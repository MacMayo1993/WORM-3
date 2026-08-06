// src/worm/wormBookFX.js
// Shared geometry constants + math helpers for the Book Worm's open-book body:
// lying flat, open to the middle on both sides, raised up off the crawl
// surface by the book's own height, and banking its pages toward whichever
// side the worm is turning into. Framework-agnostic (plain three.js/math) so
// Healer mode's instanced body, Platformer mode's per-segment body, and the
// store preview all animate the same way.
import * as THREE from 'three';

// Page footprint in the segment's own local space, using the same axis
// convention as the existing book-segment orientation (THREE.Matrix4.lookAt
// with the direction of travel as its target): local -Z is forward, so Z runs
// along the spine (the segment's length), X is side/right (how far an open
// page reaches out), Y is up/thickness.
//
// A single thick slab read as a flat cutout no matter how tall it got — a
// real stack of paper reads as a stack because you can see the individual
// sheets. PAGE_LAYER_COUNT thin layers, PAGE_LAYER_GAP apart, do that: each
// layer is thinner than the gap between layers so there's a visible seam
// between them, and the whole stack (layer count × gap) is the visible body
// height.
export const PAGE_GEO_ARGS = [0.85, 0.032, 0.86]; // one sheet's footprint
export const PAGE_LAYER_COUNT = 8;
// Keep the sheets close enough to read as one page block. The earlier wide
// air gaps made four floating shelves, rather than the fore-edge of a book.
export const PAGE_LAYER_GAP = 0.048;
// Paper stays paper-coloured regardless of the equipped skin. The skin colour
// belongs to the binding; alternating warm whites make the individual page
// edges legible without turning the stack into stripes.
export const PAGE_COLORS = ['#fff8df', '#eadfbd'];
export const PAGE_HINGE_X = 0.11; // matches the thin spine's own half-width — pages hinge flush at its edge
// The book segment's own box geometry is scaled by this factor on its X (side)
// axis only, in all three renderers, so it reads as a spine/binding instead of
// a square cubelet the pages are perched on top of.
export const SPINE_X_SCALE = 0.22;
// Half the spine's own unit-box height (its existing box geometry is
// [SPINE_X_SCALE, 0.68, ...] in all three renderers) — the page stack's
// bottom layer sits flush with its top surface (not floating above it in a
// "V"), and the whole book is lifted this much extra off the crawl surface so
// it visibly rests ON TOP of the ground instead of being centered/embedded at
// it, standing up by its own height.
export const PAGE_HINGE_Y = 0.34;

// The head is a round orb, like every other worm's.  It used to be an upright
// cover panel behind two open paper leaves — a book standing on end, which at
// gameplay size read as a rectangle with a face stuck on it rather than as a
// head.  Only the head changed; the body is still a stack of books.
//
// Kept here because gameplay and the picker previews both build it, and they
// must agree or the preview stops matching the worm you get.
export const BOOK_HEAD_RADIUS = 0.092; // matches HEAD_RADIUS / the sphere worms' head

// The book body floats a little off the surface (PAGE_HINGE_Y lifts the page
// stack clear of the tile).  The head rides at the same height so it sits on
// the body's line rather than sunk below it — and WormFace applies the same
// lift, so the eyes stay on the orb.
export const BOOK_HEAD_LIFT = BOOK_HEAD_RADIUS * PAGE_HINGE_Y;

// At rest the two page blocks form a shallow open-book V around the middle.
// A turn banks BOTH sides by the same extra rotation, so the whole spread
// tips like a seesaw around the spine and reads as pages flapping toward the
// side the worm turns into.
export const PAGE_REST_ANGLE = 0.22;   // radians — a chunky, readable open-book V
export const PAGE_SWING_GAIN = 1.1;    // radians of bank at full turn force
export const TURN_SMOOTH_RATE = 7;     // per-second exponential-follow rate
export const TURN_SIGNAL_GAIN = 14;    // scales the raw per-frame direction-delta into a -1..1-ish force

/**
 * Signed "how hard is it turning, and which way" scalar from two consecutive
 * (unit) forward directions and the up/normal axis they're both tangent to.
 * Positive/negative sign is arbitrary but consistent frame-to-frame — only
 * the sign flip on reversal and the magnitude scaling with turn rate matter.
 */
const _turnCross = new THREE.Vector3();
export function turnSignalFromDirections(prevDir, newDir, upAxis) {
  _turnCross.crossVectors(prevDir, newDir);
  return _turnCross.dot(upAxis);
}

/**
 * Exponential-follow smoothing toward a target value (frame-rate independent).
 */
export function smoothTurn(current, target, delta, rate = TURN_SMOOTH_RATE) {
  return current + (target - current) * Math.min(1, delta * rate);
}

/**
 * Hinge angle for the left/right page, given the smoothed turn value
 * (roughly -1..1, unclamped at the extremes on purpose — a hard turn should
 * be able to bank a page fully past flat). Both pages get the SAME rotation
 * around the shared spine axis; since they're mirrored (hinged at +X/-X),
 * an identical rotation angle moves one up and the other down — the flat
 * spread tips like a seesaw toward whichever side the worm turns into,
 * rather than each page reacting independently.
 */
export function pageHingeAngles(turn) {
  const bank = turn * PAGE_SWING_GAIN;
  return {
    left: PAGE_REST_ANGLE + bank,
    right: -PAGE_REST_ANGLE + bank,
  };
}
