import { afterEach, expect, it } from 'vitest';
import { stageStory, storyMetrics, replenishStoryTunnel } from '../worm/story/runtime.js';
import { storyLevel, storyOutcome, storyChecklist, storyFinishHint } from '../worm/story/levels.js';
import { makeWormSim } from '../worm/healerWorm/wormSim.js';
import { healSticker } from '../game/cubeState.js';
import { getActiveTunnels, findStickerByStableKey } from '../worm/wormLogic.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

afterEach(resetLiveRotation);

function completedRun(id = 69) {
  const level = storyLevel(id), size = level.cubeSize, sim = makeWormSim(size);
  const practice = stageStory(sim, size, level);
  let cubies = practice.cubies;
  for (const pair of getActiveTunnels(cubies, size)) {
    for (const p of [pair.entry, pair.exit]) cubies = healSticker(cubies, size, p.x, p.y, p.z, p.dirKey);
  }
  // Repairs/chain credit is earned, but two unused mouths are still queued.
  practice.pendingMouths = practice.pendingMouths.slice(0, 2);
  // Food can hold those mouths closed, reproducing an empty visible network.
  sim.powerups = practice.pendingMouths.map(key => findStickerByStableKey(cubies, size, key));
  practice.mechanics = { ...level.mechanics };
  practice.elements = new Set(practice.elementOrder);
  practice.rotationEpoch = 0;
  sim.healed = level.target;
  const state = { cubies, rotationEpoch: level.rotations, wormSessionOrbs: level.orbs, animState: null };
  const read = (tunnels = []) => storyMetrics(sim, practice, level, state, tunnels, 0.05);
  return { level, size, sim, practice, state, read };
}

it('level 69 finishes with all five goals earned and no open pairs, despite unused queued mouths', () => {
  const { level, size, sim, practice, state, read } = completedRun();
  expect(getActiveTunnels(state.cubies, size)).toHaveLength(0);
  expect(storyChecklist(level, read()).every(goal => goal.done)).toBe(true);
  expect(replenishStoryTunnel(sim, practice, state, size)).toBeNull();
  expect(practice.pendingMouths).toHaveLength(0);
  const metrics = read();
  expect(metrics.remaining).toBe(0);
  expect(storyFinishHint(level, metrics)).toBeNull();
  expect(storyOutcome(level, metrics)).not.toBeNull();
});

it('counts real open pairs and still waits for the tail, healing and rotation', () => {
  const { level, sim, read } = completedRun();
  const open = read([{}, {}]);
  expect(open.remaining).toBe(2);
  expect(storyOutcome(level, open)).toBeNull();
  const closed = read();
  for (const extra of [{ tailClear: false }, { rotationSettled: false }, { landed: false }]) {
    expect(storyOutcome(level, { ...closed, ...extra })).toBeNull();
  }
  sim.healPauseT = 1;
  expect(storyOutcome(level, read())).toBeNull();
});

it.each(['heals', 'chain'])('keeps queued pairs when the %s goal is unfinished', missing => {
  const { size, sim, practice, state, read } = completedRun();
  if (missing === 'heals') sim.healed--;
  else practice.mechanics.multiHeals = 0;
  expect(read().remaining).toBe(2);
  sim.powerups = []; sim.specials = [];
  expect(replenishStoryTunnel(sim, practice, state, size)).not.toBeNull();
  expect(practice.pendingMouths).toHaveLength(1);
});

it('preserves traversal supply even when a tunnel level has enough heal credit', () => {
  const { size, sim, practice, state, read } = completedRun(91);
  expect(read().remaining).toBe(2);
  sim.powerups = []; sim.specials = [];
  expect(replenishStoryTunnel(sim, practice, state, size)).not.toBeNull();
});
