import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createParityMobiusGeometry } from '../worm/parityGeometry.js';
import {
  createOrbComets, cometIntensity, cometMaterial, stepCometHead,
  COMET_LAPS_PER_SECOND, COMET_TAIL,
} from '../worm/orbComet.js';

describe('the band\'s loop coordinate', () => {
  const g = createParityMobiusGeometry(0.24, 0.08);
  const loop = g.getAttribute('aLoop');
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const half = pos.count / 2;
  const v = (attr, i) => new THREE.Vector3().fromBufferAttribute(attr, i);

  it('runs 0 → 1 round the near copy and 1 → 2 round the far copy', () => {
    expect(loop.count).toBe(pos.count);
    for (let i = 0; i < half; i++) {
      expect(loop.getX(i)).toBeGreaterThanOrEqual(0);
      expect(loop.getX(i)).toBeLessThanOrEqual(1);
      expect(loop.getX(i + half)).toBeCloseTo(loop.getX(i) + 1, 6);
    }
  });

  it('carries the near copy\'s end onto the far copy\'s start: one side, no edge crossed', () => {
    // Column 0 of each copy is vertices 0..3 (vS + 1 across); the near copy's
    // last column is its last four vertices.
    const cols = 4;
    for (let j = 0; j < cols; j++) {
      const end = half - cols + j;            // near copy at loop 1
      const start = half + (cols - 1 - j);    // far copy at loop 1, the band flipped across
      expect(loop.getX(end)).toBeCloseTo(1, 6);
      expect(loop.getX(start)).toBeCloseTo(1, 6);
      expect(v(pos, end).distanceTo(v(pos, start))).toBeLessThan(1e-6);
      expect(v(nrm, end).dot(v(nrm, start))).toBeGreaterThan(0.95);
    }
  });
});

describe('orb comet', () => {
  it('needs two laps to come home, and holds still under reduced motion', () => {
    const lap = 1 / COMET_LAPS_PER_SECOND;
    expect(stepCometHead(0, lap)).toBeCloseTo(1, 6);       // one lap: the far side
    expect(stepCometHead(0, 2 * lap)).toBeCloseTo(0, 6);   // two laps: home
    expect(stepCometHead(1.9, lap / 2)).toBeCloseTo(0.4, 6);
    expect(stepCometHead(0, 0.1, 1)).toBeGreaterThan(stepCometHead(0, 0.1, 0)); // hurries near the worm
    expect(stepCometHead(0.7, 1, 1, true)).toBe(0.7);
  });

  it('is brightest at its head, fades back along its tail and lights only its own side', () => {
    expect(cometIntensity(0.5, 0.5)).toBeCloseTo(1, 6);
    expect(cometIntensity(0.5 - COMET_TAIL / 2, 0.5)).toBeCloseTo(0.5 ** 1.6, 6);
    expect(cometIntensity(0.5 - COMET_TAIL * 1.01, 0.5)).toBeLessThan(0.01);
    expect(cometIntensity(0.65, 0.5)).toBeLessThan(0.01); // ahead of the head: dark
    expect(cometIntensity(1.5, 0.5)).toBeLessThan(1e-6);  // same angle, other side of the band
    expect(cometIntensity(1.95, 0.05)).toBeGreaterThan(0.6); // the tail runs back across the seam
  });

  it('draws every comet on a band geometry in one transparent instanced draw over the band\'s own buffers', () => {
    const band = createParityMobiusGeometry(0.24, 0.08);
    const comets = createOrbComets([band], 3);
    const [mesh] = comets.group.children;
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.material).toBe(cometMaterial());
    expect(mesh.material.transparent).toBe(true);
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.instanceColor).toBeTruthy();       // the warm-up links the variant that draws
    expect(mesh.renderOrder).toBeGreaterThan(-0.5); // after the beacons…
    expect(mesh.renderOrder).toBeLessThan(0);       // …before the glass
    expect(mesh.geometry.getAttribute('position')).toBe(band.getAttribute('position'));
    expect(band.getAttribute('aComet')).toBeUndefined();
    expect(mesh.visible).toBe(false);

    const root = new THREE.Group();
    const orb = new THREE.Mesh(band);
    orb.position.set(1, 2, 3);
    root.add(orb);
    root.updateMatrixWorld(true);
    comets.begin(root);
    comets.add(orb, new THREE.Color('#ff0000'), 1.25, 0.8);
    comets.add(orb, '#00ff00', 0, 0);                         // faded out: skipped
    comets.add(new THREE.Mesh(new THREE.BoxGeometry()), '#0000ff', 0, 1); // not a band
    comets.end();
    expect(mesh.count).toBe(1);
    expect(mesh.visible).toBe(true);
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).toArray()).toEqual([1, 2, 3]);
    expect(Array.from(mesh.geometry.getAttribute('aComet').array.slice(0, 2))).toEqual([1.25, expect.closeTo(0.8)]);

    // Unmounting frees only the comet's own attribute, never the band's buffers.
    comets.dispose();
    expect(band.getAttribute('position')).toBeTruthy();
    expect(band.index).toBeTruthy();
  });
});
