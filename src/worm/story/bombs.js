import { collectManifoldRing } from '../wormLogic.js';
import { getAllSurfaceTiles } from '../healerWorm/surfaceTiles.js';
import { tileKeyOf } from '../healerWorm/bombs.js';

export const STORY_BOMB_OPENING_DELAY = 3;
export const STORY_BOMB_REFILL_DELAY = 5;
export const STORY_BOMB_FUSE = 25;

// Quest bombs use the whole surface, independently of enemy rifts or deaths.
// Never fall back to an occupied tile when the board has no safe space.
export function storyBombTile(head, size, cubies, occupied, combat, pickups = [], rand = Math.random) {
  const blocked = collectManifoldRing(head.x, head.y, head.z, head.dirKey, size, size <= 3 ? 1 : 2);
  for (const key of occupied) blocked.add(key);
  for (const tile of pickups) blocked.add(tileKeyOf(tile));
  if (combat?.portal) blocked.add(tileKeyOf(combat.portal));
  for (const enemy of combat?.enemies ?? []) {
    blocked.add(tileKeyOf(enemy.tile));
    if (enemy.next) blocked.add(tileKeyOf(enemy.next));
  }
  const candidates = getAllSurfaceTiles(size).filter(tile => {
    const sticker = cubies[tile.x]?.[tile.y]?.[tile.z]?.stickers[tile.dirKey];
    return sticker && sticker.curr === sticker.orig && !blocked.has(tileKeyOf(tile));
  });
  return candidates.length ? candidates[Math.floor(rand() * candidates.length)] : null;
}
