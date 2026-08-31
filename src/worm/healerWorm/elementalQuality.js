// src/worm/healerWorm/elementalQuality.js
//
// How much elemental effect this device can afford.
//
// The elemental wash is the heaviest thing on screen in Healer Worm mode: it lays
// a translucent layer over every face of the cube while the crawler, the bombs, the
// orbs and the tunnel rings are all still drawing. Before this module the budget
// was three hard-coded constants (a 5×5 sample grid per face, 130 particles, 5
// flames per cell) applied identically to a desktop 3×3 and a phone on a 15×15 —
// the phone paid full price for detail it could not resolve.
//
// The rule is degrade, never delete: every tier still sheathes the whole cube in
// the element. What shrinks is density (fewer, larger cover cells), accent counts
// and per-frame work — the identity of the element is the last thing to go.
//
// Pure and dependency-free (the caller passes the device facts in) so the budget
// table is testable without a DOM, a GPU or the store.

/**
 * Tiers, cheapest first.
 *   minimal reduced-motion, and phones on the very large boards: the floor budget
 *   low     phones / touch devices
 *   medium  desktop on a large board, where cell count is the binding cost
 *   high    desktop at the advertised sizes — today's look, unchanged
 *
 * The tier names a BUDGET, not a motion policy: `animate` is decided separately so
 * a phone pushed down to the floor by cell count still moves, while reduced motion
 * holds the same skin perfectly still.
 */
export const ELEMENTAL_TIERS = ['minimal', 'low', 'medium', 'high'];

// Cube edge length past which even a desktop steps down a tier. The skin's cover
// grid is already capped, but the cube itself is drawing size³ cubies behind it, so
// the frame budget left for the wash shrinks as the board grows.
const LARGE_CUBE = 6;

const BUDGETS = {
  minimal: {
    // The mega-board floor (large boards on a phone) and the reduced-motion tier.
    // 4×4 cover cells per face: a coarser grid than desktop but dense enough that a
    // huge board still reads as fully sheathed in the element rather than dotted
    // with a few patches. Fire is one instanced mesh, so its flame count is nearly
    // free to raise — and on a coarse grid each cover cell spans several tiles, so
    // it needs more tongues to fill that footprint instead of a few sparse licks.
    skinGrid: 4,
    particleCount: 0,
    flamesPerCell: 6,
    // Cube-scale adornments (edge flow, corner crowns, icicles, charge rails).
    adornments: 0,
    animate: false,
    accents: false
  },
  low: {
    skinGrid: 3,
    particleCount: 60,
    flamesPerCell: 6,
    adornments: 12,
    animate: true,
    accents: false
  },
  medium: {
    // Large desktop boards. Full 5×5 cover grid (same reach as the top tier) so a
    // mega cube is densely sheathed in every element; the step down from `high` is
    // in the particle and adornment counts, not the skin coverage.
    skinGrid: 5,
    particleCount: 90,
    flamesPerCell: 7,
    adornments: 24,
    animate: true,
    accents: true
  },
  high: {
    // Desktop at the advertised sizes.
    skinGrid: 5,
    particleCount: 130,
    flamesPerCell: 7,
    adornments: 48,
    animate: true,
    accents: true
  }
};

/** Look up a tier's budget table. Unknown names fall back to the safe floor. */
export const elementalBudget = (tier) => BUDGETS[tier] ?? BUDGETS.minimal;

/**
 * Pick the tier for the current device and board.
 *
 * Reduced motion wins outright — it is an accessibility request, not a perf hint,
 * so it is never traded away for a faster machine.
 *
 * @param {object}  o
 * @param {boolean} [o.mobile]        canonical isMobile from utils/device.js
 * @param {boolean} [o.reducedMotion] canonical prefersReducedMotion()
 * @param {number}  [o.cubeSize]
 * @returns {{tier:string, skinGrid:number, particleCount:number, flamesPerCell:number,
 *            adornments:number, animate:boolean, accents:boolean}}
 */
export function resolveElementalQuality({ mobile = false, reducedMotion = false, cubeSize = 3 } = {}) {
  let tier;
  if (reducedMotion) tier = 'minimal';
  else if (mobile) tier = cubeSize >= LARGE_CUBE ? 'minimal' : 'low';
  else tier = cubeSize >= LARGE_CUBE ? 'medium' : 'high';

  // A phone on a 15×15 lands on the floor budget by the branch above. That is a
  // perf decision, not an accessibility one, so it keeps the floor's counts but
  // stays alive — only an explicit reduced-motion request freezes the wash.
  const budget = elementalBudget(tier);
  const animate = !reducedMotion;
  return { tier, ...budget, animate, accents: budget.accents && animate };
}

/**
 * Rising ember sparks per cell for the FIRE skin, derived from the tongue budget so
 * the accents scale with the same device tier.
 *
 * Reduced motion (animate: false) gets none: a spark is pure motion, and frozen
 * ones would just be dots parked in mid-air above the cube.
 */
export function sparksForBudget(flamesPerCell, animate = true) {
  if (!animate) return 0;
  if (flamesPerCell >= 5) return 2;
  if (flamesPerCell >= 4) return 1;
  return 0;
}
