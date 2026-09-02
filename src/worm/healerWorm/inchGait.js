// src/worm/healerWorm/inchGait.js
//
// The Inch Worm's gait, as pure math so it can be reasoned about and tested away
// from the renderer.
//
// ── The move ────────────────────────────────────────────────────────────────
// A real inchworm does not ripple. It plants its front, hauls its back end up into
// a tall Ω loop, rears, and then pours itself forward through it. The loop stays
// WHERE IT IS on the ground while the animal flows through — the same trick the
// jump already uses in this codebase, where each step-history entry stores the lift
// that was active at that spatial position and beads climb through it one by one
// (see the chain-fountain note in wormSim.js).
//
// So the module answers one question per body segment: given that this segment is
// `arc` of BODY LENGTH behind the head, how far behind the head does it sit on the
// GROUND, and how high does it ride? Those two are not independent — that was the
// central bug — and the rest of this file is the bookkeeping that keeps them
// consistent.
//
// ── Pinning a crest to the ground ───────────────────────────────────────────
// Loops live on a lattice in ground distance behind the head:
//
//     v = (ground arc behind the head − distance crawled) / pitch
//
// with a crest at every whole v. The MINUS is the whole trick, and it is worth
// deriving rather than trusting. Let H be the distance the head has crawled and W
// a fixed spot on the trail, so a segment sitting `s` behind the head is at
// W = H − s. Substituting s = H − W:
//
//     v = (H − W − H) / pitch = −W / pitch
//
// — no H left, so a crest is a fixed spot on the cube and the worm crawls through
// it. With a PLUS the same substitution gives (2H − W)/pitch: the crest sprints
// along the ground at twice the worm's own speed while racing head-ward down the
// body. That was the visible "spazzing", and it was the previous version's
// arithmetic.
//
// ── Ground distance is not body arc ─────────────────────────────────────────
// Body standing up in a loop is body that is not lying flat, so the ground
// distance to a segment is SHORTER than its arc along the body by exactly the arc
// the loops in between have taken up:
//
//     arc(s) = s + ∫₀ˢ (√(1 + y′²) − 1) dσ
//
// and the gait needs the inverse of that. Getting it right is what makes 3D bead
// spacing come out at exactly INCH_BALL_SPACING everywhere — flat body, flank, and
// crest alike — so the body neither piles up nor gaps as it climbs.
//
// `arc(s)` is one strictly increasing function per loop pitch, repeating, so the
// inverse is a single 128-entry table built with the shape and read twice per
// segment. Inverting a monotone map also hands the renderer its hard requirement
// for free: `dist` strictly increases with segment index, because the renderer
// walks the path buffer forward and can never step back. That now holds by
// construction, for every shape and every phase, rather than by a tuning margin.
//
// Two earlier versions prescribed the lift and a separate hand-tuned "gather"
// independently. The two disagreed: beads piled up to ~37% of their rest spacing
// at each crest and stretched apart on the flanks.
//
// ── Sizing the loop from the body, not from a world constant ────────────────
// The loop used to be sized from a world-space height cap (three quarters of the
// jump apex, 1.125 units) with its width derived from that height. Every worm the
// game actually produces — it starts at 4 balls and grows 3 per orb — was then
// SHORTER than one loop was wide, and the loop pitch (3.2–6.2 units, against a
// 1-unit tile) was longer than the whole animal. The result was not inching: the
// worm lay dead flat for a few tiles, heaved its entire body a full tile into the
// air as the one crest swept over it, and flopped down again.
//
// So width comes first now, from the body's own length, and height follows it at a
// fixed aspect. A short worm gets one small loop scaled to itself; once the body
// outgrows INCH_MAX_PITCH it carries a train of identical loops.

/** World-space gap between two Inch Worm body balls at rest. */
export const INCH_BALL_SPACING = 0.095;

/**
 * Loop half-width : loop height. Roughly 1.6:1 keeps the arch fuller than a
 * semicircle without pinching into a spike.
 */
export const INCH_ARCH_ASPECT = 1.6;

/**
 * Fraction of a loop's pitch that the arch itself occupies; the rest is flat body.
 *
 * This is what makes a loop legible — an arch only reads as an arch against
 * straight worm on either side of it — and it is also the pacing.
 */
export const INCH_ARCH_DUTY = 0.45;

/**
 * Longest loop-to-loop distance, in world units (a cube tile is 1).
 *
 * Below this the worm carries exactly one loop, sized to itself, which is what a
 * real inchworm does. Past it the pitch stops growing and a long body carries a
 * train of identical loops rather than one enormous one.
 */
