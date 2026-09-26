// Pure, absolute-time geometry for the loading screen's wormhole. Like the
// opening's motion (introMotion.js), every value is a function of the clock, so a
// dropped frame or a main thread stalled by a parsing chunk lands on the right
// pose instead of accumulating drift.
//
// The mouth is an ellipse on the paper (`well`: centre cx, cy and half-axes a, b
// in CSS pixels, b < a because the paper is seen at an angle). Inside it a funnel
// sinks to a throat: s = 0 at the rim, 1 at the throat.

/**
 * The cube's hop, in seconds. Must match LoadingScene.css: `--wl-beat` and the
 * `wl-hop` keyframes, whose landing sits at 15% of the beat. Time 0 is the apex
 * the cube drops from as the screen mounts.
 */
export const BEAT = { period: 3, land: 0.45 };

export const THROAT = 0.17; // throat radius, as a fraction of the mouth
const DEPTH = 0.5; // how far the throat sinks toward the viewer, in units of b
const SPIN = 0.85; // radians per second
const KICK = 0.9; // extra turn each landing gives the vortex, radians

const fract = (v) => v - Math.floor(v);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Seconds since the cube last landed, or null before its first landing. */
export function sinceLanding(t) {
  if (t < BEAT.land) return null;
  return (t - BEAT.land) % BEAT.period;
}

/** 1 the instant the cube lands, easing to 0 before the next hop. */
export function landingPulse(t) {
  const since = sinceLanding(t);
  return since === null ? 0 : Math.exp(-since / 0.35);
}

/** How many times the cube has landed by time t. */
export const landings = (t) => (t < BEAT.land ? 0 : Math.floor((t - BEAT.land) / BEAT.period) + 1);

/**
 * The vortex's turn: a steady spin plus a kick that each landing adds and that
 * eases in over half a second, so the funnel visibly whirls when the cube lands.
 * Monotonic and continuous across landings.
 */
export function spinAngle(t) {
  const since = sinceLanding(t);
  const kicks = since === null ? 0 : landings(t) - Math.exp(-since / 0.5);
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
 * by the caller. `pulse` (0–1) winds the swirl a little tighter on a landing.
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
