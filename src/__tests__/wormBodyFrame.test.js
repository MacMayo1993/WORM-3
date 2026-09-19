import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { bodyFrameInto } from '../worm/healerWorm/bodySurface.js';

describe('body orientation at tunnel mouths', () => {
  it('keeps a rigid right-handed frame for axial and nearly axial travel on all faces', () => {
    const normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const components of normals) {
      const normal = new THREE.Vector3(...components);
      for (const sign of [-1, 1]) {
        for (const epsilon of [0, 1e-8, 1e-5, 0.1]) {
          const forward = normal.clone().multiplyScalar(sign).addScalar(epsilon).normalize();
          const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
          const matrix = bodyFrameInto(new THREE.Matrix4(), forward, normal, x, y, z);
          expect(x.length()).toBeCloseTo(1, 8);
          expect(y.length()).toBeCloseTo(1, 8);
          expect(z.dot(forward)).toBeCloseTo(-1, 8);
          expect(x.dot(y)).toBeCloseTo(0, 8);
          expect(y.dot(z)).toBeCloseTo(0, 8);
          expect(x.dot(z)).toBeCloseTo(0, 8);
          expect(matrix.determinant()).toBeCloseTo(1, 8);
          const q = new THREE.Quaternion().setFromRotationMatrix(matrix);
          expect(q.length()).toBeCloseTo(1, 8);
        }
      }
    }
  });
});
