import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBodySurface, updateBodySurface, clearBodySurfaceInto, blendBodyNormalInto } from '../worm/healerWorm/bodySurface.js';
import {
  createBookParts, disposeBookParts, bookCoverAngles, bookCoverMatrixInto, bookScaleForRadius, bookVolumeScale, bookGroundLift,
  BOOK_PART, BOOK_BELLY, BOOK_MAX_ANGLE, BOOK_BANK_GAIN, BOOK_BREATH_RATE, BOOK_BREATH_PHASE, smoothTurn, turnSignalFromDirections
} from '../worm/wormBookFX.js';

const idle = { active: false, sliceIndices: [], angles: [] };
const axes = ['x', 'y', 'z'];

// Independent reference: sphere vs each real cubie's box, in that cubie's own
// current frame. The renderer uses aggregated slabs; this deliberately does not.
function nearestCubieDistance(point, size, rotation) {
  const axis = rotation.axis === 'col' ? new THREE.Vector3(1, 0, 0) : rotation.axis === 'row' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  let nearest = Infinity;
  const k = (size - 1) / 2;
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) {
    const plane = rotation.axis === 'col' ? x : rotation.axis === 'row' ? y : z;
    const index = rotation.active ? rotation.sliceIndices.indexOf(plane) : -1;
    const p = point.clone().applyAxisAngle(axis, index < 0 ? 0 : -rotation.angles[index]);
    const center = new THREE.Vector3(x - k, y - k, z - k);
    const box = new THREE.Box3(center.clone().addScalar(-0.5), center.clone().addScalar(0.5));
    nearest = Math.min(nearest, box.distanceToPoint(p));
  }
  return nearest;
}

describe('character surface clearance', () => {
  it('reproduces and clears a sidewinder bead cutting through a cube edge', () => {
    const surface = updateBodySurface(createBodySurface(), 3, idle);
    const p = new THREE.Vector3(1.48, 0, 1.48);
    const n = new THREE.Vector3(1, 0, 1).normalize();
    expect(nearestCubieDistance(p, 3, idle)).toBe(0);
    clearBodySurfaceInto(p, n, 0.1, surface);
    expect(nearestCubieDistance(p, 3, idle)).toBeGreaterThanOrEqual(0.1);
    expect(p.x).toBeCloseTo(p.z, 10);
  });

  it('keeps displaced beads outside cubies on all six faces and rotating axes', () => {
    for (const size of [3, 5]) for (const axis of ['col', 'row', 'depth']) {
      const rotation = { active: true, axis, sliceIndices: [0, size - 1], angles: [Math.PI / 4, -Math.PI / 3] };
      const surface = updateBodySurface(createBodySurface(), size, rotation);
      const rotationAxis = new THREE.Vector3(axis === 'col' ? 1 : 0, axis === 'row' ? 1 : 0, axis === 'depth' ? 1 : 0);
      for (const face of axes) for (const sign of [-1, 1]) for (const plane of [0, 1, size - 1]) {
        const n = new THREE.Vector3(); n[face] = sign;
        const p = n.clone().multiplyScalar(size / 2 + 0.08);
        const sliceAxis = axis === 'col' ? 'x' : axis === 'row' ? 'y' : 'z';
        if (sliceAxis !== face) p[sliceAxis] = plane - (size - 1) / 2;
        const actualPlane = Math.min(size - 1, Math.max(0, Math.round(p[sliceAxis] + (size - 1) / 2)));
        const index = rotation.sliceIndices.indexOf(actualPlane);
        const angle = index < 0 ? 0 : rotation.angles[index];
        p.applyAxisAngle(rotationAxis, angle); n.applyAxisAngle(rotationAxis, angle);
        const side = new THREE.Vector3(n.y, -n.x, n.z * 0.1).cross(n).normalize();
        p.addScaledVector(side, 0.26);
        clearBodySurfaceInto(p, n, 0.10, surface);
        expect(nearestCubieDistance(p, size, rotation)).toBeGreaterThanOrEqual(0.10 - 1e-6);
      }
    }
  });

  it('leaves airborne and already clear positions alone and reuses boxes', () => {
    const surface = updateBodySurface(createBodySurface(), 100, idle);
    const box = surface.boxes[0];
    const p = new THREE.Vector3(0, 52, 0);
    clearBodySurfaceInto(p, new THREE.Vector3(0, 1, 0), 0.1, surface);
    expect(p.y).toBe(52);
    updateBodySurface(surface, 100, idle);
    expect(surface.count).toBe(1);
    expect(surface.boxes[0]).toBe(box);
  });

  it('blends independently ridden normals and never returns a zero frame', () => {
    const out = new THREE.Vector3(), a = new THREE.Vector3(0, 0, 1), b = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3(1, 0, 0);
    blendBodyNormalInto(out, a, b, .25, axis, Math.PI / 2, null, new THREE.Vector3(), new THREE.Vector3());
    expect(out.distanceTo(new THREE.Vector3(0, -1, 0))).toBeLessThan(1e-7);
    blendBodyNormalInto(out, a, b, .5, axis, Math.PI / 2, null, new THREE.Vector3(), new THREE.Vector3());
    expect(out.length()).toBeCloseTo(1, 10);
    expect(a.toArray()).toEqual([0, 0, 1]);
    expect(b.toArray()).toEqual([0, 1, 0]);
  });
});

