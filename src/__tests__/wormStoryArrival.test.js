import { expect, it } from 'vitest';
import { storyArrivalPose, STORY_ARRIVAL_SECONDS, STORY_ARRIVAL_REDUCED_SECONDS } from '../worm/healerWorm/storyArrival.js';
import { storyMouths } from '../worm/story/runtime.js';

it('keeps the worm absent for the portal opening and settles exactly onto its authored body', () => {
  expect(storyArrivalPose(0)).toMatchObject({ scale: 0, lift: 0, ring: 0 });
  expect(storyArrivalPose(0.2).scale).toBe(0);
  expect(storyArrivalPose(0.75).scale).toBeGreaterThan(0);
  expect(storyArrivalPose(0.75).scale).toBeLessThan(1);
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS).scale).toBe(1);
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS).lift).toBeCloseTo(0);
});
it('uses a brief motion-free reveal for reduced motion', () => {
  expect(storyArrivalPose(0.1, true)).toMatchObject({ lift: 0, ring: 0 });
  expect(storyArrivalPose(STORY_ARRIVAL_REDUCED_SECONDS, true)).toMatchObject({ scale: 1, lift: 0, ring: 0 });
});
it.each([3, 4, 5, 6])('varies safe opening mouths by level and keeps retries stable on %i', size => {
  const openings = Array.from({ length: 6 }, (_, i) => storyMouths(size, 1, i + 1));
  expect(new Set(openings.map(JSON.stringify)).size).toBe(6);
  expect(storyMouths(size, 2, 4)).toEqual(storyMouths(size, 2, 4));
});
