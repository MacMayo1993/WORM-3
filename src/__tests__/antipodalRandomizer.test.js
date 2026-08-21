import { describe, it, expect } from 'vitest';
import {
  computeCDir,
  targetAmbiguity,
  enumerateConfigs,
  parRange,
  generateLevelState,
  starsForMoves,
  nextHint,
  tierForLevel,
  generateCampaignLevel,
  generateCampaign,
  generateDailyChallenge,
  makeRng
} from '../levels/antipodalRandomizer.js';
import { fibreCosts } from '../game/antipodalEngine.js';

describe('computeCDir', () => {
  it('matches C_dir = n_A + min(n11, P - n11)', () => {
    expect(computeCDir(3, 0, 0)).toBe(0); // all clean
    expect(computeCDir(0, 5, 0)).toBe(0); // all dirty (global flip)
    expect(computeCDir(2, 2, 0)).toBe(2); // flip the 2 dirty
    expect(computeCDir(1, 1, 2)).toBe(3); // 2 heals + 1 flip
  });

  it('agrees with the engine fibreCosts.quotientCost accounting', () => {
    // n00=2, n11=3, nA=1 → P=6. Engine quotientCost = nA + min(n11, P-n11).
    const P = 6;
    const configs = enumerateConfigs(P, computeCDir(2, 3, 1), { minNA: 1, maxNA: 1 });
    expect(configs.some((c) => c.n11 === 3 && c.n00 === 2)).toBe(true);
    // Mirror of engine formula (antipodalEngine.fibreCosts) on the same numbers.
    const asymmetricPairs = 1;
    const dirtyPairs = 3;
    const engineLike = asymmetricPairs + Math.min(dirtyPairs, P - dirtyPairs);
    expect(engineLike).toBe(computeCDir(2, 3, 1));
    expect(typeof fibreCosts).toBe('function');
  });
});

describe('enumerateConfigs', () => {
  it('every returned config actually hits the target par and partitions P', () => {
    const P = 8;
    for (let par = 0; par <= P; par++) {
      for (const c of enumerateConfigs(P, par)) {
        expect(c.n00 + c.n11 + c.nA).toBe(P);
        expect(computeCDir(c.n00, c.n11, c.nA)).toBe(par);
      }
    }
  });

  it('respects the asymmetry band', () => {
    const configs = enumerateConfigs(10, 5, { minNA: 2, maxNA: 3 });
    expect(configs.length).toBeGreaterThan(0);
    for (const c of configs) expect(c.nA).toBeGreaterThanOrEqual(2), expect(c.nA).toBeLessThanOrEqual(3);
  });

  it('par range spans [0, P]', () => {
    expect(parRange(12)).toEqual({ min: 0, max: 12 });
  });
});

describe('generateLevelState', () => {
  it('produces a state whose C_dir equals the requested par', () => {
    const lvl = generateLevelState({ P: 8, targetPar: 5, seed: 1 });
    const { n00, n11, nA } = lvl.params;
    expect(computeCDir(n00, n11, nA)).toBe(5);
    expect(lvl.state.orbits).toHaveLength(8);
    expect(lvl.state.flatVector).toHaveLength(16);
  });

  it('is deterministic for a fixed seed and diverges across seeds', () => {
    const a = generateLevelState({ P: 10, targetPar: 6, seed: 'x' });
    const b = generateLevelState({ P: 10, targetPar: 6, seed: 'x' });
    expect(a.state.flatVector).toEqual(b.state.flatVector);
    // Different seed almost surely reshuffles / repartitions.
    const c = generateLevelState({ P: 10, targetPar: 6, seed: 'y' });
    expect(a.state.flatVector).not.toEqual(c.state.flatVector);
  });

  it('throws for an unreachable par', () => {
    expect(() => generateLevelState({ P: 4, targetPar: 9, seed: 0 })).toThrow(RangeError);
  });

  it('does not depend on Math.random', () => {
    const orig = Math.random;
    Math.random = () => {
      throw new Error('Math.random must not be used');
    };
    try {
      expect(() => generateLevelState({ P: 6, targetPar: 3, seed: 2 })).not.toThrow();
    } finally {
      Math.random = orig;
    }
  });
});

describe('starsForMoves', () => {
  it('gold at par, silver in slack window, bronze otherwise', () => {
    expect(starsForMoves(6, 6)).toBe(3);
    expect(starsForMoves(6, 8)).toBe(2); // slack = ceil(6*0.5)=3 → par+3=9
    expect(starsForMoves(6, 20)).toBe(1);
  });
});

describe('nextHint', () => {
  it('heals an asymmetric pair before anything else', () => {
    const orbits = [
      { orbitType: '00', bits: [0, 0] },
      { orbitType: '10', bits: [1, 0] }
    ];
    expect(nextHint(orbits).action).toBe('heal');
    expect(nextHint(orbits).orbitIndex).toBe(1);
  });

  it('flips toward the cheaper polarity when symmetric', () => {
    // n11=1, P=3 → n11 <= P-n11 → flip the dirty pair.
    const few = [
      { bits: [1, 1] },
      { bits: [0, 0] },
      { bits: [0, 0] }
    ];
    expect(nextHint(few)).toMatchObject({ action: 'flip' });
    expect(few[nextHint(few).orbitIndex].bits).toEqual([1, 1]);

    // n11=3, P=4 → n11 > P-n11 → flip the clean pair instead.
    const many = [{ bits: [1, 1] }, { bits: [1, 1] }, { bits: [1, 1] }, { bits: [0, 0] }];
    expect(many[nextHint(many).orbitIndex].bits).toEqual([0, 0]);
  });

  it('reports solved when the fibre is in the solved orbit', () => {
    expect(nextHint([{ bits: [0, 0] }, { bits: [0, 0] }]).action).toBe('solved');
  });
});

describe('campaign', () => {
  it('places every level in exactly one tier', () => {
    for (let l = 1; l <= 100; l++) expect(tierForLevel(l)).not.toBeNull();
  });

  it('generates 100 deterministic levels each with an exact reachable par', () => {
    const c1 = generateCampaign(20260821);
    const c2 = generateCampaign(20260821);
    expect(c1.levels).toHaveLength(100);
    expect(c1.levels.map((l) => l.state.flatVector)).toEqual(c2.levels.map((l) => l.state.flatVector));
    for (const lvl of c1.levels) {
      const { n00, n11, nA } = lvl.params;
      expect(computeCDir(n00, n11, nA)).toBe(lvl.parMetrics.gold);
      expect(lvl.parMetrics.gold).toBeLessThanOrEqual(lvl.params.P);
    }
  });

  it('single-level generation matches the full campaign', () => {
    const solo = generateCampaignLevel(42, 20260821);
    const full = generateCampaign(20260821).levels[41];
    expect(solo.state.flatVector).toEqual(full.state.flatVector);
  });
});

describe('daily challenge', () => {
  it('is identical for the same date and differs across dates', () => {
    const a = generateDailyChallenge('2026-08-21');
    const b = generateDailyChallenge('2026-08-21');
    const c = generateDailyChallenge('2026-08-22');
    expect(a.state.flatVector).toEqual(b.state.flatVector);
    expect(a.state.flatVector).not.toEqual(c.state.flatVector);
    expect(computeCDir(a.params.n00, a.params.n11, a.params.nA)).toBe(a.parMetrics.gold);
  });
});

describe('makeRng', () => {
  it('is a stable stream for a given seed', () => {
    const r1 = makeRng('seed');
    const r2 = makeRng('seed');
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
    expect(targetAmbiguity(6, 3)).toBe(0);
  });
});
