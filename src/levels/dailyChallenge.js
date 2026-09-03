// dailyChallenge.js — the Daily Descent: one procedural antipodal puzzle per
// calendar day, identical for every player who plays that date.
//
// The generator has existed and been unit-tested since the analytic level work
// landed (antipodalRandomizer.generateDailyChallenge), and the economy has
// carried EARN_DAILY_CHALLENGE the whole time — but nothing ever built a
// *playable* level from the draw, so none of it was reachable. This module is
// the missing half: it lands the day's abstract fibre on a real cube through
// antipodalLevelBridge, and owns the pure streak arithmetic that
// ProgressManager persists.
//
// ── What the daily can and cannot realise ────────────────────────────────────
// A draw is a fibre partition (n00, n11, n_A) over P antipodal β-orbit pairs,
// whose exact solve cost is the directed canonical formula
//
//     C_dir = n_A + min(n11, P − n11).
//
// Classic staging authors a level with *paired* native flips, and a paired move
// toggles both members of a β-pair at once — so it can only ever produce
// SYMMETRIC states (n_A = 0). Asymmetric defect pairs are exactly the ∆ ≠ 0
// states the monograph proves unreachable by paired moves; they belong to the
// worm/heal move model. See the header of antipodalLevelBridge.js.
//
// So the daily lives on the invariant plane (n_A = 0), where the formula
// collapses to C_dir = min(n11, P − n11) = the day's par, exactly.
//
// P here is the cube's REAL β-pair count — betaPairCount(3) = 27 — not a
// notional orbit count. It used to be a free parameter (2·par + 0/2/4) fed to
// the abstract randomizer, which made the reported n00/n11/ambiguity describe a
// fibre nobody was playing: the board always carried exactly `par` flips out of
// 27 whatever P said, and `ambiguity` was computed against the fiction. Every
// number this module reports is now measured on the board that gets staged.
//
// ── The polarity choice ──────────────────────────────────────────────────────
// min(n11, P − n11) has two branches, and the daily draws between them:
//
//   LOW  (n11 = par ≤ 13)      the board shows `par` wrong pairs. Tap them home.
//   HIGH (n11 = 27 − par ≥ 17) the board shows 17–23 wrong pairs — and the cheap
//                              route is NOT to fix them. Flip the `par` pairs
//                              that still look RIGHT and the cube lands
//                              all-dirty: every sticker showing its antipode,
//                              which is solved in the RP² quotient.
//
// Par is `par` either way, so a high day punishes the reflex to repair what
// looks broken: 23 taps and a 1-star finish, against 4 taps for par. That is the
// day's actual puzzle — count, decide, commit — and it needs no cube-solving
// skill, which is what keeps the daily a single sitting.
//
// A high day is only winnable through WIN_CONDITIONS.ANTIPODAL; under CLASSIC
// the all-dirty target is not a win at all, so the level declares it and
// useGameSession honours it. buildPlayableAntipodalLevel refuses the pairing in
// the other direction rather than shipping an unwinnable par.
//
// ── Determinism ──────────────────────────────────────────────────────────────
// Nothing here touches Math.random or reads the clock except through an
// injected date. Every choice — the day's par, its P, which β-pairs are flipped
// — descends from the date key, so two players on the same calendar date face
// byte-identical puzzles and can compare move counts honestly.

import { makeRng, computeCDir, targetAmbiguity } from './antipodalRandomizer.js';
import { buildPlayableAntipodalLevel, betaPairCount } from './antipodalLevelBridge.js';
import { createLevelPack, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS, WIN_CONDITIONS } from './schema.js';
import { levelsManager } from './LevelsManager.js';

export const DAILY_PACK_ID = 'daily-challenge';

// One id, re-pointed at a new puzzle each day. The daily is not a campaign
// chapter — it is deliberately NOT tracked in the flat completed-levels array,
// because "completed" for a daily means "completed today", which that array
// cannot express. Its record lives under DAILY_STORAGE_KEY instead.
export const DAILY_LEVEL_ID = 401;
export const DAILY_STORAGE_KEY = 'worm3_daily_record';

export const DAILY_CUBE_SIZE = 3;

// The par band. The floor keeps a daily from being a two-tap formality; the
// ceiling keeps it inside a single sitting, which is the whole point of a daily.
//
// The ceiling also has to stay strictly under P/2 = 13.5, or the two polarities
// stop being distinguishable and `par` would no longer be the cheaper of them.
export const DAILY_PAR_MIN = 4;
export const DAILY_PAR_MAX = 10;

// How often the day draws the HIGH polarity — the board that looks nearly ruined
// but is `par` taps from the all-dirty solve. Kept under half so the reflex read
// ("fix what's wrong") is right more often than not; a player who never checks
// still solves most days, and pays for it on the rest.
export const DAILY_HIGH_POLARITY_RATE = 0.35;

