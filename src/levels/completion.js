// completion.js — what it means to finish a level, in one place.
//
// This decision used to live inline in App's victory handlers, where it was
// both untestable and easy to bypass: one of the four ways out of the victory
// screen (Main Menu) skipped the handlers entirely and silently discarded the
// solve. Pulling it out gives the rule a single home and a unit test.
//
// The rule has two branches:
//
//   · A campaign chapter goes through progressManager.completeLevel, which owns
//     stars, unlocks and the flat completed-levels array. It also pays Parity
//     Points now — first clear plus any star it has never earned before — so the
//     three campaigns stop being a dead end for the game's only meta-progression
//     (see levels/rewards.js for why that cannot be farmed).
//
//   · The Daily Descent does NOT. It reuses one level id for a different puzzle
//     every day, so a flat "completed" flag and best-moves stats keyed on that
//     id would be meaningless — yesterday's 6 moves are not comparable to
//     today's par-9 draw. It keeps its own dated record instead.

import { progressManager as defaultProgress } from './ProgressManager.js';
import { DAILY_LEVEL_ID, dailyKeyFor } from './dailyChallenge.js';
import { levelPayout, awardMilestone, freeplaySolveKey } from './rewards.js';

/**
 * Record a finished level.
 *
 * @param {object} args
 * @param {number|null} args.levelId
 * @param {object|null} args.levelData   the live level (carries `dailyKey`/`par`)
 * @param {{ moves?: number, time?: number }} args.stats
 * @param {object} [args.progress]       ProgressManager instance (injectable for tests)
 * @param {(amount:number)=>void} [args.earn]  pays the daily purse
 * @param {number} [args.dailyReward]
 * @returns {{ kind: 'none'|'daily'|'level', ... }} what was recorded
 */
export function recordLevelCompletion({
  levelId,
  levelData = null,
  stats = {},
  progress = defaultProgress,
  earn = null,
  dailyReward = 0,
  enabled = true,
}) {
  if (!levelId) return { kind: 'none' };

  if (levelId === DAILY_LEVEL_ID) {
    // The key the level was BUILT with, never a fresh clock read. A player who
    // opens the daily at 23:58 and solves it at 00:03 has solved YESTERDAY's
    // puzzle; banking it under the new date would reset or wrongly extend the
    // streak, pay the new day's purse, and mark a puzzle complete before it has
    // been played. The fallback only covers a level object predating the field.
    const dateKey = levelData?.dailyKey ?? dailyKeyFor();
    const firstToday = !progress.isDailyComplete(dateKey);

    const result = progress.completeDailyChallenge(dateKey, {
      par: levelData?.par ?? null,
      moves: stats.moves,
      time: stats.time,
    });

    // Paid once a day, not once per replay.
    const paid = enabled && firstToday && dailyReward > 0 ? dailyReward : 0;
    if (paid > 0) earn?.(paid);

    return { kind: 'daily', dateKey, firstToday, paid, ...result };
  }

  // Stars are stored as a running maximum, so the payout needs the value from
  // BEFORE this run — read it first or the delta is always zero.
  const previousStars = progress.getLevelStats?.(levelId)?.stars ?? 0;
  const result = progress.completeLevel(levelId, stats);
  const newStars = result?.stats?.stars ?? previousStars;

  const payout = enabled
    ? levelPayout({ isFirstCompletion: result?.isFirstCompletion, previousStars, newStars })
    : 0;
  if (payout > 0) earn?.(payout);

  return { kind: 'level', result, previousStars, newStars, paid: payout };
}

/**
 * Record a Freeplay / Random solve — a win with no level behind it.
 *
 * Paid once per cube size rather than per solve: a 3×3 solve is an achievement
 * the first time and a warm-up the twentieth, and paying every time would make
 * the store farmable by shuffling and undoing.
 *
 * @param {object} o
 * @param {number} o.size
 * @param {object} [o.progress]
 * @param {(amount:number)=>void} [o.earn]
 * @param {boolean} [o.enabled]  false during the demo, which solves for the player
 * @returns {{ kind: 'freeplay', size: number, paid: number }}
 */
export function recordFreeplaySolve({ size, progress = defaultProgress, earn = null, enabled = true }) {
  const paid = Number.isFinite(size)
    ? awardMilestone(freeplaySolveKey(size), { progress, earn, enabled })
    : 0;
  return { kind: 'freeplay', size, paid };
}
