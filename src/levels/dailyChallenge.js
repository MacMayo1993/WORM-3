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
// So the daily pins the draw to the invariant plane (nARange [0, 0]), where the
// formula collapses to C_dir = min(n11, P − n11) = targetPar. The par the player
// is scored against is therefore the day's *exact* analytic par, not an
// approximation of it — the same guarantee Story mode's own descent chapters
// carry. P is chosen as 2·par (+0/2/4) so a symmetric config always exists:
// generateLevelState relaxes an unsatisfiable band rather than throwing, and a
// relaxed band would silently hand back an unplayable n_A > 0 state.
//
// ── Determinism ──────────────────────────────────────────────────────────────
// Nothing here touches Math.random or reads the clock except through an
// injected date. Every choice — the day's par, its P, which β-pairs are flipped
// — descends from the date key, so two players on the same calendar date face
// byte-identical puzzles and can compare move counts honestly.

import { generateDailyChallenge, makeRng } from './antipodalRandomizer.js';
import { buildPlayableAntipodalLevel, betaPairCount } from './antipodalLevelBridge.js';
import { createLevelPack, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from './schema.js';
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
export const DAILY_PAR_MIN = 4;
export const DAILY_PAR_MAX = 10;

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
 * The analytic plan for one day: its exact par, the fibre it was drawn from,
 * and the ambiguity of that fibre (Δ = 0 means both polarities cost the same,
 * so the day offers a genuine choice rather than one obvious attractor).
 *
 * Deterministic in `dateKey` alone.
 */
export function dailyPlanFor(dateKey) {
  const rng = makeRng(`daily-plan:${dateKey}`);

  const par = DAILY_PAR_MIN + Math.floor(rng() * (DAILY_PAR_MAX - DAILY_PAR_MIN + 1));
  // min(n11, P − n11) = par is only satisfiable when par ≤ ⌊P/2⌋.
  const P = 2 * par + 2 * Math.floor(rng() * 3);

  const physicalPairs = betaPairCount(DAILY_CUBE_SIZE);
  if (par > physicalPairs) {
    throw new RangeError(`Daily par ${par} exceeds the ${physicalPairs} β-pairs of a ${DAILY_CUBE_SIZE}×${DAILY_CUBE_SIZE} cube`);
  }

  const draw = generateDailyChallenge(dateKey, { P, targetPar: par, nARange: [0, 0] });

  return {
    dateKey,
    par,
    size: DAILY_CUBE_SIZE,
    P,
    n00: draw.params.n00,
    n11: draw.params.n11,
    nA: draw.params.nA,
    ambiguity: draw.ambiguity
  };
}

/** Difficulty band for the day's par — drives the card's tone, not the rules. */
export function dailyDifficultyFor(par) {
  if (par <= 5) return DIFFICULTY.EASY;
  if (par <= 8) return DIFFICULTY.MEDIUM;
  return DIFFICULTY.HARD;
}

/**
 * Today's playable level. One CLASSIC flip-solve puzzle with an exact par and no
 * layer turns to undo — the fastest honest expression of the antipodal idea.
 */
export function buildDailyLevel(dateKey) {
  const plan = dailyPlanFor(dateKey);

  return buildPlayableAntipodalLevel({
    id: DAILY_LEVEL_ID,
    size: plan.size,
    targetPar: plan.par,
    seed: `daily:${dateKey}`,
    meta: {
      name: `Daily Descent — ${dateKey}`,
      description: `${plan.par} antipodal pairs are showing their opposite. Everyone playing today gets this exact puzzle.`,
      background: BACKGROUNDS.NASA,
      difficulty: dailyDifficultyFor(plan.par),
      tags: [LEVEL_TAGS.PUZZLE],
      tutorial: {
        title: 'Daily Descent',
        text: `${plan.par} pairs show their antipodal twin. Tap each one back home — no layer turns are needed today.`,
        objective: `Par is ${plan.par} flip${plan.par === 1 ? '' : 's'}. Match it for all three stars.`,
        tip: plan.ambiguity === 0
          ? 'Both polarities cost the same today — either target is a par solve.'
          : 'One polarity is cheaper than the other. Count before you tap.'
      },
      winMessage: 'Daily Descent solved. ⭐',
      requirements: { previousLevel: null, stars: 0, achievements: [] }
    }
  });
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
