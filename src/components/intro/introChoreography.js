import { EXPLOSION_START, EXPLOSION_END, IMPLODE_START, IMPLODE_END, WORM_START, TITLE_START, TITLE_END, INTRO_FINISH } from './introTiming.js';

export const INTRO_END = INTRO_FINISH;
export const clamp01 = t => Math.max(0, Math.min(1, t));
export const smooth = t => { const p = clamp01(t); return p * p * p * (p * (p * 6 - 15) + 10); };
export const ramp = (t, a, b) => smooth((t - a) / (b - a));
export const windowOpacity = (t, a, b) => ramp(t, a, a + 0.45) * (1 - ramp(t, b - 0.45, b));

// Absolute-time poses: no accumulated rotations, random motion, or frame-rate drift.
export function sampleIntro(t, reducedMotion = false) {
  const open = reducedMotion ? 0 : ramp(t, EXPLOSION_START, EXPLOSION_END) * (1 - ramp(t, IMPLODE_START, IMPLODE_END));
  const turn = ramp(t, 0.6, 3.2);
  return {
    open,
    reveal: reducedMotion ? 1 : ramp(t, 0.1, 0.6),
    turn: reducedMotion ? 0 : 0.4 * turn,
    orbit: reducedMotion ? 0.65 : 0.65 + 0.25 * ramp(t, 0, 1) + 0.65 * ramp(t, 2.2, 5.6),
    distance: reducedMotion ? 12.5 : 10.5 + 5 * open + 2 * (1 - ramp(t, 0, 0.8)),
    flip: reducedMotion ? 0 : Math.PI * ramp(t, 1.0, 2.1) * (1 - ramp(t, IMPLODE_START, IMPLODE_END)),
    passage: reducedMotion ? 0 : windowOpacity(t, 2.2, TITLE_START),
    worm: clamp01((t - WORM_START) / 2.2),
    wormVisible: !reducedMotion && t >= WORM_START && t < IMPLODE_START,
    title: reducedMotion ? 1 : ramp(t, TITLE_START, TITLE_END)
  };
}

// Fit a bounding sphere in both portrait and landscape; leave room for copy.
export function introCameraDistance(distance, aspect, fov = 40) {
  const vertical = fov * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.1, aspect));
  return distance * Math.max(1, Math.sin(vertical) / Math.sin(horizontal));
}
