import { expect, it } from 'vitest';
import { storyLevel, storyChecklist, storyOutcome } from '../worm/story/levels.js';
import { storyOrbTarget } from '../worm/story/starGoals.js';
import { stageStory } from '../worm/story/runtime.js';
import { offerStoryPower, updateMastery } from '../worm/story/mastery.js';
import { makeWormSim } from '../worm/healerWorm/wormSim.js';
import { isViewPower } from '../worm/healerWorm/viewPowerups.js';

// These lessons previously carried only a body-length mechanic. Replacing that
// qualification must not remove their landing guard or optional-power scheduler.
const FORMER_GROWTH_LESSONS = [1, 11, 21, 31, 39, 41, 42, 44, 51, 52, 56, 58, 71, 76, 92, 101, 103, 104];

it.each(FORMER_GROWTH_LESSONS)('level %i replaces length with orbs but still lands before finishing', id => {
  const level = storyLevel(id);
  expect(level.mechanics).toEqual({});
  expect(storyChecklist(level).some(goal => goal.key === 'bodyLength')).toBe(false);
  const metrics = { alive: true, elapsed: 1, cuts: 0, currentLength: 0, peakLength: 0,
    landed: true, tailClear: true, rotationSettled: true, remaining: 0,
    ...Object.fromEntries(storyChecklist(level).map(goal => [goal.key, goal.target])), orbs: storyOrbTarget(level) };
  expect(storyOutcome(level, metrics)).toMatchObject({ stars: 3 });
  expect(storyOutcome(level, { ...metrics, landed: false })).toBeNull();
});

it.each(FORMER_GROWTH_LESSONS)('level %i retains its optional-power clock and later view offer', id => {
  const level = storyLevel(id), size = level.cubeSize, sim = makeWormSim(size);
  const practice = stageStory(sim, size, level);
  practice.powerDelay = 0.1;
  updateMastery(sim, practice, level, 0.1);
  expect(practice.powerDelay).toBe(0);
  expect(practice.mechanics).toEqual({});
  // Make a free food cell, as a real pickup does, for an optional view offer.
  sim.powerups = [];
  const offered = offerStoryPower(sim, practice, level, size, practice.cubies);
  if (id >= 21) {
    expect(offered).toBe(true);
    expect(practice.viewOffered).toBe(true);
    expect(sim.specials.some(orb => isViewPower(orb.type))).toBe(true);
  } else {
    expect(offered).toBe(false);
    expect(practice.viewOffered).toBeFalsy();
  }
});
