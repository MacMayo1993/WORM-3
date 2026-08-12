// src/game/manifoldLogic.js
// Manifold topology and antipodal flipping logic
import { ANTIPODAL_COLOR, FLIP_CAP } from '../utils/constants.js';
import { getGridRC, getManifoldGridId } from './gridIds.js';

// Get manifold neighbors for a sticker - includes cross-face neighbors at edges
// Returns array of {x, y, z, dirKey} for each neighbor
export const getManifoldNeighbors = (x, y, z, dirKey, size) => {
  const S = size;
  const neighbors = [];

  // Helper to add a neighbor if valid
  const add = (nx, ny, nz, nDir) => {
    if (nx >= 0 && nx < S && ny >= 0 && ny < S && nz >= 0 && nz < S) {
      neighbors.push({ x: nx, y: ny, z: nz, dirKey: nDir });
    }
  };

  if (dirKey === 'PX' || dirKey === 'NX') {
    // X faces: stickers vary in y,z
    const xi = dirKey === 'PX' ? S - 1 : 0;

    // Same-face neighbors
    add(xi, y - 1, z, dirKey); // down
    add(xi, y + 1, z, dirKey); // up
    add(xi, y, z - 1, dirKey); // back
    add(xi, y, z + 1, dirKey); // front

    // Cross-face neighbors at edges
    if (y === S - 1) {
      // Top edge → PY face
      add(x, S - 1, z, 'PY');
    }
    if (y === 0) {
      // Bottom edge → NY face
      add(x, 0, z, 'NY');
    }
    if (z === S - 1) {
      // Front edge → PZ face
      add(x, y, S - 1, 'PZ');
    }
    if (z === 0) {
      // Back edge → NZ face
      add(x, y, 0, 'NZ');
    }
  } else if (dirKey === 'PY' || dirKey === 'NY') {
    // Y faces: stickers vary in x,z
    const yi = dirKey === 'PY' ? S - 1 : 0;

    // Same-face neighbors
    add(x - 1, yi, z, dirKey); // left
    add(x + 1, yi, z, dirKey); // right
    add(x, yi, z - 1, dirKey); // back
    add(x, yi, z + 1, dirKey); // front

    // Cross-face neighbors at edges
    if (x === S - 1) {
      // Right edge → PX face
      add(S - 1, y, z, 'PX');
    }
    if (x === 0) {
      // Left edge → NX face
      add(0, y, z, 'NX');
    }
    if (z === S - 1) {
      // Front edge → PZ face
      add(x, y, S - 1, 'PZ');
    }
    if (z === 0) {
      // Back edge → NZ face
      add(x, y, 0, 'NZ');
    }
  } else {
    // PZ or NZ: stickers vary in x,y
    const zi = dirKey === 'PZ' ? S - 1 : 0;

    // Same-face neighbors
    add(x - 1, y, zi, dirKey); // left
    add(x + 1, y, zi, dirKey); // right
    add(x, y - 1, zi, dirKey); // down
    add(x, y + 1, zi, dirKey); // up

    // Cross-face neighbors at edges
    if (x === S - 1) {
      // Right edge → PX face
      add(S - 1, y, z, 'PX');
    }
    if (x === 0) {
      // Left edge → NX face
      add(0, y, z, 'NX');
    }
    if (y === S - 1) {
      // Top edge → PY face
      add(x, S - 1, z, 'PY');
    }
    if (y === 0) {
      // Bottom edge → NY face
      add(x, 0, z, 'NY');
    }
  }

  return neighbors;
};

// Check if a sticker sits on the seam (edge boundary between two faces).
// Returns true if any of its grid coordinates are at 0 or size-1 within its face.
export const isOnSeam = (x, y, z, dirKey, size) => {
  const S = size - 1;
  if (dirKey === 'PX' || dirKey === 'NX') return y === 0 || y === S || z === 0 || z === S;
  if (dirKey === 'PY' || dirKey === 'NY') return x === 0 || x === S || z === 0 || z === S;
  return x === 0 || x === S || y === 0 || y === S; // PZ, NZ
};

