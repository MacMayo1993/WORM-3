import { rotateSliceCubies } from '../game/cubeRotation.js';

const ANTIPODAL_COLOR = {
  1: 4,
  2: 5,
  3: 6,
  4: 1,
  5: 2,
  6: 3,
};

const MAX_LEVEL = 5;

// ─── Conway's Game of Life propagation rules ─────────────────────────────────
// Each level uses a different B/S rulestring adapted for the 4–6 neighbor
// manifold grid. Chains ignite; Conway spreads and recovers.
//
// "Infected" = flips > 0 && flips < flipCap (alive in Conway terms)
// Birth: healthy sticker gains a flip if infected-neighbor count ∈ birthSet
// Survival: infected sticker keeps its flips if infected-neighbor count ∈ surviveSet
// Recovery: infected sticker loses a flip if it FAILS the survival check

const CONWAY_RULES = [
  null, // index 0 unused
  // L1: B3/S12 — gentle Life analog for 4-neighbor grid; self-regulating
  { birth: new Set([3]), survive: new Set([1, 2]), recoveryRate: 0.3, period: 2200 },
  // L2: B23/S12 — HighLife analog; replicator-like spread from 2 neighbors
  { birth: new Set([2, 3]), survive: new Set([1, 2]), recoveryRate: 0.25, period: 1800 },
  // L3: B2/S — Seeds analog; explosive but ephemeral, constant turnover
  { birth: new Set([2]), survive: new Set([]), recoveryRate: 0.5, period: 1400 },
  // L4: B34/S234 — Day & Night inspired; mirrors antipodal duality
  { birth: new Set([3, 4]), survive: new Set([2, 3, 4]), recoveryRate: 0.15, period: 1600 },
  // L5: B12/S1234 — aggressive; spreads fast, very persistent, hard to kill
  { birth: new Set([1, 2]), survive: new Set([1, 2, 3, 4]), recoveryRate: 0.1, period: 1000 },
];

// Conway generation cadence per level (ms between full-surface evaluations)
const conwayPeriodByLevel = [0, 2200, 1800, 1400, 1600, 1000];
// Max births per Conway tick to avoid frame spikes on large cubes
const conwayBirthCapByLevel = [0, 3, 4, 6, 5, 8];
// Max recoveries per Conway tick
const conwayRecoveryCapByLevel = [0, 2, 3, 4, 3, 2];

// Level profile (1..5):
// L1-L2: sparse, exploratory spread
// L3-L4: sustained chain movement
// L5: high propagation, but fewer starts and longer cadence to avoid frame spikes
const numChainsByLevel = [0, 1, 1, 1, 2, 2];
const delayByLevel = [0, 420, 280, 220, 170, 190];
const basePropByLevel = [0, 0.35, 0.45, 0.55, 0.65, 0.80];
const decayByLevel = [0, 0.68, 0.74, 0.80, 0.86, 0.93];
const cooldownByLevel = [0, 1700, 1100, 850, 650, 520]; // ms — compared against cooldownAcc (real ms)
const chainCapByLevel = [0, 3, 4, 6, 8, 10];

const computeSizeScale = (stickers) => {
  // Keep growth sub-linear on large cubes to avoid worker/main-thread burst
  // overload (7x7 has 294 surface stickers vs 54 on 3x3).
  // 3x3:1, 5x5:2, 6x6:3, 7x7:3
  return Math.max(1, Math.ceil(stickers / 96));
};

let state = null;
let running = false;
let timerId = null;
let size = 3;
let chaosLevel = 1;
let flipCap = 10;
let explosionT = 0;
let animating = false;
let manifoldMapCache = null;
let surfaceCoords = [];
let surfaceStickers = 54;
let tickAcc = 0;
let last = 0;

// Cached result of the last computeChaosMetrics call.
// Only refreshed when didWork is true, so the O(n) scan is skipped on idle ticks.
let cachedMetrics = { disparity: 0, flipActive: 0, edgeTotal: 1, totalFlips: 0, deadTiles: 0 };

let chains = [];
// Living sticker index: Map<"x,y,z,dirKey", {x,y,z,dirKey}>.
// Maintained incrementally; dead-tile removal is O(1) vs O(n) array splice.
let livingStickers = new Map();
let deadTileSet = new Set();
let deathRank = 0;
let pairDeathCount = 0;
let winnerAnnounced = false;
let faceAliveMap = new Map([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]]);

