// Timing of the menu's light sweep (MenuLightSweep.jsx), pure for tests.
export const SWEEP_PERIOD = 7.5;
export const SWEEP_TIME = 1.5;
export const LIGHT_SWEEP_PEAK = 20;

const clamp01 = v => Math.max(0, Math.min(1, v));

/** Where the sweep is (`x` -1…1 across the cube) and how bright, at `t`. */
export function lightSweepAt(t, out = { x: 0, strength: 0 }) {
  const phase = ((t % SWEEP_PERIOD) + SWEEP_PERIOD) % SWEEP_PERIOD;
  const p = clamp01(phase / SWEEP_TIME);
  out.x = p * 2 - 1;
  out.strength = phase < SWEEP_TIME ? Math.sin(Math.PI * p) ** 2 : 0;
  return out;
}

