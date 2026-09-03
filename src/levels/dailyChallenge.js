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
// A short scramble plus a few flipped pairs, solved by TURNING and FLIPPING.
//
// The win condition is the ordinary one and always was: every sticker shows the
// colour its face wants. What matters is the colour showing, not whether the
// tile is flipped or not — so a flipped tile that displays the right colour is
// finished, and the player is never made to undo it.
//
// That makes the flip a second way to fix a tile, alongside the turn. A sticker
// standing on its ANTIPODAL face shows exactly the wrong colour — red on the
// orange face — and one tap recolours it to the one that face wants, correcting
// it where it stands with no turn at all. A sticker flipped in its own cell is
// the mirror case: one tap puts it back. Both cost a move, because the game
// charges a move for a rotation and for a flip alike (useCubeState).
//
// ── Why it had to stop being a pure flip puzzle ──────────────────────────────
// The daily used to stage a solved cube plus paired flips and ask the player to
// tap them back, scored against C_dir = n_A + min(n11, P − n11). Every flipped
// tile was visibly wrong and one tap fixed it, so there was nothing to work out.
// Adding turns is what gives the flip something to compete with: now a tile can
// be wrong because it MOVED or because it FLIPPED, the two are repaired
// differently, and telling them apart is the puzzle.
//
// ── Par ──────────────────────────────────────────────────────────────────────
// Par is the exact minimum number of moves — turns and flips together — found
// by parSolver. It is NOT the staging length: turns sometimes cancel, and a
// tile that a turn carried onto its antipodal face is one flip from correct
// rather than several turns from home. Par is proven optimal by exhausting
// everything shorter, so matching it is a genuine achievement.
//
// ── Determinism ──────────────────────────────────────────────────────────────
// Nothing here touches Math.random or reads the clock except through an
// injected date. Every choice — the day's par, its P, which β-pairs are flipped
// — descends from the date key, so two players on the same calendar date face
// byte-identical puzzles and can compare move counts honestly.

import { makeRng } from './antipodalRandomizer.js';
import { betaPairAnchors } from './antipodalLevelBridge.js';
import { buildMoveTable, solveCost } from './parSolver.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { createLevel, createLevelPack, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from './schema.js';
import { levelsManager } from './LevelsManager.js';

export const DAILY_PACK_ID = 'daily-challenge';

// One id, re-pointed at a new puzzle each day. The daily is not a campaign
// chapter — it is deliberately NOT tracked in the flat completed-levels array,
// because "completed" for a daily means "completed today", which that array
// cannot express. Its record lives under DAILY_STORAGE_KEY instead.
export const DAILY_LEVEL_ID = 401;
export const DAILY_STORAGE_KEY = 'worm3_daily_record';

export const DAILY_CUBE_SIZE = 3;

// The par band, counted in MOVES — turns and flips share the currency, because
// the game charges one move for either.
//
// The ceiling is a performance limit as much as a design one. Proving a par of N
// optimal means exhausting every turn sequence shorter than N, which grows ~17×
// per turn: par 5 resolves in about 30ms, par 6 in nearly half a second. Five is
// what a screen mount can spend without a visible hitch.
export const DAILY_PAR_MIN = 3;
export const DAILY_PAR_MAX = 5;

// Staging. Two turns and three flipped pairs put the two kinds of wrongness on
// the board in comparable amounts — a tile out of place and a tile out of
// colour — which is the distinction the player has to make.
export const DAILY_SCRAMBLE_TURNS = 2;
export const DAILY_FLIPPED_PAIRS = 3;

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

/**
 * The cube a staging produces — turns then flips, matching the order
 * levelStaging.buildLevelStartState applies them in. Pricing anything else would
 * price a board the player never sees.
 */
function stageBoard(scramble, flips) {
  let state = makeCubies(DAILY_CUBE_SIZE);
  for (const { axis, sliceIndex, dir } of scramble) {
    state = rotateSliceCubies(state, DAILY_CUBE_SIZE, axis, sliceIndex, dir);
  }
  for (const { x, y, z, dirKey } of flips) {
    state = flipStickerPair(state, DAILY_CUBE_SIZE, x, y, z, dirKey, buildManifoldGridMap(state, DAILY_CUBE_SIZE));
  }
  return state;
}

