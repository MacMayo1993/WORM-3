import { beforeEach, expect, it } from 'vitest';
import { WORM_STORY_LEVELS, storyLevel, storyChecklist, storyOutcome } from '../worm/story/levels.js';
import { storyGrowthTarget } from '../worm/story/starGoals.js';
import { stageStory, replenishStoryTunnel } from '../worm/story/runtime.js';
import { makeWormSim } from '../worm/healerWorm/wormSim.js';
import { getActiveTunnels, findStickerByStableKey } from '../worm/wormLogic.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { healSticker } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { resetLiveRotation, liveRotation } from '../worm/liveRotation.js';
import { SMALL_BOARD_BUDGETS, difficultyFindings } from '../../tools/worm-level-auditor/web/audit.js';
import { modeledPowerBudget } from '../../tools/worm-level-auditor/web/generator.js';

beforeEach(resetLiveRotation);

it.each(WORM_STORY_LEVELS)('level $id has combined task/recovery headroom and board-appropriate growth', level => {
  expect(difficultyFindings({ ...level, starLength: storyGrowthTarget(level) }, modeledPowerBudget(level))).toEqual([]);
  const budget = SMALL_BOARD_BUDGETS[level.cubeSize];
  if (budget) expect(storyChecklist(level).length).toBeLessThanOrEqual(6);
});

it('level 60 can finish with repairs, food, growth and turns without either chain trick', () => {
  const level = storyLevel(60);
  expect(storyChecklist(level).map(goal => goal.key).sort()).toEqual(['bodyLength', 'healed', 'orbs', 'rotations']);
  expect(storyOutcome(level, { alive: true, elapsed: 400, cuts: 1, healed: 4, orbs: 28,
    bodyLength: 65, peakLength: 65, rotations: 3, remaining: 0, landed: true,
    tailClear: true, rotationSettled: true, selfPasses: 0, multiHeals: 0 })).not.toBeNull();
});

it('flags the former level 60 overload and combined work that passes a power-only check', () => {
  const old = { ...storyLevel(60), speed: 2.1, rotateEvery: 11, orbs: 42,
    mechanics: { selfPasses: 2, multiHeals: 1, bodyLength: 110 } };
  expect(difficultyFindings(old).map(f => f.key)).toEqual(expect.arrayContaining(['speed', 'bodyLength', 'orbs', 'rotations', 'chains']));
  const short = { ...storyLevel(57), limit: modeledPowerBudget(storyLevel(57)) + 1 };
  expect(difficultyFindings(short, modeledPowerBudget(short))).toContainEqual(expect.objectContaining({ key: 'workload' }));
});

function exhausted(id) {
  const level = storyLevel(id), size = level.cubeSize, sim = makeWormSim(size);
  const p = stageStory(sim, size, level, 'glow');
  sim.powerups = []; sim.specials = [];
  const state = { cubies: p.cubies, wormPaused: false, animState: null };
  const seal = () => {
    const pair = getActiveTunnels(state.cubies, size)[0];
    for (const mouth of [pair.entry, pair.exit]) {
      state.cubies = healSticker(state.cubies, size, mouth.x, mouth.y, mouth.z, mouth.dirKey);
    }
  };
  const refill = () => {
    const next = replenishStoryTunnel(sim, p, state, size);
    if (next) state.cubies = next;
    return next;
  };
  // Miss every chain. Exhaust all authored pairs without firing the final refill.
  for (let i = 0; i < level.target; i++) { seal(); if (i + 1 < level.target) refill(); }
  expect(getActiveTunnels(state.cubies, size)).toHaveLength(0);
  expect(p.pendingMouths).toHaveLength(0);
  return { level, size, sim, p, state, seal, refill };
}

it.each(WORM_STORY_LEVELS.filter(l => l.mechanics?.selfPasses || l.mechanics?.multiHeals || l.mechanics?.ringHeals).map(l => l.id))(
  'level %i supplies repeated missed-task attempts and stops when tasks are earned', id => {
    const { p, state, size, seal, refill } = exhausted(id);
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(refill()).not.toBeNull(); expect(refill()).not.toBeNull();
      expect(getActiveTunnels(state.cubies, size)).toHaveLength(2);
      expect(refill()).toBeNull(); // never more than two active pairs
      seal(); seal();
    }
    Object.assign(p.mechanics, p.tunnelGoals);
    expect(refill()).toBeNull();
    expect(p.pendingMouths).toHaveLength(0);
  });

it.each(['tail', 'pause', 'rotation', 'animation', 'heal', 'cut', 'rescue', 'reveal', 'dead'])(
  'does not reopen retry doors during %s', hold => {
    const { sim, p, state, refill } = exhausted(54);
    if (hold === 'tail') sim.tunnelPassages.push({ heal: { tunnelKey: 'old' } });
    if (hold === 'pause') state.wormPaused = true;
    if (hold === 'rotation') liveRotation.active = true;
    if (hold === 'animation') state.animState = {};
    if (hold === 'heal') sim.healPauseT = 1;
    if (hold === 'cut') sim.cutFocusT = 1;
    if (hold === 'rescue') sim.jumpRescueHeld = true;
    if (hold === 'reveal') sim.elementalFocusT = 1;
    if (hold === 'dead') sim.alive = false;
    expect(refill()).toBeNull();
    expect(p.pendingMouths).toHaveLength(0);
  });

it('follows rotated retry mouths and waits for pickups at both endpoints', () => {
  const { p, sim, state, size, refill } = exhausted(54);
  state.cubies = rotateSliceCubies(state.cubies, size, 'row', 1, 1);
  const map = buildManifoldGridMap(state.cubies, size);
  sim.powerups = p.retryMouths.map(key => {
    const mouth = findStickerByStableKey(state.cubies, size, key, map);
    return findAntipodalStickerByGrid(map, state.cubies[mouth.x][mouth.y][mouth.z].stickers[mouth.dirKey], size);
  });
  expect(refill()).toBeNull();
  expect(p.pendingMouths).toHaveLength(2);
  sim.powerups = [];
  expect(refill()).not.toBeNull(); expect(refill()).not.toBeNull();
  expect(getActiveTunnels(state.cubies, size)).toHaveLength(2);
});

it('does not reopen completed level 60 while the player hunts a third star', () => {
  const { p, refill } = exhausted(60);
  expect(p.tunnelGoals).toEqual({});
  expect(refill()).toBeNull();
});
