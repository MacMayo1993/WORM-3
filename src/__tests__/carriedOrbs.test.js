import { describe, expect, it } from 'vitest';
import { cutCarriedOrbs, ensureOrbSegments, spendCarriedOrbs } from '../worm/healerWorm/carriedOrbs.js';
import { computeOrbDeposit } from '../worm/healerWorm/economy.js';
import { BASE_TAIL_LENGTH } from '../worm/healerWorm/constants.js';

const body = () => ({ orbPickupColors: ['red', 'blue', 'yellow'], orbPickupFaceIds: [1, 2, 3], orbPickupSegments: [3, 3, 3] });

describe('carried orb material', () => {
    it('spends the matching face rather than the last pickup', () => {
        const carried = body();
        spendCarriedOrbs(carried, { 1: 3, 2: 3, 3: 3 }, { 1: 0, 2: 3, 3: 3 });
        expect(carried.orbPickupColors).toEqual(['blue', 'yellow']);
        expect(carried.orbPickupFaceIds).toEqual([2, 3]);
        expect(carried.orbPickupSegments).toEqual([3, 3]);
    });
    it('keeps a partially paid pickup and preserves survivor order', () => {
        const carried = body();
        spendCarriedOrbs(carried, { 1: 3, 2: 3, 3: 3 }, { 1: 3, 2: 1, 3: 3 });
        expect(carried.orbPickupColors).toEqual(['red', 'blue', 'yellow']);
        expect(carried.orbPickupSegments).toEqual([3, 1, 3]);
    });
    it('follows Prism matching-first inventory deductions', () => {
        const carried = body();
        const inventory = { 1: 3, 2: 3, 3: 3 };
        const deposit = computeOrbDeposit({ inventory, deposited: 0, entryFaceId: 2, tailLength: BASE_TAIL_LENGTH + 9, isPrism: true });
        spendCarriedOrbs(carried, inventory, deposit.nextInventory);
        const total = carried.orbPickupSegments.reduce((a, b) => a + b, 0);
        expect(total).toBe(9 - deposit.n);
        for (const face of [1, 2, 3]) {
            expect(carried.orbPickupSegments.reduce((sum, n, i) => sum + (carried.orbPickupFaceIds[i] === face ? n : 0), 0)).toBe(deposit.nextInventory[face]);
        }
    });
    it('splits bonus growth and recovered partial pickups exactly', () => {
        const carried = { orbPickupColors: ['red', 'blue'], orbPickupFaceIds: [1, 2], orbPickupSegments: [5, 2] };
        expect(cutCarriedOrbs(carried, 4)).toEqual({ colors: ['red', 'blue'], faceIds: [1, 2], segments: [1, 2] });
        expect(carried.orbPickupSegments).toEqual([4]);
        expect(carried.orbPickupColors).toEqual(['red']);
        expect(cutCarriedOrbs(carried, 2)).toEqual({ colors: ['red'], faceIds: [1], segments: [2] });
        expect(carried.orbPickupSegments).toEqual([2]);
    });
    it('does not invent material when tracked bodies have unrelated extra length', () => {
        const carried = body();
        ensureOrbSegments(carried, 20);
        expect(carried.orbPickupSegments).toEqual([3, 3, 3]);
    });
    it('initializes legacy demo entries and never retains material beyond capacity', () => {
        const carried = body();
        delete carried.orbPickupSegments;
        ensureOrbSegments(carried, 7);
        expect(carried.orbPickupSegments).toEqual([3, 3, 1]);
    });
});
