import { makeTunnelRideFrame, tunnelCameraFrameInto } from '../utils/tunnelRide.js';
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
import { coreZoomBoundsInto } from '../3d/antipodalCore.js';
import { buildTunnelPathForTunnel, getTunnelArcPosSmoothInto } from './wormLogic.js';
import { makeTunnelPath, tunnelDockWidth, tunnelPathTToArc, tunnelPathArcPointExtendedInto,
  ARM_A_END, tunnelTraversalT } from '../utils/tunnelPath.js';

// Offset from the centerline while riding.
//
// Lift above the worm in the open arms. cameraRideHeight eases this to zero
// through the outer mouths and the core: those cutouts follow the rider's
// centerline, and an elevated camera would pass through their solid walls.
// The worm renderer already fades body segments that get too close to the lens.
export const TUNNEL_CAM_UP = 0.62;
// The default 0.1 near plane cuts away the rim of the small core openings.
export const TUNNEL_CAM_NEAR = 0.002;

// Meet the mouth up close instead of pulling back to a whole-cube overview.
// This is an offset FROM the entry tile, not a distance from the cube center.
export const portalDist = (size) => 0.6 + size * 0.02;
export const portalUp = (size) => 1.3 + size * 0.32;

// A raised landing's shot while the worm coils on its pad: high enough to hold
// the whole coil, a little behind the landing heading, and with that heading as
// screen-up so the pitch down from the chase needs no roll.
const WINDUP_CAM_LIFT = 0.45;
const WINDUP_CAM_BACK = 0.5;
export function windupPoseInto(out, mouth, normal, heading, size) {
  out.cam.copy(mouth).addScaledVector(normal, portalDist(size) + WINDUP_CAM_LIFT).addScaledVector(heading, -WINDUP_CAM_BACK);
  out.look.copy(mouth);
  out.up.copy(heading);
  return out;
}

// Handoff at the actual core dock, shared with the simulation and effects.
export const ENTER_END_T = ARM_A_END;

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
 * Rise above the band after entering the outer shell. The actual pose also
 * checks shell/core clearance so both circular apertures remain centered.
 */
export function cameraUpForHead(tHead) {
  // Return to the centerline before the exit mouth.
  return TUNNEL_CAM_UP
    * THREE.MathUtils.smoothstep(tHead, 0.04, 0.16)
    * (1 - THREE.MathUtils.smoothstep(tHead, 0.80, 0.95));
}

/**
 * Quintic ease for the dive: zero first and second derivatives at each end.
 * The moving rail target supplies the velocity at handoff, without the old
 * cubic acceleration spike.
 */
export const diveEase = (p) => {
  const c = p < 0 ? 0 : p > 1 ? 1 : p;
  return c * c * c * (c * (c * 6 - 15) + 10);
};

/** Join the follow rail within the first 16% of the entry arm (under 0.6s). */
export const diveProgress = (tp) => diveEase(tp / 0.16);

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
 * mouth on the dive — the entry value cannot grow much beyond this, because the
 * head is only about a unit deep when 'entering' hands over to the ride and the
 * cube's solid body is hidden at that moment. A trail longer than that depth
 * leaves the lens outside a cube that has just stopped being drawn.
 *
 * The settled deep-ride value is where the shot has room to breathe, and 1.15 was
 * not enough of it: the head sat close enough to fill the frame with its own back.
 * The growth to it is spread over tHead 0.42→0.95 so that it is always slower
 * than the head's own advance along the path — ramp it faster and the camera
 * drifts backwards out of the tunnel while the worm pulls away from it.
 */
export function backForHead(tHead, size) {
  const deep = THREE.MathUtils.smoothstep(tHead, 0.42, 0.95);
  return THREE.MathUtils.lerp(0.62 + size * 0.1, 1.45 + size * 0.1, deep);
}

const _fwd = new THREE.Vector3();
const _camPath = makeTunnelPath();
const _coreBounds = new THREE.Box3();
const _headPoint = new THREE.Vector3();

