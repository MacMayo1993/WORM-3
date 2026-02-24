/**
 * useChaosMode Hook
 *
 * Manages chaos cascade system and auto-rotate effects.
 *
 * Performance optimisations applied:
 *  #1 – Disparity counter kept in a ref, updated once per chaos tick instead
 *       of being re-computed on every RAF frame (was 60×/s O(N³) scan).
 *  #7 – Effective tick period scales with ACTIVE %: the engine breathes when
 *       the board is already saturated and doesn't freeze trying to flip dead
 *       tiles at full speed.
 *  #8 – Surface-cubie list pre-computed once per cube size.  All inner loops
 *       iterate only the ~78 % of cubies that actually carry stickers, and
 *       the redundant isOnEdge() guard is dropped because every sticker that
 *       exists on a surface cubie is by construction an edge sticker.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameStore } from './useGameStore.js';
import { buildManifoldGridMap, flipStickerPair, getManifoldNeighbors, isOnSeam, isCrossFaceNeighbor } from '../game/manifoldLogic.js';
import { getStickerWorldPos, getManifoldGridId } from '../game/coordinates.js';
import { FLIP_CAP } from '../utils/constants.js';

// ─── Module-level pure helpers ────────────────────────────────────────────────

// A1: Maximum concurrent lightning bolts rendered at once.
// Oldest cascades are dropped when the queue exceeds this limit, ensuring
// useFrame count stays bounded and animations remain visible.
const MAX_CASCADES = 6;

/**
 * Build a flat list of [x, y, z] triples for every surface cubie in an S×S×S
 * cube.  Interior cubies carry no stickers and are permanently excluded.
 *
 * For S=5: 125 cubies total → 98 surface cubies (22 % saving per scan pass).
 * For S=3:  27 cubies total → 26 surface cubies.
 */
const buildSurfaceCoords = (S) => {
  const coords = [];
  for (let x = 0; x < S; x++)
    for (let y = 0; y < S; y++)
      for (let z = 0; z < S; z++)
        if (x === 0 || x === S - 1 || y === 0 || y === S - 1 || z === 0 || z === S - 1)
          coords.push([x, y, z]);
  return coords;
};

/**
 * Single-pass scan over surface cubies only.
 *
 * Returns { disparity, flipActive, edgeTotal } without calling isOnEdge()
 * because every sticker on a surface cubie is guaranteed to be an edge sticker
 * (makeCubies only adds stickers for outward-facing directions).
 */
