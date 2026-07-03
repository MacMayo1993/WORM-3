import { describe, it, expect } from 'vitest';
import { computeOrbDeposit, classifyTraversal, orbsCarried, isHealReady } from '../worm/healerWorm/economy.js';
import { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH, HEAL_COST, WORMHOLE_MAX_TRAVERSALS } from '../worm/healerWorm/constants.js';

// Fresh inventory helper: faceId → count, all six faces present like the store default.
const inv = (overrides = {}) => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, ...overrides });

// A tail carrying `orbs` whole orbs.
const tailWith = (orbs) => BASE_TAIL_LENGTH + orbs * ORB_SEGMENT_GROWTH;

// ─── orbsCarried ──────────────────────────────────────────────────────────────

describe('orbsCarried', () => {
  it('a bare worm carries zero orbs', () => {
    expect(orbsCarried(BASE_TAIL_LENGTH)).toBe(0);
  });

  it('each ORB_SEGMENT_GROWTH balls beyond the base is one orb', () => {
    expect(orbsCarried(tailWith(1))).toBe(1);
    expect(orbsCarried(tailWith(5))).toBe(5);
  });

  it('partial growth does not count as a whole orb', () => {
    expect(orbsCarried(tailWith(2) - 1)).toBe(1);
  });

  it('never goes negative even below the base length', () => {
    expect(orbsCarried(0)).toBe(0);
    expect(orbsCarried(BASE_TAIL_LENGTH - 2)).toBe(0);
  });
});

// ─── isHealReady ──────────────────────────────────────────────────────────────

describe('isHealReady', () => {
  it('fires exactly at HEAL_COST deposited', () => {
    expect(isHealReady(HEAL_COST)).toBe(true);
    expect(isHealReady(HEAL_COST - 1)).toBe(false);
  });

  it('treats missing progress as zero (no heal)', () => {
    expect(isHealReady(undefined)).toBe(false);
    expect(isHealReady(null)).toBe(false);
  });
});

// ─── classifyTraversal — the "void on the 4th" rule ──────────────────────────

describe('classifyTraversal', () => {
  it('the first WORMHOLE_MAX_TRAVERSALS passes are safe', () => {
    for (let n = 1; n <= WORMHOLE_MAX_TRAVERSALS; n++) {
      expect(classifyTraversal(n)).toBe('safe');
    }
  });

  it('the pass after the safe ones arms the deferred void kill', () => {
    expect(classifyTraversal(WORMHOLE_MAX_TRAVERSALS + 1)).toBe('void-arm');
  });

  it('every pass beyond that is an instant collapse', () => {
    expect(classifyTraversal(WORMHOLE_MAX_TRAVERSALS + 2)).toBe('collapse');
    expect(classifyTraversal(WORMHOLE_MAX_TRAVERSALS + 10)).toBe('collapse');
  });

  it('respects a custom max-traversals override', () => {
    expect(classifyTraversal(1, 1)).toBe('safe');
    expect(classifyTraversal(2, 1)).toBe('void-arm');
    expect(classifyTraversal(3, 1)).toBe('collapse');
  });
});

// ─── computeOrbDeposit — standard characters ─────────────────────────────────