// ─── Calendar keys ───────────────────────────────────────────────────────────
// Keys are LOCAL calendar dates, not UTC. A player's "today" should turn over at
// their own midnight; two players on the same calendar date still draw the same
// puzzle, because the key is the same string on both machines.

/** 'YYYY-MM-DD' for a Date (or anything Date accepts), in local time. */
export function dailyKeyFor(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new TypeError(`dailyKeyFor: invalid date ${String(date)}`);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The calendar day before `dateKey`. Built through Date so month lengths, leap
 * days and year boundaries are the platform's problem, not ours.
 */
export function previousDayKey(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new TypeError(`previousDayKey: malformed key ${String(dateKey)}`);
  }
  return dailyKeyFor(new Date(y, m - 1, d - 1));
}

/**
 * Milliseconds until the next local midnight — how long a rendered date key
 * stays true. A screen that shows the day's puzzle has to re-derive its key on
 * this boundary, or it sits on yesterday's date, par and streak indefinitely
 * while a click launches today's puzzle instead.
 *
 * Always ≥ 1 so a caller scheduling a timeout cannot spin at exactly midnight.
 */
export function msUntilNextLocalMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, next.getTime() - now.getTime());
}

/** A human date for the header — 'Monday 1 September'. */
export function dailyLabelFor(dateKey, locale = undefined) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  try {
    return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return dateKey;
  }
}

// ─── The day's puzzle ────────────────────────────────────────────────────────

/**
 * The analytic plan for one day: its exact par, the polarity it wants, and the
 * fibre partition of the board that will actually be staged.
 *
 * `n11` is the number of β-pairs the board opens flipped, so it is also the
 * number of visibly wrong pairs the player sees. `par` is min(n11, P − n11) —
 * the LOW day's par is what is on screen, the HIGH day's par is what is not.
 *
 * Deterministic in `dateKey` alone: two players on the same calendar date face
 * byte-identical boards and can compare move counts honestly.
 */
export function dailyPlanFor(dateKey) {
  const rng = makeRng(`daily-plan:${dateKey}`);

  const P = betaPairCount(DAILY_CUBE_SIZE);
  const par = DAILY_PAR_MIN + Math.floor(rng() * (DAILY_PAR_MAX - DAILY_PAR_MIN + 1));
  if (2 * par >= P) {
    throw new RangeError(`Daily par ${par} is not strictly under half of the ${P} β-pairs of a ${DAILY_CUBE_SIZE}×${DAILY_CUBE_SIZE} cube`);
  }

  // Draw the polarity from its own stream position, after par, so the two are
  // independent: a high day is not correlated with a particular par.
  const polarity = rng() < DAILY_HIGH_POLARITY_RATE ? 'high' : 'low';
  const n11 = polarity === 'high' ? P - par : par;
  const nA = 0;
  const n00 = P - n11 - nA;

  // The formula is the authority on par, not the arithmetic above. If these ever
  // disagree the level would be scored against a cost no route can achieve.
  const cDir = computeCDir(n00, n11, nA);
  if (cDir !== par) {
    throw new RangeError(`Daily ${dateKey}: C_dir(${n00}, ${n11}, ${nA}) = ${cDir} contradicts par ${par}`);
  }

  return {
    dateKey,
    par,
    size: DAILY_CUBE_SIZE,
    P,
    polarity,
    n00,
    n11,
    nA,
    // Δ = |P − 2·n11|. Odd P (27 at 3×3) makes Δ = 0 unreachable, so the two
    // targets are never equally priced — there is always a right answer.
    ambiguity: targetAmbiguity(P, n11)
  };
}

/** Difficulty band for the day's par — drives the card's tone, not the rules. */
export function dailyDifficultyFor(par) {
  if (par <= 5) return DIFFICULTY.EASY;
  if (par <= 8) return DIFFICULTY.MEDIUM;
  return DIFFICULTY.HARD;
}

/**
 * Today's playable level. One flip-solve puzzle with an exact par and no layer
 * turns to undo — the fastest honest expression of the antipodal idea.
 *
 * The copy states the RULE (two targets, par is the cheaper one) but never the
 * day's ANSWER. Naming the polarity would hand over the only decision in the
 * puzzle; the count is on screen for anyone willing to make it.
 */
