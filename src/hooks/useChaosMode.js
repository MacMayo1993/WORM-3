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
import { getStickerWorldPos } from '../game/coordinates.js';
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
  const rotationCountdownRef = useRef(0);

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

    // ── Opt #1: seed metrics once at activation (surface scan, not RAF scan) ─
    {
      const sc = surfaceCoordsRef.current;
      const { disparity, flipActive, edgeTotal } = computeChaosMetrics(cubiesRef.current, sc);
      disparityRef.current = disparity;
      flipPctRef.current = edgeTotal > 0 ? Math.round((flipActive / edgeTotal) * 100) : 0;
    }

    let raf = 0, last = performance.now(), tickAcc = 0, cooldownAcc = 0;
    let wasAnimating = !!animStateRef.current;

    const delayByLevel = [0, 350, 250, 150, 80];
    const basePropByLevel = [0, 0.50, 0.65, 0.80, 0.92];
    const decayByLevel = [0, 0.70, 0.78, 0.84, 0.90];
    const cooldownByLevel = [0, 1500, 1000, 700, 400];

    const tickPeriod = delayByLevel[chaosLevel] || 250;
    const basePropagation = basePropByLevel[chaosLevel] || 0.65;
    const strengthDecay = decayByLevel[chaosLevel] || 0.78;
    const chainCooldown = cooldownByLevel[chaosLevel] || 1000;

    let currentChainTile = null;
    let chainStrength = 1.0;
    let inCooldown = false;
    let visitedSet = new Set();

    // ── Opt #8: iterate surface coords only, no isOnEdge() guard needed ──────
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
        // No flipped tiles exist yet — auto-seed one random surface sticker so
        // chaos bootstraps itself without needing a manual player flip.
        const freshPool = [];
        for (const [x, y, z] of surfCoords) {
          const c = state[x][y][z];
          for (const dirKey of Object.keys(c.stickers)) {
            freshPool.push({ x, y, z, dirKey, flips: 1 });
          }
        }
        if (!freshPool.length) return null;
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

    const stepChain = (state) => {
      const S = state.length;
      // Use cached manifold map — it only depends on cube geometry (positions/dirs),
      // not on sticker colors/flips, so it stays valid across all flip operations.
      if (!manifoldMapCacheRef.current) {
        manifoldMapCacheRef.current = buildManifoldGridMap(state, S);
      }
      const currentManifoldMap = manifoldMapCacheRef.current;

      if (!currentChainTile) {
        const start = findChainStart(state);
        if (!start) return state;
        currentChainTile = start.tile;
        chainStrength = start.strength;
        visitedSet = new Set();
        visitedSet.add(`${start.tile.x},${start.tile.y},${start.tile.z},${start.tile.dirKey}`);
      }

      const next = flipStickerPair(
        state, S,
        currentChainTile.x, currentChainTile.y, currentChainTile.z,
        currentChainTile.dirKey, currentManifoldMap
      );

      chainStrength *= strengthDecay;

      if (chainStrength < 0.1) {
        currentChainTile = null;
        chainStrength = 1.0;
        visitedSet = new Set();
        inCooldown = true;
        cooldownAcc = 0;
        return next;
      }

      const neighbors = getManifoldNeighbors(
        currentChainTile.x, currentChainTile.y, currentChainTile.z,
        currentChainTile.dirKey, S
      );

      const validNeighbors = [];
      for (const neighbor of neighbors) {
        // Skip already-visited tiles so the chain spreads outward, not back
        const nKey = `${neighbor.x},${neighbor.y},${neighbor.z},${neighbor.dirKey}`;
        if (visitedSet.has(nKey)) continue;

        const nc = next[neighbor.x]?.[neighbor.y]?.[neighbor.z];
        if (!nc) continue;
        const nst = nc.stickers[neighbor.dirKey];
        if (!nst) continue;
        // Skip dead tiles — they can no longer participate in cascades
        if ((nst.flips || 0) >= FLIP_CAP) continue;
        // Surface check: neighbor must be an outward-facing sticker (guaranteed
        // by makeCubies, so this just guards against cross-face lookup errors)
        const { x: nx, y: ny, z: nz, dirKey: nd } = neighbor;
        const S1 = S - 1;
        const onEdge = (nd === 'PX' && nx === S1) || (nd === 'NX' && nx === 0) ||
                       (nd === 'PY' && ny === S1) || (nd === 'NY' && ny === 0) ||
                       (nd === 'PZ' && nz === S1) || (nd === 'NZ' && nz === 0);
        if (!onEdge) continue;

        // Seam Lightning: cross-face neighbors and on-seam tiles get a weight boost
        const crossFace = isCrossFaceNeighbor(currentChainTile.dirKey, neighbor.dirKey);
        const onSeam = isOnSeam(neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, S);
        // Cross-face = 4x weight, on-seam = 2x weight, interior = 1x
        const seamWeight = crossFace ? 4 : onSeam ? 2 : 1;
        validNeighbors.push({ ...neighbor, flips: nst.flips || 0, seamWeight });
      }

      let nextTile = null;
      if (validNeighbors.length > 0) {
        // Seam Lightning: weighted shuffle — seam neighbors get picked first
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
          // Propagation chance: high base scaled by chain strength + small boost for flipped tiles
          const flipBoost = neighbor.flips > 0 ? 1.15 : 1.0;
          const propagateChance = chainStrength * basePropagation * flipBoost;

          if (Math.random() < propagateChance) {
            const fromPos = getStickerWorldPos(
              currentChainTile.x, currentChainTile.y, currentChainTile.z,
              currentChainTile.dirKey, S, explosionT
            );
            const toPos = getStickerWorldPos(
              neighbor.x, neighbor.y, neighbor.z,
              neighbor.dirKey, S, explosionT
            );
            const crossFace = isCrossFaceNeighbor(currentChainTile.dirKey, neighbor.dirKey);
            // A2: deduplicate — skip if an identical source→dest bolt already queued.
            // Rounds world positions to 1 dp to handle float jitter in getStickerWorldPos.
            const boltKey = `${fromPos.map(v => v.toFixed(1)).join(',')}→${toPos.map(v => v.toFixed(1)).join(',')}`;
            // A1: cap concurrent bolts — drop oldest when queue is full
            setCascades((prev) => {
              if (prev.some(c => c.key === boltKey)) return prev; // A2 dedup
              const next = [...prev, { id: Date.now() + Math.random(), key: boltKey, from: fromPos, to: toPos, crossFace }];
              return next.length > MAX_CASCADES ? next.slice(-MAX_CASCADES) : next;
            });

            nextTile = neighbor;
            break;
          }
        }
      }

      if (nextTile) {
        visitedSet.add(`${nextTile.x},${nextTile.y},${nextTile.z},${nextTile.dirKey}`);
        currentChainTile = nextTile;
      } else {
        currentChainTile = null;
        chainStrength = 1.0;
        visitedSet = new Set();
        inCooldown = true;
        cooldownAcc = 0;
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

      if (inCooldown) {
        cooldownAcc += dt;
        if (cooldownAcc >= chainCooldown) {
          inCooldown = false;
          cooldownAcc = 0;
        }
      } else {
        tickAcc += dt;

        // ── Opt #7 + C3: adaptive tick period — slows down when board is saturated ─
        // Opt #7 formula: effectivePeriod = baseTick × (1 + flipPct/100)
        //   0 % active  → 1.0× base  (full speed, conquering fresh surface)
        //  50 % active  → 1.5× base  (moderate throttle)
        // 100 % active  → 2.0× base  (half speed, board is already saturated)
        //
        // C3 — saturation brake: above 85% active, add a further linear ramp
        // so the engine breathes at extreme saturation and animations stay visible.
        //  85 % → 1.0× extra,  100 % → 3.0× extra
        //  Combined at 100 % flip + 100 % active: 2.0 × 3.0 = 6× base period
        const pct = flipPctRef.current;
        const satBrake = pct > 85 ? 1 + ((pct - 85) / 15) * 2 : 1.0;
        const effectivePeriod = tickPeriod * (1 + pct / 100) * satBrake;

        if (tickAcc >= effectivePeriod) {
          // Pre-compute outside Zustand's setter so clone3D/chain work happens
          // in the RAF callback, not inside React's state reconciliation.
          const next = stepChain(cubiesRef.current);
          if (next !== cubiesRef.current) {
            // ── Opt #1: update metrics here (once per tick) so the auto-rotate
            // RAF never has to scan the cube itself.
            const sc = surfaceCoordsRef.current;
            const { disparity, flipActive, edgeTotal } = computeChaosMetrics(next, sc);
            disparityRef.current = disparity;
            flipPctRef.current = edgeTotal > 0 ? Math.round((flipActive / edgeTotal) * 100) : 0;
            setCubies(next);
          }
          tickAcc = 0;
        }
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
