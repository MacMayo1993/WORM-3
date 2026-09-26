import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { cubeExpansionScale, cubeExpansionMultiplier } from './cubeWorldGeometry.js';

// Caution posts stay on the unraised cube. A WORM pad's landing surface meets
// the upper edge of their tape, on every board size (not a share of full Explode).
export const WORM_CAUTION_POLE_HEIGHT = 0.68;
export const WORM_CAUTION_TAPE_TOP = WORM_CAUTION_POLE_HEIGHT - 0.025;
export const WORM_PAD_HEIGHT = 0.3;
export const WORM_PIECE_POP = WORM_CAUTION_TAPE_TOP - WORM_PAD_HEIGHT;
// Other cube modes keep their small whole-piece pop.
export const CUBE_PIECE_POP = 0.1;
const popAmount = (distance, size) => distance / (Math.max(0.5, (size - 1) / 2) * cubeExpansionMultiplier(size));
export const wormRaisedAmount = size => popAmount(WORM_PIECE_POP, size);
export const cubeRaisedAmount = size => popAmount(CUBE_PIECE_POP, size);
export const raisedWormExpansion = (globalExpansion, size) => Math.max(wormRaisedAmount(size), globalExpansion || 0);

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
