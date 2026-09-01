import { describe, it, expect, beforeEach } from 'vitest';
import {
  levelPayout, MAX_LEVEL_PAYOUT, milestonePayout, awardMilestone,
  freeplaySolveKey, teachAlgorithmKey, HOLONOMY_LOOP_KEY, HOLONOMY_MOBIUS_KEY,
} from '../levels/rewards.js';
import { recordLevelCompletion, recordFreeplaySolve } from '../levels/completion.js';
import { ProgressManager } from '../levels/ProgressManager.js';
import { DAILY_LEVEL_ID } from '../levels/dailyChallenge.js';
import { OFFICIAL_PACKS } from '../levels/packs/index.js';
import {
  EARN_LEVEL_FIRST_CLEAR, EARN_LEVEL_STAR, EARN_FREEPLAY_FIRST_SOLVE,
  EARN_TEACH_ALGORITHM, EARN_HOLONOMY_LOOP, EARN_HOLONOMY_MOBIUS,
} from '../utils/economyConstants.js';

const wallet = () => {
  const paid = [];
  return { paid, earn: (n) => paid.push(n), total: () => paid.reduce((a, b) => a + b, 0) };
};

describe('levelPayout', () => {
  it('pays the first clear plus every star earned with it', () => {
    expect(levelPayout({ isFirstCompletion: true, previousStars: 0, newStars: 3 }))
      .toBe(EARN_LEVEL_FIRST_CLEAR + 3 * EARN_LEVEL_STAR);
    expect(levelPayout({ isFirstCompletion: true, previousStars: 0, newStars: 1 }))
      .toBe(EARN_LEVEL_FIRST_CLEAR + EARN_LEVEL_STAR);
  });

  it('pays a replay only for stars never earned before', () => {
    // 1★ first clear, later improved to 3★ — the two new stars, nothing else.
    expect(levelPayout({ isFirstCompletion: false, previousStars: 1, newStars: 3 })).toBe(2 * EARN_LEVEL_STAR);
  });

  it('pays nothing for a replay that beats nothing', () => {
    expect(levelPayout({ isFirstCompletion: false, previousStars: 3, newStars: 3 })).toBe(0);
    expect(levelPayout({ isFirstCompletion: false, previousStars: 2, newStars: 2 })).toBe(0);
  });

  it('never pays negative when a replay is worse than the stored maximum', () => {
    // completeLevel stores stars as a max, so this shape is reachable; paying
    // negative would claw points back out of the wallet.
    expect(levelPayout({ isFirstCompletion: false, previousStars: 3, newStars: 1 })).toBe(0);
  });

  it('is bounded — replaying a level forever cannot farm it', () => {
    let total = levelPayout({ isFirstCompletion: true, previousStars: 0, newStars: 1 });
    let stars = 1;
    for (let i = 0; i < 50; i++) {
      const next = Math.min(3, stars + (i % 2));
      total += levelPayout({ isFirstCompletion: false, previousStars: stars, newStars: next });
      stars = next;
    }
    expect(total).toBe(MAX_LEVEL_PAYOUT);
  });

  it('defaults to zero rather than throwing on an empty call', () => {
    expect(levelPayout()).toBe(0);
  });
});

describe('milestonePayout', () => {
  it('prices each milestone family', () => {
    expect(milestonePayout(freeplaySolveKey(3))).toBe(EARN_FREEPLAY_FIRST_SOLVE);
    expect(milestonePayout(teachAlgorithmKey('white-cross', 0))).toBe(EARN_TEACH_ALGORITHM);
    expect(milestonePayout(HOLONOMY_LOOP_KEY)).toBe(EARN_HOLONOMY_LOOP);
    expect(milestonePayout(HOLONOMY_MOBIUS_KEY)).toBe(EARN_HOLONOMY_MOBIUS);
  });

  it('values the Möbius loop above a plain one — it is the mode’s actual point', () => {
    expect(milestonePayout(HOLONOMY_MOBIUS_KEY)).toBeGreaterThan(milestonePayout(HOLONOMY_LOOP_KEY));
  });

  it('pays nothing for an unknown or malformed key instead of throwing', () => {
    expect(milestonePayout('who:knows')).toBe(0);
    expect(milestonePayout(undefined)).toBe(0);
    expect(milestonePayout(42)).toBe(0);
  });
});

