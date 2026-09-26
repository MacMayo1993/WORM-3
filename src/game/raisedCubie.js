import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { cubeExpansionScale } from './cubeWorldGeometry.js';

// WORM keeps every piece in its slot: only the flipped tile lifts, hovering a
// short hop above the surface, so the worm can reach it without leaving the cube.
// (Cube modes still raise the whole piece to its Explode position.)
export const WORM_RAISED_AMOUNT = 0;
export const raisedWormExpansion = (globalExpansion = 0) => Math.max(WORM_RAISED_AMOUNT, globalExpansion);

// How far a WORM flip pad hovers above its slot. The sim lands on it, the portal
// rings sit on it and the pad renderer lifts the tile to it: all read this value.
// It still clears the worm's head (0.08 lift + 0.092 radius ≈ 0.17) for the crawl under.
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