// Leave room for the worm's twist and the mirrors. Keep the increased trail
// on the same curve so pulling back cannot cut across either core aperture.
// Growing the trail by at most 40% of distance travelled prevents a backward
// camera move while the worm regains its full width on the outward arm.
export function cameraArcForHead(path, tHead, size) {
  const headArc = tunnelPathTToArc(path, tHead);
  tunnelPathArcPointExtendedInto(_headPoint, path, headArc);
  const close = Math.max(.9, tunnelDockWidth(size) * 6) + _headPoint.length() * .4;
  const follow = 1 - THREE.MathUtils.smoothstep(path.armALen - headArc, .12, .9);
  const trail = THREE.MathUtils.lerp(backForHead(tHead, size), Math.min(backForHead(tHead, size), close), follow);
  // Follow closely through the outer mouth, then let the head pull away to the
  // wider mirror-room framing. A full trailing distance at the first frame
  // keeps the lens outside until the head is already deep in the entry arm.
  return headArc - Math.min(trail, 0.18 + headArc * 0.5);
}

function cameraRideHeight(point, arc, tHead, size) {
  const mouthClearance = THREE.MathUtils.smoothstep(Math.min(arc, _camPath.total - arc), 0.1, 0.55);
  // Follow the exact carved centerline through BOTH core holes. Ease out of the
  // elevated chase view before reaching any position the zoomed core can occupy.
  // Using its complete zoom envelope avoids a frame of clipping when VoidCore
  // grows after the camera update, and keeps the shot still as the zoom recedes.
  const coreClearance = THREE.MathUtils.smoothstep(_coreBounds.distanceToPoint(point), 0.2, 1);
  const insideShell = THREE.MathUtils.smoothstep(size / 2 + .03 - Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)), .1, .6);
  return cameraUpForHead(tHead) * mouthClearance * coreClearance * insideShell;
}

const _cameraLift = new THREE.Vector3();
function cameraLiftInto(out, up, tHead) {
  // During entry, raising the view must not push it back toward the mouth as
  // the transported frame bends. Release that constraint beyond the entry arm.
  return out.copy(up).addScaledVector(_camPath.nStart,
    -up.dot(_camPath.nStart) * (1 - THREE.MathUtils.smoothstep(tHead, ARM_A_END, ARM_A_END + .08)));
}

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

function cameraArcPointInto(out, path, arc) {
  return arc < 0 || arc > path.total
    ? tunnelPathArcPointExtendedInto(out, path, arc)
    : getTunnelArcPosSmoothInto(out, path, arc);
}

const _lead = new THREE.Vector3();
const _rideFrame = makeTunnelRideFrame();

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
  coreZoomBoundsInto(_coreBounds, _camPath.midA, size);
  const camArc = cameraArcForHead(_camPath, tHead, size);

  cameraArcPointInto(out.cam, _camPath, camArc);

  // Direction of travel AT THE CAMERA, not at the head: it is what the camera's
  // own up-vector and look-ahead are built from, and while the head is already
  // round the bend the camera is still coming down the throat.
  cameraArcPointInto(_fwd, _camPath, camArc + TANGENT_EPS);
  out.tangent.subVectors(_fwd, out.cam);
  if (out.tangent.lengthSq() < 1e-12) out.tangent.copy(_camPath.nStart).negate();
  out.tangent.normalize();

  // Keep the gentle banking while the lens goes through the core openings.
  tunnelCameraFrameInto(_rideFrame, _camPath, camArc);
  out.up.copy(_rideFrame.normal);
  if (camArc >= 0 && camArc <= _camPath.total) out.tangent.copy(_rideFrame.tangent);

  // Aim: mostly straight down the direction of travel, leaned toward where the
  // route goes next. Aiming *only* at the route point ahead swings the shot into a
  // corner well before reaching it (the core bend can be a right angle); aiming
  // only along the tangent stares at the wall beside that corner. The blend leans
  // in the way a headlight does, and on a straight run the two agree exactly, so
  // nothing is disturbed on the tunnels that do not bend.
  //
  // Establish the forward lead before adding the elevated riding view below.
  tunnelPathArcPointExtendedInto(_lead, _camPath, camArc + LOOK_AHEAD_ARC);
  _lead.sub(out.cam);
  if (_lead.lengthSq() < 1e-12) _lead.copy(out.tangent);
  else _lead.normalize();
  out.look.copy(out.tangent).multiplyScalar(LEAD_TANGENT_MIX)
    .addScaledVector(_lead, 1 - LEAD_TANGENT_MIX)
    .normalize()
    .multiplyScalar(LOOK_AHEAD_ARC);

  // Clear the worm's back once inside, then look slightly down at the track.
  // A parallel raised aim left the core and worm at the bottom of a phone view.
  const rideHeight = cameraRideHeight(out.cam, camArc, tHead, size);
  cameraLiftInto(_cameraLift, out.up, tHead);
  out.cam.addScaledVector(_cameraLift, rideHeight);
  out.look.add(out.cam).addScaledVector(_cameraLift, -rideHeight * 0.75);
  // From the farther, elevated approach keep looking down the track. Lock to
  // the head once the lens has lowered onto the route through the core holes.
  const followHead = (1 - THREE.MathUtils.smoothstep(_coreBounds.distanceToPoint(_headPoint), 0, .5))
    * (1 - THREE.MathUtils.smoothstep(rideHeight, 0, .15));
  out.look.lerp(_headPoint, followHead);
  return out;
}

