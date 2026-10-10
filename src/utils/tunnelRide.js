import * as THREE from 'three';
import { tunnelPathArcPointInto, tunnelPathArcTangentInto, tunnelArmFractionAt, tunnelGaugeAt } from './tunnelPath.js';

// One swept surface for the track, recorded body and camera. The body centre
// follows the shared route; the floor is one bead radius underneath it,
// tapering to the centerline where the band seats on a core sticker.
export const TUNNEL_RIDE_CLEARANCE = 0.115;
// The worm's floor at its widest, where the ride leaves a tile: room for the
// body (a bead is TUNNEL_RIDE_CLEARANCE across its radius) and a little more.
export const TUNNEL_RIDE_WIDTH = 0.36;
// Arc length over which the floor rises from one bead radius below the route to
// the route itself at a core dock.
export const TUNNEL_RIDE_SEAT = 0.6;
// The aperture is already wider than this gauge. Pinching the floor to zero
// at the mouth left the first body beads hanging over an invisible track.
export const tunnelRideWidthAt = (path, arc, dockWidth, mouthWidth = TUNNEL_RIDE_WIDTH) =>
  tunnelGaugeAt(tunnelArmFractionAt(path, arc), mouthWidth, dockWidth);
const a = new THREE.Vector3(), b = new THREE.Vector3();
const prev = new THREE.Vector3(), next = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const clamp = (v, max) => Math.max(0, Math.min(max, v));

// Arc-length at the centre of the cube, where every crossing turns.
export const tunnelRideCoreArc = path => path.legArc0[3];

export function tunnelRideTwistAt(path, arc) {
  const core = tunnelRideCoreArc(path);
  // Complete the half-turn inside the solid center cube, leaving both exposed
  // arms untwisted. The body uses this exact frame, including reverse visits.
  const halfSpan = Math.max(1e-6, (path.legLen[2] + path.legLen[3]) * 0.35);
  return THREE.MathUtils.smoothstep(arc, core - halfSpan, core + halfSpan);
}

export function tunnelCameraTwistAt(path, arc) {
  const core = tunnelRideCoreArc(path);
  // The lens banks gradually around the junction instead of copying the
  // concealed, tight body turn and snapping through 180 degrees.
  const halfSpan = Math.max(1e-6, Math.min(core, path.total - core) * 0.8);
  return THREE.MathUtils.smoothstep(arc, core - halfSpan, core + halfSpan);
}

// The shared path is already C1 continuous, including the dock tangents.
// A separate corner filter would pull the ribbon away from the core sticker.
export const tunnelRidePointInto = tunnelPathArcPointInto;

export const makeTunnelRideFrame = () => ({
  center: new THREE.Vector3(), tangent: new THREE.Vector3(),
  normal: new THREE.Vector3(), right: new THREE.Vector3(), floor: new THREE.Vector3(),
});

// Canonical physical direction: revisiting a tunnel backwards must use the
// same side of its ribbon, including when the tail still occupies that ribbon.
function forwardPath(path) {
  for (const axis of ['x', 'y', 'z']) {
    const diff = path.vEnd[axis] - path.vStart[axis];
    if (Math.abs(diff) > 1e-8) return diff > 0;
  }
  return true;
}
const FRAME_STEPS = 256;
const tangentInto = tunnelPathArcTangentInto;
function rideFrames(path) {
  const legs = path.legA.length;
  let cache = path.rideFrames;
  let unchanged = !!cache;
  for (let i = 0; unchanged && i <= legs; i++) unchanged = (i < legs ? path.legA[i] : path.vEnd).equals(cache.controls[i]);
  if (unchanged) return cache;
  if (!cache) cache = path.rideFrames = {
    controls: Array.from({ length: legs + 1 }, () => new THREE.Vector3()),
    normals: Array.from({ length: FRAME_STEPS + 1 }, () => new THREE.Vector3()),
  };
  for (let i = 0; i <= legs; i++) cache.controls[i].copy(i < legs ? path.legA[i] : path.vEnd);
  cache.forward = forwardPath(path);
  const sign = cache.forward ? 1 : -1;
  for (let i = 0; i <= FRAME_STEPS; i++) {
    const u = i / FRAME_STEPS;
    tangentInto(next, path, (cache.forward ? u : 1 - u) * path.total).multiplyScalar(sign);
    const normal = cache.normals[i];
    if (i === 0) {
      normal.set(Math.abs(next.y) > 0.9 ? 1 : 0, Math.abs(next.y) > 0.9 ? 0 : 1, 0);
      normal.addScaledVector(next, -normal.dot(next)).normalize();
    } else normal.copy(cache.normals[i - 1]).applyQuaternion(rotation.setFromUnitVectors(prev, next)).normalize();
    prev.copy(next);
  }
  return cache;
}
export function tunnelRideFrameInto(out, path, arc, twist = tunnelRideTwistAt(path, arc)) {
  const s = clamp(arc, path.total);
  tunnelRidePointInto(out.center, path, s);
  const cache = rideFrames(path);
  tangentInto(out.tangent, path, s);
  const u = path.total > 0 ? (cache.forward ? s : path.total - s) / path.total : 0;
  const sample = u * FRAME_STEPS, index = Math.min(FRAME_STEPS - 1, Math.floor(sample));
  out.normal.lerpVectors(cache.normals[index], cache.normals[index + 1], sample - index);
  out.normal.addScaledVector(out.tangent, -out.normal.dot(out.tangent)).normalize();
  next.copy(out.tangent).multiplyScalar(cache.forward ? 1 : -1);
  // The half-turn crosses 90° at the core, even when the two arms differ in
  // length. This is also the color boundary of the strip and both rails.
  out.normal.applyAxisAngle(next, (cache.forward ? twist : 1 - twist) * Math.PI).normalize();
  out.right.crossVectors(out.tangent, out.normal).normalize();
  // Let the track grow out of the aperture without protruding over the tile.
  const mouth = THREE.MathUtils.smoothstep(Math.min(s, path.total - s), 0, 0.25);
  // Seat the ribbon on its actual core tile. A fixed bead-radius offset here
  // displaced small-board bands onto neighboring stickers (or off the cube).
  // The floor eases onto the centreline over a long stretch, so it is already
  // centred as it reaches the core's opening instead of swerving in at its rim.
  const dockDistance = Math.max(0, path.armALen - s, s - (path.total - path.armBLen));
  const seat = THREE.MathUtils.smoothstep(dockDistance, 0, TUNNEL_RIDE_SEAT);
  out.floor.copy(out.center).addScaledVector(out.normal, -TUNNEL_RIDE_CLEARANCE * mouth * seat);
  return out;
}