describe('computeOrbDeposit (non-prism)', () => {
  it('returns null when the matching face has no orbs, even if others do', () => {
    const result = computeOrbDeposit({
      inventory: inv({ 2: 6 }),
      deposited: 0,
      entryFaceId: 1,
      tailLength: tailWith(2),
      isPrism: false,
    });
    expect(result).toBeNull();
  });

  it('deposits from the matching face only and never drains other faces', () => {
    const result = computeOrbDeposit({
      inventory: inv({ 1: HEAL_COST, 2: 5 }),
      deposited: 0,
      entryFaceId: 1,
      tailLength: tailWith(4),
      isPrism: false,
    });
    expect(result.n).toBe(Math.min(HEAL_COST, tailWith(4) - BASE_TAIL_LENGTH));
    expect(result.nextInventory[1]).toBe(HEAL_COST - result.n);
    expect(result.nextInventory[2]).toBe(5);
  });

  it('caps the deposit at what the tunnel still needs', () => {
    const result = computeOrbDeposit({
      inventory: inv({ 1: 10 }),
      deposited: HEAL_COST - 1,
      entryFaceId: 1,
      tailLength: tailWith(4),
      isPrism: false,
    });
    expect(result.n).toBe(1);
    expect(result.nextDeposited).toBe(HEAL_COST);
  });

  it('caps the deposit at the segments physically on the worm', () => {
    const oneSegmentTail = BASE_TAIL_LENGTH + 1;
    const result = computeOrbDeposit({
      inventory: inv({ 1: 10 }),
      deposited: 0,
      entryFaceId: 1,
      tailLength: oneSegmentTail,
      isPrism: false,
    });
    expect(result.n).toBe(1);
    expect(result.nextTailLength).toBe(BASE_TAIL_LENGTH);
  });

  it('returns null for a fully-healed tunnel and for a bare worm', () => {
    expect(computeOrbDeposit({
      inventory: inv({ 1: 10 }), deposited: HEAL_COST, entryFaceId: 1,
      tailLength: tailWith(2), isPrism: false,
    })).toBeNull();
    expect(computeOrbDeposit({
      inventory: inv({ 1: 10 }), deposited: 0, entryFaceId: 1,
      tailLength: BASE_TAIL_LENGTH, isPrism: false,
    })).toBeNull();
  });

  it('never shrinks the tail below the base length or the inventory below zero', () => {
    const result = computeOrbDeposit({
      inventory: inv({ 1: 2 }),
      deposited: 0,
      entryFaceId: 1,
      tailLength: tailWith(3),
      isPrism: false,
    });
    expect(result.n).toBe(2); // limited by inventory
    expect(result.nextTailLength).toBeGreaterThanOrEqual(BASE_TAIL_LENGTH);
    for (const v of Object.values(result.nextInventory)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('does not mutate the input inventory', () => {
    const inventory = inv({ 1: 5 });
    computeOrbDeposit({ inventory, deposited: 0, entryFaceId: 1, tailLength: tailWith(2), isPrism: false });
    expect(inventory[1]).toBe(5);
  });

  it('reports the pickup-color entries to trim for the deposited segments', () => {
    const result = computeOrbDeposit({
      inventory: inv({ 1: ORB_SEGMENT_GROWTH * 2 }),
      deposited: 0,
      entryFaceId: 1,
      tailLength: tailWith(4),
      isPrism: false,
    });
    // n segments ≈ n / ORB_SEGMENT_GROWTH whole orbs' worth of colors
    expect(result.colorsToDrop).toBe(Math.round(result.n / ORB_SEGMENT_GROWTH));
  });
});

// ─── computeOrbDeposit — Prism Worm wildcard ─────────────────────────────────

describe('computeOrbDeposit (prism wildcard)', () => {
  it('pays with any face color when the matching face is empty', () => {
    const result = computeOrbDeposit({
      inventory: inv({ 2: 2, 5: 2 }),
      deposited: 0,
      entryFaceId: 1,
      tailLength: tailWith(4),
      isPrism: true,
    });
    expect(result).not.toBeNull();
    expect(result.n).toBe(Math.min(4, HEAL_COST));
  });

  it('drains the matching face first, then spills into the others', () => {
    const result = computeOrbDeposit({
      inventory: inv({ 1: 1, 2: 10 }),
      deposited: 0,
      entryFaceId: 1,
      tailLength: tailWith(4),
      isPrism: true,
    });
    expect(result.nextInventory[1]).toBe(0);        // matching face emptied first
    expect(result.nextInventory[2]).toBe(10 - (result.n - 1)); // remainder spills
  });

  it('total drained across all faces equals the deposit, with no face negative', () => {
    const before = inv({ 1: 1, 3: 1, 6: 5 });
    const result = computeOrbDeposit({
      inventory: before,
      deposited: 0,
      entryFaceId: 1,
      tailLength: tailWith(4),
      isPrism: true,
    });
    const sumBefore = Object.values(before).reduce((s, v) => s + v, 0);
    const sumAfter = Object.values(result.nextInventory).reduce((s, v) => s + v, 0);
    expect(sumBefore - sumAfter).toBe(result.n);
    for (const v of Object.values(result.nextInventory)) expect(v).toBeGreaterThanOrEqual(0);
  });
});
