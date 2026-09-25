import { it, expect } from 'vitest';
import * as THREE from 'three';
import { wigglePointInto } from '../worm/healerWorm/wiggleSweep.js';
import { createBodySurface, updateBodySurface, clearBodySurfaceInto } from '../worm/healerWorm/bodySurface.js';
import { cubeShellDirInto } from '../worm/healerWorm/rocketOrbit.js';

// Tail Wipers maps the tail onto a bare cube shell only WORM_LIFT out, which is
// closer than a bead's radius and tighter still across an edge. WormBody clears
// each swept bead again, outward from where it lands; this is that sequence.
const boxDistance = (p, half) => {
  const q = [Math.abs(p.x) - half, Math.abs(p.y) - half, Math.abs(p.z) - half];
  return Math.hypot(...q.map(v => Math.max(v, 0))) + Math.min(Math.max(...q), 0);
};

it('keeps a Tail Wipers sweep a full bead radius off the cube, across an edge', () => {
  const size = 3, half = 1.5;
  // A tail laid along the top face towards the front edge, swept 3 tiles sideways.
  const points = [0, 1, 2, 3].map(i => new THREE.Vector3(0.9, 1.58, -0.6 + i * 0.7));
  const distances = points.map((_, i) => i * 0.7);
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(1, 0, 0);
  const sweep = { points, distances, normals: points.map(() => up.clone()), sides: points.map(() => side.clone()),
    size, phase: 0, length: 2.1, elapsed: 0.6, offset: 3 };
  const surface = updateBodySurface(createBodySurface(), size, { active: false });
  const pos = new THREE.Vector3(), normal = new THREE.Vector3();
  let rawMin = Infinity, clearedMin = Infinity;
  for (let f = 0.05; f <= 1; f += 0.05) {
    wigglePointInto(pos, sweep, f);
    rawMin = Math.min(rawMin, boxDistance(pos, half));
    cubeShellDirInto(normal, pos, size);
    clearBodySurfaceInto(pos, normal, 0.10, surface);
    clearedMin = Math.min(clearedMin, boxDistance(pos, half));
  }
  expect(rawMin).toBeLessThan(0.09); // the bare shell sinks a 0.09 bead
  expect(clearedMin).toBeGreaterThanOrEqual(0.10 - 1e-3);
});
