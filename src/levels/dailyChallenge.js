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
// ── What the daily is ────────────────────────────────────────────────────────
// A short scramble solved in the RP² QUOTIENT. Opposite faces are one face of
// the real projective plane, so red is orange, green is blue, white is yellow —
// a tile showing its antipode is showing its own manifold and is home. The cube
// is solved when every face is uniform in its colour CLASS.
//
// Two consequences shape the whole puzzle, and both are the point rather than
// concessions. A flip cannot move a sticker out of its colour class, so flips
// are accepted but never required: a tile flipped in place is already home and
// undoing it is wasted moves. And a 180° turn carries every tile to its
// antipodal face, so it costs nothing to leave in — the quotient forgives it.
// Solving here is genuinely cheaper than solving a Rubik's cube, which is what
// keeps a daily inside one sitting.
//
// ── Why it is not the flip puzzle it used to be ──────────────────────────────
// The daily used to stage a solved cube plus a handful of paired flips and ask
// the player to tap them back, scored against C_dir = n_A + min(n11, P − n11).
// Under the quotient that puzzle does not exist: a board disturbed by flips
// alone is already solved, because flipping never leaves the colour class. Only
// turns can move a tile out of its manifold, so only turns can make work — the
// daily has to scramble, and the flips it still stages are there to be
// recognised as free, not repaired.
//
// ── Par ──────────────────────────────────────────────────────────────────────
// Par is the exact minimum number of quarter turns that reaches a quotient-
// solved cube, found by iterative deepening in quotientSolver.js. Not the
// scramble length: a scramble of five quarter turns frequently solves in three
// (and occasionally in one), because the quotient goal is a much larger target
// than the literal solved cube. Par is proven optimal, so matching it is a
// genuine achievement and beating it is impossible — the same guarantee the old
// closed-form par carried, bought with a search instead of a formula.
//
// ── Determinism ──────────────────────────────────────────────────────────────
// Nothing here touches Math.random or reads the clock except through an
// injected date. Every choice — the day's par, its P, which β-pairs are flipped
// — descends from the date key, so two players on the same calendar date face
// byte-identical puzzles and can compare move counts honestly.

import { makeRng } from './antipodalRandomizer.js';
import { betaPairAnchors } from './antipodalLevelBridge.js';
import { buildMoveTable, quotientPar } from './quotientSolver.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import {
  createLevel, createLevelPack, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS
} from './schema.js';
import { levelsManager } from './LevelsManager.js';

export const DAILY_PACK_ID = 'daily-challenge';

// One id, re-pointed at a new puzzle each day. The daily is not a campaign
// chapter — it is deliberately NOT tracked in the flat completed-levels array,
// because "completed" for a daily means "completed today", which that array
// cannot express. Its record lives under DAILY_STORAGE_KEY instead.
export const DAILY_LEVEL_ID = 401;
export const DAILY_STORAGE_KEY = 'worm3_daily_record';

export const DAILY_CUBE_SIZE = 3;

// The par band, in quarter turns — the same unit the game's move counter uses.
//
// The ceiling is as much a performance limit as a design one. Proving a par of
// N optimal means exhausting every sequence shorter than N, and that grows ~17×
// per turn: par 3 resolves in under a millisecond, par 5 in about 60ms, par 6
// in roughly a second. Six is past what a screen mount should spend, so the
// daily draws inside a band it can prove instantly.
export const DAILY_PAR_MIN = 3;
export const DAILY_PAR_MAX = 5;

// Quarter turns applied when staging. Par is DERIVED from the result, never
// equal to this by assumption — the quotient collapses a scramble to something
// shorter surprisingly often, and always to the same parity.
export const DAILY_SCRAMBLE_TURNS = 5;

// Flips staged on top. They are free under the quotient (a flip never leaves
// the colour class), so they cost the player nothing to leave alone — and cost
// two moves each to "repair", which is the trap that teaches the rule.
export const DAILY_DECOY_FLIPS = 3;

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
 * A deterministic scramble: `turns` quarter turns drawn from the seeded stream,
 * in canonical form — never a move immediately undone, never a third
 * consecutive turn of one slice. Both cancel into something shorter, so a
 * scramble containing them is not the depth it claims to be.
 *
 * Two consecutive turns of one slice ARE allowed: that is a 180°, and under the
 * quotient it is free, which makes it one of the day's better traps.
 */
export function buildDailyScramble(dateKey, turns = DAILY_SCRAMBLE_TURNS, attempt = 0) {
  const rng = makeRng(`daily-scramble:${dateKey}:${attempt}`);
  const { moves } = buildMoveTable(DAILY_CUBE_SIZE);
  const seq = [];
  let run = 0;
  while (seq.length < turns) {
    const m = moves[Math.floor(rng() * moves.length)];
    const prev = seq[seq.length - 1];
    if (prev) {
      const sameSlice = prev.axis === m.axis && prev.sliceIndex === m.sliceIndex;
      if (sameSlice && prev.dir !== m.dir) continue;   // immediately undone
      if (sameSlice && run >= 2) continue;             // a third identical turn
      run = sameSlice ? run + 1 : 1;
    } else {
      run = 1;
    }
    seq.push({ axis: m.axis, sliceIndex: m.sliceIndex, dir: m.dir, numTurns: 1 });
  }
  return seq;
}

