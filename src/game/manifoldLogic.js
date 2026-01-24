// src/game/manifoldLogic.js
// Manifold topology and antipodal flipping logic
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { getGridRC, getManifoldGridId } from './coordinates.js';
import { clone3D } from './cubeState.js';

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

// Find antipodal sticker using manifold-grid mapping
export const findAntipodalStickerByGrid = (manifoldMap, sticker, size) => {
  const { r, c } = getGridRC(sticker.origPos, sticker.origDir, size);
  const idx = r * size + c + 1;
  const antipodalManifold = ANTIPODAL_COLOR[sticker.orig];
  const idStr = String(idx).padStart(3, '0');
  const antipodalGridId = `M${antipodalManifold}-${idStr}`;
  return manifoldMap.get(antipodalGridId) || null;
};

// Flip a sticker pair (sticker and its antipodal counterpart)
export const flipStickerPair = (state, size, x, y, z, dirKey, manifoldMap) => {
  const next = clone3D(state);
  const cubie = next[x]?.[y]?.[z];
  const sticker = cubie?.stickers?.[dirKey];
  if (!sticker) return next;

  const sticker1Loc = { x, y, z, dirKey, sticker };
  const sticker2Loc = findAntipodalStickerByGrid(manifoldMap, sticker, size);

  const applyFlip = (loc) => {
    if (!loc) return;
    const c = next[loc.x][loc.y][loc.z];
    const st = c.stickers[loc.dirKey];
    const stickers = { ...c.stickers };
    stickers[loc.dirKey] = {
      ...st,
      curr: ANTIPODAL_COLOR[st.curr],
      flips: (st.flips || 0) + 1
    };
    next[loc.x][loc.y][loc.z] = { ...c, stickers };
  };

  applyFlip(sticker1Loc);
  applyFlip(sticker2Loc);

  return next;
};
