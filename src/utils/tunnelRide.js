import * as THREE from 'three';
import { tunnelPathArcPointInto } from './tunnelPath.js';

// One swept surface for the track, recorded body and camera. The body centre
// keeps its existing route; the floor is one bead radius underneath it.
export const TUNNEL_RIDE_CLEARANCE = 0.115;
export const TUNNEL_RIDE_WIDTH = 0.64;
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const prev = new THREE.Vector3(), next = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const clamp = (v, max) => Math.max(0, Math.min(max, v));

export const tunnelRideCoreArc = path => path.armALen + path.legLen[2] * 0.5;

export function tunnelRideTwistAt(path, arc) {
  const core = tunnelRideCoreArc(path);
  const halfSpan = Math.max(1e-6, Math.min(core, path.total - core) * 0.8);
  return THREE.MathUtils.smoothstep(arc, core - halfSpan, core + halfSpan);
}

export function tunnelRidePointInto(out, path, arc) {
  const edge = Math.min(arc, path.total - arc);
  const window = 0.34 * clamp(edge / 0.6, 1);
  tunnelPathArcPointInto(out, path, arc);
  if (window < 0.0001) return out;
  // Exact box-filter integral of a polyline. Unlike three discrete taps this
  // has a continuous tangent at a bend, so the worm and camera cannot snap.
  for (let i = 1; i < path.legLen.length; i++) {
    const distance = Math.abs(arc - path.legArc0[i]);
    if (distance >= window || path.legLen[i - 1] < 1e-8 || path.legLen[i] < 1e-8) continue;
    a.subVectors(path.legB[i - 1], path.legA[i - 1]).divideScalar(path.legLen[i - 1]);
    b.subVectors(path.legB[i], path.legA[i]).divideScalar(path.legLen[i]);
    c.subVectors(b, a);
    out.addScaledVector(c, (window - distance) ** 2 / (4 * window));
  }
  return out;
}

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
const ahead = new THREE.Vector3(), behind = new THREE.Vector3();
const FRAME_STEPS = 256;
function tangentInto(out, path, arc) {
  tunnelRidePointInto(ahead, path, Math.min(path.total, arc + 0.001));
  tunnelRidePointInto(behind, path, Math.max(0, arc - 0.001));
  out.subVectors(ahead, behind);
  if (out.lengthSq() < 1e-10) out.copy(path.nStart).negate();
  return out.normalize();
}
function rideFrames(path) {
  let cache = path.rideFrames;
  let unchanged = !!cache;
  for (let i = 0; unchanged && i < 6; i++) unchanged = (i < 5 ? path.legA[i] : path.vEnd).equals(cache.controls[i]);
  if (unchanged) return cache;
  if (!cache) cache = path.rideFrames = {
    controls: Array.from({ length: 6 }, () => new THREE.Vector3()),
    normals: Array.from({ length: FRAME_STEPS + 1 }, () => new THREE.Vector3()),
  };
  for (let i = 0; i < 6; i++) cache.controls[i].copy(i < 5 ? path.legA[i] : path.vEnd);
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
export function tunnelRideFrameInto(out, path, arc) {
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
  const twist = tunnelRideTwistAt(path, s);
  out.normal.applyAxisAngle(next, (cache.forward ? twist : 1 - twist) * Math.PI).normalize();
  out.right.crossVectors(out.tangent, out.normal).normalize();
  // Let the track grow out of the aperture without protruding over the tile.
  const mouth = THREE.MathUtils.smoothstep(Math.min(s, path.total - s), 0, 0.25);
  out.floor.copy(out.center).addScaledVector(out.normal, -TUNNEL_RIDE_CLEARANCE * mouth);
  return out;
}

const frame = makeTunnelRideFrame();
// Writes the existing ribbon and bumper buffers; no new per-frame objects.
export function fillTunnelRideGeometry(geo, left, right, path, segments) {
  for (let i = 0; i <= segments; i++) {
    const u = i / segments, arc = u * path.total;
    tunnelRideFrameInto(frame, path, arc);
    const mouth = THREE.MathUtils.smoothstep(Math.min(arc, path.total - arc), 0, 0.3);
    const core = THREE.MathUtils.smoothstep(frame.center.length(), 0.35, 0.9);
    const width = THREE.MathUtils.lerp(0.19, TUNNEL_RIDE_WIDTH * 0.5, core) * mouth;
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const vi = i * 2 + side;
      a.copy(frame.floor).addScaledVector(frame.right, sign * width);
      geo.attributes.position.setXYZ(vi, a.x, a.y, a.z);
      geo.attributes.uv.setXY(vi, side, u);
      const rail = side === 0 ? left : right;
      for (let h = 0; h < 2; h++) {
        b.copy(a).addScaledVector(frame.normal, h * 0.035 * mouth);
        rail.attributes.position.setXYZ(i * 2 + h, b.x, b.y, b.z);
        rail.attributes.aHeightFrac.setX(i * 2 + h, h);
        rail.attributes.aTripFrac.setX(i * 2 + h, u);
      }
    }
  }
}