// Conway generation state
let conwayAcc = 0; // ms accumulator for Conway tick cadence
// Neighbor cache: Map<"x,y,z,dirKey", [{x,y,z,dirKey}, ...]>
// Built once per size, invalidated on size change. Avoids recomputing neighbors every generation.
let neighborCache = null;

const buildSurfaceCoords = (S) => {
  const coords = [];
  for (let x = 0; x < S; x++) {
    for (let y = 0; y < S; y++) {
      for (let z = 0; z < S; z++) {
        if (x === 0 || x === S - 1 || y === 0 || y === S - 1 || z === 0 || z === S - 1) {
          coords.push([x, y, z]);
        }
      }
    }
  }
  return coords;
};

const computeChaosMetrics = (cubeState, surfCoords) => {
  let disparity = 0;
  let flipActive = 0;
  let edgeTotal = 0;
  let totalFlips = 0;
  let deadTiles = 0;
  for (const [x, y, z] of surfCoords) {
    const c = cubeState[x][y][z];
    for (const key of Object.keys(c.stickers)) {
      const st = c.stickers[key];
      edgeTotal++;
      if (st.curr !== st.orig) disparity++;
      const flips = st.flips || 0;
      totalFlips += flips;
      if (flips > 0) flipActive++;
      if (flips >= flipCap) deadTiles++;
    }
  }
  return { disparity, flipActive, edgeTotal, totalFlips, deadTiles };
};

const getGridRC = (origPos, origDir, S) => {
  const { x, y, z } = origPos;
  if (origDir === 'PZ') return { r: S - 1 - y, c: x };
  if (origDir === 'NZ') return { r: S - 1 - y, c: S - 1 - x };
  if (origDir === 'PX') return { r: S - 1 - y, c: S - 1 - z };
  if (origDir === 'NX') return { r: S - 1 - y, c: z };
  if (origDir === 'PY') return { r: z, c: x };
  return { r: S - 1 - z, c: x };
};

const getManifoldGridId = (sticker, S) => {
  const { r, c } = getGridRC(sticker.origPos, sticker.origDir, S);
  const idx = r * S + c + 1;
  return `M${sticker.orig}-${String(idx).padStart(3, '0')}`;
};

const faceRCFor = (dirKey, x, y, z, S) => {
  if (dirKey === 'PZ') return { r: S - 1 - y, c: x };
  if (dirKey === 'NZ') return { r: S - 1 - y, c: S - 1 - x };
  if (dirKey === 'PX') return { r: S - 1 - y, c: S - 1 - z };
  if (dirKey === 'NX') return { r: S - 1 - y, c: z };
  if (dirKey === 'PY') return { r: z, c: x };
  return { r: S - 1 - z, c: x };
};

const getStickerWorldPos = (x, y, z, dirKey, S, explosionFactor = 0) => {
  const k = (S - 1) / 2;
  const base = [x - k, y - k, z - k];
  const exploded = [
    base[0] * (1 + explosionFactor * 1.8),
    base[1] * (1 + explosionFactor * 1.8),
    base[2] * (1 + explosionFactor * 1.8),
  ];

  const offset = 0.52;
  switch (dirKey) {
    case 'PX': return [exploded[0] + offset, exploded[1], exploded[2]];
    case 'NX': return [exploded[0] - offset, exploded[1], exploded[2]];
    case 'PY': return [exploded[0], exploded[1] + offset, exploded[2]];
    case 'NY': return [exploded[0], exploded[1] - offset, exploded[2]];
    case 'PZ': return [exploded[0], exploded[1], exploded[2] + offset];
    case 'NZ': return [exploded[0], exploded[1], exploded[2] - offset];
    default: return exploded;
  }
};

const buildManifoldGridMap = (cubies, S) => {
  const map = new Map();
  for (let x = 0; x < S; x++) {
    for (let y = 0; y < S; y++) {
      for (let z = 0; z < S; z++) {
        const c = cubies[x][y][z];
        for (const [dKey, st] of Object.entries(c.stickers)) {
          map.set(getManifoldGridId(st, S), { x, y, z, dirKey: dKey, sticker: st });
        }
      }
    }
  }
  return map;
};

