import { describe, it, expect } from 'vitest';
import { pickupPulse, PICKUP_PULSE_DURATION } from '../worm/healerWorm/pickupPulse.js';

describe('pickup body feedback', () => {
    it('reaches the head before the tail for short and maximum-length bodies', () => {
        for (const count of [2, 20, 1000]) {
            expect(pickupPulse(0.125, 0, count)).toBeCloseTo(1);
            expect(pickupPulse(0.125, count - 1, count)).toBe(0);
            expect(pickupPulse(0.725, count - 1, count)).toBeCloseTo(1);
        }
    });
    it('never overshoots and leaves every segment unchanged after completion', () => {
        for (const count of [1, 20, 1000]) for (let i = 0; i < count; i++) {
            expect(pickupPulse(-1, i, count)).toBe(0);
            expect(pickupPulse(PICKUP_PULSE_DURATION + 0.001, i, count)).toBe(0);
            expect(pickupPulse(Infinity, i, count)).toBe(0);
            for (const age of [0.1, 0.25, 0.5, 0.7]) {
                expect(pickupPulse(age, i, count)).toBeGreaterThanOrEqual(0);
                expect(pickupPulse(age, i, count)).toBeLessThanOrEqual(1);
            }
        }
    });
});
