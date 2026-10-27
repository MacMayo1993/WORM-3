import { findAntipodalStickerByGrid, canFlipStickerPair } from './manifoldLogic.js';
import { getManifoldGridId } from './gridIds.js';

// Selection is a location; linkage is an identity. Always resolve the current
// partner through the same map used by flipStickerPair, never by world antipodes.
export function cursorTile({ face, row, col }, size) {
  const m = size - 1;
  const xyz = { PZ: [col, m - row, m], NZ: [m - col, m - row, 0],
    PX: [m, m - row, m - col], NX: [0, m - row, col], PY: [col, m, row], NY: [col, 0, m - row] }[face];
  return xyz ? { x: xyz[0], y: xyz[1], z: xyz[2], dirKey: face } : null;
}

export function actionPair(cubies, size, map, selection, flipCap) {
  const tile = typeof selection === 'string' ? map.get(selection) : selection;
  if (!tile) return null;
  const { x, y, z, dirKey } = tile;
  const sticker = cubies[x]?.[y]?.[z]?.stickers?.[dirKey];
  if (!sticker) return null;
  const twin = findAntipodalStickerByGrid(map, sticker, size);
  if (!twin) return null;
  return {
    ids: [getManifoldGridId(sticker, size), getManifoldGridId(twin.sticker, size)],
    available: canFlipStickerPair(cubies, size, x, y, z, dirKey, map, flipCap),
  };
}
