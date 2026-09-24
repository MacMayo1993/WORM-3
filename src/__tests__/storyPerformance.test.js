import { describe, expect, it } from 'vitest';
import { Vector3, Mesh, MeshBasicMaterial, Raycaster, DoubleSide } from 'three';
import { hollowFrameGeometry } from '../3d/hollowFrameGeometry.js';
import { makeCubies } from '../game/cubeState.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { storySurfaceTile, nextStoryPower } from '../worm/story/mastery.js';
import { tileKey } from '../worm/healerWorm/wormSim.js';
import { storyHudSnapshot } from '../worm/story/hudSnapshot.js';
import { storyLevel, storyOutcome } from '../worm/story/levels.js';

const originalTileSearch = (pos, size, cubies, occupied) => getAllSurfaceTiles(size).find(tile => {
  const sticker = cubies[tile.x][tile.y][tile.z].stickers[tile.dirKey];
  const distance = Math.hypot(tile.x-pos.x, tile.y-pos.y, tile.z-pos.z);
  return tile.dirKey === pos.dirKey && distance >= (size >= 4 ? 2 : 1) && distance <= 3 &&
    sticker.curr === sticker.orig && !occupied.has(tileKey(tile));
});
describe('local story offerings', () => {
  it.each([2,3,4,5,6,7,8,9,10,15])('preserves placement on every face and edge of a %i cube', size => {
    const cubies = makeCubies(size), tiles = getAllSurfaceTiles(size);
    const occupied = new Set(tiles.filter((_, i) => i % 3 === 0).map(tileKey));
    for (const [i, tile] of tiles.entries()) if (i % 5 === 0) cubies[tile.x][tile.y][tile.z].stickers[tile.dirKey].curr = -1;
    for (const pos of tiles) expect(storySurfaceTile({ pos }, size, cubies, occupied))
      .toEqual(originalTileSearch(pos, size, cubies, occupied));
    expect(storySurfaceTile({ pos: tiles[0] }, size, cubies, new Set(tiles.map(tileKey)))).toBeUndefined();
  });
  it.each([27,30])('stops level %i offerings at its three authored elements', id => {
    const p = { mechanics: { explodes: 1, magnetOrbs: 4 }, elements: new Set(['water','fire']) };
    expect(nextStoryPower(p, storyLevel(id))).toBe('grass');
    p.elements.add('grass');
    expect(nextStoryPower(p, storyLevel(id))).toBeNull();
  });
});
it('shares hollow beam geometry without closing the holes or losing any of the twelve beams', () => {
  expect(hollowFrameGeometry.index.count / 3).toBe(12 * 12);
  expect(hollowFrameGeometry.groups).toHaveLength(0);
  expect(hollowFrameGeometry.boundingBox.min.toArray()).toEqual(expect.arrayContaining([expect.closeTo(-0.53, 5)]));
  expect(hollowFrameGeometry.boundingBox.max.toArray()).toEqual(expect.arrayContaining([expect.closeTo(0.53, 5)]));
  const mat = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(hollowFrameGeometry, mat);
  for (let axis = 0; axis < 3; axis++) {
    const direction = new Vector3().setComponent(axis, -1);
    const origin = new Vector3().setComponent(axis, 2);
    expect(new Raycaster(origin, direction).intersectObject(mesh)).toHaveLength(0);
    for (const offsetAxis of [0,1,2].filter(i => i !== axis)) for (const offset of [-0.49,0.49]) {
      const beam = origin.clone().setComponent(offsetAxis, offset);
      expect(new Raycaster(beam, direction).intersectObject(mesh).length).toBeGreaterThan(0);
    }
  }
  mat.dispose();
});
it('keeps idle HUD snapshots stable but publishes objective, timer, hint, clearance and run transitions immediately', () => {
  const level = storyLevel(40);
  let metrics = { alive: true, elapsed: 1.1, orbs: 0, tailClear: false };
  let hud = storyHudSnapshot(null, level, metrics, 1, null);
  expect(storyHudSnapshot(hud, level, { ...metrics, elapsed: 1.9 }, 1, null)).toBe(hud);
  for (const change of [{ orbs: 1 }, { elapsed: 2.1 }, { powerHint: 'Next power' }, { tailClear: true }]) {
    metrics = { ...metrics, ...change };
    const next = storyHudSnapshot(hud, level, metrics, 1, null);
    expect(next).not.toBe(hud); hud = next;
  }
  expect(hud.checklist.goals.find(g => g.key === 'orbs').value).toBe(1);
  expect(storyHudSnapshot(hud, level, metrics, 2, null).checklist.runId).toBe(2);
  metrics = { ...metrics, ...level.mechanics, healed: level.target, orbs: level.orbs, rotations: level.rotations,
    remaining: 0, landed: true, rotationSettled: false };
  hud = storyHudSnapshot(hud, level, metrics, 1, storyOutcome(level, metrics));
  expect(hud.checklist.settling).toBe(true);
  metrics.rotationSettled = true;
  expect(storyHudSnapshot(hud, level, metrics, 1, storyOutcome(level, metrics)).checklist.settling).toBe(false);
});
