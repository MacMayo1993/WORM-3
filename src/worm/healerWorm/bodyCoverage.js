import { cubeExpansionScale } from '../../game/cubeWorldGeometry.js';
import { BODY_BALL_SPACING, MAX_TAIL } from './constants.js';

// Fixed bead spacing covers fewer logical cells while the lattice is expanded.
// Rings and bomb hazards must agree on which prefix of tileTrail is occupied.
export function bodyCoverageCount(tailLength, trailCount, size, expansionAmount = 0) {
  const reach = Math.min(MAX_TAIL, tailLength) * BODY_BALL_SPACING;
  return Math.min(trailCount, Math.max(1, Math.ceil(reach / cubeExpansionScale(size, expansionAmount))));
}