export function buildDailyLevel(dateKey) {
  const plan = dailyPlanFor(dateKey);

  const level = buildPlayableAntipodalLevel({
    id: DAILY_LEVEL_ID,
    size: plan.size,
    targetPar: plan.par,
    flipCount: plan.n11,
    seed: `daily:${dateKey}`,
    meta: {
      // Every day accepts both targets, so a low day plays exactly as before and
      // a high day is winnable at all. Declaring it per-polarity would leak the
      // answer into the level data.
      winCondition: WIN_CONDITIONS.ANTIPODAL,
      name: `Daily Descent — ${dateKey}`,
      description: `${plan.n11} antipodal pairs are showing their opposite. Everyone playing today gets this exact puzzle.`,
      background: BACKGROUNDS.NASA,
      difficulty: dailyDifficultyFor(plan.par),
      tags: [LEVEL_TAGS.PUZZLE],
      tutorial: {
        title: 'Daily Descent',
        text:
          `${plan.n11} of the cube's ${plan.P} pairs show their antipodal twin. Two boards count as solved: every pair home, ` +
          'or every pair flipped. No layer turns are needed today.',
        objective: `Par is ${plan.par} flip${plan.par === 1 ? '' : 's'}. Match it for all three stars.`,
        tip: 'Par is the shorter road to whichever target is nearer. Count both before you tap.'
      },
      winMessage: 'Daily Descent solved. ⭐',
      requirements: { previousLevel: null, stars: 0, achievements: [] }
    }
  });

  // The level carries the day it IS, so completion is recorded against the
  // puzzle actually played rather than against whatever the clock says at the
  // moment of victory. A player who opens the daily at 23:58 and solves it at
  // 00:03 has solved YESTERDAY's puzzle: reading the clock afresh there would
  // bank it under the new date, which resets or wrongly extends the streak,
  // pays the new day's purse, and marks a puzzle complete before it is played.
  // createLevel drops fields it does not know, so this is stamped on after.
  return { ...level, dailyKey: dateKey };
}

/** The one-level pack the daily is played through. */
export function buildDailyPack(dateKey) {
  return createLevelPack({
    id: DAILY_PACK_ID,
    name: 'Daily Descent',
    description: 'One procedurally generated antipodal puzzle a day, the same for every player.',
    author: 'WORM³ Team',
    version: '1.0.0',
    levels: [buildDailyLevel(dateKey)],
    difficulty: DIFFICULTY.MEDIUM,
    tags: [LEVEL_TAGS.PUZZLE],
    requirements: { completedPacks: [], totalStars: 0 }
  });
}

// ─── Registration ────────────────────────────────────────────────────────────
// The daily has to be in the LevelsManager registry for getLevel(401) — and so
// the existing level-select → play routing — to resolve it. It is re-registered
// when the date turns over, which matters for a session left open past midnight.

let _registeredKey = null;

/**
 * Make sure the registry holds the pack for `dateKey`, rebuilding it if the day
 * has changed. Cheap and idempotent — safe to call on every screen mount.
 * @returns {{ pack, level, plan }}
 */
export function ensureDailyPack(dateKey = dailyKeyFor()) {
  if (_registeredKey !== dateKey) {
    // Unregister first: registerPack warns when overwriting, and a session that
    // crosses midnight would otherwise log that warning on every re-register.
    levelsManager.unregisterPack(DAILY_PACK_ID);
    levelsManager.registerPack(buildDailyPack(dateKey));
    _registeredKey = dateKey;
  }
  return {
    pack: levelsManager.getPack(DAILY_PACK_ID),
    level: levelsManager.getLevel(DAILY_LEVEL_ID),
    plan: dailyPlanFor(dateKey)
  };
}

/** Test seam — forget which day is registered. */
export function _resetDailyRegistration() {
  levelsManager.unregisterPack(DAILY_PACK_ID);
  _registeredKey = null;
}

// ─── Streaks ─────────────────────────────────────────────────────────────────
// Pure arithmetic over a plain record, so the interesting cases (a missed day,
// a double solve, a year boundary) are testable without touching storage.

/** The shape of a fresh record — also the fallback for unreadable storage. */
export function emptyDailyRecord() {
  return {
    lastKey: null,   // calendar day of the most recent solve
    current: 0,      // consecutive days ending at lastKey
    best: 0,         // longest run ever
    total: 0,        // total dailies solved
    lastPar: null,
    lastMoves: null,
    lastStars: 0
  };
}

/** Has this day's puzzle already been solved? */
export function isDailyDone(record, dateKey) {
  return !!record && record.lastKey === dateKey;
}

/**
 * Fold a solve on `dateKey` into `record`.
 *
 * Solving the same day twice is a no-op on the streak — a daily counts once,
 * however many times it is replayed — so this is safe to call unconditionally.
 */
export function advanceStreak(record, dateKey) {
  const base = { ...emptyDailyRecord(), ...(record || {}) };
  if (base.lastKey === dateKey) return base;

  const continues = base.lastKey === previousDayKey(dateKey);
  const current = continues ? base.current + 1 : 1;

  return {
    ...base,
    lastKey: dateKey,
    current,
    best: Math.max(base.best, current),
    total: base.total + 1
  };
}

/**
 * The streak as it stands *today* — a record whose last solve is older than
 * yesterday describes a run that has already lapsed, and the card must not show
 * a live "5 day streak" that a solve would reset to 1.
 */
export function currentStreak(record, dateKey) {
  if (!record || !record.lastKey) return 0;
  if (record.lastKey === dateKey || record.lastKey === previousDayKey(dateKey)) return record.current;
  return 0;
}
