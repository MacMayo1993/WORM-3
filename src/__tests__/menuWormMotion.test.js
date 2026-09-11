import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createMenuWormMotion, aimMenuWorm, stepMenuWorm, menuWormSegment } from '../3d/menuWormMotion.js';

it('keeps head and distance-following tail inside the stage through repeated turns', () => {
  const state = createMenuWormMotion();
  const out = new Vector3();
  for (let frame = 0; frame < 7200; frame++) {
    const heading = state.heading;
    stepMenuWorm(state, 1 / 60);
    expect(Math.abs(state.heading - heading)).toBeLessThanOrEqual(3.8 / 60 + 1e-8);
    for (let i = 0; i < 9; i++) {
      menuWormSegment(state, i, out);
      expect(Math.abs(out.x)).toBeLessThan(0.82);
      expect(Math.abs(out.z)).toBeLessThan(0.5);
      expect(out.y).toBe(0.105);
    }
  }
  expect(state.history).toHaveLength(256);
});
it('approaches a tapped destination and pauses there before roaming again', () => {
  const state = createMenuWormMotion();
  aimMenuWorm(state, 0.7, 0.55);
  for (let frame = 0; frame < 180; frame++) {
    stepMenuWorm(state, 1 / 60);
    if (state.wait > 0) break;
  }
  expect(Math.hypot(state.x - state.target.x, state.z - state.target.z)).toBeLessThan(0.07);
  const distance = state.distance;
  stepMenuWorm(state, 1 / 60);
  expect(state.distance).toBe(distance);
});
it('clamps edge taps to reachable floor coordinates', () => {
  const state = createMenuWormMotion();
  aimMenuWorm(state, 10, -10);
  expect(state.target).toEqual({ x: 0.58, z: -0.3 });
});
