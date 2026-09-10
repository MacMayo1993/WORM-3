import { EXPLOSION_START, EXPLOSION_END, IMPLODE_START, IMPLODE_END, WORM_START } from './introTiming.js';

export const INTRO_END = IMPLODE_END + 2;
export const clamp01 = t => Math.max(0, Math.min(1, t));
export const smooth = t => { const p = clamp01(t); return p * p * p * (p * (p * 6 - 15) + 10); };
export const ramp = (t, a, b) => smooth((t - a) / (b - a));
export const windowOpacity = (t, a, b) => ramp(t, a, a + 0.45) * (1 - ramp(t, b - 0.45, b));

// Absolute-time poses: no accumulated rotations, random motion, or frame-rate drift.
export function sampleIntro(t, reducedMotion = false) {
  const open = reducedMotion ? 0 : ramp(t, EXPLOSION_START, EXPLOSION_END) * (1 - ramp(t, IMPLODE_START, IMPLODE_END));
  const turn = ramp(t, 3.2, 6.2);
  return {
    open,
    reveal: reducedMotion ? 1 : ramp(t, 0.6, 2.8),
    turn: reducedMotion ? 0 : Math.PI * turn,
    orbit: reducedMotion ? 0.65 : 0.65 + 0.25 * ramp(t, 0, 3) + 0.65 * ramp(t, 8.2, 11),
    distance: reducedMotion ? 12.5 : 10.5 + 5 * open + 2 * (1 - ramp(t, 0, 2)),
    flip: reducedMotion ? 0 : Math.PI * ramp(t, 6.5, 8.2) * (1 - ramp(t, IMPLODE_START, IMPLODE_END)),
    passage: reducedMotion ? 0 : windowOpacity(t, 9.1, IMPLODE_END),
    worm: clamp01((t - WORM_START) / 1.3),
    wormVisible: !reducedMotion && t >= WORM_START && t < WORM_START + 1.5,
    title: reducedMotion ? 1 : ramp(t, 13.7, 14.5)
  };
}

// The center-face endpoints are exact antipodes. The bowed path makes the
// connection visible in the exploded view instead of hiding behind the core.
export function passagePoint(u, extent, out) {
  const p = clamp01(u);
  out.set(1.25 * Math.sin(Math.PI * p), 0.45 * Math.sin(2 * Math.PI * p), extent * (1 - 2 * p));
  return out;
}

// Fit a bounding sphere in both portrait and landscape; leave room for copy.
export function introCameraDistance(distance, aspect, fov = 40) {
  const vertical = fov * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.1, aspect));
  return distance * Math.max(1, Math.sin(vertical) / Math.sin(horizontal));
}
