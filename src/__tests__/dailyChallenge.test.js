import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DAILY_LEVEL_ID, DAILY_PACK_ID, DAILY_PAR_MIN, DAILY_PAR_MAX, DAILY_CUBE_SIZE,
  dailyKeyFor, previousDayKey, dailyPlanFor, buildDailyLevel,
  ensureDailyPack, _resetDailyRegistration,
  emptyDailyRecord, advanceStreak, isDailyDone, currentStreak,
  DAILY_SCRAMBLE_TURNS, DAILY_DECOY_FLIPS, _resetDailyPlanCache,
} from '../levels/dailyChallenge.js';
import { levelsManager } from '../levels/LevelsManager.js';
import { ProgressManager } from '../levels/ProgressManager.js';
import { buildMoveTable, quotientPar, quotientSolution } from '../levels/quotientSolver.js';
import { msUntilNextLocalMidnight } from '../levels/dailyChallenge.js';
import { recordLevelCompletion } from '../levels/completion.js';
import { LEVEL_ID_RANGES, WIN_CONDITIONS } from '../levels/schema.js';
import { BUILT_IN_PACKS } from '../levels/packs/index.js';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS, getAchievement, decorateAchievements } from '../levels/achievements.js';
import { buildLevelStartState } from '../levels/levelStaging.js';
import { checkRubiksSolved, checkRubiksSolvedAntipodal } from '../game/winDetection.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';

const KEY = '2026-09-01';