const computeChaosMetrics = (state, surfCoords) => {
  let disparity = 0;
  let flipActive = 0;
  let edgeTotal = 0;
  for (const [x, y, z] of surfCoords) {
    const c = state[x][y][z];
    for (const key of Object.keys(c.stickers)) {
      const st = c.stickers[key];
      edgeTotal++;
      if (st.curr !== st.orig) disparity++;
      if ((st.flips || 0) > 0) flipActive++;
    }
  }
  return { disparity, flipActive, edgeTotal };
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook for chaos mode management
 */
export function useChaosMode() {
  const chaosLevel = useGameStore((state) => state.chaosLevel);
  const setChaosLevel = useGameStore((state) => state.setChaosLevel);
  const autoRotateEnabled = useGameStore((state) => state.autoRotateEnabled);
  const setAutoRotateEnabled = useGameStore((state) => state.setAutoRotateEnabled);
  const cascades = useGameStore((state) => state.cascades);
  const setCascades = useGameStore((state) => state.setCascades);
  const explosionT = useGameStore((state) => state.explosionT);
  const size = useGameStore((state) => state.size);
  const animState = useGameStore((state) => state.animState);
  const cubies = useGameStore((state) => state.cubies);
  const setCubies = useGameStore((state) => state.setCubies);

  // Auto-rotate state
  const upcomingRotation = useGameStore((state) => state.upcomingRotation);
  const setUpcomingRotation = useGameStore((state) => state.setUpcomingRotation);
  const rotationCountdown = useGameStore((state) => state.rotationCountdown);
  const setRotationCountdown = useGameStore((state) => state.setRotationCountdown);
  const setAnimState = useGameStore((state) => state.setAnimState);
  const setPendingMove = useGameStore((state) => state.setPendingMove);

  const chaosMode = chaosLevel > 0;

  const cubiesRef = useRef(cubies);
  cubiesRef.current = cubies;
  const pendingMoveRef = useRef(null);

  // Cache the manifold map between ticks — it only changes on face rotations,
  // not on sticker flips, so rebuilding every 100ms is wasteful.
  const manifoldMapCacheRef = useRef(null);
  const animStateRef = useRef(animState);
  animStateRef.current = animState;

  // ── Auto-rotate refs — kept up-to-date every render so the merged RAF loop
  // can read current values without re-subscribing on every state change.
  // Previously these were closed over inside a second RAF, causing the loop to
  // restart (and reset lastTimestamp) on every upcomingRotation / animState change.
  const autoRotateEnabledRef = useRef(autoRotateEnabled);
  autoRotateEnabledRef.current = autoRotateEnabled;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const upcomingRotationRef = useRef(upcomingRotation);
  upcomingRotationRef.current = upcomingRotation;
  // Countdown held in a ref so the RAF body mutates it without triggering React
  // re-renders on every frame; setRotationCountdown is called only at key events.
  const _rotationCountdownRef = useRef(0);

  // ── Opt #8: surface coords list, rebuilt only when cube size changes ────────
  const surfaceCoords = useMemo(() => buildSurfaceCoords(size), [size]);
  const surfaceCoordsRef = useRef(surfaceCoords);
  surfaceCoordsRef.current = surfaceCoords;

  // ── Opt #1: disparity + flipPct stored in refs, updated once per tick ──────
  // The auto-rotate RAF reads these refs instead of scanning the full cube.
  const disparityRef = useRef(0);
  const flipPctRef = useRef(0); // 0-100

  // Generate a random rotation
  const generateRandomRotation = useCallback((cubeSize) => {
    const axes = ['col', 'row', 'depth'];
    const axis = axes[Math.floor(Math.random() * axes.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const sliceIndex = Math.floor(Math.random() * cubeSize);
    return { axis, dir, sliceIndex };
  }, []);

  // Chaos chain propagation effect
  useEffect(() => {
    if (!chaosMode) return;

    // ── Opt #1: seed metrics once at activation ───────────────────────────────
    {
      const sc = surfaceCoordsRef.current;
      const { disparity, flipActive, edgeTotal } = computeChaosMetrics(cubiesRef.current, sc);
      disparityRef.current = disparity;
      flipPctRef.current = edgeTotal > 0 ? Math.round((flipActive / edgeTotal) * 100) : 0;
    }

    // Reset disparity death log each time chaos starts fresh
    useGameStore.getState().clearDisparityGame();

    let raf = 0, last = performance.now(), tickAcc = 0;
    let wasAnimating = !!animStateRef.current;

    // ── Death-tracking state for Disparity Mode ────────────────────────────
    const deadTileSet = new Set(); // keys of already-dead stickers
    let deathRank = 0;
    let pairDeathCount = 0; // one increment per tick that produces deaths (pair grouping)
    let winnerAnnounced = false;

    // ── Level config: 5 levels (index 0 = off) ───────────────────────────────
    // L1: single slow chain — intro to the mechanic
    // L2: single chain, faster propagation
    // L3: two independent chains, stochastic activation timing
    // L4: two chains, higher rates
    // L5: three chains, same rates as L4
    const numChainsByLevel = [0, 1, 1, 2, 2, 3];
    const delayByLevel     = [0, 380, 220, 200, 130, 130];
    const basePropByLevel  = [0, 0.45, 0.72, 0.65, 0.85, 0.85];
    const decayByLevel     = [0, 0.72, 0.82, 0.78, 0.88, 0.88];
    const cooldownByLevel  = [0, 1600, 900,  800,  450,  450];

    // Scale chain count proportionally with surface sticker count relative to 3×3.
    // 3×3=54 stickers → scale 1×; 4×4=96 → 2×; 5×5=150 → 3×.
    // This keeps chaos density (flips/sec/sticker) consistent across cube sizes.
    const surfaceStickers = size * size * 6;
    const sizeScale = Math.max(1, Math.ceil(surfaceStickers / 54));
    const numChains = (numChainsByLevel[chaosLevel] || 1) * sizeScale;
    const tickPeriod     = delayByLevel[chaosLevel]    || 250;
    const basePropagation = basePropByLevel[chaosLevel] || 0.65;
    const strengthDecay  = decayByLevel[chaosLevel]    || 0.78;
    const chainCooldown  = cooldownByLevel[chaosLevel] || 1000;

    // ── Per-chain state objects — each chain is fully independent ─────────────
    // cooldownDuration is randomised on each restart (stochastic desync for L3+).
    const chains = Array.from({ length: numChains }, () => ({
      tile: null,
      strength: 1.0,
      visited: new Set(),
      inCooldown: false,
      cooldownAcc: 0,
      cooldownDuration: chainCooldown,
    }));

    // ── Opt #8: iterate surface coords only ───────────────────────────────────
    const findChainStart = (state) => {
      const surfCoords = surfaceCoordsRef.current;
      const candidates = [];

      for (const [x, y, z] of surfCoords) {
        const c = state[x][y][z];
        for (const [dirKey, st] of Object.entries(c.stickers)) {
          if (st.flips > 0 && st.flips < FLIP_CAP) {
            candidates.push({ x, y, z, dirKey, flips: st.flips });
          }
        }
      }

      if (!candidates.length) {
        // No eligible flipped tiles — seed a random unflipped, non-dead sticker
        // so chaos bootstraps itself on a clean board.
        // Fix: explicitly exclude dead tiles so 5×5 boards with saturated stickers
        // don't get stuck picking tiles that can never propagate.
        const freshPool = [];
        for (const [x, y, z] of surfCoords) {
          const c = state[x][y][z];
          for (const [dirKey, st] of Object.entries(c.stickers)) {
            if ((st.flips || 0) < FLIP_CAP) {
              freshPool.push({ x, y, z, dirKey, flips: 1 });
            }
          }
        }
        if (!freshPool.length) return null; // entire board is dead — nothing to do
        return { tile: freshPool[Math.floor(Math.random() * freshPool.length)], strength: 1.0 };
      }

      const totalWeight = candidates.reduce((sum, c) => sum + c.flips, 0);
      let roll = Math.random() * totalWeight;
      for (const c of candidates) {
        roll -= c.flips;
        if (roll <= 0) return { tile: c, strength: 1.0 };
      }
      return { tile: candidates[candidates.length - 1], strength: 1.0 };
    };

    // Steps one chain forward by one tile and mutates the chain object in place.
    // Returns the next cubies state (same reference if no flip happened).
    const stepSingleChain = (state, chain) => {
      const S = state.length;
      if (!manifoldMapCacheRef.current) {
        manifoldMapCacheRef.current = buildManifoldGridMap(state, S);
      }
      const currentManifoldMap = manifoldMapCacheRef.current;

      if (!chain.tile) {
        const start = findChainStart(state);
        if (!start) {
          // Board fully dead — go to cooldown and try again later
          chain.inCooldown = true;
          chain.cooldownAcc = 0;
          chain.cooldownDuration = chainCooldown;
          return state;
        }
        chain.tile = start.tile;
        chain.strength = start.strength;
        chain.visited = new Set();
        chain.visited.add(`${start.tile.x},${start.tile.y},${start.tile.z},${start.tile.dirKey}`);
      }

      const next = flipStickerPair(
        state, S,
        chain.tile.x, chain.tile.y, chain.tile.z,
        chain.tile.dirKey, currentManifoldMap
      );

      chain.strength *= strengthDecay;

      if (chain.strength < 0.1) {
        // Chain exhausted — reset immediately so chaos never stalls.
        // Cooldown is reserved only for the board-fully-dead case (findChainStart returns null).
        chain.tile = null;
        chain.strength = 1.0;
        chain.visited = new Set();
        return next;
      }

      const neighbors = getManifoldNeighbors(
        chain.tile.x, chain.tile.y, chain.tile.z,
        chain.tile.dirKey, S
      );

      const validNeighbors = [];
      for (const neighbor of neighbors) {
        const nKey = `${neighbor.x},${neighbor.y},${neighbor.z},${neighbor.dirKey}`;
        if (chain.visited.has(nKey)) continue;

        const nc = next[neighbor.x]?.[neighbor.y]?.[neighbor.z];
        if (!nc) continue;
        const nst = nc.stickers[neighbor.dirKey];
        if (!nst) continue;
        if ((nst.flips || 0) >= FLIP_CAP) continue;
        const { x: nx, y: ny, z: nz, dirKey: nd } = neighbor;
        const S1 = S - 1;
        const onEdge = (nd === 'PX' && nx === S1) || (nd === 'NX' && nx === 0) ||
                       (nd === 'PY' && ny === S1) || (nd === 'NY' && ny === 0) ||
                       (nd === 'PZ' && nz === S1) || (nd === 'NZ' && nz === 0);
        if (!onEdge) continue;

        const crossFace = isCrossFaceNeighbor(chain.tile.dirKey, neighbor.dirKey);
        const onSeam = isOnSeam(neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, S);
        const seamWeight = crossFace ? 4 : onSeam ? 2 : 1;
        validNeighbors.push({ ...neighbor, flips: nst.flips || 0, seamWeight, crossFace });
      }

      let nextTile = null;
      if (validNeighbors.length > 0) {
        const sorted = [];
        const pool = [...validNeighbors];
        while (pool.length > 0) {
          let roll = Math.random() * pool.reduce((s, n) => s + n.seamWeight, 0);
          let pick = pool.length - 1;
          for (let i = 0; i < pool.length; i++) {
            roll -= pool[i].seamWeight;
            if (roll <= 0) { pick = i; break; }
          }
          sorted.push(pool.splice(pick, 1)[0]);
        }

        for (const neighbor of sorted) {
          const flipBoost = neighbor.flips > 0 ? 1.15 : 1.0;
          const propagateChance = chain.strength * basePropagation * flipBoost;

          if (Math.random() < propagateChance) {
            const fromPos = getStickerWorldPos(
              chain.tile.x, chain.tile.y, chain.tile.z,
              chain.tile.dirKey, S, explosionT
            );
            const toPos = getStickerWorldPos(
              neighbor.x, neighbor.y, neighbor.z,
              neighbor.dirKey, S, explosionT
            );
            const boltKey = `${fromPos.map(v => v.toFixed(1)).join(',')}→${toPos.map(v => v.toFixed(1)).join(',')}`;
            setCascades((prev) => {
              if (prev.some(c => c.key === boltKey)) return prev;
              const n2 = [...prev, { id: Date.now() + Math.random(), key: boltKey, from: fromPos, to: toPos, crossFace: neighbor.crossFace }];
              return n2.length > MAX_CASCADES ? n2.slice(-MAX_CASCADES) : n2;
            });
            nextTile = neighbor;
            break;
          }
        }
      }

      if (nextTile) {
        chain.visited.add(`${nextTile.x},${nextTile.y},${nextTile.z},${nextTile.dirKey}`);
        chain.tile = nextTile;
      } else {
        // No valid neighbor found — reset immediately and pick a new start next tick.
        chain.tile = null;
        chain.strength = 1.0;
        chain.visited = new Set();
      }

      return next;
    };

    const loop = (now) => {
      const dt = now - last;
      last = now;

      // When a face rotation completes, cube geometry changes — invalidate the cache.
      const isAnimating = !!animStateRef.current;
      if (wasAnimating && !isAnimating) {
        manifoldMapCacheRef.current = null;
      }
      wasAnimating = isAnimating;

      // Advance each chain's cooldown independently
      for (const chain of chains) {
        if (chain.inCooldown) {
          chain.cooldownAcc += dt;
          if (chain.cooldownAcc >= chain.cooldownDuration) {
            chain.inCooldown = false;
            chain.cooldownAcc = 0;
          }
        }
      }

      tickAcc += dt;

      // Gentle adaptive period — slows by at most 1.5× at full saturation.
      // Replaces the old satBrake which could reach 6× and stall 5×5 boards.
      const pct = flipPctRef.current;
      const effectivePeriod = tickPeriod * (1 + pct / 200);

      if (tickAcc >= effectivePeriod) {
        let state = cubiesRef.current;
        let changed = false;

        for (const chain of chains) {
          if (chain.inCooldown) continue;
          const next = stepSingleChain(state, chain);
          if (next !== state) {
            state = next;
            changed = true;
          }
        }

        if (changed) {
          const sc = surfaceCoordsRef.current;
          const { disparity, flipActive, edgeTotal } = computeChaosMetrics(state, sc);
          disparityRef.current = disparity;
          flipPctRef.current = edgeTotal > 0 ? Math.round((flipActive / edgeTotal) * 100) : 0;

          // ── Disparity Mode: detect newly dead tiles each tick ─────────────
          const S = sizeRef.current;
          let alive = 0;
          const newDeaths = [];
          for (const [x, y, z] of sc) {
            const c = state[x][y][z];
            for (const [dirKey, st] of Object.entries(c.stickers)) {
              if ((st.flips || 0) >= FLIP_CAP) {
                const k = `${x},${y},${z},${dirKey}`;
                if (!deadTileSet.has(k)) { deadTileSet.add(k); newDeaths.push(st); }
              } else {
                alive++;
              }
            }
          }
          if (newDeaths.length > 0) {
            pairDeathCount++;
            const store = useGameStore.getState();
            for (const st of newDeaths) {
              deathRank++;
              store.addDisparityDeath({ id: Date.now() + Math.random(), gridId: getManifoldGridId(st, S), rank: deathRank, pairRank: pairDeathCount, timestamp: Date.now() });
            }
          }
          if (!winnerAnnounced && alive === 1) {
            winnerAnnounced = true;
            outer: for (const [x, y, z] of sc) {
              const c = state[x][y][z];
              for (const [_dirKey, st] of Object.entries(c.stickers)) {
                if ((st.flips || 0) < FLIP_CAP) {
                  useGameStore.getState().setDisparityWinner({ gridId: getManifoldGridId(st, S) });
                  useGameStore.getState().setChaosLevel(0);
                  break outer;
                }
              }
            }
          }

          setCubies(state);
        }
        tickAcc = 0;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [chaosMode, chaosLevel, explosionT, setCubies, setCascades]);

  // Auto-rotate effect
  useEffect(() => {
    if (!autoRotateEnabled || !chaosMode) {
      setUpcomingRotation(null);
      setRotationCountdown(0);
      return;
    }

    if (!upcomingRotation) {
      setUpcomingRotation(generateRandomRotation(size));
    }

    let raf = 0;
    let last = performance.now();

    const loop = (now) => {
      const dt = now - last;
      last = now;

      if (animState) {
        raf = requestAnimationFrame(loop);
        return;
      }

      // ── Opt #1: read pre-computed disparity from ref — zero cube scan ───────
      const disparity = disparityRef.current;
      const maxDisparity = size * size * 6;
      const disparityRatio = Math.min(1, disparity / maxDisparity);

      const maxInterval = 10000;
      const minInterval = 750;
      const targetInterval = maxInterval - disparityRatio * (maxInterval - minInterval);

      setRotationCountdown((prev) => {
        const newCountdown = prev - dt;

        if (newCountdown <= 0) {
          if (upcomingRotation) {
            const { axis, dir, sliceIndex } = upcomingRotation;
            setAnimState({ axis, dir, sliceIndex, t: 0 });
            const move = { axis, dir, sliceIndex };
            setPendingMove(move);
            pendingMoveRef.current = move;
          }
          setUpcomingRotation(generateRandomRotation(size));
          return targetInterval;
        }

        return newCountdown;
      });

      raf = requestAnimationFrame(loop);
    };

    // ── Opt #1: read pre-computed disparity ref for initial countdown ─────────
    const disparity = disparityRef.current;
    const maxDisparity = size * size * 6;
    const disparityRatio = Math.min(1, disparity / maxDisparity);
    const initialInterval = 10000 - disparityRatio * 9250;
    setRotationCountdown(initialInterval);

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoRotateEnabled, chaosMode, size, animState, upcomingRotation, generateRandomRotation, setAnimState, setPendingMove, setUpcomingRotation, setRotationCountdown]);

  // Cascade completion handler
  const onCascadeComplete = useCallback((id) => {
    setCascades((prev) => prev.filter((c) => c.id !== id));
  }, [setCascades]);

  return {
    // State
    chaosLevel,
    chaosMode,
    autoRotateEnabled,
    cascades,
    upcomingRotation,
    rotationCountdown,

    // Actions
    setChaosLevel,
    setAutoRotateEnabled,
    setCascades,
    onCascadeComplete,
  };
}