const findAntipodalStickerByGrid = (manifoldMap, sticker, S) => {
  const { r, c } = getGridRC(sticker.origPos, sticker.origDir, S);
  const idx = r * S + c + 1;
  const antipodalManifold = ANTIPODAL_COLOR[sticker.orig];
  const antipodalGridId = `M${antipodalManifold}-${String(idx).padStart(3, '0')}`;
  return manifoldMap.get(antipodalGridId) || null;
};

const getManifoldNeighbors = (x, y, z, dirKey, S) => {
  const neighbors = [];
  const add = (nx, ny, nz, nDir) => {
    if (nx >= 0 && nx < S && ny >= 0 && ny < S && nz >= 0 && nz < S) neighbors.push({ x: nx, y: ny, z: nz, dirKey: nDir });
  };

  if (dirKey === 'PX' || dirKey === 'NX') {
    const xi = dirKey === 'PX' ? S - 1 : 0;
    add(xi, y - 1, z, dirKey); add(xi, y + 1, z, dirKey); add(xi, y, z - 1, dirKey); add(xi, y, z + 1, dirKey);
    if (y === S - 1) add(x, S - 1, z, 'PY');
    if (y === 0) add(x, 0, z, 'NY');
    if (z === S - 1) add(x, y, S - 1, 'PZ');
    if (z === 0) add(x, y, 0, 'NZ');
  } else if (dirKey === 'PY' || dirKey === 'NY') {
    const yi = dirKey === 'PY' ? S - 1 : 0;
    add(x - 1, yi, z, dirKey); add(x + 1, yi, z, dirKey); add(x, yi, z - 1, dirKey); add(x, yi, z + 1, dirKey);
    if (x === S - 1) add(S - 1, y, z, 'PX');
    if (x === 0) add(0, y, z, 'NX');
    if (z === S - 1) add(x, y, S - 1, 'PZ');
    if (z === 0) add(x, y, 0, 'NZ');
  } else {
    const zi = dirKey === 'PZ' ? S - 1 : 0;
    add(x - 1, y, zi, dirKey); add(x + 1, y, zi, dirKey); add(x, y - 1, zi, dirKey); add(x, y + 1, zi, dirKey);
    if (x === S - 1) add(S - 1, y, z, 'PX');
    if (x === 0) add(0, y, z, 'NX');
    if (y === S - 1) add(x, S - 1, z, 'PY');
    if (y === 0) add(x, 0, z, 'NY');
  }
  return neighbors;
};

const isOnSeam = (x, y, z, dirKey, S) => {
  const s = S - 1;
  if (dirKey === 'PX' || dirKey === 'NX') return y === 0 || y === s || z === 0 || z === s;
  if (dirKey === 'PY' || dirKey === 'NY') return x === 0 || x === s || z === 0 || z === s;
  return x === 0 || x === s || y === 0 || y === s;
};

const isCrossFaceNeighbor = (sourceDirKey, neighborDirKey) => sourceDirKey !== neighborDirKey;

const flipStickerPairLocal = (cubeState, x, y, z, dirKey, manifoldMap, outFlips) => {
  const sticker = cubeState[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!sticker) return;

  const applyFlip = (loc, emitOp = false) => {
    if (!loc) return;
    const st = cubeState[loc.x][loc.y][loc.z].stickers[loc.dirKey];
    const currentFlips = st.flips || 0;
    if (currentFlips >= flipCap) return;
    st.curr = ANTIPODAL_COLOR[st.curr];
    st.flips = Math.min(flipCap, currentFlips + 1);
    if (emitOp) outFlips.push([loc.x, loc.y, loc.z, loc.dirKey]);
  };

  // Emit exactly ONE operation per pair-step.
  // Main-thread replay uses flipStickerPair(), which already flips both members.
  // Emitting both locations would double-apply and visually cancel color flips.
  applyFlip({ x, y, z, dirKey }, true);
  const anti = findAntipodalStickerByGrid(manifoldMap, sticker, size);
  applyFlip(anti, false);
};

