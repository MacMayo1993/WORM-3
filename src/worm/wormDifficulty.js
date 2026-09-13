// One choice configures the complete run; cube size remains independent.
export const WORM_DIFFICULTIES = [
  { id: 'easy', label: 'Easy', settings: { wormSpeed: 2, wormOrbCount: 12, wormholeInterval: 20 } },
  { id: 'medium', label: 'Medium', settings: { wormSpeed: 2.75, wormOrbCount: 10, wormholeInterval: 10 } },
  { id: 'hard', label: 'Hard', settings: { wormSpeed: 3.5, wormOrbCount: 8, wormholeInterval: 5 } },
];

// Preset counts describe a 3×3. Grow with edge length, not surface area.
export const MAX_WORM_ORBS = 96;
export function scaledWormOrbCount(baseCount, size) {
  const n = Number.isFinite(size) ? Math.max(2, Math.round(size)) : 3;
  const base = Number.isFinite(baseCount) ? Math.max(1, baseCount) : 10;
  // Keep at least two thirds of the tiles clear, even with custom counts.
  return Math.max(1, Math.min(MAX_WORM_ORBS, 2 * n * n, Math.round(base * n / 3)));
}