/** Allocate a reusable pose object for tunnelCamPoseInto. */
export const makeTunnelCamPose = () => ({
  cam: new THREE.Vector3(),
  look: new THREE.Vector3(),
  up: new THREE.Vector3(),
  tangent: new THREE.Vector3()
});

const _poseMatrix = new THREE.Matrix4();
const _poseA = new THREE.Quaternion();
const _poseB = new THREE.Quaternion();
const _poseDir = new THREE.Vector3();
const _poseUp = new THREE.Vector3();
function poseQuaternionInto(out, pose) {
  _poseDir.subVectors(pose.look, pose.cam).normalize();
  _poseUp.copy(pose.up).addScaledVector(_poseDir, -pose.up.dot(_poseDir));
  if (_poseUp.lengthSq() < 1e-8) {
    _poseUp.set(Math.abs(_poseDir.y) > 0.9 ? 1 : 0, Math.abs(_poseDir.y) > 0.9 ? 0 : 1, 0);
    _poseUp.addScaledVector(_poseDir, -_poseUp.dot(_poseDir));
  }
  return out.setFromRotationMatrix(_poseMatrix.lookAt(pose.cam, pose.look, _poseUp.normalize()));
}

/** Blend full rotations; opposing look/up vectors never pass through zero. */
export function blendTunnelPosesInto(out, from, to, t) {
  poseQuaternionInto(_poseA, from);
  poseQuaternionInto(_poseB, to);
  _poseA.slerp(_poseB, t);
  out.cam.lerpVectors(from.cam, to.cam, t);
  out.up.set(0, 1, 0).applyQuaternion(_poseA);
  out.look.set(0, 0, -THREE.MathUtils.lerp(from.cam.distanceTo(from.look), to.cam.distanceTo(to.look), t))
    .applyQuaternion(_poseA).add(out.cam);
  return out;
}

const _exitRail = makeTunnelCamPose();
const _exitOutside = makeTunnelCamPose();
const _exitSideRail = new THREE.Vector3();
const _entryRide = makeTunnelCamPose();
const _entryStart = makeTunnelCamPose();
const _entryRideUp = new THREE.Vector3();
const _entryLateral = new THREE.Vector3();
const _rollAxis = new THREE.Vector3();
const _rollA = new THREE.Vector3();
const _rollB = new THREE.Vector3();
const _rollC = new THREE.Vector3();

/**
 * Signed turn about `to`'s view axis that carries its screen-up onto `from`'s.
 * Opposite ups have no preferred side, so that case always turns the same way
 * and the sign cannot flicker from frame to frame.
 */
function rollBetween(from, to) {
  _rollAxis.subVectors(to.look, to.cam).normalize();
  _rollA.copy(from.up).addScaledVector(_rollAxis, -from.up.dot(_rollAxis));
  _rollB.copy(to.up).addScaledVector(_rollAxis, -to.up.dot(_rollAxis));
  if (_rollA.lengthSq() < 1e-8 || _rollB.lengthSq() < 1e-8) return 0;
  _rollA.normalize(); _rollB.normalize();
  const angle = Math.atan2(_rollAxis.dot(_rollC.crossVectors(_rollB, _rollA)), _rollB.dot(_rollA));
  return Math.abs(angle) > Math.PI - 1e-3 ? Math.PI : angle;
}

