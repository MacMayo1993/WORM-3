import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { sampleCubeWorm, CUBE_WORM_HALF, CUBE_WORM_CLEARANCE, CUBE_WORM_LAP } from '../components/menus/cubeWormPath.js';
it('visits all six faces with constant clearance and a tangent facing', () => {
  const p = new Vector3(), n = new Vector3(), f = new Vector3(), faces = new Set();
  for (let s = 0; s < CUBE_WORM_LAP; s += 0.02) {
    sampleCubeWorm(s, p, n, f);
    const clearance = Math.hypot(...p.toArray().map(v => Math.max(0, Math.abs(v) - CUBE_WORM_HALF)));
    expect(clearance).toBeCloseTo(CUBE_WORM_CLEARANCE, 6);
    expect(f.length()).toBeCloseTo(1);
    expect(n.dot(f)).toBeCloseTo(0);
    n.toArray().forEach((v, axis) => { if (Math.abs(v) > 0.99) faces.add(`${axis}:${Math.sign(v)}`); });
  }
  expect(faces.size).toBe(6);
});
it('joins the lap seam without a positional or orientation jump', () => {
  const a = [new Vector3(), new Vector3(), new Vector3()], b = a.map(() => new Vector3());
  sampleCubeWorm(-1e-6, ...a); sampleCubeWorm(1e-6, ...b);
  a.forEach((v, i) => expect(v.distanceTo(b[i])).toBeLessThan(0.0001));
});
it('keeps every paired segment antipodal throughout the lap and after cube rotation', () => {
  const a = [new Vector3(), new Vector3(), new Vector3()], b = a.map(() => new Vector3());
  const axis = new Vector3(1, 2, -3).normalize();
  for (let s = 0; s < CUBE_WORM_LAP; s += 0.17) {
    for (let bead = 0; bead < 9; bead++) {
      sampleCubeWorm(s - bead * 0.18, ...a);
      sampleCubeWorm(s - bead * 0.18, ...b, true);
      a.forEach((v, i) => {
        expect(v.clone().add(b[i]).length()).toBeLessThan(1e-10);
        expect(v.clone().applyAxisAngle(axis, 1.3).add(b[i].clone().applyAxisAngle(axis, 1.3)).length()).toBeLessThan(1e-10);
      });
    }
  }
});
