import { describe, it, expect } from 'vitest';
import {
  BET_TYPES,
  FACE_INFO,
  ANTIPODAL_PAIRS,
  streakMultiplier,
  calcPayout,
  getFaceFromGridId,
  getWinnerFaces,
  resolveBet,
} from '../utils/disparityBetting.js';

// The chaos worker always finishes with an antipodal pair, e.g. Red/Orange.
const winnerPair = (a = 'M1-001', b = 'M4-001') => ({ pair: [a, b] });

const ctx = (overrides = {}) => ({
  disparityDeaths: [],
  disparityWinner: winnerPair(),
  disparityEliminatedFaces: [],
  ...overrides,
});

// ─── streakMultiplier ─────────────────────────────────────────────────────────

describe('streakMultiplier', () => {
  it('is 1 with no streak', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(undefined)).toBe(1);
    expect(streakMultiplier(null)).toBe(1);
  });

  it('adds 10% per consecutive win', () => {
    expect(streakMultiplier(1)).toBeCloseTo(1.1);
    expect(streakMultiplier(3)).toBeCloseTo(1.3);
  });

  it('caps at 1.5 (+50%)', () => {
    expect(streakMultiplier(5)).toBe(1.5);
    expect(streakMultiplier(100)).toBe(1.5);
  });
});

// ─── calcPayout ───────────────────────────────────────────────────────────────

describe('calcPayout', () => {
  it('multiplies wager by odds', () => {
    expect(calcPayout(100, 4, 0)).toBe(400);
    expect(calcPayout(25, 8, 0)).toBe(200);
  });

  it('applies the streak multiplier', () => {
    expect(calcPayout(100, 4, 2)).toBe(480); // 100 × 4 × 1.2
  });

  it('rounds fractional payouts to whole PP', () => {
    expect(calcPayout(25, 1.8, 0)).toBe(45);
    expect(calcPayout(33, 1.8, 0)).toBe(59); // 59.4 → 59
  });
});

// ─── Grid ID helpers ──────────────────────────────────────────────────────────

describe('getFaceFromGridId', () => {
  it('extracts the face number from a manifold grid ID', () => {
    expect(getFaceFromGridId('M3-042')).toBe(3);
    expect(getFaceFromGridId('M6-001')).toBe(6);
  });
});

describe('getWinnerFaces', () => {
  it('maps a winner pair to face numbers', () => {
    expect(getWinnerFaces(['M1-005', 'M4-005'])).toEqual([1, 4]);
  });

  it('tolerates a missing pair', () => {
    expect(getWinnerFaces(null)).toEqual([]);
    expect(getWinnerFaces(undefined)).toEqual([]);
  });
});

// ─── Data consistency ─────────────────────────────────────────────────────────

