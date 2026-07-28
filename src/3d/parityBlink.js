// src/3d/parityBlink.js
// Cadence math for the parity blink — the eyelid animation a tile plays when a
// flip lands it in parity (odd flip count). Pure functions, no Three.js state, so
// the "how many blinks / how far out" rules are testable on their own.
//
// A tile blinks once per flip it is carrying: a fresh crossing blinks once, a
// tile on its fifth crossing blinks five times. Only the first blink runs at the
// full flip length — the rest are quick after-blinks, so a heavily damaged tile
// stutters instead of stalling the board. Every blink also shoves the tile out of
// the cube along its own outward normal on the same sine bell the cubie pop uses,
// reaching a little further for each flip the tile carries.

export const BLINK_MAX = 5;
export const BLINK_BASE_DUR = 0.5;   // seconds — first blink, matches the normal flip
export const BLINK_EXTRA_DUR = 0.26; // seconds — each additional blink
export const BLINK_BOUNCE_PER_FLIP = 0.05;
export const BLINK_BOUNCE_MAX = 0.26;

/**
 * How many eyelid blinks a flip plays. Non-parity flips (the tile returning to
 * its home color) keep the single beat they always had.
 *
 * @param {number} flips - flip count AFTER this flip landed
 * @param {boolean} isParityFlip - true when the flip leaves the tile displaced
 */
export function blinkCountForFlips(flips, isParityFlip) {
  if (!isParityFlip) return 1;
  return Math.max(1, Math.min(BLINK_MAX, Math.floor(flips) || 1));
}

/** Flip-timer speed (progress per second) that fits `blinks` blinks in one flip. */
export function blinkFlipRate(blinks) {
  return 1 / (BLINK_BASE_DUR + (Math.max(1, blinks) - 1) * BLINK_EXTRA_DUR);
}

/**
 * Split whole-flip progress into the blink playing right now.
 *
 * @param {number} rawP - 0→1 across the entire flip
 * @param {number} blinks - blink count from blinkCountForFlips
 * @returns {{ blinkIdx: number, p: number }} zero-based blink, and 0→1 within it
 */
export function blinkPhase(rawP, blinks) {
  const n = Math.max(1, blinks);
  const cyc = rawP * n;
  const blinkIdx = Math.min(n - 1, Math.floor(cyc));
  return { blinkIdx, p: cyc - blinkIdx };
}

/**
 * How far out of the cube the tile sits at this instant, along its own outward
 * normal. Peaks with the lids shut (p = 0.5) and settles to 0 as they open;
 * later blinks in a burst push a little less than the first.
 *
 * @param {number} p - progress within the current blink (0→1)
 * @param {number} flips - flip count the tile is carrying
 * @param {number} blinkIdx - zero-based index of the blink playing
 */
export function blinkBounce(p, flips, blinkIdx = 0) {
  const reach = Math.min(BLINK_BOUNCE_MAX, Math.max(1, flips) * BLINK_BOUNCE_PER_FLIP);
  const decay = Math.max(0.45, 1 - blinkIdx * 0.15);
  return Math.sin(p * Math.PI) * reach * decay;
}
