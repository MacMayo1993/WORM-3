// src/game/manifoldLogic.js
// Manifold topology and antipodal flipping logic
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { getGridRC, getManifoldGridId } from './coordinates.js';
import { clone3D } from './cubeState.js';

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
