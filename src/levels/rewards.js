// rewards.js — what the rest of the game pays into the Parity Point wallet.
//
// Parity Points used to be earned in exactly two places: Worm mode and Chaos
// betting. The three campaigns, Freeplay, Random, Teach and Holonomy paid
// nothing, which made the store — the game's only meta-progression — unreachable
// from most of the game. A player could finish all 28 authored levels, learn
// every algorithm and never afford a single skin.
//
// Two shapes of award, both one-time:
//
//   · LEVELS pay on first clear, plus a per-star bonus for stars never earned
//     before. Stars are stored as a running maximum, so the star half pays the
//     DELTA: a 1★ clear later improved to 3★ pays for the two new stars and
//     nothing more. Total per level is therefore bounded at first-clear + 3
//     stars however many times it is replayed.
//
//   · MILESTONES are single events with no natural counter — a first Freeplay
//     solve at a given cube size, an algorithm run to the end, a Möbius loop.
//     Each is claimed once against a persisted key (ProgressManager's milestone
//     ledger), so re-running them is free but pays nothing.
//
// Pure: no React, no storage, no store. Callers supply the ledger and the payer.

import {
  EARN_LEVEL_FIRST_CLEAR,
  EARN_LEVEL_STAR,
  EARN_FREEPLAY_FIRST_SOLVE,
  EARN_TEACH_ALGORITHM,
  EARN_HOLONOMY_LOOP,
  EARN_HOLONOMY_MOBIUS,
} from '../utils/economyConstants.js';

// ─── Levels ──────────────────────────────────────────────────────────────────

/**
 * Parity Points for finishing an authored level.
 *
 * @param {object} o
 * @param {boolean} o.isFirstCompletion
 * @param {number} o.previousStars  stars held BEFORE this run (0 if never cleared)
 * @param {number} o.newStars       stars held after (a running max)
 * @returns {number} points to pay — 0 for a replay that beat nothing
 */
export function levelPayout({ isFirstCompletion = false, previousStars = 0, newStars = 0 } = {}) {
  const first = isFirstCompletion ? EARN_LEVEL_FIRST_CLEAR : 0;
  // max(0, …) matters: completeLevel stores stars as a maximum, so a worse
  // replay leaves newStars below the run's own rating and must never pay
  // negative (which would silently claw points back out of the wallet).
  const stars = Math.max(0, (newStars || 0) - (previousStars || 0));
  return first + stars * EARN_LEVEL_STAR;
}

/** The most a single level can ever pay, across every replay. */
export const MAX_LEVEL_PAYOUT = EARN_LEVEL_FIRST_CLEAR + 3 * EARN_LEVEL_STAR;

// ─── Milestones ──────────────────────────────────────────────────────────────
// Keys are persisted, so they are part of the save format: renaming one lets a
// player claim it a second time. Add new keys rather than reshaping old ones.

/** First Freeplay/Random solve at a given cube size. */
export const freeplaySolveKey = (size) => `solve:${size}`;

/** First time an algorithm is executed to its last move. */
export const teachAlgorithmKey = (stageId, algoIndex) => `teach:${stageId}:${algoIndex}`;

/** First closed holonomy loop, and first orientation-reversing one. */
export const HOLONOMY_LOOP_KEY = 'holonomy:loop';
export const HOLONOMY_MOBIUS_KEY = 'holonomy:mobius';

/**
 * What a milestone key is worth. Unknown keys pay nothing rather than throwing —
 * a key from a newer build sitting in an older one's ledger is harmless.
 */
export function milestonePayout(key) {
  if (typeof key !== 'string') return 0;
  if (key.startsWith('solve:')) return EARN_FREEPLAY_FIRST_SOLVE;
  if (key.startsWith('teach:')) return EARN_TEACH_ALGORITHM;
  if (key === HOLONOMY_MOBIUS_KEY) return EARN_HOLONOMY_MOBIUS;
  if (key === HOLONOMY_LOOP_KEY) return EARN_HOLONOMY_LOOP;
  return 0;
}

/**
 * Claim a milestone and pay for it, once ever.
 *
 * @param {string} key
 * @param {object} o
 * @param {{ claimMilestone: (k:string)=>boolean }} o.progress
 * @param {(amount:number)=>void} [o.earn]
 * @param {boolean} [o.enabled]  false suppresses the award entirely — the demo
 *                               drives Teach and solves cubes on the player's
 *                               behalf, and a scripted tour must not pay out.
 * @returns {number} points actually paid (0 if already claimed or disabled)
 */
export function awardMilestone(key, { progress, earn = null, enabled = true } = {}) {
  if (!enabled || !progress) return 0;

  const amount = milestonePayout(key);
  if (amount <= 0) return 0;

  // Claim first: the ledger is the thing that makes this one-time, so a payer
  // that throws must not leave the key unclaimed and the award repeatable.
  if (!progress.claimMilestone(key)) return 0;

  earn?.(amount);
  return amount;
}