describe('dailyKeyFor / previousDayKey', () => {
  it('formats a local calendar date, zero-padded', () => {
    expect(dailyKeyFor(new Date(2026, 8, 1))).toBe('2026-09-01');
    expect(dailyKeyFor(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('uses local time, not UTC — the key must not shift with the clock offset', () => {
    // 23:30 local on the 1st is still the 1st, however far the UTC date has moved.
    expect(dailyKeyFor(new Date(2026, 8, 1, 23, 30))).toBe('2026-09-01');
    expect(dailyKeyFor(new Date(2026, 8, 1, 0, 30))).toBe('2026-09-01');
  });

  it('rejects an unusable date rather than silently keying off NaN', () => {
    expect(() => dailyKeyFor(new Date('nonsense'))).toThrow(TypeError);
  });

  it('walks back across month, year and leap boundaries', () => {
    expect(previousDayKey('2026-09-02')).toBe('2026-09-01');
    expect(previousDayKey('2026-09-01')).toBe('2026-08-31');
    expect(previousDayKey('2026-01-01')).toBe('2025-12-31');
    expect(previousDayKey('2024-03-01')).toBe('2024-02-29'); // leap year
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
  });
});

describe('dailyPlanFor', () => {
  it('is deterministic — the same date is the same puzzle for everyone', () => {
    _resetDailyPlanCache();
    const a = dailyPlanFor(KEY);
    _resetDailyPlanCache();
    expect(dailyPlanFor(KEY)).toEqual(a);
  });

  it('gives different days different draws', () => {
    const week = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']
      .map((k) => JSON.stringify(dailyPlanFor(k)));
    expect(new Set(week).size).toBeGreaterThan(1);
  });

  it('keeps par inside the published band', () => {
    for (let d = 1; d <= 28; d++) {
      const plan = dailyPlanFor(`2026-09-${String(d).padStart(2, '0')}`);
      expect(plan.par).toBeGreaterThanOrEqual(DAILY_PAR_MIN);
      expect(plan.par).toBeLessThanOrEqual(DAILY_PAR_MAX);
    }
  });

  it('reports par as the solver’s proven optimum, not the scramble length', () => {
    // The quotient goal is a far larger target than the literal solved cube, so
    // a scramble routinely collapses to something shorter. Shipping its length
    // as par would score a player against a cost the board does not have.
    const table = buildMoveTable(DAILY_CUBE_SIZE);
    for (let d = 1; d <= 20; d++) {
      const key = `2026-10-${String(d).padStart(2, '0')}`;
      const plan = dailyPlanFor(key);
      const staged = buildLevelStartState(buildDailyLevel(key), DAILY_CUBE_SIZE);
      expect(quotientPar(staged, DAILY_CUBE_SIZE, { maxDepth: DAILY_PAR_MAX, table }), `daily ${key}`).toBe(plan.par);
      expect(plan.par).toBeLessThanOrEqual(plan.scramble.length);
      expect(plan.slack).toBe(plan.scramble.length - plan.par);
    }
  });

  it('collapses some scrambles — proving the search is doing real work', () => {
    // If par always equalled the scramble length the solver would be pointless
    // and a formula would do. Turning quarter turns into a quotient solve is
    // exactly where the saving comes from.
    const slacks = Array.from({ length: 40 }, (_, i) => dailyPlanFor(`2027-03-${String((i % 28) + 1).padStart(2, '0')}`).slack);
    expect(Math.max(...slacks)).toBeGreaterThan(0);
  });

  it('authors a canonical scramble — nothing that cancels into something shorter', () => {
    for (let d = 1; d <= 28; d++) {
      const { scramble } = dailyPlanFor(`2026-11-${String(d).padStart(2, '0')}`);
      expect(scramble).toHaveLength(DAILY_SCRAMBLE_TURNS);
      let run = 0;
      scramble.forEach((m, i) => {
        const prev = scramble[i - 1];
        if (!prev) { run = 1; return; }
        const sameSlice = prev.axis === m.axis && prev.sliceIndex === m.sliceIndex;
        if (sameSlice) expect(prev.dir, 'a move immediately undone').toBe(m.dir);
        run = sameSlice ? run + 1 : 1;
        expect(run, 'a third consecutive turn of one slice').toBeLessThanOrEqual(2);
      });
    }
  });
});

describe('buildDailyLevel', () => {
  it('authors the scramble and the decoy flips', () => {
    const plan = dailyPlanFor(KEY);
    const level = buildDailyLevel(KEY);
    expect(level.id).toBe(DAILY_LEVEL_ID);
    expect(level.par).toBe(plan.par);
    expect(level.scrambleSequence).toEqual(plan.scramble);
    expect(level.flipSequence).toHaveLength(DAILY_DECOY_FLIPS);
    expect(level.cubeSize).toBe(DAILY_CUBE_SIZE);
    expect(level.features.flips).toBe(true);
    expect(level.features.rotations).toBe(true);
  });

  it('solves the manifold, so the level says so', () => {
    for (let d = 1; d <= 10; d++) {
      expect(buildDailyLevel(`2026-12-${String(d).padStart(2, '0')}`).winCondition).toBe(WIN_CONDITIONS.ANTIPODAL);
    }
  });

  it('stages decoy flips that cost the player nothing to leave alone', () => {
    // A flip cannot move a sticker out of its colour class, so it cannot change
    // the quotient distance. The decoys are visible and free — which is the
    // whole trap, and is worth pinning so nobody later "fixes" par to count them.
    const table = buildMoveTable(DAILY_CUBE_SIZE);
    for (let d = 1; d <= 10; d++) {
      const key = `2027-04-${String(d).padStart(2, '0')}`;
      const level = buildDailyLevel(key);
      const withDecoys = buildLevelStartState(level, DAILY_CUBE_SIZE);
      const without = buildLevelStartState({ ...level, flipSequence: [] }, DAILY_CUBE_SIZE);
      expect(quotientPar(withDecoys, DAILY_CUBE_SIZE, { maxDepth: DAILY_PAR_MAX, table }))
        .toBe(quotientPar(without, DAILY_CUBE_SIZE, { maxDepth: DAILY_PAR_MAX, table }));
    }
  });

  it('is byte-identical for the same date and different across dates', () => {
    expect(JSON.stringify(buildDailyLevel(KEY))).toBe(JSON.stringify(buildDailyLevel(KEY)));
    expect(JSON.stringify(buildDailyLevel(KEY))).not.toBe(JSON.stringify(buildDailyLevel('2026-09-02')));
  });

  it('opens with no next level — a daily is one puzzle, not a ladder', () => {
    expect(buildDailyLevel(KEY).requirements.previousLevel).toBeNull();
  });
});

describe('ensureDailyPack', () => {
  afterEach(() => _resetDailyRegistration());

  it('registers the day so the normal level routing can resolve it', () => {
    // The whole reason the feature was unreachable: getLevel(401) returned null.
    _resetDailyRegistration();
    expect(levelsManager.getLevel(DAILY_LEVEL_ID)).toBeNull();
    ensureDailyPack(KEY);
    expect(levelsManager.getLevel(DAILY_LEVEL_ID)).not.toBeNull();
    expect(levelsManager.getLevel(DAILY_LEVEL_ID).par).toBe(dailyPlanFor(KEY).par);
  });

  it('re-points the id at the new puzzle when the day turns over', () => {
    ensureDailyPack(KEY);
    const first = levelsManager.getLevel(DAILY_LEVEL_ID).flipSequence;
    ensureDailyPack('2026-09-02');
    const second = levelsManager.getLevel(DAILY_LEVEL_ID).flipSequence;
    expect(second).not.toEqual(first);
  });

  it('is idempotent within a day and leaves no duplicate pack behind', () => {
    ensureDailyPack(KEY);
    ensureDailyPack(KEY);
    ensureDailyPack(KEY);
    expect(levelsManager.getPack(DAILY_PACK_ID).levels).toHaveLength(1);
  });

  it('does not offer a next level, so victory cannot walk off the end', () => {
    ensureDailyPack(KEY);
    expect(levelsManager.getNextLevel(DAILY_LEVEL_ID)).toBeNull();
  });

  it('leaves the story campaign’s length — and so the completionist award — alone', () => {
    const before = levelsManager.getTotalLevels();
    ensureDailyPack(KEY);
    expect(levelsManager.getTotalLevels()).toBe(before);
  });
});

describe('the daily is actually winnable, in exactly par', () => {
  // The end-to-end guarantee the whole feature rests on. A daily that generated
  // but could not be solved — or that was already solved when it opened — would
  // look completely fine until a player sat in front of it.
  const table = buildMoveTable(DAILY_CUBE_SIZE);

  const playOptimally = (level) => {
    let state = buildLevelStartState(level, DAILY_CUBE_SIZE);
    expect(checkRubiksSolvedAntipodal(state, DAILY_CUBE_SIZE), 'opens already solved').toBe(false);
    const solution = quotientSolution(state, DAILY_CUBE_SIZE, { maxDepth: DAILY_PAR_MAX, table });
    expect(solution, 'no solution within the par band').not.toBeNull();
    const wonAfter = [];
    for (const { axis, sliceIndex, dir } of solution) {
      state = rotateSliceCubies(state, DAILY_CUBE_SIZE, axis, sliceIndex, dir);
      wonAfter.push(checkRubiksSolvedAntipodal(state, DAILY_CUBE_SIZE));
    }
    return { state, solution, firstWin: wonAfter.indexOf(true) + 1 };
  };

  it('stages disturbed and solves in exactly par turns', () => {
    const level = buildDailyLevel(KEY);
    const { solution, firstWin } = playOptimally(level);
    expect(solution).toHaveLength(level.par);
    // Not one turn sooner: an earlier win would mean par overstates the cost.
    expect(firstWin).toBe(level.par);
  });

  it('holds for a run of consecutive days, not just a lucky one', () => {
    for (let d = 1; d <= 12; d++) {
      const key = `2026-12-${String(d).padStart(2, '0')}`;
      const level = buildDailyLevel(key);
      const { firstWin } = playOptimally(level);
      expect(firstWin, `daily ${key}`).toBe(level.par);
    }
  });

  it('accepts a board still carrying flips — the manifold is what is solved', () => {
    // The decoys are never undone by the optimal line, so the winning board has
    // tiles showing their antipode. If the win demanded the literal colouring
    // this would fail, and the player would be forced to spend moves undoing
    // free flips.
    const { state } = playOptimally(buildDailyLevel(KEY));
    expect(checkRubiksSolvedAntipodal(state, DAILY_CUBE_SIZE)).toBe(true);
    expect(checkRubiksSolved(state, DAILY_CUBE_SIZE), 'won on the literal colouring, so the test proves nothing').toBe(false);
  });
});

describe('the level carries the day it is', () => {
  it('stamps the build key onto the level', () => {
    expect(buildDailyLevel(KEY).dailyKey).toBe(KEY);
    expect(buildDailyLevel('2026-12-25').dailyKey).toBe('2026-12-25');
  });

  it('survives registration, so the played level still knows its date', () => {
    _resetDailyRegistration();
    ensureDailyPack(KEY);
    // handleLevelSelect reads the level back out of the registry — the stamp has
    // to survive _registerLevels' spread or the completion path loses the date.
    expect(levelsManager.getLevel(DAILY_LEVEL_ID).dailyKey).toBe(KEY);
    _resetDailyRegistration();
  });
});

describe('msUntilNextLocalMidnight', () => {
  it('measures to the next local midnight', () => {
    // 21:00 local → 3 hours left.
    expect(msUntilNextLocalMidnight(new Date(2026, 8, 1, 21, 0, 0))).toBe(3 * 3600_000);
    expect(msUntilNextLocalMidnight(new Date(2026, 8, 1, 23, 59, 59))).toBe(1000);
  });

  it('never returns zero, so a midnight timer cannot spin', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 8, 1, 0, 0, 0))).toBeGreaterThan(0);
    expect(msUntilNextLocalMidnight(new Date(2026, 8, 1, 23, 59, 59, 999))).toBeGreaterThan(0);
  });

  it('crosses month and year ends', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 7, 31, 23, 0, 0))).toBe(3600_000);
    expect(msUntilNextLocalMidnight(new Date(2026, 11, 31, 23, 0, 0))).toBe(3600_000);
  });
});