/** The cube a scramble produces, with no flips applied. */
function scrambledCube(scramble) {
  let state = makeCubies(DAILY_CUBE_SIZE);
  for (const { axis, sliceIndex, dir } of scramble) {
    state = rotateSliceCubies(state, DAILY_CUBE_SIZE, axis, sliceIndex, dir);
  }
  return state;
}

/**
 * Which β-pairs open flipped. Decoys: free to leave, costly to "fix". Chosen
 * from the pairs of a SOLVED cube, which is where levelStaging applies them, and
 * they are invisible to par because a flip cannot change a colour class.
 */
function buildDailyDecoys(dateKey, count = DAILY_DECOY_FLIPS) {
  const rng = makeRng(`daily-decoys:${dateKey}`);
  const anchors = betaPairAnchors(DAILY_CUBE_SIZE);
  const order = anchors.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, count).map((i) => anchors[i]);
}

// dailyPlanFor runs a proof-of-optimality search, which is cheap but not free,
// and several screens ask for the same day. Memoised so a mount costs nothing
// after the first. Keyed by date, so a session crossing midnight still recomputes.
const _planCache = new Map();

/**
 * The plan for one day: its scramble, its decoy flips, and its EXACT par.
 *
 * Par comes from the solver, so a scramble whose par falls below the band is
 * redrawn rather than shipped — the quotient collapses some scrambles to almost
 * nothing, and a par-1 daily is not a daily. Redraws are seeded by attempt
 * number, so the day is still identical for every player.
 *
 * Deterministic in `dateKey` alone.
 */
export function dailyPlanFor(dateKey) {
  const cached = _planCache.get(dateKey);
  if (cached) return cached;

  const table = buildMoveTable(DAILY_CUBE_SIZE);
  let scramble = null;
  let par = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const candidate = buildDailyScramble(dateKey, DAILY_SCRAMBLE_TURNS, attempt);
    const found = quotientPar(scrambledCube(candidate), DAILY_CUBE_SIZE, { maxDepth: DAILY_PAR_MAX, table });
    if (found !== null && found >= DAILY_PAR_MIN) {
      scramble = candidate;
      par = found;
      break;
    }
  }
  if (scramble === null) {
    throw new RangeError(`Daily ${dateKey}: no scramble landed a par in [${DAILY_PAR_MIN}, ${DAILY_PAR_MAX}] in 24 attempts`);
  }

  const plan = {
    dateKey,
    par,
    size: DAILY_CUBE_SIZE,
    scramble,
    decoys: buildDailyDecoys(dateKey),
    // How far the quotient shortened the scramble. 0 means the scramble was
    // already optimal; 2 or 4 means some of it cancelled for free.
    slack: scramble.length - par
  };
  _planCache.set(dateKey, plan);
  return plan;
}

/** Test seam — forget memoised plans. */
export function _resetDailyPlanCache() {
  _planCache.clear();
}

/** Difficulty band for the day's par — drives the card's tone, not the rules. */
export function dailyDifficultyFor(par) {
  if (par <= 3) return DIFFICULTY.EASY;
  if (par <= 4) return DIFFICULTY.MEDIUM;
  return DIFFICULTY.HARD;
}

/**
 * Today's playable level.
 *
 * The copy teaches the RULE — the manifold is what gets solved, opposite
 * colours are the same colour — and never the day's answer. It is worth saying
 * plainly that flipped tiles are already home, because a player who does not
 * know that will spend moves undoing them and lose stars to a misunderstanding
 * rather than to the puzzle.
 */
export function buildDailyLevel(dateKey) {
  const plan = dailyPlanFor(dateKey);

  const level = createLevel({
    id: DAILY_LEVEL_ID,
    name: `Daily Descent — ${dateKey}`,
    description: `A ${plan.scramble.length}-turn scramble that solves in ${plan.par}. Everyone playing today gets this exact cube.`,
    cubeSize: plan.size,
    scrambleSequence: plan.scramble,
    scrambleMoves: 0,
    flipSequence: plan.decoys,
    par: plan.par,
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background: BACKGROUNDS.NASA,
    features: { rotations: true, tunnels: false, flips: true, chaos: false, explode: false, parity: true, net: false },
    tutorial: {
      title: 'Daily Descent',
      text:
        'Solve the manifold, not the colours. Opposite faces are the same face here — red is orange, green is blue, ' +
        'white is yellow — so a face counts as done when it shows one colour PAIR, not one colour.',
      objective: `Par is ${plan.par} turn${plan.par === 1 ? '' : 's'}. Match it for all three stars.`,
      tip:
        'Tiles showing their opposite are already home — flipping them back only spends moves. ' +
        'And a half turn costs you nothing: it lands every tile on its twin.'
    },
    // The manifold is what is being solved, so a tile showing its antipode is
    // home and a 180° turn is free. See winDetection.checkRubiksSolved.
    winCondition: WIN_CONDITIONS.ANTIPODAL,
    winMessage: 'Daily Descent solved. ⭐',
    difficulty: dailyDifficultyFor(plan.par),
    tags: [LEVEL_TAGS.PUZZLE],
    requirements: { previousLevel: null, stars: 0, achievements: [] }
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
