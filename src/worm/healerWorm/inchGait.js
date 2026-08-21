// src/worm/healerWorm/inchGait.js
//
// The Inch Worm's gait, as pure math so it can be reasoned about and tested away
// from the renderer.
//
// ── What it used to do, and why it broke ─────────────────────────────────────
// The old gait was ONE global pulse for the whole worm:
//
//     arch  = sin(PI * i / (count - 1))       // one half-sine over the body
//     dist  = i * SPACING * (1 - pulse * 0.28)
//
// Both terms scale with body length, which is fine at four segments and falls
// apart at four hundred:
//
//   * One hump. The arch is a single half-sine spanning the whole worm, so a long
//     body does not inch — it inflates, lifting everything between head and tail
//     as one balloon whose peak sits hundreds of segments back.
//   * The distance term multiplies the WHOLE arc, so the compression a segment
//     sees grows with its index. At 400 segments the tail's rest arc is ~38 world
//     units and 28% of that is ~10 units — the tail whips ten tiles back and
//     forth every couple of tiles crawled. That is the "glitching out": not a
//     rendering fault, just an amplitude that scales without bound.
//
// ── What it does now ────────────────────────────────────────────────────────
// A travelling longitudinal wave of FIXED wavelength along the body. Every term
// is local, so nothing scales with length:
//
//   * Humps appear one per wavelength, so a four-segment worm makes a single
//     hump and a long one ripples with many — more humps the longer it grows,
//     which is the point.
//   * Longitudinal displacement is capped at INCH_SQUISH × wavelength (a fraction
//     of one segment spacing) no matter how long the body is.
//   * The phase advances with crawl distance at exactly the rate the head moves,
//     so a crest stays PUT in world space while the body flows through it — feet
//     planted, waves running up the body, the way a caterpillar actually crawls.
//
// The wave is also strictly monotonic in arc, which the renderer depends on: the
// body's curve-walk marches forward through the path buffer and can never step
// back, so a segment may never be asked for a smaller distance than the one
// before it. See the guard on INCH_SQUISH below.

const TWO_PI = Math.PI * 2;

/** World-space gap between two Inch Worm body balls at rest. */
export const INCH_BALL_SPACING = 0.095;

/**
 * World-space length of one accordion wave — i.e. one hump.
 *
 * 0.76 is eight segments at INCH_BALL_SPACING, chosen so a fresh worm
 * (BASE_TAIL_LENGTH = 4 balls) spans half a wave and reads as exactly one hump,
 * and every eight segments it grows adds another.
 */
export const INCH_WAVELENGTH = 0.76;

/**
 * Longitudinal squish, as a fraction of the wavelength.
 *
 * Local spacing scales by 1 + 2π·INCH_SQUISH·cos(θ), so this must stay below
 * 1/2π ≈ 0.159 or the wave folds back on itself: segments would swap order, the
 * renderer's forward-only curve walk would lose its bracket, and the body would
 * tangle. At 0.095 the tightest spacing is ~40% of rest and the loosest ~160%,
 * which is a strong accordion with a comfortable margin.
 */
export const INCH_SQUISH = 0.095;

/**
 * Segments over which the arch fades in at the head and out at the tail, so both
 * ends stay planted on the surface and the worm pushes off something.
 */
export const INCH_ANCHOR_SEGMENTS = 1.2;

/**
 * Gait for one body segment, written into `out` (`{ dist, arch }`).
 *
 * Called once per segment per frame, so it takes a scratch object rather than
 * allocating — a long worm would otherwise churn 1200 objects a frame.
 *
 * @param {{dist:number, arch:number}} out  scratch target, returned
 * @param {number} i      segment index (0 = head)
 * @param {number} count  visible segment count
 * @param {number} phase  crawl distance accumulated this run, in world units
 * @param {number} move   0..1 eased "is moving" factor; 0 lays the body out flat
 * @returns {{dist:number, arch:number}} `dist` = arc behind the head to place this
 *          segment at; `arch` = 0..1 how much this segment rides up off the surface
 */
export function inchGaitInto(out, i, count, phase, move) {
  const arc = i * INCH_BALL_SPACING;

  if (!(move > 0) || count < 2) {
    // At rest the worm lies out at full spread — no wave, no lift.
    out.dist = arc;
    out.arch = 0;
    return out;
  }

  // Adding `phase` to the arc (rather than subtracting) walks each crest toward
  // the head as the worm advances, which is what keeps the crest stationary in
  // world space: the head gains `phase`, the crest's arc behind it loses it.
  const theta = TWO_PI * ((arc + phase) / INCH_WAVELENGTH);

  out.dist = arc + INCH_WAVELENGTH * INCH_SQUISH * move * Math.sin(theta);

  // The body bunches where the wave compresses it (cos < 0), and that is exactly
  // where an inchworm's back rides up, so one term drives both. Smoothstepped:
  // the raw clamp meets the ground with a non-zero slope, which creases visibly
  // where each hump takes off.
  const raw = Math.max(0, -Math.cos(theta));
  const bunch = raw * raw * (3 - 2 * raw);
  const headEnd = Math.min(1, i / INCH_ANCHOR_SEGMENTS);
  const tailEnd = Math.min(1, (count - 1 - i) / INCH_ANCHOR_SEGMENTS);
  out.arch = bunch * headEnd * tailEnd * move;

  return out;
}

/**
 * How many humps a body of `count` segments carries. Reporting only — the wave
 * itself never needs this — but it is the property the gait is tuned around, so
 * it is worth being able to state and test.
 */
export function inchHumpCount(count) {
  if (count < 2) return 0;
  return Math.max(1, Math.round(((count - 1) * INCH_BALL_SPACING) / INCH_WAVELENGTH));
}
