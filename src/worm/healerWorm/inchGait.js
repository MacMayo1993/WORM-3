// src/worm/healerWorm/inchGait.js
//
// The Inch Worm's gait, as pure math so it can be reasoned about and tested away
// from the renderer.
//
// ── The move ────────────────────────────────────────────────────────────────
// A real inchworm does not ripple. It plants its front, hauls its back end up
// into a tall Ω loop, rears, and then throws that stored body forward. The loop
// itself stays WHERE IT IS on the ground while the animal pours through it —
// the same trick the jump already uses in this codebase, where each step-history
// entry stores the lift that was active at that spatial position and beads climb
// through it one by one (see the chain-fountain note in wormSim.js). This module
// does the same thing for the crawl: loop crests sit at fixed world positions,
// and the body flows head-ward through them.
//
// So the wave is written in WORLD arc, not in segment index:
//
//     u = (arc behind the head + distance crawled) / loop spacing
//
// Hold `u` at a whole number and you have a crest: as the head advances by δ the
// crest's arc-behind-the-head drops by δ, which is exactly the amount the head
// moved. The crest does not budge. Beads gather into it, rear over it, and are
// paid out in front.
//
// ── Two earlier versions and why they failed ────────────────────────────────
// 1. One global pulse: arch = sin(PI·i/(count-1)), dist = i·SPACING·(1-pulse·0.28).
//    Both terms scale with body length. A long worm did not inch, it inflated —
//    one balloon peaking hundreds of segments back — and the distance term gave
//    the tail of a 400-segment worm ~10 world units of travel per cycle, which is
//    the whipping that read as the animation glitching out.
// 2. A continuous sinusoid along the body. Nothing whipped and the humps scaled
//    with length, but a sine has no flat: EVERY segment was mid-hump at all
//    times, so the body shimmered evenly instead of inching. There was no loop to
//    see, because a loop is only legible against straight body on either side.
//
// This version keeps the loops LOCALIZED: each one occupies ±halfWidth of body
// arc and the body between loops lies flat on the surface.
//
// ── The monotonic constraint ────────────────────────────────────────────────
// `dist` must strictly increase with the segment index. The renderer walks the
// path buffer forward and can never step back, so a segment may not be asked for
// a smaller distance than the one before it. That caps the gather — see
// INCH_GATHER.

import { SURFACE_JUMP_HEIGHT } from './constants.js';

/** World-space gap between two Inch Worm body balls at rest. */
export const INCH_BALL_SPACING = 0.095;

/**
 * The rear-up, as a fraction of the jump's own apex.
 *
 * The worm's jump arc is the tallest thing it does, so it is the natural yardstick
 * for the second tallest.
 */
export const INCH_JUMP_FRACTION = 0.75;

/** Tallest a loop ever rears, for a worm with the body to support it. */
export const INCH_MAX_HUMP = SURFACE_JUMP_HEIGHT * INCH_JUMP_FRACTION;

/**
 * Height a loop may rear, as a fraction of the whole body's arc length.
 *
 * A loop cannot rear higher than the body it is made of: lifting a bead 1.1 world
 * units when there is only a third of a unit of worm to either side of it does not
 * make an arch, it makes a spike with two beads stranded on the ground. So a short
 * worm rears proportionally — a fresh 4-ball worm humps about a ball-height — and
 * the rear-up grows with the animal until it reaches INCH_MAX_HUMP.
 */
export const INCH_BODY_HEIGHT_RATIO = 0.4;

/**
 * Half-width of a loop (in body arc) per unit of its height, and the floor under
 * it. Roughly 1:1 keeps the arch fuller than a semicircle without pinching into a
 * spike; the floor stops a tiny worm's loop from collapsing to nothing.
 */
export const INCH_ARCH_ASPECT = 1.6;
export const INCH_MIN_HALF_WIDTH = 0.3;

/**
 * Flat body left between consecutive loops.
 *
 * This is what makes a loop legible, and it is also the pacing: loops are pinned
 * to the ground, so the worm meets one every (2·halfWidth + gap) of crawl. Packed
 * close, a long worm carries a dozen loops all rising and falling at once, which
 * reads as the whole animal bobbing rather than as inching. Wide apart, most of
 * the body lies still and each loop is an event.
 */
export const INCH_LOOP_GAP = 2.6;

/**
 * Accordion gather, as a fraction of a loop's half-width: how far body inside the
 * loop is drawn toward its crest.
 *
 * Confined to the loop. An earlier version let the gather reach all the way to the
 * neighbouring loops so a tall arch could haul in the extra body it needs — but
 * that puts every bead in motion, including the tail, which slid forward and back
 * for the whole run. Body outside a loop now holds perfectly still; the arch is
 * wide enough (INCH_ARCH_ASPECT) not to need the extra.
 *
 * The term is A·sin(πx)·bump(x) with A = INCH_GATHER × halfWidth, so its steepest
 * slope is π·INCH_GATHER regardless of scale. It must stay below 1/π ≈ 0.318 or
 * `dist` stops increasing, the renderer's forward-only curve walk loses its
 * bracket, and the body tangles. At 0.20 the tightest bead spacing at a crest is
 * ~37% of rest — a hard scrunch with room to spare.
 */
