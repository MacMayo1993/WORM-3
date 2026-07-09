import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { isTileInSlice, nextRestRead, rotateMoveDir } from '../worm/wormLogic.js';
import { rotateVec90 } from '../game/cubeRotation.js';
import { DIR_FORWARD } from '../worm/healerWorm/constants.js';
import { DIR_TO_VEC, VEC_TO_DIR } from '../utils/constants.js';

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

describe('nextRestRead — end-of-rotation read for steps crossing a mid-rotation slice', () => {
  // 5×5 cube, row slice y=2 rotating. Static tiles have y≠2; slice tiles have y=2.
  const staticA = { x: 0, y: 1, z: 4 };
  const staticB = { x: 0, y: 0, z: 4 };
  const sliceA = { x: 0, y: 2, z: 4 };
  const sliceB = { x: 1, y: 2, z: 4 };
  const armed = { axis: 'row', sliceIndex: 2 };

  it('stays clear when no rotation is animating', () => {
    expect(nextRestRead(null, false, 'row', 2, staticA, sliceA)).toBeNull();
    expect(nextRestRead(armed, false, 'row', 2, staticA, sliceA)).toBeNull();
  });

  it('arms when crossing from static ground onto the rotating slice', () => {
    expect(nextRestRead(null, true, 'row', 2, staticA, sliceA)).toEqual({ axis: 'row', sliceIndex: 2 });
  });

  it('arms on the first step (no source tile yet) onto the rotating slice', () => {
    expect(nextRestRead(null, true, 'row', 2, null, sliceA)).toEqual({ axis: 'row', sliceIndex: 2 });
  });

  it('stays armed while stepping along the rotating slice', () => {
    expect(nextRestRead(armed, true, 'row', 2, sliceA, sliceB)).toBe(armed);
  });

  it('stays armed while stepping back off the slice (the lerp source is still a rest-read cell)', () => {
    expect(nextRestRead(armed, true, 'row', 2, sliceA, staticA)).toBe(armed);
  });

  it('clears once both step endpoints are on static ground', () => {
    expect(nextRestRead(armed, true, 'row', 2, staticA, staticB)).toBeNull();
  });

  it('keeps a rider riding: a worm already on the slice never arms by stepping within it', () => {
    expect(nextRestRead(null, true, 'row', 2, sliceA, sliceB)).toBeNull();
    expect(nextRestRead(null, true, 'row', 2, sliceA, staticA)).toBeNull();
  });

  it('drops a descriptor from a previous rotation when a different one is animating', () => {
    // Same step shape, but the live rotation is now col/0 — the old row/2 state must not leak.
    expect(nextRestRead(armed, true, 'col', 3, sliceA, sliceB)).toBeNull();
    // And crossing into the NEW rotating slice re-arms for that rotation.
    expect(nextRestRead(armed, true, 'col', 0, { x: 1, y: 2, z: 4 }, { x: 0, y: 2, z: 4 }))
      .toEqual({ axis: 'col', sliceIndex: 0 });
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

  // After a slice rotation carries the worm's tile to a new face, the worm must keep heading
  // the SAME way in world space ("continue in the same direction, now rotated"). rotateMoveDir
  // picks the move-direction on the new face whose world-forward equals the rotated old forward.
  describe('rotateMoveDir preserves the worm\'s world-space heading', () => {
    const FACES = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
    const MOVES = ['up', 'down', 'left', 'right'];
    // rotateVec90 can emit -0 (e.g. -dir*0); DIR_FORWARD uses literal +0, and toEqual
    // distinguishes the two. Normalise -0 → 0 for the array comparison (rotateMoveDir
    // itself is unaffected — it selects via dot product).
    const norm0 = (v) => v.map((n) => (n === 0 ? 0 : n));

    for (const axis of ['col', 'row', 'depth']) {
      for (const dir of [1, -1]) {
        it(`${axis} dir ${dir}: heading on the new face matches the rotated old heading`, () => {
          for (const face of FACES) {
            // The face the worm's tile lands on after the slice turn (same transform the cube uses).
            const [nvx, nvy, nvz] = rotateVec90(DIR_TO_VEC[face][0], DIR_TO_VEC[face][1], DIR_TO_VEC[face][2], axis, dir);
            const newFace = VEC_TO_DIR(nvx, nvy, nvz);
            for (const m of MOVES) {
              const fwd = DIR_FORWARD[face][m];
              const [rx, ry, rz] = rotateVec90(fwd[0], fwd[1], fwd[2], axis, dir);
              const newMove = rotateMoveDir(m, face, newFace, axis, dir);
              // The new face's forward for newMove must equal the rotated old-forward exactly.
              expect(norm0(DIR_FORWARD[newFace][newMove])).toEqual(norm0([rx, ry, rz]));
            }
          }
        });
      }
    }

    it('matches the worked example: right on PY through a depth turn becomes up on NX', () => {
      expect(rotateMoveDir('right', 'PY', 'NX', 'depth', 1)).toBe('up');
    });
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
