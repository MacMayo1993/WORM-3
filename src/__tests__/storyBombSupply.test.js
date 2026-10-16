import { expect, it } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { storyBombTile } from '../worm/story/bombs.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { tileKeyOf } from '../worm/healerWorm/bombs.js';
import { collectManifoldRing } from '../worm/wormLogic.js';

it('randomizes across all six faces while avoiding the worm, tunnels, pickups and enemy rifts', () => {
  const size = 8, cubies = makeCubies(size);
  const head = { x: 4, y: 4, z: 7, dirKey: 'PZ' };
  const [body, portal, enemy, next, pickup, tunnel] = getAllSurfaceTiles(size).slice(0, 6);
  cubies[tunnel.x][tunnel.y][tunnel.z].stickers[tunnel.dirKey].curr = -1;
  const combat = { portal, enemies: [{ tile: enemy, next }] };
  const occupied = new Set([tileKeyOf(body)]);
  const blocked = collectManifoldRing(head.x, head.y, head.z, head.dirKey, size, 2);
  for (const tile of [body, portal, enemy, next, pickup, tunnel]) blocked.add(tileKeyOf(tile));
  const chosen = Array.from({ length: 1000 }, (_, i) =>
    storyBombTile(head, size, cubies, occupied, combat, [pickup], () => i / 1000));
  expect(new Set(chosen.map(tile => tile.dirKey)).size).toBe(6);
  expect(chosen.every(tile => !blocked.has(tileKeyOf(tile)))).toBe(true);
  expect(new Set(chosen.map(tileKeyOf)).size).toBe(6 * size * size - blocked.size);
});

it('waits for space instead of spawning on a blocked tile', () => {
  const size = 3, cubies = makeCubies(size), all = getAllSurfaceTiles(size);
  const occupied = new Set(all.map(tileKeyOf));
  expect(storyBombTile(all[0], size, cubies, occupied, null)).toBeNull();
  occupied.delete(tileKeyOf(all.at(-1)));
  expect(storyBombTile(all[0], size, cubies, occupied, null)).toEqual(all.at(-1));
});