describe('recordLevelCompletion', () => {
  let pm;
  beforeEach(() => { pm = new ProgressManager({ testMode: false, autoSave: false }); });

  const dailyLevel = (dateKey = KEY, par = 6) => ({ dailyKey: dateKey, par, id: DAILY_LEVEL_ID });

  it('does nothing without a level — freeplay wins are not completions', () => {
    expect(recordLevelCompletion({ levelId: null, progress: pm })).toEqual({ kind: 'none' });
  });

  it('records a campaign chapter through completeLevel', () => {
    const out = recordLevelCompletion({ levelId: 1, stats: { moves: 3, time: 20 }, progress: pm });
    expect(out.kind).toBe('level');
    expect(pm.loadProgress()).toContain(1);
  });

  it('banks the daily against the key the LEVEL was built with, not the clock', () => {
    // The 23:58 → 00:03 case: the level is yesterday's, so the solve is too.
    const yesterday = '2026-09-01';
    const out = recordLevelCompletion({
      levelId: DAILY_LEVEL_ID,
      levelData: dailyLevel(yesterday),
      stats: { moves: 6 },
      progress: pm,
    });
    expect(out.dateKey).toBe(yesterday);
    expect(pm.isDailyComplete(yesterday)).toBe(true);
    // The new day must NOT be marked complete before it has been played.
    expect(pm.isDailyComplete('2026-09-02')).toBe(false);
  });

  it('keeps a midnight-crossing solve on the same streak rather than resetting it', () => {
    // Solved the 1st on the 1st, then opened the 2nd's puzzle before midnight on
    // the 2nd and finished it after — that is a two-day run, not a reset.
    recordLevelCompletion({ levelId: DAILY_LEVEL_ID, levelData: dailyLevel('2026-09-01'), stats: { moves: 6 }, progress: pm });
    const out = recordLevelCompletion({ levelId: DAILY_LEVEL_ID, levelData: dailyLevel('2026-09-02'), stats: { moves: 6 }, progress: pm });
    expect(out.streak).toBe(2);
  });

  it('pays the purse once a day, however many times the day is replayed', () => {
    const paid = [];
    const args = { levelId: DAILY_LEVEL_ID, levelData: dailyLevel(), stats: { moves: 6 }, progress: pm, earn: (n) => paid.push(n), dailyReward: 100 };
    recordLevelCompletion(args);
    recordLevelCompletion(args);
    recordLevelCompletion(args);
    expect(paid).toEqual([100]);
  });

  it('pays nothing when no reward is configured', () => {
    const paid = [];
    recordLevelCompletion({ levelId: DAILY_LEVEL_ID, levelData: dailyLevel(), stats: { moves: 6 }, progress: pm, earn: (n) => paid.push(n) });
    expect(paid).toEqual([]);
  });

  it('keeps the daily out of campaign completion', () => {
    recordLevelCompletion({ levelId: DAILY_LEVEL_ID, levelData: dailyLevel(), stats: { moves: 6 }, progress: pm });
    expect(pm.loadProgress()).not.toContain(DAILY_LEVEL_ID);
  });

  it('scores against the level’s own par', () => {
    const out = recordLevelCompletion({
      levelId: DAILY_LEVEL_ID, levelData: dailyLevel(KEY, 6), stats: { moves: 6 }, progress: pm,
    });
    expect(out.stars).toBe(3);
  });
});

