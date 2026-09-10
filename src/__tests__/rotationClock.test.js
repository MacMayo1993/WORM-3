// The rotation clock is the contract between HealerWormMode's frame loop (writer)
// and RotationCountdownHUD's rAF (reader). Neither side re-renders on it, so a
// field that stops being cleared shows up as a stale countdown on the next run
// rather than as an error anywhere.

import { describe, it, expect, beforeEach } from 'vitest';
import { rotationClock, resetRotationClock } from '../worm/healerWorm/rotationClockBridge.js';

describe('rotation clock bridge', () => {
  beforeEach(() => resetRotationClock());

  it('starts disarmed, which is what hides the readout', () => {
    expect(rotationClock.armed).toBe(false);
    expect(rotationClock.secondsLeft).toBe(0);
    expect(rotationClock.warning).toBe(0);
    expect(rotationClock.held).toBe(false);
  });

  it('clears every field a run wrote, so the next run starts blank', () => {
    Object.assign(rotationClock, {
      armed: true, secondsLeft: 4.2, total: 10, warning: 0.6, held: true, axis: 'row', sliceIndex: 2
    });
    rotationClock.sliceIndices.push(2, 5);
    resetRotationClock();
    expect(rotationClock).toEqual({
      armed: false, secondsLeft: 0, total: 0, warning: 0, held: false,
      axis: null, sliceIndex: null, sliceIndices: []
    });
  });

  it('truncates the plane list in place rather than replacing it', () => {
    // The writer copies into this array every frame and the sim reads it on orb
    // respawn — swapping in a fresh array would leave either side holding a stale
    // reference, so the reset has to empty the one they already share.
    const planes = rotationClock.sliceIndices;
    planes.push(1, 3);
    resetRotationClock();
    expect(rotationClock.sliceIndices).toBe(planes);
    expect(planes).toHaveLength(0);
  });
});
