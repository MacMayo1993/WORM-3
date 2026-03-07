const ANTIPODAL_COLOR = {
  1: 4,
  2: 5,
  3: 6,
  4: 1,
  5: 2,
  6: 3,
};

const MAX_LEVEL = 5;

const numChainsByLevel = [0, 1, 1, 2, 2, 3];
const delayByLevel = [0, 380, 220, 200, 130, 130];
const basePropByLevel = [0, 0.45, 0.72, 0.65, 0.85, 0.85];
const decayByLevel = [0, 0.72, 0.82, 0.78, 0.88, 0.88];
const cooldownByLevel = [0, 1600, 900, 800, 450, 450];

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

let chains = [];
let deadTileSet = new Set();
let deathRank = 0;
let pairDeathCount = 0;
let winnerAnnounced = false;
let faceAliveMap = new Map([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]]);
let faceSeedDone = false;

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
  for (const [x, y, z] of surfCoords) {
    const c = cubeState[x][y][z];
    for (const key of Object.keys(c.stickers)) {
      const st = c.stickers[key];
      edgeTotal++;
      if (st.curr !== st.orig) disparity++;
      if ((st.flips || 0) > 0) flipActive++;
    }
  }
  return { disparity, flipActive, edgeTotal };
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

  const applyFlip = (loc) => {
    if (!loc) return;
    const st = cubeState[loc.x][loc.y][loc.z].stickers[loc.dirKey];
    const currentFlips = st.flips || 0;
    if (currentFlips >= flipCap) return;
    st.curr = ANTIPODAL_COLOR[st.curr];
    st.flips = Math.min(flipCap, currentFlips + 1);
    outFlips.push([loc.x, loc.y, loc.z, loc.dirKey]);
  };

  applyFlip({ x, y, z, dirKey });
  const anti = findAntipodalStickerByGrid(manifoldMap, sticker, size);
  applyFlip(anti);
};

const resetChainState = () => {
  deadTileSet = new Set();
  deathRank = 0;
  pairDeathCount = 0;
  winnerAnnounced = false;
  faceAliveMap = new Map([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]]);
  faceSeedDone = false;

  const level = Math.max(1, Math.min(MAX_LEVEL, chaosLevel));
  const sizeScale = Math.max(1, Math.ceil(surfaceStickers / 54));
  const numChains = (numChainsByLevel[level] || 1) * sizeScale;
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
  const candidates = [];
  for (const [x, y, z] of surfaceCoords) {
    const c = state[x][y][z];
    for (const [dirKey, st] of Object.entries(c.stickers)) {
      if (st.flips > 0 && st.flips < flipCap) candidates.push({ x, y, z, dirKey, flips: st.flips });
    }
  }

  if (!candidates.length) {
    const freshPool = [];
    for (const [x, y, z] of surfaceCoords) {
      const c = state[x][y][z];
      for (const [dirKey, st] of Object.entries(c.stickers)) {
        if ((st.flips || 0) < flipCap) freshPool.push({ x, y, z, dirKey, flips: 1 });
      }
    }
    if (!freshPool.length) return null;
    return { tile: freshPool[Math.floor(Math.random() * freshPool.length)], strength: 1 };
  }

  const totalWeight = candidates.reduce((sum, c) => sum + c.flips, 0);
  let roll = Math.random() * totalWeight;
  for (const c of candidates) {
    roll -= c.flips;
    if (roll <= 0) return { tile: c, strength: 1 };
  }
  return { tile: candidates[candidates.length - 1], strength: 1 };
};

const tick = () => {
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
      chain.cooldownAcc += 1;
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
      const key = `${loc.x},${loc.y},${loc.z},${loc.dirKey}`;
      if (st && (st.flips || 0) >= flipCap && !deadTileSet.has(key) && surfaceStickers - deadTileSet.size > 2) {
        deadTileSet.add(key);
        chainDeaths.push({ st, ...loc });
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
      for (const { st, x, y, z, dirKey: ddk } of chainDeaths) {
        deathRank += 1;
        const gridId = getManifoldGridId(st, size);
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
      const seamWeight = crossFace ? 4 : (isOnSeam(neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, size) ? 2 : 1);
      validNeighbors.push({ ...neighbor, flips: nst.flips || 0, seamWeight, crossFace });
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
      const flipBoost = neighbor.flips > 0 ? 1.15 : 1.0;
      const propagateChance = chain.strength * basePropagation * flipBoost;
      if (Math.random() < propagateChance) {
        const from = getStickerWorldPos(current.x, current.y, current.z, current.dirKey, size, explosionT);
        const to = getStickerWorldPos(neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, size, explosionT);
        cascades.push({ from, to, crossFace: neighbor.crossFace });
        chain.tile = { x: neighbor.x, y: neighbor.y, z: neighbor.z, dirKey: neighbor.dirKey };
        chain.visited.add(`${neighbor.x},${neighbor.y},${neighbor.z},${neighbor.dirKey}`);
        break;
      }
    }
  }

  if (!faceSeedDone) {
    for (const [x, y, z] of surfaceCoords) {
      const c = state[x][y][z];
      for (const st of Object.values(c.stickers)) {
        if (st.orig) faceAliveMap.set(st.orig, (faceAliveMap.get(st.orig) ?? 0) + 1);
      }
    }
    faceSeedDone = true;
  }

  let winner = null;
  const aliveAfterDeaths = surfaceStickers - deadTileSet.size;
  if (!winnerAnnounced && aliveAfterDeaths <= 2 && aliveAfterDeaths > 0 && deathRank > 0) {
    winnerAnnounced = true;
    winner = [];
    for (const [x, y, z] of surfaceCoords) {
      const c = state[x][y][z];
      for (const st of Object.values(c.stickers)) {
        if ((st.flips || 0) < flipCap) winner.push(getManifoldGridId(st, size));
      }
    }
    running = false;
  }

  const { disparity, flipActive, edgeTotal } = computeChaosMetrics(state, surfaceCoords);
  const flipPct = edgeTotal > 0 ? Math.round((flipActive / edgeTotal) * 100) : 0;

  return {
    flips,
    cascades,
    deaths,
    eliminatedFaces: [...new Set(eliminatedFaces)],
    winner,
    metrics: { disparity, flipPct },
    didWork: flips.length > 0 || cascades.length > 0 || producedDeaths,
  };
};

const schedule = () => {
  if (!running) return;
  const now = performance.now();
  const dt = now - last;
  last = now;
  tickAcc += dt;

  const level = Math.max(1, Math.min(MAX_LEVEL, chaosLevel));
  const tickPeriod = delayByLevel[level] || 250;
  const metrics = state ? computeChaosMetrics(state, surfaceCoords) : { flipActive: 0, edgeTotal: 1 };
  const activeRatio = metrics.edgeTotal > 0 ? (metrics.flipActive / metrics.edgeTotal) : 0;
  const effectivePeriod = Math.round(tickPeriod * (0.9 + activeRatio * 1.1));

  if (tickAcc >= effectivePeriod) {
    const payload = tick();
    if (payload && payload.didWork) {
      self.postMessage({ type: 'TICK', payload });
    }
    tickAcc = 0;
  }

  if (running) timerId = setTimeout(schedule, 16);
};

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
      if (timerId) clearTimeout(timerId);
      schedule();
      break;
    }

    case 'SYNC_CUBIES':
      state = payload.cubies;
      manifoldMapCache = null;
      break;

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