describe('daily id band', () => {
  // The daily is registered at runtime, so it is deliberately absent from
  // LEVEL_ID_RANGES (which algorithmCodex.test.js asserts holds only statically
  // registered packs). These are the collision guards that map would have given.
  it('sits inside the reserved 401–499 band', () => {
    expect(DAILY_LEVEL_ID).toBeGreaterThanOrEqual(401);
    expect(DAILY_LEVEL_ID).toBeLessThanOrEqual(499);
  });

  it('cannot collide with any shipped pack’s ids', () => {
    for (const [packId, [lo, hi]] of Object.entries(LEVEL_ID_RANGES)) {
      expect(DAILY_LEVEL_ID < lo || DAILY_LEVEL_ID > hi, `overlaps ${packId}`).toBe(true);
    }
    for (const pack of Object.values(BUILT_IN_PACKS)) {
      for (const level of pack.levels) expect(level.id).not.toBe(DAILY_LEVEL_ID);
    }
  });

  it('stays out of BUILT_IN_PACKS — the daily is built per-day, never shipped', () => {
    expect(Object.keys(BUILT_IN_PACKS)).not.toContain(DAILY_PACK_ID);
  });
});

describe('streak arithmetic', () => {
  it('starts a run at one', () => {
    expect(advanceStreak(emptyDailyRecord(), KEY)).toMatchObject({ current: 1, best: 1, total: 1, lastKey: KEY });
  });

  it('extends across consecutive days', () => {
    let r = emptyDailyRecord();
    for (const k of ['2026-09-01', '2026-09-02', '2026-09-03']) r = advanceStreak(r, k);
    expect(r).toMatchObject({ current: 3, best: 3, total: 3 });
  });

  it('resets the run on a missed day but keeps the best and the total', () => {
    let r = emptyDailyRecord();
    for (const k of ['2026-09-01', '2026-09-02', '2026-09-03']) r = advanceStreak(r, k);
    r = advanceStreak(r, '2026-09-05'); // skipped the 4th
    expect(r).toMatchObject({ current: 1, best: 3, total: 4 });
  });

  it('counts a day once however many times it is replayed', () => {
    let r = advanceStreak(emptyDailyRecord(), KEY);
    r = advanceStreak(r, KEY);
    r = advanceStreak(r, KEY);
    expect(r).toMatchObject({ current: 1, total: 1 });
  });

  it('bridges a month boundary', () => {
    let r = advanceStreak(emptyDailyRecord(), '2026-08-31');
    r = advanceStreak(r, '2026-09-01');
    expect(r.current).toBe(2);
  });

  it('tolerates a null or partial record from an older build', () => {
    expect(advanceStreak(null, KEY).current).toBe(1);
    expect(advanceStreak({ lastKey: previousDayKey(KEY), current: 4 }, KEY)).toMatchObject({ current: 5, best: 5 });
  });

  it('reports a lapsed run as zero rather than advertising a streak a solve would reset', () => {
    const r = advanceStreak(emptyDailyRecord(), '2026-09-01');
    expect(currentStreak(r, '2026-09-01')).toBe(1); // solved today
    expect(currentStreak(r, '2026-09-02')).toBe(1); // still live — today is unplayed
    expect(currentStreak(r, '2026-09-03')).toBe(0); // lapsed
    expect(currentStreak(emptyDailyRecord(), KEY)).toBe(0);
  });

  it('knows whether today is already done', () => {
    const r = advanceStreak(emptyDailyRecord(), KEY);
    expect(isDailyDone(r, KEY)).toBe(true);
    expect(isDailyDone(r, '2026-09-02')).toBe(false);
  });
});

