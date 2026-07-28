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
import { buildTunnelPathForTunnel } from './wormLogic.js';
import { makeTunnelPath, tunnelPathTToArc, tunnelPathArcPointExtendedInto } from '../utils/tunnelPath.js';

// Offset from the centerline. Deliberately small: it rotates with the Möbius roll,
// so a large one walks the camera around the bore and pins it against one wall
// instead of leaving the shaft symmetric around the view.
export const TUNNEL_CAM_UP = 0.32;

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

const _axisDelta = new THREE.Vector3();

/**
 * Project a world-space point onto the face-normal line through a sticker's
 * physical centre. This is intentionally tile-based rather than tunnel-based:
 * render smoothing may leave a camera pose carrying lateral error from the
 * previous chase shot even when the tunnel centerline itself is correct.
 */
export function projectToTileCenterAxisInto(out, point, tileCenter, faceNormal) {
  _axisDelta.subVectors(point, tileCenter);
  return out.copy(tileCenter).addScaledVector(faceNormal, _axisDelta.dot(faceNormal));
}

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
 * Fraction of the 'entering' phase spent held on the exterior framing before the
 * dive begins at all.
 *
 * The suck-in is the beat the hold exists for: the head is already through the
 * aperture from the first frame of the phase, and the body streams in behind it
 * over the whole of it. A camera that leaves immediately takes the tail — which is
 * still out on the surface, BEHIND the lens — off screen before any of that
 * happens, so the worm merely stopped existing. Held here, the player watches the
 * body drain into the hole from outside, and only then falls in after it.
 */
export const DIVE_HOLD = 0.34;

/** Dive progress (0→1) for a given 'entering' phase progress, including the hold. */
export const diveProgress = (tp) => diveEase((tp - DIVE_HOLD) / (1 - DIVE_HOLD));

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
const _camPath = makeTunnelPath();

// How far apart the two samples used to differentiate the route are, in world
// units. Small enough to read as the local direction of travel, large enough not
// to be swamped by float noise at the throat/diagonal corner.
const TANGENT_EPS = 0.05;

// How far ahead of the LENS the aim point sits, in world units along the route.
// The head is backForHead() ahead of the lens (0.8–1.2 across the supported cube
// sizes), so this lands just past it — the worm stays in frame with the route it
// is about to take opening up beyond it.
const LOOK_AHEAD_ARC = 1.6;

// How much of the aim direction comes from the local direction of travel versus
// from where the route runs LOOK_AHEAD_ARC further on. Keeping the tangent in the
// majority bounds how far the shot can swing at the core's right-angle bend.
const LEAD_TANGENT_MIX = 0.62;

const _lead = new THREE.Vector3();

/**
 * Write the on-rails camera pose at `tHead` into `out`.
 *
 * The lens rides the route itself: it sits a fixed distance BEHIND the head
 * measured along the centerline — through the throat, round the bend, out the far
 * mouth — rather than a fixed distance back along the head's current tangent. The
 * distinction is the whole ballgame at the aperture. A tangent-trailing camera
 * leaves the tile's axis the instant the path bends and crosses the cube's surface
 * through whichever tile happens to be over there; a route-trailing one goes where
 * the head went, which is down the middle of the hole.
 *
 * @param {{cam: THREE.Vector3, look: THREE.Vector3, up: THREE.Vector3, tangent: THREE.Vector3}} out
 * @param {Object} tunnel  active tunnel descriptor (entry/exit tiles)
 * @param {number} tHead   0→1 position of the worm's head along the traversal
 * @param {number} size    cube size
 * @returns {typeof out}
 */
export function tunnelCamPoseInto(out, tunnel, tHead, size) {
  buildTunnelPathForTunnel(_camPath, tunnel, size);
  const headArc = tunnelPathTToArc(_camPath, tHead);
  const camArc = headArc - backForHead(tHead, size);

  tunnelPathArcPointExtendedInto(out.cam, _camPath, camArc);

  // Direction of travel AT THE CAMERA, not at the head: it is what the camera's
  // own up-vector and look-ahead are built from, and while the head is already
  // round the bend the camera is still coming down the throat.
  tunnelPathArcPointExtendedInto(_fwd, _camPath, camArc + TANGENT_EPS);
  out.tangent.subVectors(_fwd, out.cam);
  if (out.tangent.lengthSq() < 1e-12) out.tangent.copy(_camPath.nStart).negate();
  out.tangent.normalize();

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

  // Aim: mostly straight down the direction of travel, leaned toward where the
  // route goes next. Aiming *only* at the route point ahead swings the shot into a
  // corner well before reaching it (the core bend can be a right angle); aiming
  // only along the tangent stares at the wall beside that corner. The blend leans
  // in the way a headlight does, and on a straight run the two agree exactly, so
  // nothing is disturbed on the tunnels that do not bend.
  //
  // Measured from the camera's position ON the route, before the riding height is
  // applied below — so the offset lens looks parallel down the shaft rather than
  // converging back onto the centerline.
  tunnelPathArcPointExtendedInto(_lead, _camPath, camArc + LOOK_AHEAD_ARC);
  _lead.sub(out.cam);
  if (_lead.lengthSq() < 1e-12) _lead.copy(out.tangent);
  else _lead.normalize();
  out.look.copy(out.tangent).multiplyScalar(LEAD_TANGENT_MIX)
    .addScaledVector(_lead, 1 - LEAD_TANGENT_MIX)
    .normalize()
    .multiplyScalar(LOOK_AHEAD_ARC);

  // Riding height comes on only once the lens is well clear of the mouth — see
  // cameraUpForHead. Both the lens and its aim move together, so the shot keeps
  // pointing down the tunnel instead of tipping toward the centerline.
  out.cam.addScaledVector(out.up, cameraUpForHead(tHead));
  out.look.add(out.cam);
  return out;
}

/** Allocate a reusable pose object for tunnelCamPoseInto. */
export const makeTunnelCamPose = () => ({
  cam: new THREE.Vector3(),
  look: new THREE.Vector3(),
  up: new THREE.Vector3(),
  tangent: new THREE.Vector3()
});