describe('awardMilestone', () => {
  let pm, w;
  beforeEach(() => { pm = new ProgressManager({ testMode: false, autoSave: false }); w = wallet(); });

  it('pays the first time and never again', () => {
    const key = freeplaySolveKey(3);
    expect(awardMilestone(key, { progress: pm, earn: w.earn })).toBe(EARN_FREEPLAY_FIRST_SOLVE);
    expect(awardMilestone(key, { progress: pm, earn: w.earn })).toBe(0);
    expect(awardMilestone(key, { progress: pm, earn: w.earn })).toBe(0);
    expect(w.paid).toEqual([EARN_FREEPLAY_FIRST_SOLVE]);
  });

  it('tracks each cube size separately', () => {
    for (const size of [2, 3, 4, 5]) awardMilestone(freeplaySolveKey(size), { progress: pm, earn: w.earn });
    expect(w.total()).toBe(4 * EARN_FREEPLAY_FIRST_SOLVE);
    // ...but a repeat of one already claimed adds nothing.
    awardMilestone(freeplaySolveKey(3), { progress: pm, earn: w.earn });
    expect(w.total()).toBe(4 * EARN_FREEPLAY_FIRST_SOLVE);
  });

  it('pays nothing while disabled, and leaves the key unclaimed for later', () => {
    const key = freeplaySolveKey(3);
    expect(awardMilestone(key, { progress: pm, earn: w.earn, enabled: false })).toBe(0);
    expect(pm.hasMilestone(key)).toBe(false);
    // The demo tour must not burn the player's real first solve.
    expect(awardMilestone(key, { progress: pm, earn: w.earn })).toBe(EARN_FREEPLAY_FIRST_SOLVE);
  });

  it('claims before paying, so a throwing payer cannot leave it repeatable', () => {
    const key = HOLONOMY_MOBIUS_KEY;
    expect(() => awardMilestone(key, { progress: pm, earn: () => { throw new Error('boom'); } })).toThrow();
    expect(pm.hasMilestone(key)).toBe(true);
    expect(awardMilestone(key, { progress: pm, earn: w.earn })).toBe(0);
  });

  it('does not claim a key it would not pay for', () => {
    expect(awardMilestone('who:knows', { progress: pm, earn: w.earn })).toBe(0);
    expect(pm.hasMilestone('who:knows')).toBe(false);
  });
});

describe('milestone ledger', () => {
  let pm;
  beforeEach(() => { pm = new ProgressManager({ testMode: false, autoSave: false }); });

  it('claims once and reports membership', () => {
    expect(pm.hasMilestone('solve:3')).toBe(false);
    expect(pm.claimMilestone('solve:3')).toBe(true);
    expect(pm.claimMilestone('solve:3')).toBe(false);
    expect(pm.hasMilestone('solve:3')).toBe(true);
  });

  it('ignores a malformed key', () => {
    expect(pm.claimMilestone('')).toBe(false);
    expect(pm.claimMilestone(null)).toBe(false);
    expect(pm.loadMilestones()).toEqual([]);
  });

  it('clears on a full progress reset, so a replaying player is paid again', () => {
    pm.claimMilestone('solve:3');
    pm.resetAllProgress(true);
    expect(pm.hasMilestone('solve:3')).toBe(false);
  });
});

