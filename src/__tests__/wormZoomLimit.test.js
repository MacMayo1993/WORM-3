import { describe, it, expect } from 'vitest';
import { boundedWormZoom, wormZoomLimit, wormSurfaceFov } from '../worm/healerWorm/zoomLimit.js';

it('frames the surface like a 10% closer camera at every portrait blend and growth distance', () => {
    for (const baseFov of [70, 73, 76, 79, 82]) for (const distance of [3, 8, 15, 30]) {
        const previousExtent = distance * Math.tan(baseFov * Math.PI / 360);
        const nextExtent = distance * Math.tan(wormSurfaceFov(baseFov) * Math.PI / 360);
        expect(nextExtent / previousExtent).toBeCloseTo(0.9, 12);
    }
});

describe('worm maximum zoom', () => {
    it('brings the maximum backward distance 20% closer for every cube size and aspect', () => {
        for (const size of [2, 3, 5, 7, 15]) for (const portraitBoost of [0, 0.2, 0.4]) {
            const base = 2.4 + portraitBoost * 0.9;
            const previousMax = base + (size * 2.6 * 0.8) * 0.8;
            expect(base + wormZoomLimit(size, base) * 0.8).toBeCloseTo(previousMax * 0.8);
            expect(boundedWormZoom(size, base, 10000, 2)).toBe(wormZoomLimit(size, base));
        }
    });
    it('preserves starting distance and early growth', () => {
        expect(boundedWormZoom(3, 2.4, 0, 0)).toBe(0);
        expect(boundedWormZoom(3, 2.4, 3, 0)).toBeCloseTo(0.54);
    });
    it('allows a pickup burst only within the common ceiling', () => {
        expect(boundedWormZoom(3, 2.4, 0, 0.8)).toBeCloseTo(0.8);
        expect(boundedWormZoom(3, 2.4, 24, 2)).toBe(wormZoomLimit(3, 2.4));
        expect(boundedWormZoom(3, 2.4, 20, 0)).toBeLessThan(boundedWormZoom(3, 2.4, 24, 0));
    });
});