const resetChainState = () => {
  deadTileSet = new Set();
  deathRank = 0;
  pairDeathCount = 0;
  winnerAnnounced = false;
  faceAliveMap = new Map([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]]);
  conwayAcc = 0;
  neighborCache = null;

  // Rebuild the living-sticker index from all surface stickers.
  // state must be set before resetChainState() is called (guaranteed by START handler).
  livingStickers = new Map();
  if (state) {
    for (const [x, y, z] of surfaceCoords) {
      for (const dirKey of Object.keys(state[x][y][z].stickers)) {
        livingStickers.set(`${x},${y},${z},${dirKey}`, { x, y, z, dirKey });
      }
    }
    // Seed face alive counts HERE, before any tick runs, so that death tracking
    // on tick 1 never sees a zero-count face and fires false elimination events.
    for (const [x, y, z] of surfaceCoords) {
      const c = state[x][y][z];
      for (const st of Object.values(c.stickers)) {
        if (st.orig) faceAliveMap.set(st.orig, (faceAliveMap.get(st.orig) ?? 0) + 1);
      }
    }
  }

  const level = Math.max(1, Math.min(MAX_LEVEL, chaosLevel));
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

  const candidates = [];
  for (const { x, y, z, dirKey } of livingStickers.values()) {
    const st = state[x][y][z].stickers[dirKey];
    if (st.flips > 0) candidates.push({ x, y, z, dirKey, flips: st.flips });
  }

  if (!candidates.length) {
    // No flipped tiles yet — pick any living tile as a fresh start.
    const values = [...livingStickers.values()];
    const pick = values[Math.floor(Math.random() * values.length)];
    return { tile: { ...pick, flips: 1 }, strength: 1 };
  }

  // Weight restarts QUADRATICALLY by flip count. Linear weighting spread chains
  // evenly across all damaged tiles, so damage never concentrated enough to reach
  // the cap. Squaring makes a chain far more likely to resume a near-cap tile and
  // finish the kill instead of scattering fresh flips across the whole surface.
  const totalWeight = candidates.reduce((sum, c) => sum + c.flips * c.flips, 0);
  let roll = Math.random() * totalWeight;
  for (const c of candidates) {
    roll -= c.flips * c.flips;
    if (roll <= 0) return { tile: c, strength: 1 };
  }
  return { tile: candidates[candidates.length - 1], strength: 1 };
};

// ─── Conway Generation Evaluation ────────────────────────────────────────────
// Evaluates all living stickers simultaneously against the current level's B/S
// rulestring. Returns births (new infections) and recoveries (healed stickers).

const buildNeighborCache = (S) => {
  const cache = new Map();
  for (const [x, y, z] of surfaceCoords) {
    if (!state[x]?.[y]?.[z]) continue;
    for (const dirKey of Object.keys(state[x][y][z].stickers)) {
      cache.set(`${x},${y},${z},${dirKey}`, getManifoldNeighbors(x, y, z, dirKey, S));
    }
  }
  return cache;
};

const recoverStickerPairLocal = (cubeState, x, y, z, dirKey, manifoldMap, outRecoveries) => {
  const sticker = cubeState[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!sticker) return;

  const applyRecover = (loc, emitOp = false) => {
    if (!loc) return;
    const st = cubeState[loc.x][loc.y][loc.z].stickers[loc.dirKey];
    const currentFlips = st.flips || 0;
    if (currentFlips <= 0 || currentFlips >= flipCap) return;
    st.curr = ANTIPODAL_COLOR[st.curr];
    st.flips = currentFlips - 1;
    if (emitOp) outRecoveries.push([loc.x, loc.y, loc.z, loc.dirKey]);
  };

  applyRecover({ x, y, z, dirKey }, true);
  const anti = findAntipodalStickerByGrid(manifoldMap, sticker, size);
  applyRecover(anti, false);
};

