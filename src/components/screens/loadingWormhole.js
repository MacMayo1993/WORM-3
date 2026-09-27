// Pure, absolute-time geometry for the loading screen's wormhole. Like the
// opening's motion (introMotion.js), every value is a function of the clock, so a
// dropped frame or a main thread stalled by a parsing chunk lands on the right
// pose instead of accumulating drift.
//
// The mouth is an ellipse on the paper (`well`: centre cx, cy and half-axes a, b
// in CSS pixels, b < a because the paper is seen at an angle). Inside it a funnel
// sinks to a throat: s = 0 at the rim, 1 at the throat.

/**
 * The cube's endless fall between the two portals: out of the one above, into
 * the one on the paper, and out of the one above again. Must match
 * LoadingScene.css: `--wl-beat` is the period, `--wl-drop` the drop between the
 * portals (in cubes), and the `wl-fall` keyframes start the cube `lead` cubes
 * above the top portal, still inside it. Time 0 is that start, as the screen
 * mounts. The cube passes through both portals at once — its centre sinks
 * through the bottom mouth as its twin's comes out of the top one — `lead`
 * cubes into each fall.
 */
export const FALL = { period: 1.5, drop: 2.8, lead: 1.4 };
/** Seconds into each fall at which the cube passes through the portals. */
export const PASS_AT = (FALL.period * FALL.lead) / FALL.drop;

const fmt = (v) => +v.toFixed(4);

/**
 * The CSS clip-path for the shaft the cube falls down, which is exactly as wide
 * as the portals and runs from the top of the one above to the bottom of the one
 * on the paper. The upper portal faces down: the cube emerges across its mouth
 * from the far (upper) arc, then passes IN FRONT of its lower rim. The floor
 * portal faces up: the cube sinks behind its near (lower) arc. Clipping both
 * at their near arcs makes the upper portal look like an opaque lid.
 * `rim` is the CSS length of a portal's half-height.
 */
export function shaftClipPath(rim = 'var(--wl-wb)', steps = 12) {
  const arc = (centre, from, to) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const angle = from + ((to - from) * i) / steps;
      return `${fmt(50 + 50 * Math.cos(angle))}% calc(${centre} + ${rim} * ${fmt(Math.sin(angle))})`;
    });
  // Left to right along the ceiling's far edge, then right to left along the
  // floor's near edge. The rim canvas covers these two cut lines.
  return `polygon(${[...arc(rim, Math.PI, Math.PI * 2), ...arc(`100% - ${rim}`, 0, Math.PI)].join(', ')})`;
}

export const THROAT = 0.17; // throat radius, as a fraction of the mouth
const DEPTH = 0.5; // how far the throat sinks toward the viewer, in units of b
const SPIN = 0.85; // radians per second
const KICK = 0.9; // extra turn each pass gives the vortex, radians

const fract = (v) => v - Math.floor(v);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Seconds since the cube last passed through the portals, or null before its first pass. */
export function sincePass(t) {
  if (t < PASS_AT) return null;
  return (t - PASS_AT) % FALL.period;
}

/** 1 the instant the cube passes through, easing to 0 well before the next pass. */
export function passPulse(t) {
  const since = sincePass(t);
  return since === null ? 0 : Math.exp(-since / 0.35);
}

/** How many times the cube has passed through the portals by time t. */
export const passes = (t) => (t < PASS_AT ? 0 : Math.floor((t - PASS_AT) / FALL.period) + 1);

/**
 * The vortex's turn: a steady spin plus a kick that each pass adds and that
 * eases in over half a second, so both portals whirl as the cube goes through.
 * Monotonic and continuous across passes.
 */
export function spinAngle(t) {
  const since = sincePass(t);
  // Sum the remaining ease-out of every pass. At the faster cadence the last
  // kick is still settling when the next starts; dropping it causes a jump.
  const decay = Math.exp(-FALL.period / 0.5);
  const kicks = since === null ? 0 : passes(t) - Math.exp(-since / 0.5) * (1 - decay ** passes(t)) / (1 - decay);
  return SPIN * t + KICK * kicks;
}

/** Radius (fraction of the mouth) and screen-space sink of funnel depth s. */
export const funnelRadius = (s) => 1 - (1 - THROAT) * Math.pow(clamp01(s), 1.25);
export const funnelSink = (s) => DEPTH * Math.pow(clamp01(s), 1.5);

