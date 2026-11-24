// src/3d/cubeHeroView.js
// The opening view of a Flip Cube or Chaos round: the cube at three-quarters, so
// three faces show and it reads as a cube. Face-on, a phone showed one face as a
// flat grid of nine squares, and the antipodal flips (which jump to another face)
// happened out of sight.
//
// The camera swings in from the old face-on spot (a little farther out) along a
// smooth path, on the frame clock, so the round opens with the cube turning to
// meet the player. Reduced motion lands on the view at once.

/** Turn round the vertical axis, radians (shows the right face). */
export const HERO_YAW = 0.6;
/** Rise above the equator, radians (shows the top face). */
export const HERO_PITCH = 0.46;
/**
 * Extra distance so the wider three-quarter silhouette still fits: a cube's
 * outline at this angle is about 1.4× its face width. Portrait screens are the
 * narrow ones, so they get the most.
 */
export function heroDistanceScale(aspect) {
  if (!(aspect > 0)) return 1.12;
  if (aspect >= 1) return 1.04;
  return 1.04 + 0.16 * Math.min(1, (1 - aspect) / 0.55);
}
/** Seconds the opening swing takes. */
export const HERO_SWING_SECONDS = 1.35;
/** How much farther out than the view the swing starts. */
export const HERO_SWING_PULLBACK = 1.35;

/** Writes the resting hero camera position for `distance` into `out` (any {x, y, z}). */
export function heroPositionInto(out, distance) {
  const c = Math.cos(HERO_PITCH);
  out.x = distance * c * Math.sin(HERO_YAW);
  out.y = distance * Math.sin(HERO_PITCH);
  out.z = distance * c * Math.cos(HERO_YAW);
  return out;
}

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Camera position `t` seconds into the swing: from face-on and pulled back, to
 * the hero view, turning and rising together (spherical, so the cube stays the
 * same apparent size apart from the dolly). Returns true once settled.
 */
export function heroSwingInto(out, t, distance) {
  const k = easeOutCubic(Math.min(1, Math.max(0, t / HERO_SWING_SECONDS)));
  const yaw = HERO_YAW * k;
  const pitch = HERO_PITCH * k;
  const r = distance * (HERO_SWING_PULLBACK + (1 - HERO_SWING_PULLBACK) * k);
  const c = Math.cos(pitch);
  out.x = r * c * Math.sin(yaw);
  out.y = r * Math.sin(pitch);
  out.z = r * c * Math.cos(yaw);
  return k >= 1;
}
