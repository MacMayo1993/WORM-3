// src/worm/wormBookFX.js
// Shared geometry constants + math helpers for the Book Worm's open-book body:
// two page flaps hinged along the spine (the existing flattened "cover" box),
// flung toward the outside of a turn by an inferred turn-force signal.
// Framework-agnostic (plain three.js/math) so Healer mode's instanced body,
// Platformer mode's per-segment body, and the store preview all animate the
// same way.
import * as THREE from 'three';

// Page footprint in the segment's own local space, using the same axis
// convention as the existing book-segment orientation (THREE.Matrix4.lookAt
// with the direction of travel as its target): local -Z is forward, so Z runs
// along the spine (the segment's length), X is side/right (how far an open
// page reaches out), Y is up/thickness.
//
// The segment's own box geometry (SPINE_GEO_X_SCALE below) is now a thin
// binding rather than the full-width slab it used to be — the pages are the
// visible body, not an add-on riding on top of a separate square block.
export const PAGE_GEO_ARGS = [0.85, 0.035, 0.86];
export const PAGE_HINGE_X = 0.11; // matches the thin spine's own half-width — pages hinge flush at its edge
// The book segment's own box geometry is scaled by this factor on its X (side)
// axis only, in all three renderers, so it reads as a spine/binding instead of
// a square cubelet the pages are perched on top of.
export const SPINE_X_SCALE = 0.22;

// At rest (no turn) the two pages are propped open in a shallow "V"; a turn
// swings BOTH pages the same rotational direction, so one side flattens
// toward the spine while the other flips further over/past vertical toward
// the opposite side — read as pages flung by the turn's inertia.
export const PAGE_REST_ANGLE = 0.55;   // radians, ~31.5°
export const PAGE_SWING_GAIN = 1.5;    // radians of extra swing at full turn force
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
 * be able to fully fling a page past vertical).
 */
export function pageHingeAngles(turn) {
  return {
    left: PAGE_REST_ANGLE + turn * PAGE_SWING_GAIN,
    right: -(PAGE_REST_ANGLE - turn * PAGE_SWING_GAIN),
  };
}