/**
 * Which β-pairs open flipped. Real work, not decoration: a tile flipped in its
 * own cell shows the wrong colour and costs a move to put right — unless a turn
 * carries it somewhere its current colour is the one wanted, which is exactly
 * the trade the solver prices and the player can learn to see.
 *
 * Chosen from the pairs of a SOLVED cube, which is where levelStaging applies
 * them; the pairing then rides along with the stickers through every turn.
 */
function buildDailyFlips(dateKey, count = DAILY_FLIPPED_PAIRS) {
  const rng = makeRng(`daily-flips:${dateKey}`);
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
 * The plan for one day: its scramble, its flipped pairs, and its EXACT par.
 *
 * Par comes from the solver, so a staging whose par falls below the band is
 * redrawn rather than shipped — turns cancel sometimes, and a three-move daily
 * is thin. Redraws are seeded by attempt number, so the day is still identical
 * for every player.
 *
 * Deterministic in `dateKey` alone.
 */
export function dailyPlanFor(dateKey) {
  const cached = _planCache.get(dateKey);
  if (cached) return cached;

  const table = buildMoveTable(DAILY_CUBE_SIZE);
  const flips = buildDailyFlips(dateKey);
  let scramble = null;
  let par = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const candidate = buildDailyScramble(dateKey, DAILY_SCRAMBLE_TURNS, attempt);
    // Price the board the player will actually see: turns first, then flips,
    // the same order levelStaging applies them in.
    const board = stageBoard(candidate, flips);
    const found = solveCost(board, DAILY_CUBE_SIZE, { maxMoves: DAILY_PAR_MAX, table });
    if (found !== null && found >= DAILY_PAR_MIN) {
      scramble = candidate;
      par = found;
      break;
    }
  }
  if (scramble === null) {
    throw new RangeError(`Daily ${dateKey}: no staging landed a par in [${DAILY_PAR_MIN}, ${DAILY_PAR_MAX}] in 24 attempts`);
  }

  const plan = {
    dateKey,
    par,
    size: DAILY_CUBE_SIZE,
    scramble,
    flips,
    // How much cheaper the board is than the staging that made it. 0 means every
    // staged move has to be individually undone; more means the solver found a
    // shortcut — a cancellation, or a tile a turn left one flip from correct.
    slack: scramble.length + flips.length - par
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
 * The copy teaches the rule — what counts is the colour a tile SHOWS — and never
 * the day's answer. Worth stating plainly, because the whole point is that a
 * flipped tile displaying the right colour is finished, and a player who assumes
 * otherwise will spend moves undoing flips that were already correct.
 */
export function buildDailyLevel(dateKey) {
  const plan = dailyPlanFor(dateKey);

  const level = createLevel({
    id: DAILY_LEVEL_ID,
    name: `Daily Descent — ${dateKey}`,
    description: `${plan.scramble.length} turns and ${plan.flips.length} flipped pairs, solvable in ${plan.par} moves. Everyone playing today gets this exact cube.`,
    cubeSize: plan.size,
    scrambleSequence: plan.scramble,
    scrambleMoves: 0,
    flipSequence: plan.flips,
    par: plan.par,
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background: BACKGROUNDS.NASA,
    features: { rotations: true, tunnels: false, flips: true, chaos: false, explode: false, parity: true, net: false },
    tutorial: {
      title: 'Daily Descent',
      text:
        'Some tiles are out of place, some are just the wrong colour. Turning moves a tile; flipping recolours it to its ' +
        'opposite. Both cost one move, and only the colour SHOWING counts.',
      objective: `Par is ${plan.par} move${plan.par === 1 ? '' : 's'}. Match it for all three stars.`,
      tip:
        'A tile that landed on the opposite face is showing exactly the wrong colour — one flip fixes it where it stands, ' +
        'no turn needed. And a flipped tile already showing the right colour is done: leave it.'
    },
    // The ordinary win: every sticker shows the colour its face wants, however
    // it came to show it. See winDetection.checkRubiksSolved.
    winCondition: WIN_CONDITIONS.CLASSIC,
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
