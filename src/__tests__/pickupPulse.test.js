import { describe, it, expect } from 'vitest';
import { pickupPulse, PICKUP_PULSE_DURATION, advancePickupPulses, enqueuePickupPulse, MAX_PICKUP_PULSES, pickupGulpScale } from '../worm/healerWorm/pickupPulse.js';

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


describe('overlapping pickup presentation', () => {
    it('lets the first colour reach its original tail after another pickup', () => {
        const pulses = [];
        enqueuePickupPulse(pulses, 'yellow', 20, 17);
        advancePickupPulses(pulses, 0.3);
        enqueuePickupPulse(pulses, 'blue', 23, 20);
        advancePickupPulses(pulses, 0.425);
        expect(pulses[0].color).toBe('yellow');
        expect(pickupPulse(pulses[0].age, 19, pulses[0].count)).toBeCloseTo(1);
        expect(pulses[1].growthStart).toBe(20);
        advancePickupPulses(pulses, 0);
        expect(pulses[1].age).toBe(0.425);
        advancePickupPulses(pulses, PICKUP_PULSE_DURATION);
        expect(pulses).toEqual([]);
    });
    it('bounds rapid pickups while retaining the newest colour', () => {
        const pulses = [];
        for (let i = 0; i < 100; i++) enqueuePickupPulse(pulses, i, 20, 17);
        expect(pulses).toHaveLength(MAX_PICKUP_PULSES);
        expect(pulses.at(-1).color).toBe(99);
    });
    it('squeezes, rebounds and restores head and face to their original size', () => {
        expect(pickupGulpScale(0)).toBe(1);
        expect(pickupGulpScale(0.06)).toBeCloseTo(0.87);
        expect(pickupGulpScale(0.22)).toBeCloseTo(1.1);
        expect(pickupGulpScale(0.32)).toBe(1);
        expect(pickupGulpScale(Infinity)).toBe(1);
    });
});
