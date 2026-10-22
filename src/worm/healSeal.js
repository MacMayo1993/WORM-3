// src/worm/healSeal.js
//
// Cue the heal seal on the tiles of a healed pair. A flip is an involution (α² = id)
// applied to the pair {x, −x}, so a heal sends BOTH tiles home at once: both play the
// seal (StickerPlane: a golden ring closing, then home-colour rings, and sparks), not
// just the mouth the worm came out of. Keys are the stickers' manifold grid ids,
// computed from the healed cubies exactly as StickerPlane computes its own.
import { getManifoldGridId } from '../game/gridIds.js';
import { healBurstMap } from '../3d/healBurstBridge.js';

export function queueHealSeal(cubies, size, tiles) {
  for (const tile of tiles) {
    const sticker = tile && cubies?.[tile.x]?.[tile.y]?.[tile.z]?.stickers?.[tile.dirKey];
    const id = sticker ? getManifoldGridId(sticker, size) : null;
    if (id) healBurstMap.set(id, 1);
  }
}
