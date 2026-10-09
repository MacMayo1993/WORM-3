import { expect, it } from 'vitest';
import { WORM_STORY_LEVELS, storyLevel, storyChecklist, storyOutcome } from '../worm/story/levels.js';
import { storyGrowthTarget, storyStarRules, shouldFinishStory } from '../worm/story/starGoals.js';
import { makeWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { stageStory, storyMetrics, replenishStoryOrbs } from '../worm/story/runtime.js';
import { storyHudSnapshot } from '../worm/story/hudSnapshot.js';
import { BASE_TAIL_LENGTH, MAX_TAIL } from '../worm/healerWorm/constants.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

const completed = level => ({ alive: true, elapsed: level.par, cuts: 0,
  ...Object.fromEntries(storyChecklist(level).map(goal => [goal.key, goal.target])),
  tailClear: true, landed: true, rotationSettled: true, remaining: 0,
  peakLength: storyGrowthTarget(level) });

it.each(WORM_STORY_LEVELS)('requires real growth for three stars on level $id and keeps a lower-star clear possible', level => {
  const metrics = completed(level);
  expect(storyOutcome(level, metrics)?.stars).toBe(3);
  expect(storyGrowthTarget(level)).toBeGreaterThan(BASE_TAIL_LENGTH);
  expect(storyGrowthTarget(level)).toBeLessThanOrEqual(MAX_TAIL);
  expect(storyOutcome(level, { ...metrics, peakLength: metrics.peakLength - 1 })?.stars).toBe(2);
  expect(storyOutcome(level, { ...metrics, peakLength: undefined, orbs: 999 })?.stars).toBe(2);
  expect(storyOutcome(level, { ...metrics, elapsed: level.par + 0.01 })?.stars).toBe(2);
  expect(storyOutcome(level, { ...metrics, cuts: 1 })?.stars).toBe(2);
  expect(storyOutcome(level, { ...metrics, cuts: 1, elapsed: level.par + 0.01 })?.stars).toBe(1);
  expect(storyOutcome(level, { ...metrics, elapsed: level.limit + 0.01 })).toBeNull();
  for (const goal of storyChecklist(level)) {
    expect(storyOutcome(level, { ...metrics, [goal.key]: goal.target - 1 })).toBeNull();
  }
  const rules = storyStarRules(level);
  expect(rules[0]).toContain(`${level.limit}s`);
  expect(rules[1]).toContain(' OR ');
  expect(rules[2]).toContain(`${metrics.peakLength} body segments`);
});

it('offers a finish button while growth is attainable, then finishes at three stars or par expiry', () => {
  const level = storyLevel(2), metrics = { ...completed(level), elapsed: 50, peakLength: 10 };
  const outcome = storyOutcome(level, metrics);
  expect(shouldFinishStory(level, metrics, outcome)).toBe(false);
  expect(shouldFinishStory(level, metrics, null)).toBe(false);
  for (const patch of [{ peakLength: storyGrowthTarget(level) }, { elapsed: level.par }, { cuts: 1 }]) {
    const changed = { ...metrics, ...patch };
    expect(shouldFinishStory(level, changed, storyOutcome(level, changed))).toBe(true);
  }
  const hud = storyHudSnapshot(null, level, metrics, 42, outcome);
  expect(hud.checklist).toMatchObject({ canFinish: true, settling: false, starGoals: { peakLength: 10, grown: false } });
  expect(storyHudSnapshot(hud, level, { ...metrics, peakLength: 13 }, 42, outcome)).not.toBe(hud);
});

it('keeps peak length through a healing deposit and resets it on retry', () => {
  resetLiveRotation();
  const level = storyLevel(2), sim = makeWormSim(level.cubeSize);
  const practice = stageStory(sim, level.cubeSize, level);
  const state = { wormSessionOrbs: 12, rotationEpoch: 0 };
  sim.tailLength = 46;
  expect(storyMetrics(sim, practice, level, state, [], 0.05).peakLength).toBe(46);
  sim.tailLength = 10;
  expect(storyMetrics(sim, practice, level, state, [], 0.05).peakLength).toBe(46);
  // A pickup and deposit can occur within the same tick: retain the pickup peak.
  sim.peakTailLength = 49;
  expect(storyMetrics(sim, practice, level, state, [], 0.05).peakLength).toBe(49);
  const retry = stageStory(sim, level.cubeSize, level);
  expect(storyMetrics(sim, retry, level, state, [], 0.05).peakLength).toBe(BASE_TAIL_LENGTH);
});

it.each(['glow', 'classic'])('bounds food density and refills all 120 levels with unique pickups (%s)', character => {
  resetLiveRotation();
  for (const level of WORM_STORY_LEVELS) {
    const size = level.cubeSize, sim = makeWormSim(size);
    const practice = stageStory(sim, size, level, character);
    const initial = sim.powerups.length;
    expect(initial).toBeLessThanOrEqual(size <= 3 ? Math.floor(6 * size * size * 0.6) : 90);
    expect(new Set(sim.powerups.map(tileKey)).size).toBe(initial);
    if (size >= 6) expect(initial).toBeGreaterThanOrEqual(60);
    sim.powerups = [];
    const state = { cubies: practice.cubies, wormPaused: false, animState: null };
    for (let i = 0; i < 30; i++) {
      practice.orbRefillDelay = 0;
      replenishStoryOrbs(sim, practice, state, size, 0.1);
    }
    expect(sim.powerups.length).toBe(initial);
  }
});