export const INCH_MAX_PITCH = 2.0;

/**
 * Floor under the half-width, so a fresh 4-ball worm still visibly humps instead
 * of scaling its loop down to nothing.
 */
export const INCH_MIN_HALF_WIDTH = 0.12;

/**
 * Fore/aft skew of the arch, 0..1. Body flows through a planted loop from its
 * trailing (tail-ward) side to its leading (head-ward) side, so a longer trailing
 * face and a steeper leading one mean a bead takes its time rearing up and then
 * tips over and is thrown forward — the push, rather than a symmetric bob. The two
 * faces still add up to 2 × halfWidth.
 */
export const INCH_SKEW = 0.3;

/**
 * Head taper, as a fraction of the body.
 *
 * The head is placed by the simulation, flat on its tile, so a loop that reached
 * it would snap the neck: head on the ground, the bead 0.095 behind it a third of
 * a tile in the air. The first `anchor` of body eases into the gait instead.
 *
 * The TAIL is deliberately not tapered. Tapering scales a bead's rise and its
 * share of the ground contraction together, which only holds bead spacing to first
 * order, so every tapered bead is one whose spacing is slightly off. One end has
 * to be tapered; the other does not, and a rear that lifts with the loop is what
 * an inchworm does anyway.
 */
export const INCH_ANCHOR_FRACTION = 0.25;

// ── Arch profile ────────────────────────────────────────────────────────────
// Written against `xs`, the arch coordinate running −1 (the leading, head-ward
// edge) → 0 (crest) → +1 (the trailing, tail-ward edge). The skew is a different
// scale on each side so the profile reaches exactly zero at both edges. The
// previous version culled at |x| ≥ 1 while its skewed cosine was still at 11% of
// full height on the trailing side, so every bead leaving a loop popped.

const LEAD = 1 - INCH_SKEW;  // head-ward face: the short, steep one
const TRAIL = 1 + INCH_SKEW; // tail-ward face: longer and gentler

/** Arch height, 0..1, at arch coordinate `xs`. */
function archProfile(xs) {
  return xs <= -1 || xs >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * xs));
}

/**
 * Arch coordinate for a point `g` of GROUND distance behind a crest (negative =
 * ahead of it, toward the head).
 */
function archCoord(g, halfWidth) {
  return g < 0 ? g / (halfWidth * LEAD) : g / (halfWidth * TRAIL);
}

/** dy/dg — how steeply the arch climbs, per unit of ground. */
function archSlope(g, halfWidth) {
  const xs = archCoord(g, halfWidth);
  if (xs <= -1 || xs >= 1) return 0;
  // height = halfWidth / ASPECT, so the halfWidth cancels: the arch has the same
  // slope profile at every scale, which is why one table serves every shape whose
  // duty cycle matches.
  return (-0.5 * Math.PI * Math.sin(Math.PI * xs)) / (INCH_ARCH_ASPECT * (g < 0 ? LEAD : TRAIL));
}

/** Samples across one loop pitch, for the ground↔arc map and its inverse. */
const MAP_SAMPLES = 128;

// Shapes are rebuilt only when the worm grows, but `inchLoopShape` is called every
// frame, and building one allocates two typed arrays. One slot of memo is all the
// renderer needs — there is a single Inch Worm on screen.
let memoCount = -1;
let memoShape = null;

/**
 * Loop geometry for a body of `count` balls: how wide each loop is, how tall it
 * rears, how far apart consecutive loops sit, and the ground↔arc map that lets a
 * segment's body arc be turned into a place on the ground.
 */
