// Pure, absolute-time motion for the opening: every value here is a function of
// the intro clock, so a scrub, a dropped frame or a remount lands on the same pose.
import { RUBIKS_FACE_COLORS } from '../../utils/constants.js';
import { clamp01, ramp } from './introChoreography.js';
import {
  FULL_FLIP_START, FULL_FLIP_END, IMPLODE_START, IMPLODE_END, TUNNEL_FORM_START, EXPLOSION_START, DISSOLVE_START, DISSOLVE_END
} from './introTiming.js';
import { introMote } from './introEnergy.js';
import { FACES } from './introTopology.js';

/** Sticker colour for a face id (1–6): the same classic Rubik's palette as the menu cube. */
export const introColor = id => RUBIKS_FACE_COLORS[id] ?? '#f0f0f0';

// ── Drop, bounce and squash ────────────────────────────────────────────────
export const LAND_TIME = 0.5;
export const DROP_HEIGHT = 4.5;
const BOUNCE_TIME = 0.36;
const BOUNCE_HEIGHT = 0.42;

/** Height above the rest pose: falls onto the paper, one bounce, then rests. */
export function introDrop(t, reducedMotion = false) {
  if (reducedMotion) return 0;
  if (t < LAND_TIME) { const u = clamp01(t / LAND_TIME); return DROP_HEIGHT * (1 - u * u); }
  const b = (t - LAND_TIME) / BOUNCE_TIME;
  return b < 1 ? BOUNCE_HEIGHT * Math.sin(Math.PI * b) : 0;
}

const impulse = (t, at, amount) => t <= at ? 0 : amount * Math.sin((t - at) * 20) * Math.exp(-(t - at) * 7);
/**
 * Squash (+) / stretch (−) of the whole cube: stretched while it falls, a hard
 * squash on landing, a softer one after the bounce, and a snap when it shuts.
 * Scale y by (1 − s) and x/z by (1 + s/2), pivoting on the cube's base.
 */
export function introSquash(t, reducedMotion = false) {
  if (reducedMotion) return 0;
  const fall = t < LAND_TIME ? -0.14 * clamp01(t / LAND_TIME) ** 2 : 0;
  return fall + impulse(t, LAND_TIME, 0.22) + impulse(t, LAND_TIME + BOUNCE_TIME, 0.09) + impulse(t, IMPLODE_END - 0.05, 0.16);
}

// ── Top-layer twist ────────────────────────────────────────────────────────
/** The layer that twists as the cube lands: the top one, y = +1. */
export const TWIST_LAYER = { axis: 1, index: 1 };
const TWIST_SETTLE = 0.35;

/**
 * Angle of the top layer about +y. The cube is thrown in a quarter turn off
 * solved, the layer finishes its turn as the cube falls, and it clacks into
 * place on landing with a small recoil. Exactly 0 once settled, so the flip
 * wave, tunnels and worms all see a solved cube.
 */
export function introLayerTurn(t, reducedMotion = false) {
  if (reducedMotion) return 0;
  const recoil = (t - LAND_TIME) / TWIST_SETTLE;
  const clack = recoil > 0 && recoil < 1 ? 0.09 * Math.sin(recoil * 3 * Math.PI) * (1 - recoil) ** 2 : 0;
  return -(Math.PI / 2) * (1 - ramp(t, 0.04, LAND_TIME - 0.03)) + clack;
}

// ── Sticker flip wave ──────────────────────────────────────────────────────
const FLIP_TIME = 0.42;
const RETURN_TIME = 0.36;

/** 0 at the top-left of the cube, 1 at the bottom-right: the order the wave reaches a sticker. */
export function stickerWave(tile) {
  const p = tile.position.slice();
  p[tile.face.axis] += 0.5 * tile.face.sign;
  return clamp01(((1.5 - p[1]) / 3) * 0.7 + ((p[0] + 1.5) / 3) * 0.3);
}

/**
 * One sticker's flip state. `out` flips it to its antipodal colour as the wave
 * passes during the full flip; `back` flips it on round to its own colour as the
 * cube shuts, in the reverse order. The colour changes at the half-way point,
 * when the sticker is edge-on, and it pops off the face while turning so it
 * never cuts into the cubie.
 */
export function stickerFlip(tile, t, reducedMotion = false) {
  if (reducedMotion) return { angle: 0, flipped: false, lift: 0 };
  const w = stickerWave(tile);
  const outStart = FULL_FLIP_START + w * (FULL_FLIP_END - FULL_FLIP_START - FLIP_TIME);
  const backStart = IMPLODE_START + (1 - w) * (IMPLODE_END - IMPLODE_START - RETURN_TIME);
  const out = ramp(t, outStart, outStart + FLIP_TIME);
  const back = ramp(t, backStart, backStart + RETURN_TIME);
  return {
    angle: Math.PI * (out + back),
    flipped: (out >= 0.5) !== (back >= 0.5),
    lift: 0.32 * (Math.sin(Math.PI * out) + Math.sin(Math.PI * back))
  };
}