describe('progressManager daily record', () => {
  let pm;
  beforeEach(() => { pm = new ProgressManager({ testMode: false, autoSave: false }); });

  it('starts empty and reports no streak', () => {
    expect(pm.loadDailyRecord()).toMatchObject({ lastKey: null, current: 0, total: 0 });
    expect(pm.isDailyComplete(KEY)).toBe(false);
    expect(pm.getDailyStreak(KEY)).toBe(0);
  });

  it('records a solve, its streak and its golf stars', () => {
    const res = pm.completeDailyChallenge(KEY, { par: 6, moves: 6, time: 40 });
    expect(res.stars).toBe(3);          // par exactly
    expect(res.isFirstToday).toBe(true);
    expect(res.streak).toBe(1);
    expect(pm.isDailyComplete(KEY)).toBe(true);
  });

  it('grades over par the same way story levels are graded', () => {
    expect(pm.completeDailyChallenge('2026-09-10', { par: 6, moves: 8 }).stars).toBe(2);
    expect(pm.completeDailyChallenge('2026-09-11', { par: 6, moves: 40 }).stars).toBe(1);
  });

  it('does not touch campaign completion — the daily id is not a chapter', () => {
    pm.completeDailyChallenge(KEY, { par: 5, moves: 5 });
    expect(pm.loadProgress()).not.toContain(DAILY_LEVEL_ID);
  });

  it('keeps the day’s best when the same day is replayed, and does not double the streak', () => {
    pm.completeDailyChallenge(KEY, { par: 6, moves: 20 });
    const again = pm.completeDailyChallenge(KEY, { par: 6, moves: 6 });
    expect(again.isFirstToday).toBe(false);
    expect(again.streak).toBe(1);
    expect(pm.loadDailyRecord()).toMatchObject({ total: 1, lastMoves: 6, lastStars: 3 });
  });

  it('awards the daily achievements at their thresholds, once each', () => {
    expect(pm.completeDailyChallenge('2026-09-01', { par: 6, moves: 9 }).newAchievements).toContain('daily_first');
    expect(pm.completeDailyChallenge('2026-09-02', { par: 6, moves: 9 }).newAchievements).toEqual([]);
    expect(pm.completeDailyChallenge('2026-09-03', { par: 6, moves: 9 }).newAchievements).toContain('daily_streak_3');

    for (const d of ['04', '05', '06']) pm.completeDailyChallenge(`2026-09-${d}`, { par: 6, moves: 9 });
    expect(pm.completeDailyChallenge('2026-09-07', { par: 6, moves: 9 }).newAchievements).toContain('daily_streak_7');
  });

  it('awards the par achievement only for a par-or-better solve', () => {
    expect(pm.completeDailyChallenge('2026-09-01', { par: 6, moves: 9 }).newAchievements).not.toContain('daily_par');
    expect(pm.completeDailyChallenge('2026-09-02', { par: 6, moves: 6 }).newAchievements).toContain('daily_par');
  });

  it('clears the streak when progress is reset', () => {
    pm.completeDailyChallenge(KEY, { par: 6, moves: 6 });
    pm.resetAllProgress(true);
    expect(pm.loadDailyRecord()).toMatchObject({ lastKey: null, current: 0, total: 0 });
  });
});