export const INCH_GATHER = 0.2;

/**
 * Fore/aft skew of the arch, 0..1. The loop's leading face (toward the head) is
 * steeper than its trailing face, so a bead climbing into the loop takes its time
 * rearing up and then tips over and is thrown forward — the push, rather than a
 * symmetric bob.
 */
export const INCH_SKEW = 0.3;

/**
 * Loop geometry for a body of `count` balls: how tall each loop rears, how much
 * body arc it occupies, and how far apart consecutive loops sit.
 *
 * Cheap, but it only changes when the worm grows, so the renderer computes it
 * once per frame rather than once per segment.
 */
export function inchLoopShape(count) {
  const bodyArc = Math.max(0, count - 1) * INCH_BALL_SPACING;
  const height = Math.min(INCH_MAX_HUMP, bodyArc * INCH_BODY_HEIGHT_RATIO);
  const halfWidth = Math.max(INCH_MIN_HALF_WIDTH, height * INCH_ARCH_ASPECT);
  return { bodyArc, height, halfWidth, spacing: 2 * halfWidth + INCH_LOOP_GAP };
}

/**
 * Gait for one body segment, written into `out` (`{ dist, arch }`).
 *
 * Called once per segment per frame, so it takes a scratch object rather than
 * allocating — a long worm would otherwise churn 1200 objects a frame.
 *
 * @param {{dist:number, arch:number}} out  scratch target, returned
 * @param {number} i      segment index (0 = head)
 * @param {number} count  visible segment count
 * @param {number} phase  distance crawled this run, in world units
 * @param {number} move   0..1 eased "is moving" factor; 0 lays the body out flat
 * @param {object} shape  from inchLoopShape(count)
 * @returns {{dist:number, arch:number}} `dist` = arc behind the head to place this
 *          segment at; `arch` = 0..1, multiplied by `shape.height` to lift it
 */
export function inchGaitInto(out, i, count, phase, move, shape) {
  const arc = i * INCH_BALL_SPACING;
  out.dist = arc;
  out.arch = 0;
  if (!(move > 0) || count < 2) return out; // at rest the worm lies out flat

  const { halfWidth, spacing, bodyArc } = shape;

  // Distance from this segment to the nearest loop crest. Crests are pinned to
  // world positions, so adding the crawled distance to the arc is what makes them
  // stay put while the body flows through.
  const u = (arc + phase) / spacing;
  const d = (u - Math.floor(u + 0.5)) * spacing;

  const x = d / halfWidth; // ±1 at the loop's edge
  if (x <= -1 || x >= 1) return out; // flat body between loops: still, and lying down

  // Both ends stay planted — a loop needs something to push off, and the tail is
  // the anchor the worm inches away from, so it neither lifts nor slides. The
  // taper runs over the loop's own half-width rather than a fixed segment count
  // (a tall rear-up would otherwise leave the last bead hanging in the air), but
  // never over more than a quarter of the body, or a short worm could never lift.
  const anchor = Math.min(halfWidth, bodyArc * 0.25) || 1e-6;
  const ends = Math.min(1, arc / anchor) * Math.min(1, (bodyArc - arc) / anchor);
  if (ends <= 0) return out;

  // Gather: body inside the loop is drawn toward its crest — the beads behind it
  // pulled forward, the ones in front held back. That is the accordion. Symmetric
  // on purpose; skewing this too would put a kink in the bead spacing right at the
  // apex, where it is most visible.
  const bump = 0.5 * (1 + Math.cos(Math.PI * x));
  out.dist = arc - INCH_GATHER * halfWidth * move * ends * Math.sin(Math.PI * x) * bump;

  // Arch, skewed: gentler up the trailing face, steeper down the leading one.
  const xs = x < 0 ? x / (1 - INCH_SKEW) : x / (1 + INCH_SKEW);
  const rear = xs <= -1 || xs >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * xs));
  out.arch = rear * ends * move;

  return out;
}

/**
 * How many loops a body of `count` balls carries at once. Reporting only — the
 * gait never needs it — but it is the property the shape is tuned around, so it
 * is worth being able to state and test.
 */
export function inchHumpCount(count) {
  const shape = inchLoopShape(count);
  if (count < 2 || shape.spacing <= 0) return 0;
  return Math.max(1, Math.round(shape.bodyArc / shape.spacing));
}
