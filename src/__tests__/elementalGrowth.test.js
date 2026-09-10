import { describe, expect, it } from 'vitest';
import { natureBlade } from '../utils/elementalGrowth.js';
import { getGrassBladeMaterial } from '../3d/styles/GrassBlades.jsx';

describe('Nature coverage', () => {
  it('keeps growth inside its cover cell and leaves the center readable', () => {
    for (const seed of [0, 0.25, 7, 100]) for (let i = 0; i < 110; i++) {
      const blade = natureBlade(seed, i);
      const rim = Math.max(Math.abs(blade.x), Math.abs(blade.y));
      expect(rim).toBeGreaterThanOrEqual(0.19 - 1e-12);
      expect(rim).toBeLessThanOrEqual(0.38);
      expect(blade.height).toBeGreaterThanOrEqual(0.08);
      expect(blade.height).toBeLessThanOrEqual(0.24);
    }
  });
  it('preserves the same clusters after remounts and when detail is reduced', () => {
    const full = Array.from({ length: 110 }, (_, i) => natureBlade(42, i));
    const low = Array.from({ length: 64 }, (_, i) => natureBlade(42, i));
    expect(low).toEqual(full.slice(0, 64));
    expect(natureBlade(43, 0)).not.toEqual(full[0]);
  });
  it('isolates reduced-motion Nature from the animated grass material', () => {
    const still = getGrassBladeMaterial('#22c55e', true, false);
    const moving = getGrassBladeMaterial('#22c55e', true, true);
    expect(still).not.toBe(moving);
    expect(still.uniforms.time.value).toBe(0);
    expect(still.uniforms.time).not.toBe(moving.uniforms.time);
    expect(getGrassBladeMaterial('#22c55e').uniforms.elemental.value).toBe(0);
  });
});
