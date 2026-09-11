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
import { buildTunnelPathForTunnel, getTunnelArcPosSmoothInto } from './wormLogic.js';
import { makeTunnelPath, tunnelPathTToArc, tunnelPathArcPointExtendedInto } from '../utils/tunnelPath.js';

// Offset from the centerline while riding.
//
// The worm's body occupies that centerline — it is strung along the exact route
// the camera trails down — so this offset is the only thing keeping the lens out
// of it. At 0.32 the nearest segment passed a fifth of a unit under the lens and
// filled a third of the frame, which reads as the camera being inside the worm
// rather than following it. It has to stay under the bore's radius, though, or
// the lens ends up outside the shaft looking back through its wall.
export const TUNNEL_CAM_UP = 0.42;

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
  // …and it eases back OUT again on the approach to the exit mouth, for the same
  // reason it is held off the entry one: the bore narrows to the width of a tile
  // there, and the shot of the worm bursting out wants to be straight up the exit
  // tile's axis rather than nudged off to one side of it.
  return TUNNEL_CAM_UP
    * THREE.MathUtils.smoothstep(tHead, 0.38, 0.52)
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
export const DIVE_HOLD = 0.18;

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
const _framePrev = new THREE.Vector3();
const _frameNext = new THREE.Vector3();
const _frameTurn = new THREE.Quaternion();

// Parallel-transport the entry frame around the bends. Re-selecting world-up
// from a tangent threshold caused a discontinuous roll on top/bottom tunnels.
function routeUpInto(out, path, arc, tangent, roll) {
  _framePrev.copy(path.nStart).negate();
  out.set(Math.abs(_framePrev.y) > 0.9 ? 1 : 0, Math.abs(_framePrev.y) > 0.9 ? 0 : 1, 0);
  out.addScaledVector(_framePrev, -out.dot(_framePrev)).normalize();
  for (let i = 0; i < path.legLen.length; i++) {
    if (path.legArc0[i] >= arc || path.legLen[i] < 1e-8) break;
    _frameNext.subVectors(path.legB[i], path.legA[i]).normalize();
    if (path.legArc0[i] + path.legLen[i] >= arc) break;
    out.applyQuaternion(_frameTurn.setFromUnitVectors(_framePrev, _frameNext));
    _framePrev.copy(_frameNext);
  }
  out.applyQuaternion(_frameTurn.setFromUnitVectors(_framePrev, tangent));
  return out.normalize().applyAxisAngle(tangent, roll);
}

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

  cameraArcPointInto(out.cam, _camPath, camArc);

  // Direction of travel AT THE CAMERA, not at the head: it is what the camera's
  // own up-vector and look-ahead are built from, and while the head is already
  // round the bend the camera is still coming down the throat.
  cameraArcPointInto(_fwd, _camPath, camArc + TANGENT_EPS);
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
  routeUpInto(out.up, _camPath, camArc, out.tangent, tHead * Math.PI);

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
  out.look.set(0, 0, -LOOK_AHEAD_ARC).applyQuaternion(_poseA).add(out.cam);
  return out;
}

const _exitRail = makeTunnelCamPose();
const _exitOutside = makeTunnelCamPose();
const _exitSideRail = new THREE.Vector3();
const _entryRide = makeTunnelCamPose();
const _entryLateral = new THREE.Vector3();

/** Dive along route distance, so corner-tile tunnels use their own opening too. */
export function tunnelEntryPoseInto(out, tunnel, progress, size, from) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const tHead = p * ENTER_END_T;
  tunnelCamPoseInto(_entryRide, tunnel, tHead, size);
  const blend = diveProgress(p);
  blendTunnelPosesInto(out, from, _entryRide, blend);
  _entryLateral.subVectors(from.cam, _camPath.vStart);
  const height = _entryLateral.dot(_camPath.nStart);
  _entryLateral.addScaledVector(_camPath.nStart, -height);
  const arc = THREE.MathUtils.lerp(-height,
    tunnelPathTToArc(_camPath, tHead) - backForHead(tHead, size), blend);
  _poseDir.subVectors(out.look, out.cam);
  cameraArcPointInto(out.cam, _camPath, arc);
  out.cam.addScaledVector(_entryLateral, diveEase(-arc / Math.max(0.1, height * 0.5)));
  out.look.copy(out.cam).add(_poseDir);
  return out;
}

/** One exit shot shared by exiting's endpoint and windout's starting pose. */
export function tunnelExitPoseInto(out, tunnel, progress, size) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const tHead = 0.67 + p * 0.33;
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
  const arc = THREE.MathUtils.lerp(tunnelPathTToArc(_camPath, tHead) - backForHead(tHead, size),
    _camPath.total + outsideDistance, blend);
  const sideBlend = diveEase((arc - _camPath.total - 0.35) / (outsideDistance - 0.35));
  _poseDir.subVectors(out.look, out.cam);
  cameraArcPointInto(out.cam, _camPath, arc);
  out.cam.addScaledVector(_exitRail.up, cameraUpForHead(tHead) * (1 - blend))
    .addScaledVector(_exitSideRail, (1.2 + size * 0.22) * sideBlend);
  out.look.copy(out.cam).add(_poseDir);
  return out;
}