const conwayTick = () => {
  if (!state || animating) return null;
  if (!manifoldMapCache) manifoldMapCache = buildManifoldGridMap(state, size);
  if (!neighborCache) neighborCache = buildNeighborCache(size);

  const level = Math.max(1, Math.min(MAX_LEVEL, chaosLevel));
  const rules = CONWAY_RULES[level];
  if (!rules) return null;

  const { birth: birthSet, survive: surviveSet, recoveryRate } = rules;
  const birthCap = conwayBirthCapByLevel[level] || 4;
  const recoveryCap = conwayRecoveryCapByLevel[level] || 3;

  const births = []; // [x,y,z,dirKey] — healthy stickers to infect
  const recoveries = []; // [x,y,z,dirKey] — infected stickers to heal
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
      if (nst && (nst.flips || 0) > 0 && (nst.flips || 0) < flipCap) {
        infectedCount++;
      }
    }

    const currentFlips = st.flips || 0;
    const isInfected = currentFlips > 0;

    if (!isInfected) {
      // Birth check: healthy sticker with right number of infected neighbors
      if (birthSet.has(infectedCount) && births.length < birthCap) {
        births.push([loc.x, loc.y, loc.z, loc.dirKey]);
      }
    } else {
      // Survival check: infected sticker without enough support recovers
      if (!surviveSet.has(infectedCount) && Math.random() < recoveryRate && recoveries.length < recoveryCap) {
        recoveries.push([loc.x, loc.y, loc.z, loc.dirKey]);
      }
    }
  }

  // Apply births (flip sticker + antipodal pair)
  const outFlips = [];
  for (const [x, y, z, dirKey] of births) {
    flipStickerPairLocal(state, x, y, z, dirKey, manifoldMapCache, outFlips);
    // Emit cascade visual from a random infected neighbor to the birth site
    const neighbors = neighborCache.get(`${x},${y},${z},${dirKey}`);
    if (neighbors) {
      const infectedNeighbor = neighbors.find((n) => {
        const nst = state[n.x]?.[n.y]?.[n.z]?.stickers?.[n.dirKey];
        return nst && (nst.flips || 0) > 0 && (nst.flips || 0) < flipCap;
      });
      if (infectedNeighbor && !(infectedNeighbor.x === x && infectedNeighbor.y === y && infectedNeighbor.z === z)) {
        const from = getStickerWorldPos(infectedNeighbor.x, infectedNeighbor.y, infectedNeighbor.z, infectedNeighbor.dirKey, size, explosionT);
        const to = getStickerWorldPos(x, y, z, dirKey, size, explosionT);
        cascades.push({ from, to, crossFace: infectedNeighbor.dirKey !== dirKey });
      }
    }
  }

  // Apply recoveries (decrement flip on sticker + antipodal pair)
  const outRecoveries = [];
  for (const [x, y, z, dirKey] of recoveries) {
    recoverStickerPairLocal(state, x, y, z, dirKey, manifoldMapCache, outRecoveries);
  }

  const didWork = outFlips.length > 0 || outRecoveries.length > 0;
  return didWork ? { flips: outFlips, recoveries: outRecoveries, cascades } : null;
};

