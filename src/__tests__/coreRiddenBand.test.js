import { describe, it, expect } from 'vitest';
import { coreOpeningBandWidth, coreOpeningRadius, coreRiddenBandWidth, RIDDEN_TRACK_WIDTH } from '../3d/corePassage.js';
import { tunnelRiderDockWidth } from '../utils/tunnelPath.js';
import { CORE_ZOOM_MAX } from '../3d/antipodalCore.js';

describe('the ridden band and the core opening', () => {
  it('keeps the exterior approach narrower than its actual tile-sized opening', () => {
    // Interior fragments are clipped, but the visible arms must meet their
    // smaller holes without covering adjacent stickers.
    for (const size of [2, 3, 5, 10, 15]) {
      expect(coreRiddenBandWidth(size, 1)).toBeCloseTo(coreOpeningBandWidth(size, 1), 10);
      for (let zoom = 1; zoom <= CORE_ZOOM_MAX; zoom += 0.25) {
        const width = coreRiddenBandWidth(size, zoom);
        expect(width).toBeLessThanOrEqual(coreOpeningBandWidth(size, zoom) + 1e-12);
        expect(width).toBeGreaterThan(0);
        expect(width).toBeLessThanOrEqual(Math.max(RIDDEN_TRACK_WIDTH, tunnelRiderDockWidth(size) * 1.5) + 1e-12);
      }
      expect(coreRiddenBandWidth(size, CORE_ZOOM_MAX)).toBeLessThan(0.3);
    }
  });

  it('fills the opening as the core swells while always leaving a rim', () => {
    for (const size of [2, 3, 5, 10, 15]) {
      expect(coreOpeningBandWidth(size, 1)).toBeCloseTo(coreOpeningRadius(size, 1) * 1.7, 10);
      for (let zoom = 1; zoom <= CORE_ZOOM_MAX; zoom += 0.25) {
        const width = coreOpeningBandWidth(size, zoom);
        expect(width).toBeGreaterThan(0);
        expect(width).toBeLessThan(2 * coreOpeningRadius(size, zoom));
        expect(width).toBeGreaterThan(1.5 * coreOpeningRadius(size, zoom));
      }
    }
  });
});
