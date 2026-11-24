import { describe, it, expect } from 'vitest';
import {
  HERO_PITCH, HERO_YAW, HERO_SWING_SECONDS, HERO_SWING_PULLBACK,
  heroDistanceScale, heroPositionInto, heroSwingInto
} from '../3d/cubeHeroView.js';

const len = (p) => Math.hypot(p.x, p.y, p.z);

describe('cube hero view', () => {
  it('sits at three-quarters: right, above and in front, so three faces show', () => {
    const p = heroPositionInto({}, 14);
    expect(len(p)).toBeCloseTo(14, 6);
    expect(p.x).toBeGreaterThan(0);
    expect(p.y).toBeGreaterThan(0);
    expect(p.z).toBeGreaterThan(p.x);
    // Steep enough to read the top face, not so steep the front loses out.
    expect(HERO_PITCH).toBeGreaterThan(0.3);
    expect(HERO_PITCH).toBeLessThan(0.6);
    expect(HERO_YAW).toBeGreaterThan(0.4);
    expect(HERO_YAW).toBeLessThan(Math.PI / 4);
  });

  it('pulls back further on narrow portrait screens than on wide ones', () => {
    expect(heroDistanceScale(390 / 844)).toBeGreaterThan(heroDistanceScale(1280 / 800));
    expect(heroDistanceScale(1280 / 800)).toBeGreaterThanOrEqual(1);
    expect(heroDistanceScale(0.3)).toBeLessThanOrEqual(1.2);
    expect(heroDistanceScale(NaN)).toBeGreaterThan(1);
  });

  it('swings in from face-on and pulled back, and lands exactly on the view', () => {
    const start = {};
    expect(heroSwingInto(start, 0, 14)).toBe(false);
    expect(start.x).toBeCloseTo(0, 6);
    expect(start.y).toBeCloseTo(0, 6);
    expect(start.z).toBeCloseTo(14 * HERO_SWING_PULLBACK, 6);
    const end = {};
    expect(heroSwingInto(end, HERO_SWING_SECONDS, 14)).toBe(true);
    const rest = heroPositionInto({}, 14);
    for (const k of ['x', 'y', 'z']) expect(end[k]).toBeCloseTo(rest[k], 6);
  });

  it('closes in monotonically, never overshooting the resting distance', () => {
    let last = Infinity;
    const p = {};
    for (let t = 0; t <= HERO_SWING_SECONDS; t += 0.05) {
      heroSwingInto(p, t, 14);
      expect(len(p)).toBeLessThanOrEqual(last + 1e-9);
      expect(len(p)).toBeGreaterThanOrEqual(14 - 1e-9);
      last = len(p);
    }
  });
});
