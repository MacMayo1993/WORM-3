// src/game/chaosSim.js
// The chaos-mode simulation core: chain walks, Conway generations, the death
// ledger, and winner detection — extracted from the chaos worker into a pure
// factory so it can be unit-tested and driven headless (e.g. to measure round
// durations for SPEED bet odds). The worker is a thin scheduling/postMessage
// adapter around this module; keep ALL game rules here.
//
// The `now` option injects the clock used for death timestamps, letting a
// harness run rounds in virtual time.

import { rotateSliceCubies } from './cubeRotation.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { getManifoldGridId, faceRCFor, getStickerWorldPos } from './gridIds.js';
import {
  buildManifoldGridMap,
  findAntipodalStickerByGrid,
  getManifoldNeighbors,
  isOnSeam,
  isCrossFaceNeighbor,
} from './manifoldLogic.js';
import { buildSurfaceCoords, computeChaosMetrics } from './chaosMetrics.js';

const MAX_LEVEL = 5;

// ─── Conway's Game of Life propagation rules ─────────────────────────────────
// Each level uses a different B/S rulestring adapted for the 4–6 neighbor
// manifold grid. Chains ignite; Conway spreads and recovers.
//
// "Infected" = flips > 0 && flips < flipCap (alive in Conway terms)
// Birth: healthy sticker gains a flip if infected-neighbor count ∈ birthSet
// Survival: infected sticker keeps its flips if infected-neighbor count ∈ surviveSet
// Recovery: infected sticker loses a flip if it FAILS the survival check

// Pacing retuned 2026-07 ("tiles dying way too slowly"): pre-tune medians ran
// 5–14 min at the standard cap. Targets are monotonic L1→L5, roughly 4–1 min
// at cap 15. Re-run scripts/measureSpeedOdds.mjs and refresh SPEED_MEDIANS in
// utils/disparityBetting.js after ANY change to the constants below.
export const CONWAY_RULES = [
  null, // index 0 unused
  // L1: B3/S12 — gentle Life analog for 4-neighbor grid; self-regulating
  { birth: new Set([3]), survive: new Set([1, 2]), recoveryRate: 0.22, period: 1600 },
  // L2: B23/S12 — HighLife analog; replicator-like spread from 2 neighbors
  { birth: new Set([2, 3]), survive: new Set([1, 2]), recoveryRate: 0.18, period: 1300 },
  // L3: B2/S — Seeds analog; explosive but ephemeral, constant turnover
  { birth: new Set([2]), survive: new Set([]), recoveryRate: 0.35, period: 1100 },
  // L4: B34/S234 — Day & Night inspired; mirrors antipodal duality
  { birth: new Set([3, 4]), survive: new Set([2, 3, 4]), recoveryRate: 0.12, period: 1000 },
  // L5: B12/S1234 — aggressive; spreads fast, very persistent, hard to kill
  { birth: new Set([1, 2]), survive: new Set([1, 2, 3, 4]), recoveryRate: 0.08, period: 800 },
];

// Conway generation cadence per level (BASE ms between full-surface evaluations).
// Actual period is scaled up by sizePenalty for larger cubes.
export const conwayPeriodByLevel = [0, 1600, 1300, 1100, 1000, 800];
// Max births per Conway tick (absolute cap regardless of cube size)
export const conwayBirthCapByLevel = [0, 4, 4, 6, 5, 7];
// Max recoveries per Conway tick
export const conwayRecoveryCapByLevel = [0, 2, 2, 3, 2, 2];

// Level profile (1..5):
// L1-L2: sparse, exploratory spread
// L3-L4: sustained chain movement
// L5: high propagation with fast cadence
export const numChainsByLevel = [0, 2, 2, 3, 3, 3];
export const delayByLevel = [0, 280, 250, 180, 160, 110];
export const basePropByLevel = [0, 0.50, 0.60, 0.70, 0.80, 0.88];
export const decayByLevel = [0, 0.82, 0.82, 0.86, 0.90, 0.94];
export const cooldownByLevel = [0, 800, 700, 550, 400, 260]; // ms — compared against cooldownAcc (real ms)
export const chainCapByLevel = [0, 2, 3, 4, 5, 6];