describe('bookworm geometry', () => {
  // Every vertex of a posed volume, in book units about the segment centre.
  const posedBook = (parts, angles) => {
    const points = [], v = new THREE.Vector3(), m = new THREE.Matrix4();
    const each = (geometry, matrix) => {
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) points.push(v.fromBufferAttribute(p, i).applyMatrix4(matrix).clone());
    };
    each(parts.spine, m.identity());
    each(parts.left, bookCoverMatrixInto(new THREE.Matrix4(), m.identity(), angles.left));
    each(parts.right, bookCoverMatrixInto(new THREE.Matrix4(), m.identity(), angles.right));
    return points;
  };

  it('builds a spine, mirrored boards and a page block from one binding', () => {
    const parts = createBookParts();
    for (const geometry of Object.values(parts)) {
      expect([...geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
      expect(geometry.attributes.bookPart.count).toBe(geometry.attributes.position.count);
    }
    const kinds = g => new Set(g.attributes.bookPart.array);
    expect([...kinds(parts.left)].sort()).toEqual([BOOK_PART.cover, BOOK_PART.board, BOOK_PART.paper].sort());
    expect(kinds(parts.spine)).toEqual(new Set([BOOK_PART.spine, BOOK_PART.gilt]));
    parts.left.computeBoundingBox(); parts.right.computeBoundingBox();
    expect(parts.left.boundingBox.min.x).toBeCloseTo(-parts.right.boundingBox.max.x, 6);
    expect(parts.left.boundingBox.max.x).toBeCloseTo(-parts.right.boundingBox.min.x, 6);
    disposeBookParts(parts);
  });

  it('rests on the bead belly it replaces and never reaches through it', () => {
    const parts = createBookParts();
    for (const turn of [-100, -1, 0, 0.4, 1, 100]) for (const time of [0, 0.3, 1.1, 2.7]) for (const index of [1, 2, 7]) {
      const points = posedBook(parts, bookCoverAngles(turn, time, index));
      const low = Math.min(...points.map(p => p.y)), high = Math.max(...points.map(p => p.y));
      expect(low).toBeGreaterThanOrEqual(-BOOK_BELLY - 1e-6);
      // Lower and wider than a bead: the spine ridge stays under the bead's crown.
      expect(high).toBeLessThan(BOOK_BELLY);
    }
    // The most drooped board just meets the belly, so the pages sit on the tile.
    const droop = posedBook(parts, { left: BOOK_MAX_ANGLE, right: -BOOK_MAX_ANGLE });
    expect(Math.min(...droop.map(p => p.y))).toBeCloseTo(-BOOK_BELLY, 6);
    disposeBookParts(parts);
  });

  it('grounds any size of volume and alternates sizes along the body', () => {
    const radius = 0.1;
    for (const index of [1, 2, 3, 4]) {
      const scale = bookScaleForRadius(radius) * bookVolumeScale(index);
      // Raised by the ground lift, the book's belly sits exactly `radius` below the centre.
      expect(bookGroundLift(scale, radius) - BOOK_BELLY * scale).toBeCloseTo(-radius, 10);
    }
    expect(bookVolumeScale(1)).not.toBe(bookVolumeScale(2));
    expect(bookVolumeScale(2)).toBe(bookVolumeScale(4));
  });

  it('keeps board banking bounded and smoothing independent of frame rate', () => {
    for (const turn of [-100, -1, 0, 1, 100]) for (const time of [0, 0.5, 1.7]) {
      const { left, right } = bookCoverAngles(turn, time, 3);
      // Pitched down on both sides, never flat and never past the droop limit.
      expect(left).toBeGreaterThan(0.4);
      expect(-right).toBeGreaterThan(0.4);
      expect(Math.max(left, -right)).toBeLessThanOrEqual(BOOK_MAX_ANGLE + 1e-9);
      // A turn tips the spread like a seesaw: both boards by the same bank.
      expect(left + right).toBeCloseTo(2 * Math.max(-1, Math.min(1, turn)) * BOOK_BANK_GAIN, 10);
    }
    // The breath is a wave running tailward: each volume takes the pose the
    // one ahead of it had a beat earlier.
    const beat = BOOK_BREATH_PHASE / BOOK_BREATH_RATE;
    for (const time of [0, 0.4, 2.2]) expect(bookCoverAngles(0, time + beat, 4).left).toBeCloseTo(bookCoverAngles(0, time, 3).left, 10);
    let slow = 0, fast = 0;
    for (let i = 0; i < 30; i++) slow = smoothTurn(slow, 1, 1 / 30);
    for (let i = 0; i < 120; i++) fast = smoothTurn(fast, 1, 1 / 120);
    expect(slow).toBeCloseTo(fast, 10);
  });
});


describe('book turn signal', () => {
  it('banks equally at 30 and 120 FPS for the same angular velocity', () => {
    const forward = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3(0, 1, 0);
    const sample = dt => turnSignalFromDirections(forward, forward.clone().applyAxisAngle(up, dt * 2), up, dt);
    expect(sample(1 / 30)).toBeCloseTo(sample(1 / 120), 10);
  });
});