describe('achievement catalogue', () => {
  it('has unique ids, and a label, description and glyph for each', () => {
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.glyph.length).toBeGreaterThan(0);
      expect(['campaign', 'daily']).toContain(a.group);
    }
  });

  it('catalogues every id ProgressManager can actually grant', () => {
    // A granted id with no entry here would render as a blank card.
    const granted = ['first_steps', 'topology_master', 'speed_demon', 'perfectionist', 'completionist',
      'daily_first', 'daily_streak_3', 'daily_streak_7', 'daily_par'];
    for (const id of granted) expect(ACHIEVEMENT_IDS).toContain(id);
  });

  it('degrades readably for an id from another build instead of blanking', () => {
    const unknown = getAchievement('from_the_future');
    expect(unknown.label).toBe('From The Future');
    expect(unknown.glyph).toBe('?');
  });

  it('marks what is earned and never drops an award the player holds', () => {
    const decorated = decorateAchievements(['perfectionist', 'from_the_future']);
    expect(decorated.find((a) => a.id === 'perfectionist').earned).toBe(true);
    expect(decorated.find((a) => a.id === 'first_steps').earned).toBe(false);
    expect(decorated.find((a) => a.id === 'from_the_future')).toMatchObject({ earned: true });
    expect(decorateAchievements()).toHaveLength(ACHIEVEMENTS.length);
  });
});
