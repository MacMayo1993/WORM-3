import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { PASSAGES, passagePoint, wormProgress, wormSegmentScale, WORM_SEGMENTS } from '../components/intro/introPassages.js';
import { IMPLODE_START, WORM_START } from '../components/intro/introTiming.js';

describe('intro hero passages', () => {
  it('anchors each route at opposite stickers at every explosion spacing', () => {
    expect(PASSAGES).toHaveLength(6);
    expect(new Set(PASSAGES).size).toBe(6);
    for (const pair of PASSAGES) for (const spacing of [1, 1.5, 2.5]) {
      const start = passagePoint(pair, 0, spacing, new Vector3());
      const end = passagePoint(pair, 1, spacing, new Vector3());
      const expected = new Vector3(...pair.position).multiplyScalar(spacing);
      expected.setComponent(pair.face.axis, expected.getComponent(pair.face.axis) + .54);
      expect(start.distanceTo(expected)).toBeLessThan(1e-8);
      expect(end.distanceTo(expected.negate())).toBeLessThan(1e-8);
      expect(passagePoint(pair, .5, spacing, new Vector3()).length()).toBeGreaterThan(.6);
    }
  });
  it('seats the path perpendicular to the portal and keeps it finite', () => {
    for (const pair of PASSAGES) {
      const start = passagePoint(pair, 0, 2.5, new Vector3());
      const heading = passagePoint(pair, .0001, 2.5, new Vector3()).sub(start).normalize();
      expect(heading.getComponent(pair.face.axis)).toBeLessThan(-.999);
      for (let u = 0; u <= 1; u += .01) {
        expect(passagePoint(pair, u, 2.5, new Vector3()).toArray().every(Number.isFinite)).toBe(true);
      }
    }
  });
  it('staggers travel and lets every tail exit before the cube closes', () => {
    expect(wormProgress(WORM_START, 0)).toBe(0);
    expect(wormProgress(WORM_START, 1)).toBeLessThan(0);
    PASSAGES.forEach((_, i) => expect(wormProgress(IMPLODE_START, i) - (WORM_SEGMENTS - 1) * .018).toBeGreaterThan(1));
    for (const u of [-.1, 0, 1, 1.1]) expect(wormSegmentScale(u, 0)).toBe(0);
    expect(wormSegmentScale(.5, 0)).toBeGreaterThan(wormSegmentScale(.5, WORM_SEGMENTS - 1));
  });
});
