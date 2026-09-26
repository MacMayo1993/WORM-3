import { describe, it, expect } from 'vitest';
import { healingNeed, tunnelDanger, nearSignScale, SIGN_HIDE_DISTANCE, SIGN_FULL_DISTANCE } from '../worm/healerWorm/tunnelReadout.js';

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

it('distinguishes the third safe trip from fatal re-entry, even when heal-ready', () => {
  expect(tunnelDanger({ uses: 2, ready: true })).toBeNull();
  expect(tunnelDanger({ uses: 3, inTransit: true })).toBeNull();
  expect(tunnelDanger({ uses: 3, ready: true })).toBe('lethal');
  expect(tunnelDanger({ uses: 4, inTransit: true, collapsing: true })).toBe('collapsing');
  expect(tunnelDanger({ uses: 3, locked: true })).toBeNull();
  expect(tunnelDanger({ voided: true, ready: true })).toBe('collapsed');
});

it('shrinks a tunnel sign away as the camera nears it, and keeps far signs whole', () => {
  expect(nearSignScale(0)).toBe(0);
  expect(nearSignScale(SIGN_HIDE_DISTANCE)).toBe(0);
  expect(nearSignScale(SIGN_FULL_DISTANCE)).toBe(1);
  expect(nearSignScale(40)).toBe(1);
  let last = 0;
  for (let d = SIGN_HIDE_DISTANCE; d <= SIGN_FULL_DISTANCE; d += 0.05) {
    const s = nearSignScale(d);
    expect(s).toBeGreaterThanOrEqual(last);
    last = s;
  }
  // The pad one tile ahead of the default chase camera (about 3.4 units away)
  // gets a small sign; its HUD card carries the full readout.
  expect(nearSignScale(3.4)).toBeLessThan(0.3);
});