const cameraFrame = makeTunnelRideFrame();
// The tiny core can bend the body over centimetres even on a 15×15 board. The
// lens banks over a wider window while keeping the exact same centerline.
export function tunnelCameraFrameInto(out, path, arc) {
  const s = clamp(arc, path.total);
  const window = 0.4 * THREE.MathUtils.smoothstep(Math.min(s, path.total - s), 0, 0.6);
  out.normal.set(0, 0, 0); out.tangent.set(0, 0, 0);
  for (let i = -4; i <= 4; i++) {
    const sample = clamp(s + i * window / 4, path.total);
    tunnelRideFrameInto(cameraFrame, path, sample, tunnelCameraTwistAt(path, sample));
    out.normal.addScaledVector(cameraFrame.normal, 5 - Math.abs(i));
    out.tangent.addScaledVector(cameraFrame.tangent, 5 - Math.abs(i));
  }
  out.tangent.normalize();
  out.normal.addScaledVector(out.tangent, -out.normal.dot(out.tangent)).normalize();
  out.right.crossVectors(out.tangent, out.normal).normalize();
  return out;
}

const frame = makeTunnelRideFrame();
// Keep both docking cross-sections in the mesh even on large cubes, where the
// miniature occupies less than one uniform segment of the complete route.
export function tunnelRideSampleArc(path, index, segments) {
  const dockA = Math.max(1, Math.min(segments - 3, Math.round(path.armALen / path.total * segments)));
  const dockB = Math.max(dockA + 2, Math.min(segments - 1, Math.round((path.total - path.armBLen) / path.total * segments)));
  if (index <= dockA) return index / dockA * path.armALen;
  const endCore = path.total - path.armBLen;
  if (index <= dockB) return path.armALen + (index - dockA) / (dockB - dockA) * (endCore - path.armALen);
  return endCore + (index - dockB) / (segments - dockB) * path.armBLen;
}
// Writes the existing ribbon and bumper buffers; no new per-frame objects.
// The band is `mouthWidth` where it leaves each tile and narrows to `dockWidth`
// where it plugs into the core (see tunnelGaugeAt).
export function fillTunnelRideGeometry(geo, left, right, path, segments, mouthWidth = TUNNEL_RIDE_WIDTH, dockWidth = TUNNEL_RIDE_WIDTH) {
  for (let i = 0; i <= segments; i++) {
    const arc = tunnelRideSampleArc(path, i, segments), u = arc / (path.total || 1);
    tunnelRideFrameInto(frame, path, arc);
    const mouth = THREE.MathUtils.smoothstep(Math.min(arc, path.total - arc), 0, 0.3);
    const width = 0.5 * tunnelRideWidthAt(path, arc, dockWidth, mouthWidth);
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const vi = i * 2 + side;
      a.copy(frame.floor).addScaledVector(frame.right, sign * width);
      geo.attributes.position.setXYZ(vi, a.x, a.y, a.z);
      geo.attributes.uv.setXY(vi, side, u);
      geo.attributes.aDistance?.setX(vi, arc);
      const rail = side === 0 ? left : right;
      for (let h = 0; h < 2; h++) {
        const dockDistance = Math.max(0, path.armALen - arc, arc - (path.total - path.armBLen));
        const seat = THREE.MathUtils.smoothstep(dockDistance, 0, 0.2);
        b.copy(a).addScaledVector(frame.normal, h * 0.035 * mouth * seat);
        rail.attributes.position.setXYZ(i * 2 + h, b.x, b.y, b.z);
        rail.attributes.aHeightFrac.setX(i * 2 + h, h);
        rail.attributes.aTripFrac.setX(i * 2 + h, u);
        rail.attributes.aDistance?.setX(i * 2 + h, arc);
      }
    }
  }
}