// The band's screen-up can differ from the approach's by up to a half turn.
// The dive keeps the approach's up and the lens rolls onto the band over the
// rest of the entry arm, inside the tunnel, instead of spinning at the mouth.
const ENTRY_ROLL_START = 0.12;

/** Dive along route distance, so corner-tile tunnels use their own opening too. */
export function tunnelEntryPoseInto(out, tunnel, progress, size, from) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const tHead = tunnelTraversalT('entering', p);
  tunnelCamPoseInto(_entryStart, tunnel, tunnelTraversalT('entering', 0), size);
  const settle = rollBetween(from, _entryStart);
  tunnelCamPoseInto(_entryRide, tunnel, tHead, size);
  _entryRideUp.copy(_entryRide.up);
  const remaining = settle * (1 - THREE.MathUtils.smoothstep(p, ENTRY_ROLL_START, 1));
  if (remaining) _entryRide.up.applyAxisAngle(_rollAxis.subVectors(_entryRide.look, _entryRide.cam).normalize(), remaining);
  const blend = diveProgress(p);
  blendTunnelPosesInto(out, from, _entryRide, blend);
  _entryLateral.subVectors(from.cam, _camPath.vStart);
  const height = _entryLateral.dot(_camPath.nStart);
  _entryLateral.addScaledVector(_camPath.nStart, -height);
  const arc = THREE.MathUtils.lerp(-height,
    cameraArcForHead(_camPath, tHead, size), blend);
  _poseDir.subVectors(out.look, out.cam);
  cameraArcPointInto(out.cam, _camPath, arc);
  // Centre on the mouth over the whole descent, so an offset approach (the
  // raised pad's shot sits behind the heading) never slides in at the last moment.
  out.cam.addScaledVector(_entryLateral, diveEase(-arc / Math.max(0.1, height)));
  out.cam.addScaledVector(cameraLiftInto(_cameraLift, _entryRideUp, tHead), cameraRideHeight(out.cam, arc, tHead, size) * blend);
  out.look.copy(out.cam).add(_poseDir);
  return out;
}

/** One exit shot shared by exiting's endpoint and windout's starting pose. */
export function tunnelExitPoseInto(out, tunnel, progress, size) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const tHead = tunnelTraversalT('exiting', p);
  tunnelCamPoseInto(_exitRail, tunnel, tHead, size);
  const blend = diveEase((p - 0.50) / 0.50);
  _exitSideRail.set(0, 1, 0).cross(_camPath.nEnd);
  if (_exitSideRail.lengthSq() < 1e-8) _exitSideRail.set(1, 0, 0);
  _exitSideRail.normalize();
  const outsideDistance = 1.7 + size * 0.34;
  _exitOutside.cam.copy(_camPath.vEnd).addScaledVector(_camPath.nEnd, outsideDistance)
    .addScaledVector(_exitSideRail, 1.2 + size * 0.22);
  _exitOutside.look.copy(_camPath.vEnd);
  _exitOutside.up.copy(_camPath.nEnd);
  blendTunnelPosesInto(out, _exitRail, _exitOutside, blend);

  // Move along the actual route until the lens clears the mouth. Only then
  // introduce the side offset; a straight chord cuts through neighbouring tiles.
  const arc = THREE.MathUtils.lerp(cameraArcForHead(_camPath, tHead, size),
    _camPath.total + outsideDistance, blend);
  const sideBlend = diveEase((arc - _camPath.total - 0.35) / (outsideDistance - 0.35));
  _poseDir.subVectors(out.look, out.cam);
  cameraArcPointInto(out.cam, _camPath, arc);
  // The exit blend changes the LENS arc. Apply core clearance at that actual
  // position too: on small boards the head exits while the camera is in the core.
  out.cam.addScaledVector(_exitRail.up, cameraRideHeight(out.cam, arc, tHead, size) * (1 - blend))
    .addScaledVector(_exitSideRail, (1.2 + size * 0.22) * sideBlend);
  out.look.copy(out.cam).add(_poseDir);
  return out;
}
