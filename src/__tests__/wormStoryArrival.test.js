import { expect, it } from 'vitest';
import { storyArrivalPose, STORY_ARRIVAL_SECONDS, STORY_ARRIVAL_REDUCED_SECONDS } from '../worm/healerWorm/storyArrival.js';
import { storyMouths } from '../worm/story/runtime.js';

it('keeps the worm absent for the portal opening and settles exactly onto its authored body', () => {
  expect(storyArrivalPose(0)).toMatchObject({ scale: 0, lift: 0, ring: 0 });
  expect(storyArrivalPose(0.2).scale).toBe(0);
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS * 0.6).scale).toBeGreaterThan(0);
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS * 0.72).scale).toBeGreaterThan(3);
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS)).toMatchObject({ scale: 1, yaw: 0, ring: 0, burst: 0, step: 'go' });
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

it('charges before revealing, then releases into the exact rest pose', () => {
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS * 0.4).scale).toBe(0);
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS * 0.65).lift).toBeGreaterThan(0.5);
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS * 0.78).burst).toBeGreaterThan(0.5);
  expect([0.1, 0.3, 0.6, 0.8].map(t => storyArrivalPose(t * STORY_ARRIVAL_SECONDS).step)).toEqual([3, 2, 1, 'go']);
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS + 20)).toEqual(storyArrivalPose(STORY_ARRIVAL_SECONDS));
});
