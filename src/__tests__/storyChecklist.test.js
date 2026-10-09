import { it, expect } from 'vitest';
import { WORM_STORY_LEVELS, storyLevel, storyChecklist, storyOutcome } from '../worm/story/levels.js';

it('shows every level-seven task separately and checks only completed work', () => {
  const level = storyLevel(7);
  const goals = storyChecklist(level, { boosts: 2, doubleJumps: 1, rockets: 0, magnetOrbs: 4, orbs: 12, healed: 1 });
  expect(goals.map(g => g.key)).toEqual(['boosts', 'doubleJumps', 'rockets', 'magnetOrbs', 'healed', 'orbs']);
  expect(goals.filter(g => g.done).map(g => g.key)).toEqual(['boosts', 'magnetOrbs']);
  expect(storyChecklist(level).every(g => g.value === 0 && !g.done)).toBe(true);
});
it.each(WORM_STORY_LEVELS)('matches the completion requirements for level $id', level => {
  const goals = storyChecklist(level);
  const metrics = { alive: true, elapsed: 1, remaining: 0, tailClear: true, landed: true, rotationSettled: true };
  for (const goal of goals) metrics[goal.key] = goal.target;
  expect(storyOutcome(level, metrics)).not.toBeNull();
  for (const goal of goals) {
    expect(storyOutcome(level, { ...metrics, [goal.key]: goal.target - 1 })).toBeNull();
  }
  expect(storyChecklist(level, metrics).every(g => g.done)).toBe(true);
});

it.each(WORM_STORY_LEVELS.filter(level => level.kind === 'mastery'))('level $id finishes its listed tasks without requiring old tail routes or extra tunnels', level => {
  const metrics = { alive: true, elapsed: 1, cuts: 0, peakLength: 456, remaining: 2,
    tailClear: false, landed: true, onSurface: true, healSettled: true, rotationSettled: true };
  for (const goal of storyChecklist(level)) metrics[goal.key] = goal.target;
  expect(storyOutcome(level, metrics)).not.toBeNull();
  for (const held of [{ landed: false }, { healSettled: false }, { rotationSettled: false }, { alive: false }, { elapsed: level.limit + 1 }]) {
    expect(storyOutcome(level, { ...metrics, ...held })).toBeNull();
  }
});
