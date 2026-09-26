import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { MENU_FLIP_PAIRS } from './menuCenterPortals.js';

// The actual rendered mouths, expressed in ShufflingCube space. Each correction
// includes the pad spring AND the sticker's tap-flip, without double-applying
// the menu cube's camera-facing rotation/scale.
export function createMenuPortalFrames() {
  return MENU_FLIP_PAIRS.flat().map(face => {
    const base = new Matrix4().compose(new Vector3(...face.pos),
      new Quaternion().setFromEuler(new Euler(...face.rot)), new Vector3(1, 1, 1));
    return { dir: face.dir, node: null, active: false, base,
      inverseBase: base.clone().invert(), matrix: base.clone(), correction: new Matrix4() };
  });
}

const inverseRoot = new Matrix4();
export function updateMenuPortalFrames(root, frames) {
  root.updateWorldMatrix(true, false);
  inverseRoot.copy(root.matrixWorld).invert();
  for (const frame of frames) {
    frame.active = !!frame.node;
    if (!frame.node) continue;
    frame.node.updateWorldMatrix(true, false);
    frame.matrix.multiplyMatrices(inverseRoot, frame.node.matrixWorld);
    frame.correction.multiplyMatrices(frame.matrix, frame.inverseBase);
  }
}

const local = new Vector3(), moved = new Vector3(), original = new Vector3();
const ease = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Follow the whole raised tile, then slope back to the ordinary cube surface
// outside its edge. Deep inside the cube the original antipodal trail stays put.
// At the mouth the weight is exactly one, so it can never target the old slot.
export function deformMenuWormPoint(position, frames, normal = null) {
  original.copy(position);
  for (const frame of frames) {
    if (!frame.active) continue;
    local.copy(original).applyMatrix4(frame.inverseBase);
    const radial = Math.max(Math.abs(local.x), Math.abs(local.y));
    const weight = (1 - ease(0.6, 1.12, radial)) * ease(-0.72, -0.18, local.z);
    if (weight <= 0) continue;
    moved.copy(original).applyMatrix4(frame.correction).sub(original);
    position.addScaledVector(moved, weight);
    if (normal) {
      moved.copy(normal).transformDirection(frame.correction);
      normal.lerp(moved, weight).normalize();
    }
  }
  return position;
}

// Re-measure the deformed trail once per worm/frame so body spacing stays
// physical: lifting a portal must not stretch adjacent body beads apart.
// Every fourth source point keeps the curve smooth with ~440 reusable samples.
export function createRaisedMenuTrail(path) {
  const indices = [];
  for (let i = 0; i < path.points.length; i += 4) indices.push(i);
  if (indices.at(-1) !== path.points.length - 1) indices.push(path.points.length - 1);
  return {
    indices, sourceLengths: indices.map(i => path.lengths[i]),
    points: indices.map(i => path.points[i].clone()),
    normals: indices.map(i => path.normals[i].clone()),
    lengths: indices.map(i => path.lengths[i]), length: path.length,
    up: path.up.clone()
  };
}

export function updateRaisedMenuTrail(path, trail, frames, antipodal = false) {
  let length = 0;
  trail.up.copy(path.up).multiplyScalar(antipodal ? -1 : 1);
  for (let i = 0; i < trail.indices.length; i++) {
    const source = trail.indices[i], p = trail.points[i], n = trail.normals[i];
    p.copy(path.points[source]); n.copy(path.normals[source]);
    if (antipodal) { p.negate(); n.negate(); }
    deformMenuWormPoint(p, frames, n);
    if (i) length += p.distanceTo(trail.points[i - 1]);
    trail.lengths[i] = length;
  }
  trail.length = length;
}

// Keep the head's progress attached to the same part of the moving surface;
// following segments are then spaced along the measured, deformed trail.
export function raisedMenuDistance(trail, distance) {
  const source = trail.sourceLengths;
  if (distance < 0) return distance;
  if (distance >= source.at(-1)) return trail.length + distance - source.at(-1);
  let lo = 0, hi = source.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (source[mid] <= distance) lo = mid; else hi = mid;
  }
  const span = source[hi] - source[lo];
  const t = span ? (distance - source[lo]) / span : 0;
  return trail.lengths[lo] + t * (trail.lengths[hi] - trail.lengths[lo]);
}
