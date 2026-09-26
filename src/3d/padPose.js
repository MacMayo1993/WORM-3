import { clampWear } from '../game/flipPad.js';

export const PAD_PROFILES = {
  cube: { height: 0.30, amplitude: 0.04, wearAmplitude: 0.12, frequency: 0.9 },
  chaos: { height: 0.14, amplitude: 0.02, wearAmplitude: 0.10, frequency: 1 },
  worm: { height: 0.50, amplitude: 0.05, wearAmplitude: 0.10, frequency: 0.8 },
  menu: { height: 0.35, amplitude: 0.06, wearAmplitude: 0.10, frequency: 0.7 }
};

export function pairPhase(key = '') {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return (hash >>> 0) / 4294967296;
}

// Worn pads (wear ≥ K_STAR, or one life left) stop keeping time. Two changes,
// both read from the pair's own phase and seed so twins stay identical:
//  • each hop picks its own height, from 55% to 100% of the amplitude, and
//  • the beat drifts on two incommensurate rates, so hops land unevenly.
// Heights only shrink toward the hover height, so a worn pad never dips below it
// (WORM's clearance floor). The drift can slow the beat but never reverse it: its
// steepest slope, 0.06·2π·(0.5 + 0.5·1.618) ≈ 0.49 cycles per cycle, stays under 1.
// No jitter or tilt: sticker marks stay square and legible.
export const WORN_HOP_SPREAD = 0.45;
export const WORN_DRIFT = 0.06;
// How fast the worn weight may change (per second). Easing across the threshold
// keeps the rhythm from snapping; at this rate the beat still only moves forward.
export const WORN_EASE = 1.5;
const GOLDEN = 1.61803398875;
const TAU = Math.PI * 2;

// Deterministic 0..1 per (pair seed, hop): a hop always gets the same height.
function hopNoise(seed, hop) {
  let h = (seed + Math.imul(hop, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Output object may be reused in the render loop. Phase is integrated by the
// owner: changing wear must not jump the phase by time * (new f - old f).
// `worn` is a boolean or a 0..1 weight the owner eases across the threshold.
export function padPose({ phase = 0, wear = 0, profile = 'cube', worn = false, seed = 0, reducedMotion = false, subtle = false, big = false }, out = {}) {
  const p = PAD_PROFILES[profile] ?? PAD_PROFILES.cube;
  const w = clampWear(wear);
  const irregular = worn === true ? 1 : Math.max(0, Math.min(1, +worn || 0));
  const beat = irregular > 0
    ? phase + irregular * WORN_DRIFT * (Math.sin(TAU * 0.5 * phase) + Math.sin(TAU * 0.5 * GOLDEN * phase))
    : phase;
  const hop = Math.floor(beat);
  const cycle = beat - hop;
  const arc = 4 * cycle * (1 - cycle);
  // A hop's height changes only at touchdown, where the arc is zero, so a new
  // height never shows as a step.
  const hopHeight = irregular > 0 ? 1 - irregular * WORN_HOP_SPREAD * hopNoise(seed, hop) : 1;
  const scale = (subtle ? 0.5 : 1) * (big ? 0.5 : 1);
  out.lift = p.height + (reducedMotion ? 0 : scale * (p.amplitude + p.wearAmplitude * w) * hopHeight * arc);
  out.impact = reducedMotion ? 0 : Math.exp(-((cycle / 0.08) ** 2));
  out.cycle = cycle;
  out.beat = beat;
  out.frequency = p.frequency * (1 + w);
  return out;
}

// Fixed substeps of at most 1/120 s keep the overshoot a player sees the same at
// 30, 60 or 144 fps; a long browser hitch is capped at 0.1 s of motion.
function advanceSpring(spring, target, delta, stiffness, damping) {
  let remaining = Math.min(0.1, Math.max(0, delta));
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120);
    spring.velocity += ((target - spring.lift) * stiffness - spring.velocity * damping) * dt;
    spring.lift += spring.velocity * dt;
    remaining -= dt;
  }
  if (Math.abs(target - spring.lift) < 0.0001 && Math.abs(spring.velocity) < 0.001) {
    spring.lift = target;
    spring.velocity = 0;
  }
  return spring;
}

// Pads use the worm-press spring (ζ ≈ 0.65): one small rebound, then still.
export const advancePadSpring = (spring, target, delta) => advanceSpring(spring, target, delta, 210, 19);

// Whole pieces use the same stiffness with lighter damping (ζ ≈ 0.42), so a
// piece passes its Explode position by about a fifth and springs back: it
// bounces out of the cube instead of easing out. Callers clamp the return at
// zero, because below it the piece would sink into its neighbours.
export const PIECE_SPRING_DAMPING = 12.2;
export const advancePieceSpring = (spring, target, delta) => advanceSpring(spring, target, delta, 210, PIECE_SPRING_DAMPING);
