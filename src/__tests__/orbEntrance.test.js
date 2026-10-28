import { describe, it, expect, beforeEach } from 'vitest';
import {
  orbEntrance, holdOrbEntrance, setOrbEntranceClock, releaseOrbEntrance, orbEntranceT,
  orbWaveReach, orbWaveStart, orbRiseSeconds, orbRisePoseInto, orbRisePingInto,
  ORB_WAVE_FROM, ORB_WAVE_TO, ORB_RISE_SECONDS,
} from '../worm/orbEntrance.js';
import { arrivalSeconds, storyArrivalPose } from '../worm/healerWorm/storyArrival.js';

const HOVER = 0.28;

describe('orb entrance bridge', () => {
  beforeEach(() => releaseOrbEntrance());

  it('holds a run\'s orbs at the start of the wave until the arrival clock runs, then lets them all through', () => {
    const run = orbEntrance.run;
    holdOrbEntrance();
    expect(orbEntrance.run).toBe(run + 1);
    expect(orbEntrance.held).toBe(true);
    expect(orbEntranceT()).toBe(0);
    setOrbEntranceClock(1.7, 3.4);
    expect(orbEntranceT()).toBeCloseTo(0.5);
    releaseOrbEntrance();
    expect(orbEntrance.held).toBe(false);
    expect(orbEntranceT()).toBe(1);
  });
});

describe('orb entrance wave', () => {
  it('leaves the portal once the head is out and reaches the far side of any board', () => {
    expect(orbWaveStart(orbWaveReach(0, 5))).toBe(ORB_WAVE_FROM);
    // The farthest point of the surface from a face centre is a corner of the far face.
    for (const size of [2, 3, 5, 10, 15]) {
      const far = Math.hypot(size / 2, size / 2, size);
      expect(orbWaveReach(far, size)).toBeGreaterThan(0.95);
      expect(orbWaveStart(orbWaveReach(far, size))).toBeLessThanOrEqual(ORB_WAVE_TO);
      expect(orbWaveReach(size / 2, size)).toBeLessThan(orbWaveReach(size, size));
    }
    // The head is popping out of the portal before the first orb moves.
    expect(storyArrivalPose(ORB_WAVE_FROM * arrivalSeconds()).rise).toBeGreaterThan(0.4);
  });

  it('has every orb up by GO on the full arrival and before control starts on every arrival', () => {
    const full = arrivalSeconds();
    const go = [...Array(1000).keys()].map(i => (i / 1000) * full).find(t => storyArrivalPose(t).step === 'go');
    expect(ORB_WAVE_TO * full + orbRiseSeconds(full)).toBeLessThanOrEqual(go);
    for (const [reduced, quick] of [[false, false], [false, true], [true, false]]) {
      const duration = arrivalSeconds(reduced, quick);
      expect(ORB_WAVE_TO * duration + orbRiseSeconds(duration)).toBeLessThan(duration);
    }
    // A start with no arrival (demo lessons) rises on the ordinary clock.
    expect(orbRiseSeconds(0)).toBe(ORB_RISE_SECONDS);
  });
});

describe('orb rise pose', () => {
  it('comes up out of the tile small, pops a touch past its hover and settles exactly', () => {
    const pose = {};
    orbRisePoseInto(pose, 0, HOVER);
    expect(pose.sink).toBeCloseTo(HOVER);
    expect(pose.scale).toBeCloseTo(0.35);
    let overshoot = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      orbRisePoseInto(pose, p, HOVER);
      overshoot = Math.min(overshoot, pose.sink);
      expect(pose.scale).toBeLessThan(1.12);
    }
    expect(overshoot).toBeLessThan(0);
    expect(overshoot).toBeGreaterThan(-0.12 * HOVER);
    orbRisePoseInto(pose, 1, HOVER);
    expect(pose).toEqual({ sink: 0, scale: 1 });
  });

  it('keeps reduced motion still: the reveal fades the orb in place', () => {
    const pose = orbRisePoseInto({}, 0.3, HOVER, true);
    expect(pose).toEqual({ sink: 0, scale: 1 });
    expect(orbRisePingInto({}, 0.3, true).intensity).toBe(0);
  });

  it('sends one ring across the tile that widens and is gone when the orb is up', () => {
    const ping = {};
    expect(orbRisePingInto(ping, 0).intensity).toBe(0);
    const early = orbRisePingInto({}, 0.1), late = orbRisePingInto({}, 0.8);
    expect(early.intensity).toBeGreaterThan(late.intensity);
    expect(late.scale).toBeGreaterThan(early.scale);
    expect(orbRisePingInto(ping, 1).intensity).toBe(0);
  });
});