// Size penalty: slows tick frequency and caps chains on larger cubes.
// 3x3→1.0, 4x4→1.2, 5x5→1.5, 6x6→1.8, 7x7→2.1
export const computeSizePenalty = (S) => 1 + (S - 3) * 0.35;

export const computeSizeScale = (stickers) => {
  // Chain count multiplier. Kept at 1 for cubes ≤5x5; only bump to 2 for 6x6+.
  // Previous formula (ceil(stickers/96)) gave 4× on 7x7 which overloaded the main thread.
  if (stickers <= 150) return 1; // 3x3=54, 4x4=96, 5x5=150
  return 2; // 6x6=216, 7x7=294
};

// Maximum total operations (flips + cascades) the chain tick can emit per cycle.
// Prevents burst frames from overwhelming the main-thread React reconciler.
// Raised 6 → 9 with the 2026-07 pacing retune so the extra chains aren't
// starved by the budget; still a trivial per-commit batch for React.
export const MAX_OPS_PER_CHAIN_TICK = 9;

const DIR_TO_FACE = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };

// Uniformly sample k items from arr (partial Fisher–Yates; mutates arr's order).
const sampleK = (arr, k) => {
  if (arr.length <= k) return arr;
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  arr.length = k;
  return arr;
};

export function createChaosSim({ cubies, size, chaosLevel, flipCap, explosionT = 0, animating = false, now = Date.now }) {
  let state = cubies;
  let currentLevel = chaosLevel;
  let cap = flipCap;
  let explosion = explosionT;
  let paused = animating;

  let manifoldMapCache = null;
  let neighborCache = null;
  const surfaceCoords = buildSurfaceCoords(size);
  const surfaceStickers = size * size * 6;

  // Cached result of the last computeChaosMetrics call.
  // Only refreshed when didWork is true, so the O(n) scan is skipped on idle ticks.
  let cachedMetrics = computeChaosMetrics(state, surfaceCoords, cap);

  let chains = [];
  // Living sticker index: Map<"x,y,z,dirKey", {x,y,z,dirKey}>.
  // Maintained incrementally; dead-tile removal is O(1) vs O(n) array splice.
  let livingStickers = new Map();
  let deadTileSet = new Set();
  let deathRank = 0;
  let pairDeathCount = 0;
  let winnerAnnounced = false;
  let faceAliveMap = new Map([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]]);

  const clampLevel = () => Math.max(1, Math.min(MAX_LEVEL, currentLevel));

  const withFlipPct = (m) => ({
    ...m,
    flipPct: m.edgeTotal > 0 ? Math.round((m.flipActive / m.edgeTotal) * 100) : 0,
  });

  // After a cube rotation every sticker's physical (x,y,z,dirKey) changes.
  // Rebuild the physical-key index from the new positions so death checks
  // delete the correct slot and findChainStart reads the right stickers.
  const rebuildLivingStickers = () => {
    livingStickers = new Map();
    for (const [x, y, z] of surfaceCoords) {
      for (const dirKey of Object.keys(state[x][y][z].stickers)) {
        const st = state[x][y][z].stickers[dirKey];
        if (!deadTileSet.has(getManifoldGridId(st, size))) {
          livingStickers.set(`${x},${y},${z},${dirKey}`, { x, y, z, dirKey });
        }
      }
    }
  };

  const flipStickerPairLocal = (x, y, z, dirKey, outFlips) => {
    const sticker = state[x]?.[y]?.[z]?.stickers?.[dirKey];
    if (!sticker) return;

    const applyFlip = (loc, emitOp = false) => {
      if (!loc) return;
      const st = state[loc.x][loc.y][loc.z].stickers[loc.dirKey];
      const currentFlips = st.flips || 0;
      if (currentFlips >= cap) return;
      st.curr = ANTIPODAL_COLOR[st.curr];
      st.flips = Math.min(cap, currentFlips + 1);
      if (emitOp) outFlips.push([loc.x, loc.y, loc.z, loc.dirKey]);
    };

    // Emit exactly ONE operation per pair-step.
    // Main-thread replay uses flipStickerPair(), which already flips both members.
    // Emitting both locations would double-apply and visually cancel color flips.
    applyFlip({ x, y, z, dirKey }, true);
    applyFlip(findAntipodalStickerByGrid(manifoldMapCache, sticker, size), false);
  };

  const recoverStickerPairLocal = (x, y, z, dirKey, outRecoveries) => {
    const sticker = state[x]?.[y]?.[z]?.stickers?.[dirKey];
    if (!sticker) return;

    const applyRecover = (loc, emitOp = false) => {
      if (!loc) return;
      const st = state[loc.x][loc.y][loc.z].stickers[loc.dirKey];
      const currentFlips = st.flips || 0;
      if (currentFlips <= 0 || currentFlips >= cap) return;
      st.curr = ANTIPODAL_COLOR[st.curr];
      st.flips = currentFlips - 1;
      if (emitOp) outRecoveries.push([loc.x, loc.y, loc.z, loc.dirKey]);
    };

    applyRecover({ x, y, z, dirKey }, true);
    applyRecover(findAntipodalStickerByGrid(manifoldMapCache, sticker, size), false);
  };

  // ─── Death bookkeeping (shared by chain and Conway ticks) ──────────────────

  // Collect a death at loc if its sticker just hit the flip cap: mark it dead
  // and drop it from the living index. Actual event emission happens in
  // registerDeaths so a pair dying together shares one pairRank.
  const collectDeathAt = (loc, pending) => {
    if (!loc) return;
    const st = state[loc.x]?.[loc.y]?.[loc.z]?.stickers?.[loc.dirKey];
    if (!st) return;
    const gridId = getManifoldGridId(st, size);
    if ((st.flips || 0) >= cap && !deadTileSet.has(gridId) && surfaceStickers - deadTileSet.size > 2) {
      deadTileSet.add(gridId);
      pending.push({ st, gridId, ...loc });
      // O(1) removal — Map key matches the format used when inserting.
      livingStickers.delete(`${loc.x},${loc.y},${loc.z},${loc.dirKey}`);
    }
  };

  // Assign ranks, emit death events, and decrement face-alive counts (emitting
  // face eliminations when a face's last tile dies). Returns true if any died.
  const registerDeaths = (pending, outDeaths, outEliminatedFaces) => {
    if (!pending.length) return false;
    pairDeathCount += 1;
    for (const { st, gridId, x, y, z, dirKey } of pending) {
      deathRank += 1;
      const { r, c } = faceRCFor(dirKey, x, y, z, size);
      const endFaceId = DIR_TO_FACE[dirKey] ?? st.curr;
      const endGridId = `M${endFaceId}-${String(r * size + c + 1).padStart(3, '0')}`;
      outDeaths.push({ gridId, endGridId, rank: deathRank, pairRank: pairDeathCount, timestamp: now() });

      const faceNum = st.orig;
      if (faceNum) {
        const prev = faceAliveMap.get(faceNum) ?? 1;
        const next = Math.max(0, prev - 1);
        faceAliveMap.set(faceNum, next);
        if (next === 0) outEliminatedFaces.push(faceNum);
      }
    }
    return true;
  };

  // Check a sticker and its antipodal partner for cap-deaths and register them.
  const checkPairDeaths = (loc, outDeaths, outEliminatedFaces) => {
    const pending = [];
    collectDeathAt(loc, pending);
    const st = state[loc.x]?.[loc.y]?.[loc.z]?.stickers?.[loc.dirKey];
    if (st && manifoldMapCache) {
      collectDeathAt(findAntipodalStickerByGrid(manifoldMapCache, st, size), pending);
    }
    return registerDeaths(pending, outDeaths, outEliminatedFaces);
  };

  // preserveDeaths: keep the death ledger (deadTileSet, ranks, face counts,
  // winner flag) across the reset. Used for mid-round chaos-level changes so a
  // level switch doesn't resurrect dead tiles or re-fire face eliminations.
  const resetChainState = (preserveDeaths = false) => {
    if (!preserveDeaths) {
      deadTileSet = new Set();
      deathRank = 0;
      pairDeathCount = 0;
      winnerAnnounced = false;
      faceAliveMap = new Map([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]]);
    }
    neighborCache = null;

    // Rebuild the living-sticker index (skips tiles already in deadTileSet).
    rebuildLivingStickers();
    // Seed face alive counts HERE, before any tick runs, so that death tracking
    // on tick 1 never sees a zero-count face and fires false elimination events.
    if (!preserveDeaths) {
      for (const [x, y, z] of surfaceCoords) {
        const c = state[x][y][z];
        for (const st of Object.values(c.stickers)) {
          if (st.orig) faceAliveMap.set(st.orig, (faceAliveMap.get(st.orig) ?? 0) + 1);
        }
      }
    }

    const level = clampLevel();
    const sizeScale = computeSizeScale(surfaceStickers);
    const rawChains = (numChainsByLevel[level] || 1) * sizeScale;
    const numChains = Math.min(rawChains, chainCapByLevel[level] || rawChains);
    const chainCooldown = cooldownByLevel[level] || 1000;
    chains = Array.from({ length: numChains }, () => ({
      tile: null,
      strength: 1,
      visited: new Set(),
      inCooldown: false,
      cooldownAcc: 0,
      cooldownDuration: chainCooldown,
    }));
  };

  const findChainStart = () => {
    // Use the living-sticker index instead of scanning all surfaceCoords.
    // livingStickers is maintained incrementally; dead tiles are removed on death.
    if (!livingStickers.size) return null;

    // Single-pass weighted reservoir sampling (Efraimidis–Spirakis).
    // Avoids building a full candidates array on large cubes (294 stickers on 7x7).
    // Weight = flips² so chains concentrate on near-dead tiles.
    let bestTile = null;
    let bestKey = -Infinity;
    let anyFlipped = false;

    for (const { x, y, z, dirKey } of livingStickers.values()) {
      const st = state[x][y][z].stickers[dirKey];
      const flips = st.flips || 0;
      if (flips <= 0) continue;
      anyFlipped = true;
      const weight = flips * flips;
      const key = Math.pow(Math.random(), 1 / weight);
      if (key > bestKey) {
        bestKey = key;
        bestTile = { x, y, z, dirKey, flips };
      }
    }

    if (!anyFlipped) {
      // No flipped tiles yet — pick a random living tile as a fresh start.
      // Use index-based random pick to avoid spreading all values into an array.
      const targetIdx = Math.floor(Math.random() * livingStickers.size);
      let idx = 0;
      for (const loc of livingStickers.values()) {
        if (idx === targetIdx) return { tile: { ...loc, flips: 1 }, strength: 1 };
        idx++;
      }
    }

    return bestTile ? { tile: bestTile, strength: 1 } : null;
  };

  const buildNeighborCache = () => {
    const cache = new Map();
    for (const [x, y, z] of surfaceCoords) {
      if (!state[x]?.[y]?.[z]) continue;
      for (const dirKey of Object.keys(state[x][y][z].stickers)) {
        cache.set(`${x},${y},${z},${dirKey}`, getManifoldNeighbors(x, y, z, dirKey, size));
      }
    }
    return cache;
  };

  // ─── Conway Generation Evaluation ───────────────────────────────────────────
  // Evaluates all living stickers simultaneously against the current level's B/S
  // rulestring. Returns births (new infections) and recoveries (healed stickers).
  const conwayTick = () => {
    if (!state || paused || winnerAnnounced) return null;
    if (!manifoldMapCache) manifoldMapCache = buildManifoldGridMap(state, size);
    if (!neighborCache) neighborCache = buildNeighborCache();

    const level = clampLevel();
    const rules = CONWAY_RULES[level];
    if (!rules) return null;

    const { birth: birthSet, survive: surviveSet, recoveryRate } = rules;
    const birthCap = conwayBirthCapByLevel[level] || 4;
    const recoveryCap = conwayRecoveryCapByLevel[level] || 3;

    const birthCandidates = []; // [x,y,z,dirKey] — healthy stickers eligible to infect
    const recoveryCandidates = []; // [x,y,z,dirKey] — infected stickers eligible to heal
    const cascades = [];

    // Snapshot: evaluate all stickers against current state (synchronous generation)
    for (const [key, loc] of livingStickers) {
      const st = state[loc.x]?.[loc.y]?.[loc.z]?.stickers?.[loc.dirKey];
      if (!st) continue;

      const neighbors = neighborCache.get(key);
      if (!neighbors) continue;

      // Count infected neighbors (flips > 0 and not dead)
      let infectedCount = 0;
      for (const n of neighbors) {
        const nst = state[n.x]?.[n.y]?.[n.z]?.stickers?.[n.dirKey];
        if (nst && (nst.flips || 0) > 0 && (nst.flips || 0) < cap) {
          infectedCount++;
        }
      }

      const isInfected = (st.flips || 0) > 0;
      if (!isInfected) {
        // Birth check: healthy sticker with right number of infected neighbors
        if (birthSet.has(infectedCount)) {
          birthCandidates.push([loc.x, loc.y, loc.z, loc.dirKey]);
        }
      } else {
        // Survival check: infected sticker without enough support recovers
        if (!surviveSet.has(infectedCount) && Math.random() < recoveryRate) {
          recoveryCandidates.push([loc.x, loc.y, loc.z, loc.dirKey]);
        }
      }
    }

    // Sample the per-tick caps uniformly from the full candidate pools. Taking
    // the first N as candidates appear would always favour stickers early in
    // livingStickers' insertion order — a deterministic spatial bias.
    const births = sampleK(birthCandidates, birthCap);
    const recoveries = sampleK(recoveryCandidates, recoveryCap);

    // Apply births (flip sticker + antipodal pair)
    const outFlips = [];
    const outDeaths = [];
    const outEliminatedFaces = [];
    for (const [x, y, z, dirKey] of births) {
      flipStickerPairLocal(x, y, z, dirKey, outFlips);
      // A birth can push the antipodal partner (or, with flipCap 1, the sticker
      // itself) over the cap — register those deaths here just like the chain
      // tick does, so no capped tile escapes the death ledger.
      checkPairDeaths({ x, y, z, dirKey }, outDeaths, outEliminatedFaces);
      // Emit at most 2 cascade visuals per Conway tick to avoid GPU overload
      if (cascades.length < 2) {
        const neighbors = neighborCache.get(`${x},${y},${z},${dirKey}`);
        if (neighbors) {
          const infectedNeighbor = neighbors.find((n) => {
            const nst = state[n.x]?.[n.y]?.[n.z]?.stickers?.[n.dirKey];
            return nst && (nst.flips || 0) > 0 && (nst.flips || 0) < cap;
          });
          if (infectedNeighbor && !(infectedNeighbor.x === x && infectedNeighbor.y === y && infectedNeighbor.z === z)) {
            const from = getStickerWorldPos(infectedNeighbor.x, infectedNeighbor.y, infectedNeighbor.z, infectedNeighbor.dirKey, size, explosion);
            const to = getStickerWorldPos(x, y, z, dirKey, size, explosion);
            cascades.push({ from, to, crossFace: infectedNeighbor.dirKey !== dirKey });
          }
        }
      }
    }

    // Apply recoveries (decrement flip on sticker + antipodal pair)
    const outRecoveries = [];
    for (const [x, y, z, dirKey] of recoveries) {
      recoverStickerPairLocal(x, y, z, dirKey, outRecoveries);
    }

    const didWork = outFlips.length > 0 || outRecoveries.length > 0 || outDeaths.length > 0;
    return didWork
      ? { flips: outFlips, recoveries: outRecoveries, cascades, deaths: outDeaths, eliminatedFaces: [...new Set(outEliminatedFaces)] }
      : null;
  };

  // ─── Chain tick ─────────────────────────────────────────────────────────────
  // dtMs: real milliseconds elapsed since the previous tick (used for cooldown accumulation).
  const chainTick = (dtMs) => {
    if (!state || paused || winnerAnnounced) return null;
    if (!manifoldMapCache) manifoldMapCache = buildManifoldGridMap(state, size);

    const level = clampLevel();
    const basePropagation = basePropByLevel[level] || 0.65;
    const strengthDecay = decayByLevel[level] || 0.78;
    const chainCooldown = cooldownByLevel[level] || 1000;

    const flips = [];
    const cascades = [];
    const deaths = [];
    const eliminatedFaces = [];
    let producedDeaths = false;
    let opsEmitted = 0;

    for (const chain of chains) {
      // Budget gate: stop processing chains once we've emitted enough operations
      // for this tick. Remaining chains will process on the next cycle.
      if (opsEmitted >= MAX_OPS_PER_CHAIN_TICK) break;

      if (chain.inCooldown) {
        // Accumulate real ms so cooldownDuration values (ms) work as intended.
        chain.cooldownAcc += dtMs;
        if (chain.cooldownAcc >= chain.cooldownDuration) {
          chain.inCooldown = false;
          chain.tile = null;
          chain.strength = 1;
          chain.visited = new Set();
        }
        continue;
      }

      if (!chain.tile) {
        const start = findChainStart();
        if (!start) {
          chain.inCooldown = true;
          chain.cooldownAcc = 0;
          chain.cooldownDuration = chainCooldown;
          continue;
        }
        chain.tile = start.tile;
        chain.strength = start.strength;
        chain.visited = new Set([`${start.tile.x},${start.tile.y},${start.tile.z},${start.tile.dirKey}`]);
      }

      const current = chain.tile;
      flipStickerPairLocal(current.x, current.y, current.z, current.dirKey, flips);
      opsEmitted++;

      if (checkPairDeaths(current, deaths, eliminatedFaces)) {
        producedDeaths = true;
      }

      // Contagion boost: the more times THIS tile has been flipped, the more
      // readily it spreads to its neighbours — chaos snowballs as tiles take
      // damage instead of propagating at a flat rate for the tile's whole life.
      const currentSt = state[current.x]?.[current.y]?.[current.z]?.stickers?.[current.dirKey];
      const sourceCapProximity = cap > 0 ? Math.min(1, (currentSt?.flips || 0) / cap) : 0;

      chain.strength *= strengthDecay;
      if (chain.strength < 0.1) {
        chain.tile = null;
        chain.strength = 1;
        chain.visited = new Set();
        continue;
      }

      const neighbors = getManifoldNeighbors(current.x, current.y, current.z, current.dirKey, size);
      const validNeighbors = [];
      for (const neighbor of neighbors) {
        const nKey = `${neighbor.x},${neighbor.y},${neighbor.z},${neighbor.dirKey}`;
        if (chain.visited.has(nKey)) continue;
        const nst = state[neighbor.x]?.[neighbor.y]?.[neighbor.z]?.stickers?.[neighbor.dirKey];
        if (!nst || (nst.flips || 0) >= cap) continue;

        const crossFace = isCrossFaceNeighbor(chain.tile.dirKey, neighbor.dirKey);
        const nFlips = nst.flips || 0;
        // Bias the walk toward already-damaged neighbours. Without this the chain
        // wandered onto fresh tiles every step, smearing 1 flip everywhere and
        // rarely pushing any single tile over the cap. Weighting by accumulated
        // flips makes chains snowball into existing damage and convert it to kills.
        const damageWeight = 1 + nFlips * 1.5;
        const seamWeight = (crossFace ? 4 : (isOnSeam(neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, size) ? 2 : 1)) * damageWeight;
        validNeighbors.push({ ...neighbor, flips: nFlips, seamWeight, crossFace });
      }

      let poolLen = validNeighbors.length;
      while (poolLen > 0) {
        let totalWeight = 0;
        for (let i = 0; i < poolLen; i++) totalWeight += validNeighbors[i].seamWeight;
        let roll = Math.random() * totalWeight;
        let pick = poolLen - 1;
        for (let i = 0; i < poolLen; i++) {
          roll -= validNeighbors[i].seamWeight;
          if (roll <= 0) {
            pick = i;
            break;
          }
        }
        const neighbor = validNeighbors[pick];
        validNeighbors[pick] = validNeighbors[poolLen - 1];
        poolLen--;
        // Finisher boost: the closer a neighbour is to the flip cap, the more likely
        // the chain commits to it — so near-dead tiles get pushed over the edge
        // instead of being abandoned one flip short of dying. Stacked with the
        // source tile's own contagion boost (sourceCapProximity, above) so a
        // heavily-flipped tile spreads faster regardless of which neighbour it hits.
        const capProximity = cap > 0 ? neighbor.flips / cap : 0;
        const flipBoost = 1.0 + capProximity * 1.4 + sourceCapProximity * 1.0;
        const propagateChance = Math.min(1, chain.strength * basePropagation * flipBoost);
        if (Math.random() < propagateChance) {
          // Only emit a cascade bolt for hops between *different* cubies.
          // Same-cubie cross-face hops (corner NX→NY→NZ) are topologically valid but
          // produce an impact sphere right on the neighboring sticker, making it
          // appear to randomly spaz/flash even though its flip count hasn't changed.
          const sameCubie = neighbor.x === current.x && neighbor.y === current.y && neighbor.z === current.z;
          if (!sameCubie && cascades.length < 3) {
            const from = getStickerWorldPos(current.x, current.y, current.z, current.dirKey, size, explosion);
            const to = getStickerWorldPos(neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, size, explosion);
            cascades.push({ from, to, crossFace: neighbor.crossFace });
            opsEmitted++;
          }
          chain.tile = { x: neighbor.x, y: neighbor.y, z: neighbor.z, dirKey: neighbor.dirKey };
          chain.visited.add(`${neighbor.x},${neighbor.y},${neighbor.z},${neighbor.dirKey}`);
          break;
        }
      }
    }

    let winner = null;
    // The worker is the authoritative simulation. When it finishes, include a
    // complete final snapshot with the winner event so the render thread can
    // reconcile any in-flight TICK batches before revealing the result. This
    // is deliberately a snapshot (rather than just the final flip operations):
    // a busy main thread can otherwise display an older cube even though the
    // worker's death ledger has correctly narrowed the round to one pair.
    let finalState = null;
    const aliveAfterDeaths = surfaceStickers - deadTileSet.size;
    if (!winnerAnnounced && aliveAfterDeaths <= 2 && aliveAfterDeaths > 0 && deathRank > 0) {
      winnerAnnounced = true;
      // Scan state directly for alive stickers so rotations don't corrupt the list.
      // livingStickers physical keys become stale after syncCubies; deadTileSet
      // manifold IDs are rotation-stable and are the canonical source of truth.
      winner = [];
      for (const [x, y, z] of surfaceCoords) {
        for (const dirKey of Object.keys(state[x][y][z].stickers)) {
          const st = state[x][y][z].stickers[dirKey];
          if (!deadTileSet.has(getManifoldGridId(st, size))) {
            winner.push(getManifoldGridId(st, size));
          }
        }
      }
      finalState = state;
    }

    // Only recompute the O(n) metrics scan when something actually changed this tick.
    const didWork = flips.length > 0 || cascades.length > 0 || producedDeaths || !!winner;
    if (didWork) {
      cachedMetrics = computeChaosMetrics(state, surfaceCoords, cap);
    }

    return {
      flips,
      cascades,
      deaths,
      eliminatedFaces: eliminatedFaces.length > 0 ? [...new Set(eliminatedFaces)] : eliminatedFaces,
      winner,
      finalState,
      metrics: withFlipPct(cachedMetrics),
      didWork,
    };
  };

  // ─── Tick cadence ───────────────────────────────────────────────────────────
  // The scheduler (worker or test harness) asks the sim how long until each
  // tick type is due, so cadence rules live here beside the rules they pace.
  const chainPeriod = () => {
    const level = clampLevel();
    const sizePenalty = computeSizePenalty(size);
    const tickPeriod = delayByLevel[level] || 250;
    // Use cached metrics (updated each tick) to avoid iterating all stickers on every call.
    const activeRatio = cachedMetrics.edgeTotal > 0 ? (cachedMetrics.flipActive / cachedMetrics.edgeTotal) : 0;
    const chainPressure = Math.min(1, chains.length / 12);
    // sizePenalty slows the tick on large cubes so we don't flood the main thread.
    return Math.round(tickPeriod * (0.9 + activeRatio * 1.1) * (1 + chainPressure * 0.6) * sizePenalty);
  };

  const conwayPeriod = () => {
    const level = clampLevel();
    return Math.round((conwayPeriodByLevel[level] || 2000) * computeSizePenalty(size));
  };

  // ─── External state changes ─────────────────────────────────────────────────

  const rotateSlice = ({ axis, sliceIndex, dir, numTurns }) => {
    for (let i = 0; i < (numTurns ?? 1); i++) {
      state = rotateSliceCubies(state, size, axis, sliceIndex, dir);
    }
    manifoldMapCache = null;
    neighborCache = null;
    rebuildLivingStickers();
  };

  const syncCubies = (nextCubies) => {
    state = nextCubies;
    manifoldMapCache = null;
    neighborCache = null;
    rebuildLivingStickers();
  };

  const setChaosLevel = (nextLevel) => {
    currentLevel = nextLevel;
    // Preserve the death ledger: a mid-round level change re-tunes the chains
    // but must not resurrect dead tiles or re-fire face eliminations.
    resetChainState(true);
  };

  // Lowering the cap can put already-damaged tiles at/over it. Sweep them into
  // the death ledger and return the deaths as a payload — otherwise they'd be
  // stranded (too damaged to flip or recover, never registered as dead) until
  // a chain wandered by. Returns null when nothing died.
  const setFlipCap = (nextCap) => {
    const prevCap = cap;
    cap = nextCap;
    if (!state || cap >= prevCap) return null;
    if (!manifoldMapCache) manifoldMapCache = buildManifoldGridMap(state, size);
    const deaths = [];
    const eliminatedFaces = [];
    for (const loc of [...livingStickers.values()]) {
      const st = state[loc.x]?.[loc.y]?.[loc.z]?.stickers?.[loc.dirKey];
      if (st && (st.flips || 0) >= cap) {
        checkPairDeaths(loc, deaths, eliminatedFaces);
      }
    }
    if (deaths.length === 0) return null;
    cachedMetrics = computeChaosMetrics(state, surfaceCoords, cap);
    return {
      flips: [],
      cascades: [],
      recoveries: [],
      deaths,
      eliminatedFaces: [...new Set(eliminatedFaces)],
      winner: null, // winner detection stays with the next chain tick
      finalState: null,
      metrics: withFlipPct(cachedMetrics),
      didWork: true,
    };
  };

  resetChainState();

  return {
    chainTick,
    conwayTick,
    chainPeriod,
    conwayPeriod,
    rotateSlice,
    syncCubies,
    setChaosLevel,
    setFlipCap,
    setExplosion: (t) => { explosion = t ?? 0; },
    setAnimating: (b) => { paused = !!b; },
    isFinished: () => winnerAnnounced,
    getMetrics: () => withFlipPct(cachedMetrics),
    getAliveCount: () => surfaceStickers - deadTileSet.size,
    getDeadTileSet: () => deadTileSet,
    getState: () => state,
  };
}