// dtMs: real milliseconds elapsed since the previous tick (used for cooldown accumulation).
const tick = (dtMs) => {
  if (!state || animating) return null;
  if (!manifoldMapCache) manifoldMapCache = buildManifoldGridMap(state, size);

  const level = Math.max(1, Math.min(MAX_LEVEL, chaosLevel));
  const basePropagation = basePropByLevel[level] || 0.65;
  const strengthDecay = decayByLevel[level] || 0.78;
  const chainCooldown = cooldownByLevel[level] || 1000;

  const flips = [];
  const cascades = [];
  const deaths = [];
  const eliminatedFaces = [];
  let producedDeaths = false;

  for (const chain of chains) {
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
    flipStickerPairLocal(state, current.x, current.y, current.z, current.dirKey, manifoldMapCache, flips);

    const chainDeaths = [];
    const checkDeath = (loc) => {
      if (!loc) return;
      const st = state[loc.x]?.[loc.y]?.[loc.z]?.stickers?.[loc.dirKey];
      if (!st) return;
      const gridId = getManifoldGridId(st, size);
      if ((st.flips || 0) >= flipCap && !deadTileSet.has(gridId) && surfaceStickers - deadTileSet.size > 2) {
        deadTileSet.add(gridId);
        chainDeaths.push({ st, gridId, ...loc });
        // O(1) removal — Map key matches the format used when inserting in resetChainState.
        livingStickers.delete(`${loc.x},${loc.y},${loc.z},${loc.dirKey}`);
      }
    };

    checkDeath(current);
    const currentSticker = state[current.x]?.[current.y]?.[current.z]?.stickers?.[current.dirKey];
    if (currentSticker) {
      const antiLoc = findAntipodalStickerByGrid(manifoldMapCache, currentSticker, size);
      checkDeath(antiLoc);
    }

    if (chainDeaths.length > 0) {
      pairDeathCount += 1;
      producedDeaths = true;
      const DIR_TO_FACE = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };
      for (const { st, gridId, x, y, z, dirKey: ddk } of chainDeaths) {
        deathRank += 1;
        const { r, c } = faceRCFor(ddk, x, y, z, size);
        const endFaceId = DIR_TO_FACE[ddk] ?? st.curr;
        const endGridId = `M${endFaceId}-${String(r * size + c + 1).padStart(3, '0')}`;
        deaths.push({ gridId, endGridId, rank: deathRank, pairRank: pairDeathCount, timestamp: Date.now() });

        const faceNum = st.orig;
        if (faceNum) {
          const prev = faceAliveMap.get(faceNum) ?? 1;
          const next = Math.max(0, prev - 1);
          faceAliveMap.set(faceNum, next);
          if (next === 0) eliminatedFaces.push(faceNum);
        }
      }
    }

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
      if (!nst || (nst.flips || 0) >= flipCap) continue;

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

    const pool = [...validNeighbors];
    while (pool.length > 0) {
      let roll = Math.random() * pool.reduce((s, n) => s + n.seamWeight, 0);
      let pick = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        roll -= pool[i].seamWeight;
        if (roll <= 0) {
          pick = i;
          break;
        }
      }
      const neighbor = pool.splice(pick, 1)[0];
      // Finisher boost: the closer a neighbour is to the flip cap, the more likely
      // the chain commits to it — so near-dead tiles get pushed over the edge
      // instead of being abandoned one flip short of dying.
      const capProximity = flipCap > 0 ? neighbor.flips / flipCap : 0;
      const flipBoost = 1.0 + capProximity * 1.4;
      const propagateChance = Math.min(1, chain.strength * basePropagation * flipBoost);
      if (Math.random() < propagateChance) {
        // Only emit a cascade bolt for hops between *different* cubies.
        // Same-cubie cross-face hops (corner NX→NY→NZ) are topologically valid but
        // produce an impact sphere right on the neighboring sticker, making it
        // appear to randomly spaz/flash even though its flip count hasn't changed.
        const sameCubie = neighbor.x === current.x && neighbor.y === current.y && neighbor.z === current.z;
        if (!sameCubie) {
          const from = getStickerWorldPos(current.x, current.y, current.z, current.dirKey, size, explosionT);
          const to = getStickerWorldPos(neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, size, explosionT);
          cascades.push({ from, to, crossFace: neighbor.crossFace });
        }
        chain.tile = { x: neighbor.x, y: neighbor.y, z: neighbor.z, dirKey: neighbor.dirKey };
        chain.visited.add(`${neighbor.x},${neighbor.y},${neighbor.z},${neighbor.dirKey}`);
        break;
      }
    }
  }

  let winner = null;
  const aliveAfterDeaths = surfaceStickers - deadTileSet.size;
  if (!winnerAnnounced && aliveAfterDeaths <= 2 && aliveAfterDeaths > 0 && deathRank > 0) {
    winnerAnnounced = true;
    // Scan state directly for alive stickers so rotations don't corrupt the list.
    // livingStickers physical keys become stale after SYNC_CUBIES; deadTileSet
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
    running = false;
  }

  // Only recompute the O(n) metrics scan when something actually changed this tick.
  const didWork = flips.length > 0 || cascades.length > 0 || producedDeaths || !!winner;
  if (didWork) {
    cachedMetrics = computeChaosMetrics(state, surfaceCoords);
  }
  const flipPct = cachedMetrics.edgeTotal > 0 ? Math.round((cachedMetrics.flipActive / cachedMetrics.edgeTotal) * 100) : 0;

  return {
    flips,
    cascades,
    deaths,
    eliminatedFaces: [...new Set(eliminatedFaces)],
    winner,
    metrics: { ...cachedMetrics, flipPct },
    didWork,
  };
};