describe('campaign levels pay into the wallet', () => {
  let pm, w;
  beforeEach(() => { pm = new ProgressManager({ testMode: false, autoSave: false }); w = wallet(); });

  const finish = (levelId, stats) =>
    recordLevelCompletion({ levelId, stats, progress: pm, earn: w.earn });

  it('pays a story chapter on first clear — it used to pay nothing at all', () => {
    const out = finish(1, { moves: 1, time: 10 });
    expect(out.kind).toBe('level');
    expect(out.paid).toBeGreaterThan(0);
    expect(w.total()).toBe(out.paid);
  });

  it('pays the star delta on an improved replay, and nothing on a worse one', () => {
    finish(1, { moves: 999, time: 999 });          // 1★
    const before = w.total();
    const better = finish(1, { moves: 1, time: 1 }); // 3★
    expect(better.paid).toBe(2 * EARN_LEVEL_STAR);
    const worse = finish(1, { moves: 999, time: 999 });
    expect(worse.paid).toBe(0);
    expect(w.total()).toBe(before + 2 * EARN_LEVEL_STAR);
  });

  it('caps a single level however many times it is replayed', () => {
    for (let i = 0; i < 20; i++) finish(1, { moves: 1, time: 1 });
    expect(w.total()).toBe(MAX_LEVEL_PAYOUT);
  });

  it('pays nothing while disabled', () => {
    const out = recordLevelCompletion({ levelId: 1, stats: { moves: 1 }, progress: pm, earn: w.earn, enabled: false });
    expect(out.paid).toBe(0);
    expect(w.paid).toEqual([]);
  });

  it('reaches every shipped campaign, not just Story', () => {
    // The finding was that Cube Academy and Algorithm Codex were dead ends too.
    for (const pack of OFFICIAL_PACKS) {
      const fresh = new ProgressManager({ testMode: false, autoSave: false });
      const pw = wallet();
      recordLevelCompletion({ levelId: pack.levels[0].id, stats: { moves: 1, time: 1 }, progress: fresh, earn: pw.earn });
      expect(pw.total(), `${pack.id} paid nothing`).toBeGreaterThan(0);
    }
  });
});

describe('freeplay solves pay once per cube size', () => {
  let pm, w;
  beforeEach(() => { pm = new ProgressManager({ testMode: false, autoSave: false }); w = wallet(); });

  it('pays the first solve at a size and never again', () => {
    expect(recordFreeplaySolve({ size: 3, progress: pm, earn: w.earn }).paid).toBe(EARN_FREEPLAY_FIRST_SOLVE);
    expect(recordFreeplaySolve({ size: 3, progress: pm, earn: w.earn }).paid).toBe(0);
  });

  it('cannot be farmed by shuffling and re-solving the same cube', () => {
    for (let i = 0; i < 30; i++) recordFreeplaySolve({ size: 3, progress: pm, earn: w.earn });
    expect(w.total()).toBe(EARN_FREEPLAY_FIRST_SOLVE);
  });

  it('rewards reaching a new size', () => {
    for (const size of [2, 3, 4, 5, 6, 7]) recordFreeplaySolve({ size, progress: pm, earn: w.earn });
    expect(w.total()).toBe(6 * EARN_FREEPLAY_FIRST_SOLVE);
  });

  it('ignores a missing size rather than paying for nothing', () => {
    expect(recordFreeplaySolve({ size: undefined, progress: pm, earn: w.earn }).paid).toBe(0);
    expect(w.paid).toEqual([]);
  });

  it('pays nothing during the demo, which solves cubes for the player', () => {
    expect(recordFreeplaySolve({ size: 3, progress: pm, earn: w.earn, enabled: false }).paid).toBe(0);
  });
});

describe('the whole game now feeds one wallet', () => {
  it('lets a player who only plays authored content actually afford things', () => {
    // The finding: finish every level in the game and earn nothing but the
    // one-off starting bankroll. This is the regression guard for that.
    const pm = new ProgressManager({ testMode: false, autoSave: false });
    const w = wallet();

    for (const pack of OFFICIAL_PACKS) {
      for (const level of pack.levels) {
        recordLevelCompletion({ levelId: level.id, stats: { moves: 1, time: 1 }, progress: pm, earn: w.earn });
      }
    }
    for (const size of [2, 3, 4, 5, 6, 7]) recordFreeplaySolve({ size, progress: pm, earn: w.earn });

    const totalLevels = OFFICIAL_PACKS.reduce((n, p) => n + p.levels.length, 0);
    expect(totalLevels).toBeGreaterThan(0);
    // Comfortably past the 300 PP top store tier, without approaching the ~3900
    // PP catalogue — Worm and Chaos stay worth playing.
    expect(w.total()).toBeGreaterThan(300);
    expect(w.total()).toBeLessThan(2500);
  });

  it('still keeps the daily out of the level payout path', () => {
    const pm = new ProgressManager({ testMode: false, autoSave: false });
    const w = wallet();
    const out = recordLevelCompletion({
      levelId: DAILY_LEVEL_ID,
      levelData: { dailyKey: '2026-09-01', par: 6 },
      stats: { moves: 6 },
      progress: pm, earn: w.earn, dailyReward: 100,
    });
    expect(out.kind).toBe('daily');
    // The daily's own purse, not a level payout on top of it.
    expect(w.paid).toEqual([100]);
  });
});
