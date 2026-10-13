import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  storyArrivalPose, STORY_ARRIVAL_SECONDS, STORY_ARRIVAL_REDUCED_SECONDS,
  ARRIVAL_RAMP, arrivalBeadInto, arrivalHeadInto, arrivalPathPointInto, arrivalTuck,
} from '../worm/healerWorm/storyArrival.js';
import { storyMouths } from '../worm/story/runtime.js';
import { makeStepHistory, shPush } from '../worm/circularBuffers.js';

const at = fraction => storyArrivalPose(STORY_ARRIVAL_SECONDS * fraction);

it('opens the portal, pops the head out, then uncoils the body onto its authored trail', () => {
  expect(storyArrivalPose(0)).toMatchObject({ open: 0, ring: 0, rise: 0, emerge: 0 });
  expect(at(0.2).open).toBe(1);
  expect(at(0.23)).toMatchObject({ rise: 0, emerge: 0 });
  expect(at(0.42).rise).toBe(1);
  expect(at(0.42).emerge).toBeGreaterThan(0);
  expect(at(0.6).emerge).toBeGreaterThan(0.3);
  expect(at(0.6).emerge).toBeLessThan(1);
  expect(at(0.85).shock).toBeGreaterThan(0.5);
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS)).toMatchObject({ rise: 1, emerge: 1, ring: 0, shock: 0, settle: 1, step: 'go' });
  expect([0.1, 0.3, 0.6, 0.8].map(t => at(t).step)).toEqual([3, 2, 1, 'go']);
  expect(storyArrivalPose(STORY_ARRIVAL_SECONDS + 20)).toEqual(storyArrivalPose(STORY_ARRIVAL_SECONDS));
});

it('uncoils forward the whole way, never backing up', () => {
  let previous = -1;
  for (let i = 0; i <= 200; i++) {
    const { emerge } = at(i / 200);
    expect(emerge).toBeGreaterThanOrEqual(previous);
    previous = emerge;
  }
});

it('uses a brief motion-free reveal for reduced motion', () => {
  expect(storyArrivalPose(0.1, true)).toMatchObject({ rise: 1, emerge: 1, ring: 0, step: null });
  expect(storyArrivalPose(STORY_ARRIVAL_REDUCED_SECONDS, true).t).toBe(1);
});

it('pops the head out of the portal nose first and lands it level, at its real size', () => {
  const head = { grow: 0, lift: 0, pitch: 0 };
  expect(arrivalHeadInto(head, 0)).toMatchObject({ grow: 0 });
  expect(head.lift).toBeLessThan(0);
  expect(head.pitch).toBeGreaterThan(0.2);
  expect(arrivalHeadInto(head, 0.5).lift).toBeGreaterThan(0.1);
  for (let r = 0; r <= 1; r += 0.05) expect(arrivalHeadInto(head, r).grow).toBeLessThanOrEqual(1);
  arrivalHeadInto(head, 1);
  expect(head.grow).toBe(1);
  expect(head.lift).toBeCloseTo(0, 9);
  expect(head.pitch).toBeCloseTo(0, 9);
});

it('keeps the whole body in the portal at first and every bead at its real size once out', () => {
  const mouth = 0.81, bead = { grow: 0, lift: 0 };
  const start = arrivalTuck(0, mouth);
  // Every bead, the tail included, is still below the lip and drawn at nothing.
  for (let s = 0.09; s <= mouth + 1e-9; s += 0.09) expect(arrivalBeadInto(bead, s, start).grow).toBe(0);
  // Never larger than life: growth tops out at exactly 1.
  for (let s = 0; s <= mouth + ARRIVAL_RAMP; s += 0.01) {
    for (const tuck of [0, 0.2, 0.6]) expect(arrivalBeadInto(bead, s, tuck).grow).toBeLessThanOrEqual(1);
  }
  // A bead that just cleared the lip arches; at rest nothing is lifted or shrunk.
  expect(arrivalBeadInto(bead, 0.5, 0.3).lift).toBeGreaterThan(0.1);
  for (let s = 0.09; s <= mouth; s += 0.09) expect(arrivalBeadInto(bead, s, arrivalTuck(1, mouth))).toEqual({ grow: 1, lift: 0 });
});

it('walks the resting path on the tile surface and carries on off its end', () => {
  const normal = new Vector3(0, 0, 1);
  const history = makeStepHistory(64);
  // History carries its lift; the live head sits on the surface.
  for (let i = 10; i >= 1; i--) shPush(history, new Vector3(0, -0.1 * i, 1.58), normal, 0, 0, 0);
  const worm = { headInterpPos: { current: new Vector3(0, 0, 1.5) }, currentNormal: { current: normal }, stepHistory: { current: history } };
  const pos = new Vector3(), n = new Vector3();
  expect(arrivalPathPointInto(worm, 0, pos, n).toArray()).toEqual([0, 0, 1.5]);
  arrivalPathPointInto(worm, 0.55, pos, n);
  expect(pos.x).toBeCloseTo(0); expect(pos.y).toBeCloseTo(-0.55); expect(pos.z).toBeCloseTo(1.5);
  expect(n.toArray()).toEqual([0, 0, 1]);
  arrivalPathPointInto(worm, 1.3, pos, n);
  expect(pos.y).toBeCloseTo(-1.3); expect(pos.z).toBeCloseTo(1.5);
});

it.each([3, 4, 5, 6])('varies safe opening mouths by level and keeps retries stable on %i', size => {
  const openings = Array.from({ length: 6 }, (_, i) => storyMouths(size, 1, i + 1));
  expect(new Set(openings.map(JSON.stringify)).size).toBe(6);
  expect(storyMouths(size, 2, 4)).toEqual(storyMouths(size, 2, 4));
});
