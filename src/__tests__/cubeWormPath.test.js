import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { sampleCubeWorm, CUBE_WORM_HALF, CUBE_WORM_CLEARANCE, CUBE_WORM_LAP } from '../components/menus/cubeWormPath.js';

it('keeps each segment outside the cube with a tangent facing and surface normal', () => {
  const p = new Vector3(), n = new Vector3(), f = new Vector3();
  for (let s = -2; s < CUBE_WORM_LAP; s += 0.013) {
    sampleCubeWorm(s, p, n, f);
    const clearance = Math.hypot(Math.max(0, Math.abs(p.x) - CUBE_WORM_HALF), Math.max(0, Math.abs(p.z) - CUBE_WORM_HALF));
    expect(clearance).toBeCloseTo(CUBE_WORM_CLEARANCE, 8);
    expect(n.length()).toBeCloseTo(1);
    expect(f.length()).toBeCloseTo(1);
    expect(n.dot(f)).toBeCloseTo(0);
  }
});
it('joins all edges and the lap seam continuously, including orientation', () => {
  const a = [new Vector3(), new Vector3(), new Vector3()];
  const b = [new Vector3(), new Vector3(), new Vector3()];
  for (let k = 0; k < 4; k++) {
    for (const offset of [0, 2 * CUBE_WORM_HALF]) {
      const s = k * CUBE_WORM_LAP / 4 + offset;
      sampleCubeWorm(s - 1e-7, ...a); sampleCubeWorm(s + 1e-7, ...b);
      for (let i = 0; i < 3; i++) expect(a[i].distanceTo(b[i])).toBeLessThan(0.00001);
    }
  }
});