/** Screen point on the funnel wall at depth s and angle (radians, 0 = right, π/2 = toward the viewer). */
export function funnelPoint(well, s, angle, out = {}) {
  const r = funnelRadius(s);
  out.x = well.cx + Math.cos(angle) * r * well.a;
  out.y = well.cy + Math.sin(angle) * r * well.b + funnelSink(s) * well.b;
  out.r = r;
  return out;
}

const PULL = 0.2; // how far the paper at the rim is dragged into the mouth
const TWIST = 0.42; // radians of swirl at the rim
const REACH = 2.3; // falloff rate outward from the rim
const LENS_LIMIT = 4.2; // beyond this (in mouth radii) the paper is untouched

/**
 * Where a point of the flat paper is drawn once the wormhole drags it: pulled
 * toward the mouth and swirled the way the vortex turns, strongest at the rim
 * and gone a few mouth-widths out. Paper that ends up inside the mouth is hidden
 * by the caller. `pulse` (0–1) winds the swirl a little tighter as the cube passes.
 */
export function lensPaperPoint(well, x, y, pulse, out = {}) {
  const dx = (x - well.cx) / well.a;
  const dy = (y - well.cy) / well.b;
  const rho = Math.hypot(dx, dy);
  if (rho > LENS_LIMIT || rho === 0) {
    out.x = x;
    out.y = y;
    return out;
  }
  const near = rho >= 1 ? Math.exp(-(rho - 1) * REACH) : 1;
  const pulled = rho >= 1 ? rho - PULL * near : rho * (1 - PULL);
  const angle = Math.atan2(dy, dx) + TWIST * (1 + 0.7 * pulse) * near;
  out.x = well.cx + Math.cos(angle) * pulled * well.a;
  out.y = well.cy + Math.sin(angle) * pulled * well.b;
  return out;
}

export const MOTE_COUNT = 24;
const MOTE_COLORS = [1, 4, 2, 5, 3, 6];

/**
 * Sticker confetti swirling in: mote `index` starts on the paper a little way
 * out, spirals faster as it nears the mouth, and falls down the funnel into the
 * throat, then starts again. Seeded by index, so every frame agrees.
 * Returns { rho } while it is on the paper (rho ≥ 1) or { s } once inside.
 */
export function mote(index, t) {
  const h1 = fract(index * 0.618034 + 0.13);
  const h2 = fract(index * 0.754878 + 0.41);
  const h3 = fract(index * 0.56984 + 0.77);
  const life = 3.4 + 2.6 * h1;
  const u = fract(t / life + h2);
  const start = 1.3 + 1.2 * h3; // where it lands on the paper, in mouth radii
  const travel = (start - 1 + 1) * Math.pow(u, 1.6);
  const outside = travel < start - 1;
  return {
    outside,
    rho: outside ? start - travel : 1,
    s: outside ? 0 : Math.min(1, travel - (start - 1)),
    angle: index * 2.39996 + Math.PI * 2 * 1.4 * u * u,
    spin: index + u * 9,
    alpha: clamp01(u / 0.08),
    color: MOTE_COLORS[index % MOTE_COLORS.length]
  };
}

// The worm peeks out of the throat, rides the vortex up the wall and dives back.
const WORM_PERIOD = 7.5;
const WORM_DELAY = 1.2;
const WORM_TRIP = 4;
export const WORM_SEGMENTS = 12;
const WORM_LAG = 0.04;
const WORM_PAIRS = [
  [2, 5],
  [1, 4],
  [3, 6]
];

/**
 * The worm at time t: its colour pair (antipodal faces, as the opening's worms
 * take the colours of the tunnel they ride) and each segment's funnel depth and
 * angle, head first. A segment still in the throat has s = 1.
 */
export function wormPose(t) {
  const trip = Math.floor(t / WORM_PERIOD);
  const head = (t % WORM_PERIOD) - WORM_DELAY;
  const start = trip * 2.4 + 0.8;
  const segments = [];
  for (let j = 0; j < WORM_SEGMENTS; j++) {
    const at = head - j * WORM_LAG;
    const out = at <= 0 || at >= WORM_TRIP ? 0 : Math.pow(Math.sin((Math.PI * at) / WORM_TRIP), 0.75);
    segments.push({ s: 1 - 0.78 * out, angle: start + 1.5 * Math.max(0, Math.min(at, WORM_TRIP)) });
  }
  return { colors: WORM_PAIRS[trip % WORM_PAIRS.length], segments };
}
