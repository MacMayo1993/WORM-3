import { describe, it, expect } from 'vitest';
import { boundedWormZoom, wormZoomLimit, wormSurfaceFov } from '../worm/healerWorm/zoomLimit.js';

it('widens the previous standard framing by 20% at every portrait blend and growth distance', () => {
    for (const baseFov of [70, 73, 76, 79, 82]) for (const distance of [3, 8, 15, 30]) {
        const previousExtent = distance * Math.tan(baseFov * Math.PI / 360) * 0.9;
        const nextExtent = distance * Math.tan(wormSurfaceFov(baseFov) * Math.PI / 360);
        expect(nextExtent / previousExtent).toBeCloseTo(1.2, 12);
    }
});

describe('worm maximum zoom', () => {
    it('keeps a large collection close on every board and aspect', () => {
        for (const size of [2, 3, 5, 7, 8, 9, 10, 15]) for (const portraitBoost of [0, 0.2, 0.4]) {
            const base = 2.4 + portraitBoost * 0.9;
            expect(wormZoomLimit(size, base)).toBeLessThanOrEqual(1.5);
            expect(boundedWormZoom(size, base, 10000, 2)).toBe(wormZoomLimit(size, base));
            expect(base + boundedWormZoom(size, base, 10000, 0) * 0.8).toBeLessThanOrEqual(base + 1.2 + 1e-12);
        }
    });
    it('preserves the starting distance and eases growth with diminishing returns', () => {
        expect(boundedWormZoom(3, 2.4, 0, 0)).toBe(0);
        let previous = 0, previousStep = Infinity;
        for (let orbs = 1; orbs <= 250; orbs++) {
            const zoom = boundedWormZoom(15, 2.4, orbs, 0);
            const step = zoom - previous;
            expect(step).toBeGreaterThanOrEqual(0);
            expect(step).toBeLessThan(previousStep);
            expect(step).toBeLessThan(0.08);
            previous = zoom; previousStep = step;
        }
    });
    it('bounds bursts and negative inputs', () => {
        expect(boundedWormZoom(3, 2.4, -1, -1)).toBe(0);
        expect(boundedWormZoom(3, 2.4, 0, 0.8)).toBeCloseTo(0.8);
        expect(boundedWormZoom(3, 2.4, 24, 2)).toBe(wormZoomLimit(3, 2.4));
        expect(boundedWormZoom(0, 2.4, 100, 2)).toBe(0);
    });
});