// Check if a neighbor is a cross-face (seam-crossing) neighbor.
// Cross-face neighbors have a different dirKey than the source tile.
export const isCrossFaceNeighbor = (sourceDirKey, neighborDirKey) => {
  return sourceDirKey !== neighborDirKey;
};

// Build map from manifold-grid ID to current location
export const buildManifoldGridMap = (cubies, size) => {
  const map = new Map();
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const c = cubies[x][y][z];
        for (const [dKey, st] of Object.entries(c.stickers)) {
          const gridId = getManifoldGridId(st, size);
          map.set(gridId, { x, y, z, dirKey: dKey, sticker: st });
        }
      }
    }
  }
  return map;
};

// Incremental variant of buildManifoldGridMap. Callers that rebuild this map on every
// cubies change (flips fire ~12×/sec at chaos L4) can hold a `cache` object across calls
// (e.g. in a useRef) instead of paying the full O(size³×6) rebuild every time.
//
// Correctness: a gridId is derived from a sticker's orig/origPos/origDir, which are fixed
// at creation and never change — only WHICH (x,y,z,dirKey) cell currently holds that
// sticker changes (via rotation), or its curr/flips changes in place (via a flip, no
// position change). Cubies arrays use a shallow-clone-with-shared-refs pattern (see
// flipStickerPair/rotateSliceCubies): only cells whose cubie object actually changed get a
// new reference. So diffing cell references against the previous call and re-deriving
// gridId entries for just the changed cells always converges to the same map a full
// rebuild would produce — unchanged cells' entries are untouched because their stickers
// (and thus gridIds) didn't change either.
export const buildManifoldGridMapIncremental = (cubies, size, cache) => {
  if (!cache.map || cache.size !== size || !cache.prevCubies) {
    cache.map = buildManifoldGridMap(cubies, size);
    cache.prevCubies = cubies;
    cache.size = size;
    return cache.map;
  }

  const { map, prevCubies } = cache;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const c = cubies[x][y][z];
        if (c === prevCubies[x]?.[y]?.[z]) continue;
        for (const [dKey, st] of Object.entries(c.stickers)) {
          const gridId = getManifoldGridId(st, size);
          map.set(gridId, { x, y, z, dirKey: dKey, sticker: st });
        }
      }
    }
  }
  cache.prevCubies = cubies;
  return map;
};

// Find antipodal sticker using manifold-grid mapping
export const findAntipodalStickerByGrid = (manifoldMap, sticker, size) => {
  const { r, c } = getGridRC(sticker.origPos, sticker.origDir, size);
  const idx = r * size + c + 1;
  const antipodalManifold = ANTIPODAL_COLOR[sticker.orig];
  const idStr = String(idx).padStart(3, '0');
  const antipodalGridId = `M${antipodalManifold}-${idStr}`;
  return manifoldMap.get(antipodalGridId) || null;
};

// Resolve both endpoints of a β-pair from one of its members.
// Returns [selfLoc, partnerLoc]; partnerLoc is null for a sticker whose grid ID
// has no antipodal entry in the map (should not happen on a well-formed cube).
const resolvePairLocs = (state, size, x, y, z, dirKey, manifoldMap) => {
  const sticker = state[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!sticker) return null;
  return [{ x, y, z, dirKey }, findAntipodalStickerByGrid(manifoldMap, sticker, size)];
};

const flipsAt = (state, loc) => (loc ? state[loc.x][loc.y][loc.z].stickers[loc.dirKey].flips || 0 : 0);

// True iff a native flip on this pair would actually change the board — i.e. both
// members are still below the cap. Callers should gate on this BEFORE charging a
// move or firing flip feedback, so a tap on a burnt-out tile is not reported as a
// successful flip (see useCubeState.flipSticker).
//
// `flipCap` defaults to the module constant for standard play; Disparity/Chaos
// sessions pass the configured cap (selectEffectiveFlipCap) so the tile life the
// simulation and the health bars agree on is the one the player's taps obey too.
export const canFlipStickerPair = (state, size, x, y, z, dirKey, manifoldMap, flipCap = FLIP_CAP) => {
  const locs = resolvePairLocs(state, size, x, y, z, dirKey, manifoldMap);
  if (!locs) return false;
  const [self, partner] = locs;
  if (flipsAt(state, self) >= flipCap) return false;
  return !partner || flipsAt(state, partner) < flipCap;
};

