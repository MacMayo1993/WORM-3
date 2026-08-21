// The rocket flight path. The one thing it must never do is pass through the cube
// it is flying around, which the old "surface position + face normal × height"
// could: consumers took their normal from different sources, and a normal that
// snaps across an edge swings a point 1.4 units away through a quarter turn —
// straight through the corner.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  rocketOrbitT,
  rocketOrbitInto,
  cubeShellDirInto,
  cubeHalfExtent,
  ROCKET_ORBIT_CLEARANCE
} from '../worm/healerWorm/rocketOrbit.js';
import {
  ROCKET_DURATION,
  ROCKET_FLIGHT_HEIGHT,
  rocketFlightLift
} from '../worm/healerWorm/constants.js';
import { getStickerWorldPos } from '../game/gridIds.js';

const FACES = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

// Every sticker of a cube, as world positions — the ground the worm flies over.
const surfacePoints = (size) => {
  const pts = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const onFace = {
          PX: x === size - 1, NX: x === 0,
          PY: y === size - 1, NY: y === 0,
          PZ: z === size - 1, NZ: z === 0
        };
        for (const dk of FACES) {
          if (!onFace[dk]) continue;
          const p = getStickerWorldPos(x, y, z, dk, size, 0);
          pts.push(new THREE.Vector3(p[0], p[1], p[2]));
        }
      }
    }
  }
  return pts;
};

// How far a point sits outside the cube's own box. 0 means on it or inside it.
const gapToCube = (p, size) => {
  const a = cubeHalfExtent(size);
  const dx = Math.max(0, Math.abs(p.x) - a);
  const dy = Math.max(0, Math.abs(p.y) - a);
  const dz = Math.max(0, Math.abs(p.z) - a);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

describe('rocket orbit', () => {
  it('shares its clock with the flight altitude', () => {
    expect(rocketOrbitT(false, 0)).toBe(0);
    expect(rocketOrbitT(false, ROCKET_DURATION)).toBe(0);
    expect(rocketOrbitT(true, ROCKET_DURATION / 2)).toBe(1);
    for (const t of [0.05, 0.2, 1.0, 2.4, 2.95]) {
      expect(rocketOrbitT(true, t) * ROCKET_FLIGHT_HEIGHT).toBeCloseTo(rocketFlightLift(true, t), 10);
    }
  });

  it('never leaves the worm inside the cube, from any tile on any face', () => {
    for (const size of [2, 3, 5, 7]) {
      for (const p of surfacePoints(size)) {
        for (const t of [0.15, 0.5, 1]) {
          const out = p.clone();
          rocketOrbitInto(out, size, t);
          expect(gapToCube(out, size)).toBeGreaterThanOrEqual(ROCKET_ORBIT_CLEARANCE * t - 1e-6);
        }
      }
    }
  });

  it('clears the cube even from an edge, a corner, or a point that starts inside', () => {
    const size = 3;
    const a = cubeHalfExtent(size);
    const hard = [
      new THREE.Vector3(a, a, 0),        // on an edge
      new THREE.Vector3(a, a, a),        // on a corner
      new THREE.Vector3(a * 0.999, a * 0.999, a * 0.999),
      new THREE.Vector3(0.2, 0.1, 0.05), // deep inside — a corner arc that cut in
      new THREE.Vector3(0, 0, 0)         // dead centre, no direction to take
    ];
    for (const p of hard) {
      const out = p.clone();
      rocketOrbitInto(out, size, 1);
      expect(Number.isFinite(out.x + out.y + out.z)).toBe(true);
      expect(gapToCube(out, size)).toBeGreaterThanOrEqual(ROCKET_ORBIT_CLEARANCE - 1e-6);
    }
  });

  it('flies at a steady altitude over the flat of a face', () => {
    // Over a face the shell direction is that face's normal, so the orbit is the
    // plain cruise height — the look the flight already had, kept.
    const size = 5;
    const a = cubeHalfExtent(size);
    for (const p of surfacePoints(size)) {
      // Only the stickers that are not on an edge of their own face.
      const axes = [p.x, p.y, p.z].filter((v) => Math.abs(Math.abs(v) - a) < 1e-9);
      if (axes.length !== 1) continue;
      const out = p.clone();
      rocketOrbitInto(out, size, 1);
      expect(out.distanceTo(p)).toBeCloseTo(ROCKET_FLIGHT_HEIGHT, 6);
    }
  });

  it('rounds an edge instead of turning the corner', () => {
    // Walking a path across an edge, the flight position must move smoothly: no
    // step bigger than the step on the ground plus a small bend allowance. The
    // normal-offset version teleported a quarter-circle here.
    const size = 3;
    const a = cubeHalfExtent(size);
    const path = [];
    const N = 200;
    for (let s = 0; s <= N; s++) {
      // A quarter turn around the +X/+Y edge at z = 0, at the cube's own radius.
      const ang = (s / N) * (Math.PI / 2);
      path.push(new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(a * Math.SQRT2));
    }
    let prev = null;
    let maxStep = 0;
    for (const p of path) {
      const out = p.clone();
      rocketOrbitInto(out, size, 1);
      expect(gapToCube(out, size)).toBeGreaterThanOrEqual(ROCKET_ORBIT_CLEARANCE - 1e-6);
      if (prev) maxStep = Math.max(maxStep, out.distanceTo(prev));
      prev = out;
    }
    const groundStep = (a * Math.SQRT2 * Math.PI) / 2 / N;
    expect(maxStep).toBeLessThan(groundStep * 4);
  });

  it('takes a face normal over a face and a bisector at an edge', () => {
    const size = 3;
    const a = cubeHalfExtent(size);
    const dir = new THREE.Vector3();

    cubeShellDirInto(dir, new THREE.Vector3(a, 0.2, -0.4), size);
    expect(dir.x).toBeCloseTo(1, 6);

    cubeShellDirInto(dir, new THREE.Vector3(a, a, 0), size);
    expect(dir.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(dir.y).toBeCloseTo(Math.SQRT1_2, 6);

    cubeShellDirInto(dir, new THREE.Vector3(-a, -a, -a), size);
    expect(dir.x).toBeCloseTo(-1 / Math.sqrt(3), 6);
    expect(dir.length()).toBeCloseTo(1, 6);
  });

  it('does nothing at all when the rocket is not burning', () => {
    const p = new THREE.Vector3(1.5, 0.2, -0.3);
    const out = p.clone();
    rocketOrbitInto(out, 3, rocketOrbitT(false, 0));
    expect(out.equals(p)).toBe(true);
  });
});
