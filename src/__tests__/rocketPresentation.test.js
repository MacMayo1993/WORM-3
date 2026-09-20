import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { rocketFrameInto } from '../worm/healerWorm/rocketOrbit.js';
import { wormSegments, beginWormSegments, pushWormSegment, endWormSegments, resetWormSegments } from '../worm/wormSegments.js';

describe('rocket presentation', () => {
  it('keeps exhaust on the real tail even when the shared effects feed is capped', () => {
    beginWormSegments();
    for (let i = 0; i < 200; i++) pushWormSegment(i * .09, 2, -3);
    endWormSegments();
    expect(wormSegments.count).toBe(wormSegments.max);
    expect(wormSegments.tailCount).toBe(200);
    expect(wormSegments.tail[0]).toBeCloseTo(199 * .09, 5);
    expect(wormSegments.beforeTail[0]).toBeCloseTo(198 * .09, 5);
    resetWormSegments();
    expect(wormSegments.tailCount).toBe(0);
  });
  it('keeps flight frames finite and orthogonal throughout all six face-edge crossings', () => {
    for (const sign of [-1, 1]) for (let axis = 0; axis < 3; axis++) {
      let previous;
      for (let i = 0; i <= 100; i++) {
        const a = i / 100 * Math.PI / 2;
        const position = new Vector3(1 + .6 * Math.cos(a), 1 + .6 * Math.sin(a), 0);
        const forward = new Vector3(-Math.sin(a), Math.cos(a), 0);
        const up = new Vector3(Math.cos(a), Math.sin(a), 0);
        const rotation = new Vector3().setComponent(axis, 1);
        for (const v of [position, forward, up]) v.applyAxisAngle(rotation, sign * Math.PI / 2);
        rocketFrameInto(forward, up, position, 3, 1);
        expect(forward.length()).toBeCloseTo(1, 6);
        expect(up.length()).toBeCloseTo(1, 6);
        expect(forward.dot(up)).toBeCloseTo(0, 6);
        if (previous) expect(forward.dot(previous)).toBeGreaterThan(.99);
        previous = forward.clone();
      }
    }
  });
});
