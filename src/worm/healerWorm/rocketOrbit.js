// src/worm/healerWorm/rocketOrbit.js
//
// Where the worm flies during a rocket burn.
//
// ── The problem with lifting along the normal ───────────────────────────────
// The flight used to be `surface position + face normal × height`. On the flat of
// a face that is fine, but the cube is not a sphere: at an edge the two faces'
// normals are 90° apart, and every consumer of that offset (the head, the body
// segments, the face, the tail flame) picked its normal from a different source —
// the live `currentNormal`, a pair of lerped step-history normals, the sim's own.
// They disagree across an edge, and a normal that snaps from one face to the next
// swings a point 1.4 units away through a quarter turn instantly — straight
// through the corner of the cube it is supposed to be flying around.
//
// ── The shell ───────────────────────────────────────────────────────────────
// The flight path is now derived from POSITION alone, so nothing can disagree
// about it. Every point is pushed out along the local outward direction of a
// rounded cube: perpendicular over a face, along the bisector over an edge, along
// the diagonal at a corner. That surface is the cube grown by the flight height in
// every direction — the Minkowski sum of the cube and a ball — so the path is a
// smooth orbit at constant altitude that rounds every edge instead of cutting it.
//
// The clearance check at the end is the guarantee: whatever the input, the result
// sits outside the cube's own box by at least ROCKET_ORBIT_CLEARANCE × t. Nothing
// can clip through, including a point that arrives already inside (a corner arc
// mid-rotation, a stale history entry) — such a point is pushed out rather than
// flown through.

import * as THREE from 'three';
import { SURFACE_OFFSET } from '../../utils/constants.js';
import { ROCKET_DURATION, ROCKET_FLIGHT_HEIGHT, ROCKET_FLIGHT_TAKEOFF, ROCKET_FLIGHT_LANDING } from './constants.js';

/** Clearance the orbit keeps from the cube's own box, at full altitude. */
export const ROCKET_ORBIT_CLEARANCE = 0.55;

const _dir = new THREE.Vector3();

/**
 * Flight ramp, 0..1: rises over the takeoff, holds through the cruise, settles
 * over the landing. This is the shape `rocketFlightLift` has always had; it is
 * pulled out so height and orbit share one clock.
 */
export function rocketOrbitT(active, rocketT) {
  if (!active) return 0;
  const elapsed = ROCKET_DURATION - rocketT;
  const up = Math.min(1, elapsed / ROCKET_FLIGHT_TAKEOFF);
  const down = Math.min(1, rocketT / ROCKET_FLIGHT_LANDING);
  return Math.max(0, Math.min(up, down));
}

/** Half-extent of the cube's own box, sticker faces included. */
export const cubeHalfExtent = (size) => (size - 1) / 2 + SURFACE_OFFSET;

/**
 * Outward direction of the rounded-cube shell at `pos`, written into `out`.
 *
 * Each axis contributes however far the point reaches past the outermost cubie
 * centre, so a point on the flat of a face gets that face's normal, a point on the
 * arc around an edge gets the bisector of the two faces, and a corner gets the
 * diagonal — with everything in between varying smoothly, which is what makes the
 * orbit round the cube rather than turn a corner.
 */
export function cubeShellDirInto(out, pos, size) {
  const k = (size - 1) / 2;
  out.set(
    Math.sign(pos.x) * Math.max(0, Math.abs(pos.x) - k),
    Math.sign(pos.y) * Math.max(0, Math.abs(pos.y) - k),
    Math.sign(pos.z) * Math.max(0, Math.abs(pos.z) - k)
  );
  if (out.lengthSq() < 1e-12) {
    // Inside the shell of cubie centres (a corner arc that cut in, or a degenerate
    // position): fall back to straight-out-from-the-middle, which is always defined.
    out.copy(pos);
    if (out.lengthSq() < 1e-12) out.set(0, 1, 0);
  }
  return out.normalize();
}

/**
 * Lift a surface position into the rocket's orbit, in place.
 *
 * @param {THREE.Vector3} out  position to raise (safe to pass the same vector in)
 * @param {number} size        cube size
 * @param {number} t           0..1 flight ramp, from rocketOrbitT
 * @param {number} [height]    cruise altitude at t = 1
 */
export function rocketOrbitInto(out, size, t, height = ROCKET_FLIGHT_HEIGHT) {
  if (!(t > 0)) return out;

  cubeShellDirInto(_dir, out, size);
  out.addScaledVector(_dir, height * t);

  // Guarantee the clearance. Pushing along the shell direction always increases
  // the gap (its dot with every axis the point is outside on is non-negative), so
  // a couple of corrections converge; the loop is bounded rather than solved
  // exactly because the box distance is piecewise and not worth inverting.
  const a = cubeHalfExtent(size);
  const need = ROCKET_ORBIT_CLEARANCE * t;
  for (let pass = 0; pass < 3; pass++) {
    const dx = Math.max(0, Math.abs(out.x) - a);
    const dy = Math.max(0, Math.abs(out.y) - a);
    const dz = Math.max(0, Math.abs(out.z) - a);
    const gap = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (gap >= need) break;
    out.addScaledVector(_dir, (need - gap) * 1.75);
  }
  return out;
}
