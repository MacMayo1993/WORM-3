// One choice configures the complete run; cube size remains independent.
export const WORM_DIFFICULTIES = [
  { id: 'easy', label: 'Easy', settings: { wormSpeed: 2, wormOrbCount: 45, wormholeInterval: 20 } },
  { id: 'medium', label: 'Medium', settings: { wormSpeed: 2.75, wormOrbCount: 40, wormholeInterval: 10 } },
  { id: 'hard', label: 'Hard', settings: { wormSpeed: 3.5, wormOrbCount: 36, wormholeInterval: 5 } },
];

// Preset counts describe a 3×3 surface. Scale once when launching a run.
export const MAX_WORM_ORBS = 384;
export function scaledWormOrbCount(baseCount, size) {
  const n = Number.isFinite(size) ? Math.max(2, Math.round(size)) : 3;
  const base = Number.isFinite(baseCount) ? Math.max(1, baseCount) : 40;
  // Leave room for the head and other pickups even on the smallest boards.
  return Math.max(1, Math.min(MAX_WORM_ORBS, 6 * n * n - 4, Math.round(base * n * n / 9)));
}
