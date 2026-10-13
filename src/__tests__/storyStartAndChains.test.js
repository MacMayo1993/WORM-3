import { afterEach, describe, expect, it } from 'vitest';
import { WORM_STORY_LEVELS } from '../worm/story/levels.js';
import { stageStory, storyBodyPath, storyMouths, storyStartTile } from '../worm/story/runtime.js';
import { makeWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { DIR_FORWARD } from '../worm/healerWorm/constants.js';
import { getActiveTunnels } from '../worm/wormLogic.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { ttAt } from '../worm/circularBuffers.js';

afterEach(resetLiveRotation);
const stage = level => {
  const size = level.cubeSize ?? 5, sim = makeWormSim(size);
  return { size, sim, p: stageStory(sim, size, level, 'classic') };
};
const sameFaceDistance = (a, b) => a.dirKey !== b.dirKey ? Infinity
  : Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);

describe('Story start tile', () => {
  it.each([3, 4, 5, 6, 8, 10])('starts on the middle tile of a %i board with the body straight behind the heading', size => {
    const [c, m] = storyStartTile(size);
    expect(c).toBe(Math.floor(size / 2));
    expect(m).toBe(Math.floor((size - 1) / 2));
    const path = storyBodyPath(size, { kind: 'tunnel', id: 2 });
    expect(path[0]).toEqual([c, m]);
    // The stretch behind the head runs straight down its column, opposite "up".
    for (let v = m; v >= 0; v--) expect(path[m - v]).toEqual([c, v]);
    expect(path.length).toBeGreaterThanOrEqual(2);
  });

  // A 2×2 has no middle tile or room behind the bottom row; it keeps its old start.
it.each(WORM_STORY_LEVELS.filter(level => level.kind !== 'jump' && (level.cubeSize ?? 5) > 2))('level $id stages the head facing along its own body', level => {
    const { size, sim } = stage(level);
    const [c, m] = storyStartTile(size);
    expect(sim.pos).toEqual({ x: c, y: m, z: size - 1, dirKey: 'PZ' });
    expect(sim.moveDir).toBe('up');
    expect(sim.headInterpPos.toArray()).toEqual(getStickerWorldPos(c, m, size - 1, 'PZ', size, 0));
    expect(ttAt(sim.tileTrail, 0)).toBe(tileKey(sim.pos));
    // The body leaves the head straight backwards: no hook to the side.
    const forward = DIR_FORWARD.PZ.up;
    const head = sim.headInterpPos, neck = sim.stepHistory.buf[(sim.stepHistory.head - 1 + sim.stepHistory.capacity) % sim.stepHistory.capacity].pos;
    const back = [neck.x - head.x, neck.y - head.y];
    expect(back[0] * forward[0] + back[1] * forward[1]).toBeLessThan(0);
    expect(Math.abs(back[0])).toBeLessThan(1e-6);
  });

  it.each(WORM_STORY_LEVELS.filter(level => ['tunnel', 'collector', 'restore', 'mastery'].includes(level.kind)))(
    'level $id keeps every mouth off the start tile, its neighbours and the body trail', level => {
      const size = level.cubeSize ?? 5, edge = size - 1, [c, m] = storyStartTile(size);
      const body = new Set(storyBodyPath(size, level).map(([u, v]) => `${u},${v}`));
      for (const [x, y, z, dir] of storyMouths(size, level.target, level.id, { chain: !!level.mechanics?.multiHeals })) {
        if (dir !== 'PZ' || z !== edge) continue;
        expect(body.has(`${x},${y}`)).toBe(false);
        expect(Math.abs(x - c) + Math.abs(y - m)).toBeGreaterThan(1);
      }
    });
});

describe('double-heal levels open neighbouring pairs', () => {
  it.each(WORM_STORY_LEVELS.filter(level => level.mechanics?.multiHeals))('level $id opens two pairs close at both ends', level => {
    const { size, p } = stage(level);
    const open = getActiveTunnels(p.cubies, size);
    expect(open).toHaveLength(2);
    const [a, b] = open;
    // Riding out of one pair lands within a couple of tiles of the other, and the
    // ride back out of that one lands beside the first again.
    const ends = [a.entry, a.exit];
    for (const end of ends) {
      expect(Math.min(sameFaceDistance(end, b.entry), sameFaceDistance(end, b.exit))).toBeLessThanOrEqual(2);
    }
  });

  it('keeps spreading pairs across faces on levels without double heals', () => {
    const level = WORM_STORY_LEVELS.find(l => l.target >= 2 && !l.mechanics?.multiHeals && l.kind === 'restore' && (l.cubeSize ?? 5) >= 5);
    const mouths = storyMouths(level.cubeSize, 2, level.id);
    expect(mouths[0][3]).not.toBe(mouths[1][3]);
  });
});
