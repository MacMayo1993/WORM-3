import { describe, it, expect } from 'vitest';
import { healingNeed } from '../worm/healerWorm/tunnelReadout.js';

describe('tunnel requirement units', () => {
  it('reports two pickups for four missing segments', () => {
    expect(healingNeed({ faceId: 1, tailLength: 4 })).toMatchObject({ pickupsNeeded: 2, ready: false });
  });
  it('counts the carried matching orb and saved partial deposits', () => {
    expect(healingNeed({ faceId: 1, tailLength: 7, inventory: { 1: 3 } })).toMatchObject({ payable: 3, pickupsNeeded: 1 });
    expect(healingNeed({ faceId: 1, tailLength: 7, inventory: { 1: 3 }, deposited: 1 })).toMatchObject({ pickupsNeeded: 0, ready: true, savedFraction: 0.25, payableFraction: 0.75 });
    expect(healingNeed({ faceId: 1, tailLength: 4, deposited: 3 })).toMatchObject({ pickupsNeeded: 1, savedFraction: 0.75 });
  });
  it('ignores wrong colors, accounts for Prism, and caps reserve by physical tail', () => {
    expect(healingNeed({ faceId: 1, tailLength: 10, inventory: { 2: 6 } }).pickupsNeeded).toBe(2);
    expect(healingNeed({ faceId: 1, tailLength: 10, inventory: { 2: 6 }, isPrism: true }).ready).toBe(true);
    expect(healingNeed({ faceId: 1, tailLength: 4, inventory: { 1: 99 } }).ready).toBe(false);
    expect(healingNeed({ faceId: 1, tailLength: 4, isPrism: true }).pickupsNeeded).toBe(2);
  });
  it('shows a fully paid tunnel ready even with no remaining inventory', () => {
    expect(healingNeed({ deposited: 4, faceId: 1, tailLength: 4 })).toMatchObject({ ready: true, pickupsNeeded: 0, savedFraction: 1 });
  });
});