const schedule = () => {
  if (!running) return;
  const now = performance.now();
  const dt = now - last;
  last = now;
  tickAcc += dt;
  conwayAcc += dt;

  const level = Math.max(1, Math.min(MAX_LEVEL, chaosLevel));
  const tickPeriod = delayByLevel[level] || 250;
  // Use cached metrics (updated each tick) to avoid iterating all stickers every 16 ms.
  const activeRatio = cachedMetrics.edgeTotal > 0 ? (cachedMetrics.flipActive / cachedMetrics.edgeTotal) : 0;
  const chainPressure = Math.min(1, chains.length / 12);
  const effectivePeriod = Math.round(tickPeriod * (0.9 + activeRatio * 1.1) * (1 + chainPressure * 0.6));

  if (tickAcc >= effectivePeriod) {
    // Pass accumulated real ms to tick() so chain cooldowns run in wall-clock time.
    const payload = tick(tickAcc);
    if (payload && payload.didWork) {
      self.postMessage({ type: 'TICK', payload });
    }
    tickAcc = 0;
  }

  // Conway generation runs on its own slower cadence — evaluates the full surface
  // and produces emergent birth/recovery patterns independent of chain walks.
  const conwayPeriod = conwayPeriodByLevel[level] || 2000;
  if (conwayAcc >= conwayPeriod) {
    const conwayPayload = conwayTick();
    if (conwayPayload) {
      // Merge Conway results into a TICK message so the main thread can apply them.
      // Conway births are regular flips; recoveries are a new operation type.
      const mergedPayload = {
        flips: conwayPayload.flips,
        cascades: conwayPayload.cascades,
        recoveries: conwayPayload.recoveries,
        deaths: [],
        eliminatedFaces: [],
        winner: null,
        metrics: computeChaosMetrics(state, surfaceCoords),
        didWork: true,
      };
      mergedPayload.metrics.flipPct = mergedPayload.metrics.edgeTotal > 0
        ? Math.round((mergedPayload.metrics.flipActive / mergedPayload.metrics.edgeTotal) * 100)
        : 0;
      cachedMetrics = mergedPayload.metrics;
      self.postMessage({ type: 'TICK', payload: mergedPayload });
    }
    conwayAcc = 0;
  }

  if (running) timerId = setTimeout(schedule, 16);
};

// After a cube rotation every sticker's physical (x,y,z,dirKey) changes.
// Rebuild the physical-key index from the new positions so checkDeath
// deletes the correct slot and findChainStart reads the right stickers.
function rebuildLivingStickers() {
  livingStickers = new Map();
  for (const [x, y, z] of surfaceCoords) {
    for (const dirKey of Object.keys(state[x][y][z].stickers)) {
      const st = state[x][y][z].stickers[dirKey];
      const gridId = getManifoldGridId(st, size);
      if (!deadTileSet.has(gridId)) {
        livingStickers.set(`${x},${y},${z},${dirKey}`, { x, y, z, dirKey });
      }
    }
  }
}

self.onmessage = (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'START': {
      state = payload.cubies;
      size = payload.size;
      chaosLevel = payload.chaosLevel;
      flipCap = payload.disparityFlipCap;
      explosionT = payload.explosionT ?? 0;
      animating = !!payload.animating;
      surfaceCoords = buildSurfaceCoords(size);
      surfaceStickers = size * size * 6;
      manifoldMapCache = null;
      tickAcc = 0;
      last = performance.now();
      resetChainState();
      running = true;
      // Immediate metrics snapshot so HUDs have data before the first
      // productive tick (replaces main-thread polling scans).
      cachedMetrics = computeChaosMetrics(state, surfaceCoords);
      self.postMessage({
        type: 'METRICS',
        payload: {
          metrics: {
            ...cachedMetrics,
            flipPct: cachedMetrics.edgeTotal > 0 ? Math.round((cachedMetrics.flipActive / cachedMetrics.edgeTotal) * 100) : 0,
          },
        },
      });
      if (timerId) clearTimeout(timerId);
      schedule();
      break;
    }

    case 'SYNC_CUBIES': {
      state = payload.cubies;
      manifoldMapCache = null;
      neighborCache = null;
      rebuildLivingStickers();
      break;
    }

    case 'ROTATE_SLICE': {
      // Lightweight counterpart to SYNC_CUBIES: replay a single-slice rotation on the
      // worker's own state instead of receiving a full structured-cloned cubies array.
      const { axis, sliceIndex, dir, numTurns } = payload;
      for (let i = 0; i < (numTurns ?? 1); i++) {
        state = rotateSliceCubies(state, size, axis, sliceIndex, dir);
      }
      manifoldMapCache = null;
      neighborCache = null;
      rebuildLivingStickers();
      break;
    }

    case 'SET_FLIP_CAP':
      flipCap = payload.disparityFlipCap;
      break;

    case 'SET_CHAOS_LEVEL':
      chaosLevel = payload.chaosLevel;
      resetChainState();
      break;

    case 'SET_EXPLOSION':
      explosionT = payload.explosionT ?? 0;
      break;

    case 'SET_ANIMATING':
      animating = !!payload.animating;
      break;

    case 'STOP':
      running = false;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      break;
  }
};
