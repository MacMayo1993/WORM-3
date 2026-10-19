import { afterEach, expect, it } from 'vitest';
import { stageStory, replenishStoryTunnel } from '../worm/story/runtime.js';
import { storyLevel, WORM_STORY_LEVELS } from '../worm/story/levels.js';
import { makeWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { getActiveTunnels, findStickerByStableKey } from '../worm/wormLogic.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { healSticker } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { ttReset } from '../worm/circularBuffers.js';
import { FLIP_CAP } from '../utils/constants.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

afterEach(resetLiveRotation);

function setup(level = storyLevel(91)) {
  const size = level.cubeSize, sim = makeWormSim(size), p = stageStory(sim, size, level);
  sim.powerups = []; sim.specials = [];
  const state = { cubies: p.cubies };
  const pairs = () => getActiveTunnels(state.cubies, size);
  const seal = (pair = pairs()[0], cross = false) => {
    if (cross) p.tunnels.add(pair.pairId);
    for (const t of [pair.entry, pair.exit]) state.cubies = healSticker(state.cubies, size, t.x, t.y, t.z, t.dirKey);
  };
  const refill = () => {
    const next = replenishStoryTunnel(sim, p, state, size);
    if (next) state.cubies = next;
    return next;
  };
  return { size, sim, p, state, pairs, seal, refill };
}

it.each(WORM_STORY_LEVELS.filter(l => l.kind === 'tunnel'))(
  'level $id recovers distinct crossing opportunities after every authored pair was surrounded', level => {
    const h = setup(level);
    // Consume the entire authored inventory without any traversal credit.
    for (let i = 0; i < level.target; i++) { h.seal(); if (i + 1 < level.target) h.refill(); }
    while (h.pairs().length) h.seal();
    expect(h.p.tunnels.size).toBe(0);
    Object.assign(h.p.mechanics, h.p.tunnelGoals);
    for (let crossed = 0; crossed < level.target; crossed++) {
      h.refill(); h.refill();
      expect(h.pairs()).toHaveLength(2);
      expect(h.pairs().every(pair => !h.p.tunnels.has(pair.pairId))).toBe(true);
      h.seal(h.pairs()[0], true);
    }
    expect(h.p.tunnels.size).toBe(level.target);
    expect(h.refill()).toBeNull();
    expect(h.p.pendingMouths).toHaveLength(0);
  });

it('Chapter 10 level 1 bypasses pickup-blocked queued mouths at their rotated positions', () => {
  const h = setup(); h.seal();
  h.state.cubies = rotateSliceCubies(h.state.cubies, h.size, 'row', 1, 1);
  h.sim.powerups = h.p.pendingMouths.map(key => findStickerByStableKey(h.state.cubies, h.size, key));
  const blocked = new Set(h.sim.powerups.map(tileKey)), before = h.sim.powerups.slice();
  expect(h.refill()).not.toBeNull();
  expect(h.pairs()).toHaveLength(2);
  expect(h.sim.powerups).toEqual(before);
  for (const pair of h.pairs()) for (const t of [pair.entry, pair.exit]) expect(blocked.has(tileKey(t))).toBe(false);
});

it('keeps two self-pass opportunities after crossing is done, even with one retry pair left open', () => {
  const h = setup();
  h.p.tunnels = new Set(Array.from({ length: h.p.traversalTarget }, (_, i) => `crossed-${i}`));
  h.p.pendingMouths = [];
  h.seal();
  expect(h.refill()).not.toBeNull();
  expect(h.pairs()).toHaveLength(2);
  h.p.mechanics.selfPasses = 2;
  expect(h.refill()).toBeNull();
});

it('retries crossing supply safely after a fully occupied board clears', () => {
  const h = setup(storyLevel(2));
  while (h.pairs().length) h.seal();
  h.p.pendingMouths = [];
  h.sim.powerups = getAllSurfaceTiles(h.size);
  const before = h.state.cubies;
  expect(h.refill()).toBeNull(); expect(h.state.cubies).toBe(before);
  h.sim.powerups = []; h.sim.tailLength = 0; ttReset(h.sim.tileTrail, tileKey(h.sim.pos));
  expect(h.refill()).not.toBeNull(); expect(h.refill()).not.toBeNull();
  expect(h.pairs()).toHaveLength(2);
});

it('skips exhausted flip pairs instead of consuming a queue entry without opening a tunnel', () => {
  const h = setup(); h.seal();
  const queued = findStickerByStableKey(h.state.cubies, h.size, h.p.pendingMouths[0]);
  h.state.cubies[queued.x][queued.y][queued.z].stickers[queued.dirKey].flips = FLIP_CAP;
  expect(h.refill()).not.toBeNull();
  expect(h.pairs()).toHaveLength(2);
  expect(h.state.cubies[queued.x][queued.y][queued.z].stickers[queued.dirKey].curr)
    .toBe(h.state.cubies[queued.x][queued.y][queued.z].stickers[queued.dirKey].orig);
});

it.each(['orbs', 'jump', 'rotation'])('stages tunnels for explicit tunnel qualifiers on a %s level', kind => {
  const h = setup({ ...storyLevel(1), kind, mechanics: { ringHeals: 2, selfPasses: 1 } });
  expect(h.pairs()).toHaveLength(2);
  h.seal(); h.p.pendingMouths = [];
  expect(h.refill()).not.toBeNull();
  expect(h.pairs()).toHaveLength(2);
  h.p.mechanics = { ringHeals: 2, selfPasses: 1 };
  expect(h.refill()).toBeNull();
});
