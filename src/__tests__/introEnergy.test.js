import { describe, expect, it } from 'vitest';
import { introEnergy, introMote } from '../components/intro/introEnergy.js';

describe('opening atmosphere bounds', () => {
  it('disables every accent in reduced motion and clears visible effects at completion', () => {
    for (let t = 0; t < 9; t += 0.02) {
      expect(Object.values(introEnergy(t, true)).every(v => v === 0)).toBe(true);
      for (const value of Object.values(introEnergy(t))) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    const end = introEnergy(8.5);
    expect(end.charge + end.burst + end.dust + end.push).toBe(0);
  });
  it('keeps motes bounded and preserves their positions between quality tiers', () => {
    const full = Array.from({ length: 96 }, (_, i) => introMote(i));
    const phone = Array.from({ length: 48 }, (_, i) => introMote(i));
    expect(phone).toEqual(full.slice(0, 48));
    for (const p of full) expect(Math.hypot(...p)).toBeCloseTo(1, 10);
  });
});
