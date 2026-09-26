import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { cubeExpansionScale, cubeExpansionMultiplier } from './cubeWorldGeometry.js';

// A flipped piece pops out of the cube barely, by a fixed distance along its face
// normal on every board size. A fixed share of Explode grew with the board (half
// of it was 0.9 units on 3×3 and 5.4 on 15×15), which put WORM's tunnel out of
// reach and, in the cube modes, threw every flipped piece across the scene. Each
// amount is that distance as an Explode fraction for the outer layer.
//
// WORM_PIECE_POP: WORM's pads stand on it, so it is the sim's landing height too.
// CUBE_PIECE_POP: Flip Cube and Chaos — a hair above the surface, just enough of a
// gap that the tunnel underneath shows as a sliver.
export const WORM_PIECE_POP = 0.06;
export const CUBE_PIECE_POP = 0.1;
const popAmount = (distance, size) => distance / (Math.max(0.5, (size - 1) / 2) * cubeExpansionMultiplier(size));
export const wormRaisedAmount = size => popAmount(WORM_PIECE_POP, size);
export const cubeRaisedAmount = size => popAmount(CUBE_PIECE_POP, size);
export const raisedWormExpansion = (globalExpansion, size) => Math.max(wormRaisedAmount(size), globalExpansion || 0);

// How far a WORM flip pad hovers above its popped piece. The sim lands on it, the
// portal rings sit on it and the pad renderer lifts the tile to it: all read this.
// The crawl under runs on the unpopped surface, where the tile's underside sits
// WORM_PIECE_POP + WORM_PAD_HEIGHT up: clear of the head (≈ 0.17) and a hat (≈ 0.30).
export const WORM_PAD_HEIGHT = 0.3;

const DIRECTIONS = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

export function isLiveFlippedFace(sticker, cap) {
  return !!sticker && sticker.flips > 0 && sticker.flips < cap && sticker.flips % 2 === 1;
}

// A cubie is one solid piece. Several flipped faces must not multiply its lift.
export function cubieHasFlippedFace(cubie, cap) {
  return DIRECTIONS.some(dir => isLiveFlippedFace(cubie.stickers?.[dir], cap));
}

export function cubieFaceRole(cubie, dir, cap) {
  if (!cubie.stickers?.[dir]) return 'absent';
  if (isLiveFlippedFace(cubie.stickers[dir], cap)) return 'tunnel';
  return cubieHasFlippedFace(cubie, cap) ? 'platform' : 'surface';
}

// Colour is opposite the face currently visible, not opposite its home colour.
export const padBackFace = sticker => ANTIPODAL_COLOR[sticker?.curr] ?? sticker?.orig;

// A springing piece may pass its Explode position on the way out (the bounce).
// Bound it so a hitch can never fling a piece across the scene.
export const PIECE_OVERSHOOT_MAX = 1.5;

// Compose selective expansion with the global Explode view. The resting target is
// the SAME position as full Explode, never full Explode plus a second explosion.
// Multiply the cubie's live (possibly slice-rotated) centre by this extra ratio.
export function selectiveCubieOffsetRatio(size, globalExpansion, raisedAmount) {
  const global = Math.max(0, globalExpansion);
  const amount = Math.max(0, Math.min(PIECE_OVERSHOOT_MAX, raisedAmount));
  const combined = Math.max(global, amount);
  return cubeExpansionScale(size, combined) / cubeExpansionScale(size, global) - 1;
}
