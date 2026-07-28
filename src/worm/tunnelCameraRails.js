// src/worm/tunnelCameraRails.js
//
// The pose of the wormhole camera as a pure function of how far along the
// traversal the worm's head is.
//
// This lives outside WormChaseCamera because two different phases need the
// *same* pose: 'entering' blends into it as the dive lands, and 'tunnel' /
// 'exiting' sit on it outright. When the two carried their own copies of the
// math the phase change was a cut — which is precisely the seam the dive exists
// to remove — so there is now one definition and both call it.
//
// Pure (no React, no r3f), so the claims that matter can actually be asserted:
// that the camera crosses the cube's surface during the dive rather than
// watching the ride from outside it, and that the dive's end pose IS the ride's
// start pose.

import * as THREE from 'three';
import { getTunnelWorldPosInto } from './wormLogic.js';

// Offsets from the centerline. Deliberately small: they rotate with the Möbius
// roll, so a large one walks the camera around the bore and pins it against one
// wall instead of leaving the shaft symmetric around the view.
export const TUNNEL_CAM_UP = 0.32;
export const TUNNEL_LOOK_AHEAD = 0.7;

// The exterior framing used to watch a mouth from outside the cube — shared by
// windup, the start of the dive, and windout, so the dive provably begins from
// the pose the previous phase left the camera in.
export const portalDist = (size) => 2.8 + size * 0.85;
export const portalUp = (size) => 1.3 + size * 0.32;

// tHead at the moment the 'entering' phase hands over to 'tunnel'. The whole
// traversal is parameterised 0→1 and the three phases split it 0.33 / 0.34 /
// 0.33; several files map their own progress onto it (TunnelTube's uHead,
// portalFx's traversalProgress, tunnelState.t).
export const ENTER_END_T = 0.33;

/**
 * Lateral camera offset from the tunnel centerline.
 *
 * The entry arm must stay at zero: even a small cinematic "up" offset moves
 * the lens across the face of the entry sticker instead of through its centre.
 * Once the camera is safely beyond the mouth, ease the usual riding height
 * back in so the Möbius roll remains visible through the rest of the trip.
 */
export function cameraUpForHead(tHead) {
  return TUNNEL_CAM_UP * THREE.MathUtils.smoothstep(tHead, 0.38, 0.52);
}

/**
 * Ease for the dive through the entry hole: cubic, so the camera is nearly
 * still for most of the phase and then rushes. Same curve as the mode
 * selector's cube dive (MainMenu), which is the feel this is modelled on.
 */
export const diveEase = (p) => {
  const c = p < 0 ? 0 : p > 1 ? 1 : p;
  return c * c * c;
};

/**
 * How far behind the head the camera trails.
 *
 * This used to be one constant, 1.15 + size·0.1, and that is longer than the
 * entire entry arm on a 3×3 (1.25 world units): the camera sat further back
 * than the tunnel was deep, so it did not cross the cube's surface until
 * roughly the middle of the 'tunnel' phase. The player watched the ride from
 * outside a cube whose body is hidden during those phases, which is why the
 * shot never read as being inside anything.
 *
 * Holding the trail short through the entry arm puts the camera through the
 * mouth on the dive. The growth back to the settled deep-ride value is spread
 * over tHead 0.42→0.85 so that it is always slower than the head's own advance
 * along the path — ramp it faster and the camera drifts backwards out of the
 * tunnel while the worm pulls away from it.
 */
export function backForHead(tHead, size) {
  const deep = THREE.MathUtils.smoothstep(tHead, 0.42, 0.85);
  return THREE.MathUtils.lerp(0.62 + size * 0.1, 1.15 + size * 0.1, deep);
}

const _fwd = new THREE.Vector3();

/**
 * Write the on-rails camera pose at `tHead` into `out`.
 *
 * @param {{cam: THREE.Vector3, look: THREE.Vector3, up: THREE.Vector3, tangent: THREE.Vector3}} out
 * @param {Object} tunnel  active tunnel descriptor (entry/exit tiles)
 * @param {number} tHead   0→1 position of the worm's head along the traversal
 * @param {number} size    cube size
 * @returns {typeof out}
 */
export function tunnelCamPoseInto(out, tunnel, tHead, size) {
  getTunnelWorldPosInto(out.look, tunnel, tHead, size);
  getTunnelWorldPosInto(_fwd, tunnel, Math.min(tHead + 0.05, 1), size);
  out.tangent.subVectors(_fwd, out.look);
  if (out.tangent.lengthSq() < 1e-6) {
    // At the very end of the path the forward sample clamps onto the current
    // one and the difference collapses. Look backwards instead of falling back
    // to an arbitrary world axis, which would flick the camera around on the
    // last frames of the exit.
    getTunnelWorldPosInto(_fwd, tunnel, Math.max(tHead - 0.05, 0), size);
    out.tangent.subVectors(out.look, _fwd);
  }
  if (out.tangent.lengthSq() < 1e-6) out.tangent.set(0, 0, -1);
  else out.tangent.normalize();

  // ── Möbius roll ──────────────────────────────────────────────────────────
  // The band's cross-section rotates π across the traversal (see fillRibbon:
  // perpCurrent.applyAxisAngle(axis, t * PI)). Pinning the camera to world-up
  // meant the player watched that half-twist happen to the geometry instead of
  // having it happen to them, which throws away the one thing that makes this a
  // wormhole through RP2 rather than a pipe. Rolling the up-vector by the same
  // angle inverts the world by the time you reach the far tile — the
  // non-orientability, felt rather than observed.
  out.up.set(0, 1, 0);
  if (Math.abs(out.tangent.y) > 0.95) out.up.set(0, 0, 1);
  out.up.addScaledVector(out.tangent, -out.up.dot(out.tangent));
  if (out.up.lengthSq() < 1e-6) out.up.set(0, 0, 1);
  out.up.normalize().applyAxisAngle(out.tangent, tHead * Math.PI);

  const back = backForHead(tHead, size);
  out.cam
    .copy(out.look)
    .addScaledVector(out.tangent, -back)
    .addScaledVector(out.up, cameraUpForHead(tHead));
  out.look.addScaledVector(out.tangent, TUNNEL_LOOK_AHEAD);
  return out;
}

/** Allocate a reusable pose object for tunnelCamPoseInto. */
export const makeTunnelCamPose = () => ({
  cam: new THREE.Vector3(),
  look: new THREE.Vector3(),
  up: new THREE.Vector3(),
  tangent: new THREE.Vector3()
});
