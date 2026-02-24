/**
 * Ease the time variable, not the geometry.
 * All downstream animation math (biography weights, Chaos warps, per-tile resistance)
 * should live here rather than being folded into geometry calculations.
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
