import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { isTileInSlice } from '../worm/wormLogic.js';
import { rotateVec90 } from '../game/cubeRotation.js';

describe('isTileInSlice', () => {
  it('matches on the x coordinate for the col axis', () => {
    expect(isTileInSlice('col', 2, 2, 0, 1)).toBe(true);
    expect(isTileInSlice('col', 2, 1, 2, 2)).toBe(false);
  });

  it('matches on the y coordinate for the row axis', () => {
    expect(isTileInSlice('row', 1, 4, 1, 0)).toBe(true);
    expect(isTileInSlice('row', 1, 4, 2, 0)).toBe(false);
  });

  it('matches on the z coordinate for the depth axis', () => {
    expect(isTileInSlice('depth', 0, 3, 3, 0)).toBe(true);
    expect(isTileInSlice('depth', 0, 3, 3, 1)).toBe(false);
  });

  it('returns false for an unknown axis', () => {
    expect(isTileInSlice('nope', 0, 0, 0, 0)).toBe(false);
  });
});

describe('live-rotation ride lands exactly on a lattice cell (no drift)', () => {
  // The worm head ride mirrors CubeAssembly exactly: rotate the origin-centred lattice
  // position [x-k, y-k, z-k] about the unit slice axis by ±90°. A correct quarter turn must
  // map every cell in the slice onto another valid integer lattice cell — this is what
  // guarantees the ridden head ends precisely on the tile the rotation commits it to.
  const AXES = {
    col: new THREE.Vector3(1, 0, 0),
    row: new THREE.Vector3(0, 1, 0),
    depth: new THREE.Vector3(0, 0, 1),
  };
  const v = new THREE.Vector3();

  // The whole no-snap guarantee rests on the live ride/bake transform —
  // applyAxisAngle(unitAxis, dir·π/2) — being identical to the logical cube turn
  // (rotateVec90). If these ever diverge, the head and body would jump 90° at commit.
  it('applyAxisAngle(unitAxis, dir·π/2) equals rotateVec90 for all axes/dirs', () => {
    const axisVecs = { col: new THREE.Vector3(1, 0, 0), row: new THREE.Vector3(0, 1, 0), depth: new THREE.Vector3(0, 0, 1) };
    const samples = [
      [1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1],
      [0.7, -1.3, 0.4], [-0.5, 0.9, -1.1], [1.0, 1.0, 1.0],
    ];
    const out = new THREE.Vector3();
    for (const axis of ['col', 'row', 'depth']) {
      for (const dir of [1, -1]) {
        for (const [vx, vy, vz] of samples) {
          const [ex, ey, ez] = rotateVec90(vx, vy, vz, axis, dir);
          out.set(vx, vy, vz).applyAxisAngle(axisVecs[axis], dir * (Math.PI / 2));
          expect(out.x).toBeCloseTo(ex, 9);
          expect(out.y).toBeCloseTo(ey, 9);
          expect(out.z).toBeCloseTo(ez, 9);
        }
      }
    }
  });

  for (const size of [2, 3, 4, 5]) {
    const k = (size - 1) / 2;
    for (const [axis, axisVec] of Object.entries(AXES)) {
      for (const dir of [1, -1]) {
        it(`size ${size}, ${axis} axis, dir ${dir}`, () => {
          const angle = dir * (Math.PI / 2);
          for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
              for (let z = 0; z < size; z++) {
                const sliceIndex = axis === 'col' ? x : axis === 'row' ? y : z;
                if (!isTileInSlice(axis, sliceIndex, x, y, z)) continue;
                v.set(x - k, y - k, z - k).applyAxisAngle(axisVec, angle);
                for (const comp of [v.x + k, v.y + k, v.z + k]) {
                  const nearest = Math.round(comp);
                  expect(Math.abs(comp - nearest)).toBeLessThan(1e-9);
                  expect(nearest).toBeGreaterThanOrEqual(0);
                  expect(nearest).toBeLessThanOrEqual(size - 1);
                }
              }
            }
          }
        });
      }
    }
  }
});
