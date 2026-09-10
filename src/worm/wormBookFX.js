// src/worm/wormBookFX.js
// Shared geometry constants + math helpers for the Book Worm's open-book body:
// lying flat, open to the middle on both sides, raised up off the crawl
// surface by the book's own height, and banking its pages toward whichever
// side the worm is turning into. Framework-agnostic (plain three.js/math) so
// Healer mode's instanced body, Platformer mode's per-segment body, and the
// store preview all animate the same way.
import * as THREE from 'three';

// Local -Z follows the spine; X spans the open spread. Four closely stacked,
// gently curved leaves (including the coloured cover) read as a bound book.
export const PAGE_GEO_ARGS = [0.95, 0.018, 1.02];
export const PAGE_LAYER_COUNT = 4;
export const PAGE_LAYER_GAP = 0.035;
export const PAGE_COLORS = ['#fff8df', '#eadfbd'];
export const PAGE_HINGE_X = 0.08;
export const SPINE_X_SCALE = 0.16;
export const SPINE_GEO_ARGS = [SPINE_X_SCALE, 0.16, 1.06];
export const PAGE_HINGE_Y = 0.06;
export const BOOK_SEGMENT_STRIDE = 2;
export const BOOK_PAGE_SCALE = 1.35;

/** Low-poly curved leaf shared by gameplay and previews, including platformer.
 * Mirror the camber so both halves rise from the gutter towards the fore-edge.
 */
export function createBookPageGeometry(side = 1) {
  const geometry = new THREE.BoxGeometry(...PAGE_GEO_ARGS, 6, 1, 1);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const u = side * positions.getX(i) / PAGE_GEO_ARGS[0] + 0.5;
    positions.setY(i, positions.getY(i) + 0.055 * Math.sin(Math.PI * u) + 0.035 * u * u);
    // Chamfer the fore-edge corners without adding another geometry layer.
    positions.setZ(i, positions.getZ(i) * (1 - 0.06 * Math.pow(u, 6)));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

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
export const PAGE_SWING_GAIN = 0.10;    // radians of bank at full turn force
export const TURN_SMOOTH_RATE = 7;     // per-second exponential-follow rate
export const TURN_SIGNAL_GAIN = 14;    // scales the raw per-frame direction-delta into a -1..1-ish force

/**
 * Signed "how hard is it turning, and which way" scalar from two consecutive
 * (unit) forward directions and the up/normal axis they're both tangent to.
 * Positive/negative sign is arbitrary but consistent frame-to-frame — only
 * the sign flip on reversal and the magnitude scaling with turn rate matter.
 */
const _turnCross = new THREE.Vector3();
export function turnSignalFromDirections(prevDir, newDir, upAxis, delta = 1 / 60) {
  _turnCross.crossVectors(prevDir, newDir);
  if (!(delta > 0)) return 0;
  return Math.atan2(_turnCross.dot(upAxis), prevDir.dot(newDir)) / (delta * 60);
}

/**
 * Exponential-follow smoothing toward a target value (frame-rate independent).
 */
export function smoothTurn(current, target, delta, rate = TURN_SMOOTH_RATE) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) * rate));
}

/**
 * Hinge angle for the left/right page, given the smoothed turn value
 * clamped to -1..1 so a hard turn cannot fold the leaves through the cover.
 * Both pages get the SAME rotation
 * around the shared spine axis; since they're mirrored (hinged at +X/-X),
 * an identical rotation angle moves one up and the other down — the flat
 * spread tips like a seesaw toward whichever side the worm turns into,
 * rather than each page reacting independently.
 */
export function pageHingeAngles(turn) {
  const bank = Math.max(-1, Math.min(1, turn)) * PAGE_SWING_GAIN;
  return {
    left: PAGE_REST_ANGLE + bank,
    right: -PAGE_REST_ANGLE + bank,
  };
}