describe('face/pair data consistency', () => {
  it('FACE_INFO antipodal mapping is symmetric', () => {
    for (const [id, info] of Object.entries(FACE_INFO)) {
      expect(FACE_INFO[info.antipodalFace].antipodalFace).toBe(Number(id));
    }
  });

  it('every ANTIPODAL_PAIRS entry pairs a face with its FACE_INFO antipodal', () => {
    for (const pair of ANTIPODAL_PAIRS) {
      const [a, b] = pair.faces;
      expect(FACE_INFO[a].antipodalFace).toBe(b);
    }
  });

  it('all six faces appear in exactly one pair', () => {
    const all = ANTIPODAL_PAIRS.flatMap((p) => p.faces).sort();
    expect(all).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ─── resolveBet ───────────────────────────────────────────────────────────────

describe('resolveBet', () => {
  it('returns null without a bet or without a winner', () => {
    expect(resolveBet(null, ctx())).toBeNull();
    expect(resolveBet({ type: 'PAIR', pick: 'RO' }, ctx({ disparityWinner: null }))).toBeNull();
    expect(resolveBet({ type: 'PAIR', pick: 'RO' }, ctx({ disparityWinner: { pair: [] } }))).toBeNull();
  });

  it('returns null for an unknown bet type', () => {
    expect(resolveBet({ type: 'NOPE', pick: 1 }, ctx())).toBeNull();
  });

  describe('SURVIVOR', () => {
    it('wins when the picked face is either member of the final pair', () => {
      expect(resolveBet({ type: 'SURVIVOR', pick: 1 }, ctx()).won).toBe(true);
      expect(resolveBet({ type: 'SURVIVOR', pick: 4 }, ctx()).won).toBe(true);
    });

    it('loses when the picked face is not in the final pair', () => {
      const res = resolveBet({ type: 'SURVIVOR', pick: 3 }, ctx());
      expect(res.won).toBe(false);
      expect(res.description).toContain('White');
    });
  });

  describe('PAIR', () => {
    it('wins on the exact antipodal pair', () => {
      expect(resolveBet({ type: 'PAIR', pick: 'RO' }, ctx()).won).toBe(true);
    });

    it('loses on the wrong pair and names the actual winner', () => {
      const res = resolveBet({ type: 'PAIR', pick: 'GB' }, ctx());
      expect(res.won).toBe(false);
      expect(res.description).toContain('Red – Orange');
    });

    it('loses gracefully on an unknown pick', () => {
      expect(resolveBet({ type: 'PAIR', pick: 'XX' }, ctx()).won).toBe(false);
    });
  });

  describe('FIRST_OUT', () => {
    it('wins when the picked face was eliminated first', () => {
      const res = resolveBet({ type: 'FIRST_OUT', pick: 2 }, ctx({ disparityEliminatedFaces: [2, 5, 3] }));
      expect(res.won).toBe(true);
    });

    it('loses when a different face fell first', () => {
      const res = resolveBet({ type: 'FIRST_OUT', pick: 3 }, ctx({ disparityEliminatedFaces: [2, 5, 3] }));
      expect(res.won).toBe(false);
      expect(res.description).toContain('Green');
    });

    it('loses when no face was recorded as eliminated', () => {
      expect(resolveBet({ type: 'FIRST_OUT', pick: 2 }, ctx()).won).toBe(false);
    });
  });

  describe('SPEED', () => {
    const deathsSpanning = (seconds) => [
      { timestamp: 1_000_000 },
      { timestamp: 1_000_000 + (seconds * 1000) / 2 },
      { timestamp: 1_000_000 + seconds * 1000 },
    ];

    it('FAST wins when the round runs under 60s from first to last death', () => {
      expect(resolveBet({ type: 'SPEED', pick: 'FAST' }, ctx({ disparityDeaths: deathsSpanning(30) })).won).toBe(true);
      expect(resolveBet({ type: 'SPEED', pick: 'SLOW' }, ctx({ disparityDeaths: deathsSpanning(30) })).won).toBe(false);
    });

    it('SLOW wins when the round runs over 60s', () => {
      expect(resolveBet({ type: 'SPEED', pick: 'SLOW' }, ctx({ disparityDeaths: deathsSpanning(90) })).won).toBe(true);
      expect(resolveBet({ type: 'SPEED', pick: 'FAST' }, ctx({ disparityDeaths: deathsSpanning(90) })).won).toBe(false);
    });

    it('sorts death timestamps before measuring', () => {
      const shuffled = [{ timestamp: 1_090_000 }, { timestamp: 1_000_000 }, { timestamp: 1_050_000 }];
      expect(resolveBet({ type: 'SPEED', pick: 'SLOW' }, ctx({ disparityDeaths: shuffled })).won).toBe(true);
    });

    // Documents current behavior: with fewer than two deaths elapsed is 0,
    // which counts as fast. A real round produces ~size²·6−2 deaths before a
    // winner exists, so this path is theoretical.
    it('treats fewer than two deaths as a fast round', () => {
      expect(resolveBet({ type: 'SPEED', pick: 'FAST' }, ctx({ disparityDeaths: [] })).won).toBe(true);
    });
  });
});

// ─── Odds bookkeeping ─────────────────────────────────────────────────────────

describe('BET_TYPES odds', () => {
  it('every bet type declares positive odds', () => {
    for (const bt of Object.values(BET_TYPES)) {
      expect(bt.odds).toBeGreaterThan(1);
    }
  });

  // The final winning pair is always antipodal, so "face X in the final pair"
  // and "the pair containing X wins" are the same 1-in-3 event — they must pay
  // the same or one bet strictly dominates the other.
  it('SURVIVOR and PAIR (the same 1-in-3 event) pay the same', () => {
    expect(BET_TYPES.SURVIVOR.odds).toBe(BET_TYPES.PAIR.odds);
  });

  it('FIRST_OUT (1-in-6) pays exactly double the 1-in-3 bets', () => {
    expect(BET_TYPES.FIRST_OUT.odds).toBeCloseTo(BET_TYPES.PAIR.odds * 2);
  });

  it('no bet is player-favored before the streak bonus (house edge on every line)', () => {
    const trueProbability = { SURVIVOR: 1 / 3, PAIR: 1 / 3, FIRST_OUT: 1 / 6 };
    for (const [id, p] of Object.entries(trueProbability)) {
      expect(BET_TYPES[id].odds * p).toBeLessThan(1);
    }
  });
});
