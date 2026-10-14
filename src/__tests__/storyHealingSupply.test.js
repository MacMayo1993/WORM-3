import { afterEach, expect, it } from 'vitest';
import { stageStory, replenishStoryTunnel } from '../worm/story/runtime.js';
import { storyLevel, WORM_STORY_LEVELS } from '../worm/story/levels.js';
import { makeWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { getActiveTunnels, findStickerByStableKey } from '../worm/wormLogic.js';
import { healSticker } from '../game/cubeState.js';
import { ttReset } from '../worm/circularBuffers.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

afterEach(resetLiveRotation);

function setup(level = storyLevel(6)) {
  const size = level.cubeSize, sim = makeWormSim(size);
  const practice = stageStory(sim, size, level);
  sim.powerups = []; sim.specials = [];
  const state = { cubies: practice.cubies, animState: null };
  const pairs = () => getActiveTunnels(state.cubies, size);
  const refill = () => {
    const next = replenishStoryTunnel(sim, practice, state, size);
    if (next) state.cubies = next;
    return next;
  };
  const seal = () => {
    for (const p of [pairs()[0].entry, pairs()[0].exit]) {
      state.cubies = healSticker(state.cubies, size, p.x, p.y, p.z, p.dirKey);
    }
  };
  return { size, sim, practice, state, pairs, refill, seal };
}

it.each(WORM_STORY_LEVELS.filter(l => ['collector', 'restore', 'mastery'].includes(l.kind)))(
  'level $id keeps two pairs until the heal target is earned, then stops adding repairs', level => {
    const h = setup(level);
    for (let healed = 0; healed < level.target; healed++) {
      expect(h.pairs()).toHaveLength(2);
      h.seal(); h.sim.healed++;
      h.refill();
    }
    // Tunnel-specific tasks can still need supply after the basic heal goal.
    h.practice.mechanics = { ...level.mechanics };
    expect(h.refill()).toBeNull();
    expect(h.practice.pendingMouths).toHaveLength(0);
    while (h.pairs().length) h.seal();
    expect(h.refill()).toBeNull();
  });

it('recovers level 6 after the authored supply disappears without enough heal credit', () => {
  const h = setup();
  while (h.pairs().length) h.seal();
  h.practice.pendingMouths = [];
  h.sim.healed = 4;
  expect(h.refill()).not.toBeNull();
  expect(h.refill()).not.toBeNull();
  expect(h.pairs()).toHaveLength(2);
  expect(h.refill()).toBeNull();
});

it('uses another safe pair when every queued mouth is occupied, without moving pickups or adding queue debt', () => {
  const h = setup();
  h.seal(); h.sim.healed++;
  const mouths = h.practice.pendingMouths.map(key => findStickerByStableKey(h.state.cubies, h.size, key));
  h.sim.powerups = mouths.slice(1);
  ttReset(h.sim.tileTrail, tileKey(mouths[0]));
  const occupied = new Set(mouths.map(tileKey));
  const count = h.practice.pendingMouths.length;
  const pickups = h.sim.powerups.slice();
  expect(h.refill()).not.toBeNull();
  expect(h.pairs()).toHaveLength(2);
  expect(h.practice.pendingMouths).toHaveLength(count - 1);
  expect(h.sim.powerups).toEqual(pickups);
  for (const pair of h.pairs()) for (const end of [pair.entry, pair.exit]) {
    expect(occupied.has(tileKey(end))).toBe(false);
  }
});

it('waits safely when all free tiles are occupied and retries when space opens', () => {
  const h = setup(); h.seal();
  h.sim.powerups = getAllSurfaceTiles(h.size);
  const before = h.state.cubies;
  const pending = h.practice.pendingMouths.slice();
  expect(h.refill()).toBeNull();
  expect(h.state.cubies).toBe(before);
  expect(h.practice.pendingMouths).toEqual(pending);
  h.sim.powerups = [];
  expect(h.refill()).not.toBeNull();
  expect(h.pairs()).toHaveLength(2);
});

it.each(['wormPaused', 'animState'])('does not refill during %s', flag => {
  const h = setup(); h.seal(); h.practice.pendingMouths = [];
  h.state[flag] = true;
  expect(h.refill()).toBeNull();
  h.state[flag] = false;
  expect(h.refill()).not.toBeNull();
});

it('keeps traversal-only levels finite', () => {
  const h = setup(storyLevel(2));
  while (h.pairs().length) h.seal();
  h.practice.pendingMouths = [];
  expect(h.refill()).toBeNull();
});
