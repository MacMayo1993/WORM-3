// Render-only clearance against the cube's current solid slices. Gameplay paths
// and collision rules stay authoritative; character motion cannot push beads
// into a tile. Contiguous stationary planes share one box, so work scales with
// the number of turning planes, not the number of cubies.
import * as THREE from 'three';
const AXES = ['x', 'y', 'z'];

export function createBodySurface() {
  return { boxes: [], count: 0, point: new THREE.Vector3(), direction: new THREE.Vector3(), axis: new THREE.Vector3() };
}

export function updateBodySurface(surface, size, rotation) {
  const axis = rotation.active ? ({ col: 'x', row: 'y', depth: 'z' }[rotation.axis] || 'y') : 'y';
  surface.axis.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  let count = 0;
  let start = 0;
  const angleAt = i => {
    if (!rotation.active) return 0;
    const index = rotation.sliceIndices.indexOf(i);
    return index < 0 ? 0 : rotation.angles[index];
  };
  while (start < size) {
    const angle = angleAt(start);
    let end = start + 1;
    while (end < size && angleAt(end) === angle) end++;
    let box = surface.boxes[count];
    if (!box) {
      box = { center: new THREE.Vector3(), half: new THREE.Vector3(), inverse: new THREE.Quaternion(), enter: 0, exit: 0 };
      surface.boxes[count] = box;
    }
    box.center.set(0, 0, 0);
    box.center[axis] = (start + end - size) * 0.5;
    box.half.setScalar(size * 0.5);
    box.half[axis] = (end - start) * 0.5;
    box.inverse.setFromAxisAngle(surface.axis, -angle);
    count++;
    start = end;
  }
  surface.count = count;
  return surface;
}

/** Move outward along the local surface normal only if a bead overlaps a slab.
 * Inflating the boxes by radius conservatively includes their rounded corners.
 * Ray intervals are joined before pushing, so exiting one slab cannot put a bead
 * inside a differently rotating neighbour. All scratch is reused per frame.
 */
export function clearBodySurfaceInto(position, normal, radius, surface) {
  const { point, direction, boxes, count } = surface;
  for (let i = 0; i < count; i++) {
    const box = boxes[i];
    point.copy(position).applyQuaternion(box.inverse).sub(box.center);
    direction.copy(normal).applyQuaternion(box.inverse);
    let enter = -Infinity;
    let exit = Infinity;
    for (const axis of AXES) {
      const h = box.half[axis] + radius;
      const d = direction[axis];
      const p = point[axis];
      if (Math.abs(d) < 1e-8) {
        if (Math.abs(p) >= h) { exit = -Infinity; break; }
      } else {
        const a = (-h - p) / d;
        const b = (h - p) / d;
        enter = Math.max(enter, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
    }
    box.enter = enter;
    box.exit = exit;
  }
  let distance = 0;
  for (let pass = 0; pass <= count; pass++) {
    let next = distance;
    for (let i = 0; i < count; i++) {
      const box = boxes[i];
      if (box.enter <= distance && box.exit > distance && Number.isFinite(box.exit)) next = Math.max(next, box.exit + 0.0001);
    }
    if (next === distance) break;
    distance = next;
  }
  return position.addScaledVector(normal, distance);
}

/** Transform each endpoint normal BEFORE interpolation, just like its position. */
export function blendBodyNormalInto(out, a, b, t, axis, angleA, angleB, scratchA, scratchB) {
  scratchA.copy(a);
  scratchB.copy(b);
  if (angleA !== null) scratchA.applyAxisAngle(axis, angleA);
  if (angleB !== null) scratchB.applyAxisAngle(axis, angleB);
  out.lerpVectors(scratchA, scratchB, t);
  if (out.lengthSq() < 1e-8) out.copy(t < 0.5 ? scratchA : scratchB);
  return out.normalize();
}

/** Body's local -Z follows travel; all scratch vectors are caller-owned. */
export function bodyFrameInto(matrix, forward, normal, x, y, z) {
  z.copy(forward).negate();
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1);
  z.normalize();
  x.crossVectors(normal, z);
  if (x.lengthSq() < 1e-8) {
    // The normal is parallel to travel inside an axial throat. Perturbing z.x
    // leaves an X-axis tangent parallel and produces a singular matrix. Pick
    // a perpendicular reference without changing the actual travel direction.
    y.set(Math.abs(z.y) < 0.9 ? 0 : 1, Math.abs(z.y) < 0.9 ? 1 : 0, 0);
    x.crossVectors(y, z);
  }
  x.normalize();
  y.crossVectors(z, x);
  return matrix.makeBasis(x, y, z);
}