export function inchLoopShape(count) {
  if (count === memoCount) return memoShape;

  const bodyArc = Math.max(0, count - 1) * INCH_BALL_SPACING;
  // One loop until the body outgrows INCH_MAX_PITCH, then a train of them.
  const pitch = Math.min(bodyArc, INCH_MAX_PITCH);
  const halfWidth = Math.max(INCH_MIN_HALF_WIDTH, 0.5 * INCH_ARCH_DUTY * pitch);
  // The trailing face reaches TRAIL × halfWidth past its crest, so keep the pitch
  // wide enough that no segment is ever inside two loops at once.
  const spacing = Math.max(pitch, 2 * TRAIL * halfWidth);

  // arcAt[j] = body arc from the start of a loop period (half a pitch ahead of the
  // crest) to the ground position j/MAP_SAMPLES of the way through it.
  const arcAt = new Float64Array(MAP_SAMPLES + 1);
  const dg = spacing / MAP_SAMPLES;
  let excess = 0;
  for (let j = 1; j <= MAP_SAMPLES; j++) {
    const g = ((j - 0.5) / MAP_SAMPLES - 0.5) * spacing; // midpoint of this slice
    const s = archSlope(g, halfWidth);
    excess += (Math.sqrt(1 + s * s) - 1) * dg;
    arcAt[j] = j * dg + excess;
  }
  const arcPitch = spacing + excess; // body arc spent crossing one whole loop

  // ...and its inverse, sampled evenly in arc: groundAt[k] = the ground offset
  // (in pitches, from the crest) at body arc k/MAP_SAMPLES of the way through.
  const groundAt = new Float64Array(MAP_SAMPLES + 1);
  for (let k = 0, j = 0; k <= MAP_SAMPLES; k++) {
    const target = (k / MAP_SAMPLES) * arcPitch;
    while (j < MAP_SAMPLES - 1 && arcAt[j + 1] < target) j++;
    const a0 = arcAt[j];
    const a1 = arcAt[j + 1];
    groundAt[k] = -0.5 + (j + (a1 > a0 ? (target - a0) / (a1 - a0) : 0)) / MAP_SAMPLES;
  }

  memoCount = count;
  memoShape = { bodyArc, height: halfWidth / INCH_ARCH_ASPECT, halfWidth, spacing, arcPitch, arcAt, groundAt };
  return memoShape;
}

/** Body arc from the loop lattice's origin to lattice position `v`. */
function arcAtLattice(v, shape) {
  const n = Math.floor(v + 0.5);
  const t = (v - n + 0.5) * MAP_SAMPLES;
  const j = Math.min(MAP_SAMPLES - 1, Math.max(0, Math.floor(t)));
  const arcAt = shape.arcAt;
  return n * shape.arcPitch + arcAt[j] + (arcAt[j + 1] - arcAt[j]) * (t - j);
}

/** The inverse: lattice position `v` at body arc `a` from the lattice's origin. */
function latticeAtArc(a, shape) {
  const n = Math.floor(a / shape.arcPitch);
  const t = ((a - n * shape.arcPitch) / shape.arcPitch) * MAP_SAMPLES;
  const k = Math.min(MAP_SAMPLES - 1, Math.max(0, Math.floor(t)));
  const groundAt = shape.groundAt;
  return n + groundAt[k] + (groundAt[k + 1] - groundAt[k]) * (t - k);
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
 * @returns {{dist:number, arch:number}} `dist` = ground arc behind the head to
 *          place this segment at; `arch` = 0..1, multiplied by `shape.height` to
 *          lift it
 */
export function inchGaitInto(out, i, count, phase, move, shape) {
  const arc = i * INCH_BALL_SPACING;
  out.dist = arc;
  out.arch = 0;
  if (!(move > 0) || count < 2) return out; // at rest the worm lies out flat

  const { halfWidth, spacing, bodyArc } = shape;
  const m = move > 1 ? 1 : move;

  // The head sits at ground 0, which is somewhere inside some loop; every other
  // segment is measured in body arc from there.
  const vHead = -phase / spacing;
  const v = latticeAtArc(arcAtLattice(vHead, shape) + arc, shape);
  const ground = phase + v * spacing;

  // Ease the first stretch of body into the gait so a loop cannot pop the bead
  // right behind the planted head off the ground. Scaling the rise and the ground
  // contraction by the same factor keeps the two consistent through the taper.
  const anchor = Math.min(halfWidth, bodyArc * INCH_ANCHOR_FRACTION) || 1e-6;
  const ease = arc < anchor ? arc / anchor : 1;
  const w = m * ease;

  // Blending toward the flat layout by `w` keeps `dist` increasing: both `arc` and
  // `ground` increase with the segment index, and so does anything between them.
  out.dist = arc + w * (ground - arc);
  out.arch = archProfile(archCoord((v - Math.floor(v + 0.5)) * spacing, halfWidth)) * w;
  return out;
}

/**
 * How many loops a body of `count` balls carries at once. Reporting only — the
 * gait never needs it — but it is the property the shape is tuned around, so it is
 * worth being able to state and test.
 *
 * Divided by the ARC a loop costs, not by its ground pitch: a loop standing up
 * takes more body than the ground it covers, which is the whole point of the
 * accordion, and a long worm carries about 10% fewer loops than its ground pitch
 * alone would suggest.
 */
export function inchHumpCount(count) {
  const shape = inchLoopShape(count);
  if (count < 2 || shape.arcPitch <= 0) return 0;
  return Math.max(1, Math.round(shape.bodyArc / shape.arcPitch));
}