// Flip a sticker pair (sticker and its antipodal counterpart).
// Shallow-clones the outer arrays and only creates new cubie objects for the
// two positions that actually change — identical to the pattern in cubeRotation.js.
// This avoids a full deep-clone of all cubies on every user flip, which was
// causing unnecessary re-renders of every StickerPlane in the scene.
//
// The flip is ATOMIC across the pair: if either member is at the cap, neither
// moves. Flipping one member alone would break the ∆ invariant that
// antipodalEngine relies on ("∆ = 0 throughout ordinary play — flips are always
// paired"), stranding the pair as permanently asymmetric and adding a mandatory
// heal to every future solve plan.
export const flipStickerPair = (state, size, x, y, z, dirKey, manifoldMap, flipCap = FLIP_CAP) => {
  // Shallow-clone: outer arrays are new, cubie objects are shared by reference
  const next = state.map(L => L.map(R => R.slice()));

  const locs = resolvePairLocs(state, size, x, y, z, dirKey, manifoldMap);
  if (!locs) return next;
  if (!canFlipStickerPair(state, size, x, y, z, dirKey, manifoldMap, flipCap)) return next;

  // Create a new cubie object only for the affected position
  const applyFlip = (loc) => {
    if (!loc) return;
    const c = next[loc.x][loc.y][loc.z];
    const st = c.stickers[loc.dirKey];
    const stickers = { ...c.stickers };
    stickers[loc.dirKey] = {
      ...st,
      curr: ANTIPODAL_COLOR[st.curr],
      flips: Math.min(flipCap, (st.flips || 0) + 1)
    };
    next[loc.x][loc.y][loc.z] = { ...c, stickers };
  };

  applyFlip(locs[0]);
  applyFlip(locs[1]);

  return next;
};

// True iff the pair's last flip can be taken back: both members must carry at
// least one flip to give back. A pair at flips 0 was never flipped (or has
// already been unflipped), so there is nothing to reverse.
export const canUnflipStickerPair = (state, size, x, y, z, dirKey, manifoldMap) => {
  const locs = resolvePairLocs(state, size, x, y, z, dirKey, manifoldMap);
  if (!locs) return false;
  const [self, partner] = locs;
  if (flipsAt(state, self) <= 0) return false;
  return !partner || flipsAt(state, partner) > 0;
};

// The true inverse of flipStickerPair: toggles the colour back AND gives back the
// flip each member spent.
//
// Re-running flipStickerPair restores the colour (ANTIPODAL_COLOR is an
// involution) but *increments* the counter again, so a flip followed by an "undo"
// used to cost the pair two flips of its life instead of none — and on a capped
// tile it silently did nothing at all. Undo must hand the life back, so use this.
export const unflipStickerPair = (state, size, x, y, z, dirKey, manifoldMap) => {
  const next = state.map(L => L.map(R => R.slice()));

  const locs = resolvePairLocs(state, size, x, y, z, dirKey, manifoldMap);
  if (!locs) return next;
  if (!canUnflipStickerPair(state, size, x, y, z, dirKey, manifoldMap)) return next;

  const applyUnflip = (loc) => {
    if (!loc) return;
    const c = next[loc.x][loc.y][loc.z];
    const st = c.stickers[loc.dirKey];
    const stickers = { ...c.stickers };
    stickers[loc.dirKey] = {
      ...st,
      curr: ANTIPODAL_COLOR[st.curr],
      flips: Math.max(0, (st.flips || 0) - 1)
    };
    next[loc.x][loc.y][loc.z] = { ...c, stickers };
  };

  applyUnflip(locs[0]);
  applyUnflip(locs[1]);

  return next;
};