// ── Tunnels ───────────────────────────────────────────────────────────────
const TUNNEL_STAGGER = 0.025;
const TUNNEL_GROW = 0.6;
/** How much of pair `index`'s tunnel has shot across (0–1); pairs launch in turn. */
export const tunnelGrowth = (index, t, reducedMotion = false) => reducedMotion ? 0
  : ramp(t, TUNNEL_FORM_START + index * TUNNEL_STAGGER, TUNNEL_FORM_START + index * TUNNEL_STAGGER + TUNNEL_GROW);

// ── Floor, confetti and shockwaves ─────────────────────────────────────────
/** The paper the cube stands on, below its (possibly exploded) base. */
export const introFloorY = spacing => -(spacing + 0.5) - 0.55;

export const CONFETTI_BURSTS = [EXPLOSION_START, IMPLODE_END - 0.05];
const CONFETTI_LIFE = 1.3; // the snap-shut burst must land before the menu takes over
const CONFETTI_COLORS = [1, 2, 3, 4, 5, 6];

/**
 * Confetti piece `index` at time t. Pieces alternate between the explosion and
 * the snap shut; each is thrown from the cube along a seeded direction (the same
 * spread as introMote, so quality tiers share positions), falls, spins, and
 * shrinks away before its life ends. `null` while it is not in the air.
 */
export function introConfetti(index, t, reducedMotion = false) {
  if (reducedMotion) return null;
  const burst = CONFETTI_BURSTS[index % CONFETTI_BURSTS.length];
  const age = t - burst;
  if (age <= 0 || age >= CONFETTI_LIFE) return null;
  const [dx, dy, dz] = introMote(index + 7);
  const speed = 4.2 + (index * 0.37 % 1) * 3.2;
  const up = 3.2 + (index * 0.53 % 1) * 2.4;
  // Air drag on the throw (∫ speed·e^(−1.6t) dt), gravity on the lob.
  const travel = speed * (1 - Math.exp(-age * 1.6)) / 1.6;
  return {
    position: [dx * travel, dy * travel + up * age - 4.6 * age * age, dz * travel],
    spin: [age * (5 + index % 5), age * (3 + index % 3), age * 2],
    scale: Math.max(0, 0.16 * Math.min(1, age / 0.08) * (1 - ramp(age, CONFETTI_LIFE - 0.35, CONFETTI_LIFE))),
    color: introColor(CONFETTI_COLORS[index % CONFETTI_COLORS.length])
  };
}

export const SHOCKWAVES = [LAND_TIME, EXPLOSION_START, IMPLODE_END - 0.05];
const SHOCK_LIFE = 0.9;
/** Ink ring spreading over the paper from each impact: { radius, opacity } per wave. */
export function introShockwaves(t, reducedMotion = false) {
  return SHOCKWAVES.map(at => {
    const p = reducedMotion ? 1 : (t - at) / SHOCK_LIFE;
    if (p <= 0 || p >= 1) return { radius: 0, opacity: 0 };
    return { radius: 1.6 + p * 5.2, opacity: 0.55 * (1 - p) ** 2 };
  });
}

// ── Dissolve flecks ────────────────────────────────────────────────────────
export const FLECK_LIFE = 1.1;
const FLECK_PLASTIC = '#1b1b1d';
const fract = v => v - Math.floor(v);

/**
 * Fleck `index` shed by the cube as it dissolves: born on the cube's surface
 * when the dissolve front (top first, like introDissolve.js) passes, it drifts
 * off the face and up, spinning, and shrinks away. Most are sticker coloured,
 * every third is black plastic. `null` while it is not in the air.
 */
export function introFleck(index, t, reducedMotion = false) {
  if (reducedMotion) return null;
  const faceIndex = index % FACES.length;
  const face = FACES[faceIndex];
  const position = [0, 0, 0], normal = [0, 0, 0];
  const [a, b] = [0, 1, 2].filter(axis => axis !== face.axis);
  position[face.axis] = 1.52 * face.sign;
  position[a] = (fract(index * 0.7548776662) * 2 - 1) * 1.35;
  position[b] = (fract(index * 0.5698402910) * 2 - 1) * 1.35;
  normal[face.axis] = face.sign;
  const sweep = clamp01((1.7 - position[1]) / 3.4);
  const born = DISSOLVE_START + (DISSOLVE_END - DISSOLVE_START) * (0.1 + 0.6 * sweep + 0.2 * fract(index * 0.381966));
  const age = t - born;
  if (age <= 0 || age >= FLECK_LIFE) return null;
  const off = 0.55 * (1 - Math.exp(-age * 2.6));
  const rise = 1.1 * age + 0.5 * age * age;
  const sway = 0.14 * Math.sin(age * 4 + index);
  return {
    position: position.map((v, axis) => v + normal[axis] * off + (axis === 1 ? rise : 0) + (axis === a ? sway : 0)),
    spin: [age * (4 + index % 4), age * (3 + index % 3), age * 1.5],
    scale: 0.1 * Math.min(1, age / 0.08) * (1 - ramp(age, FLECK_LIFE * 0.45, FLECK_LIFE)),
    color: index % 3 === 2 ? FLECK_PLASTIC : introColor(face.color)
  };
}
