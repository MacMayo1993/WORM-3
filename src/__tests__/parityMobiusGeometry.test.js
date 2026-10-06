import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createParityMobiusGeometry } from '../worm/parityGeometry.js';

// The parity band is two-sided in geometry (each quad drawn once per winding)
// and is worn by tile styles, the sticker finish and lit materials, all of
// which read its vertex normals. Welding both windings onto shared vertices
// made those normals sum to floating-point residue in arbitrary directions.
// Positions are keyed to 1e-5, with -0 folded into 0 (sin 2π is not exactly 0).
const keyOf = (p) => p.toArray().map((x) => Math.round(x * 1e5) + 0).join(',');
const triangles = (g) => {
  const pos = g.attributes.position, idx = g.index.array, out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const pa = new THREE.Vector3().fromBufferAttribute(pos, a);
    const pb = new THREE.Vector3().fromBufferAttribute(pos, b);
    const pc = new THREE.Vector3().fromBufferAttribute(pos, c);
    const n = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3().subVectors(pc, pa)).normalize();
    out.push({ verts: [a, b, c], points: [pa, pb, pc], n });
  }
  return out;
};

describe.each([[0.24, 0.08], [0.3, 0.1], [0.3, 0.065]])('parity Möbius band R=%s w=%s', (R, w) => {
  const g = createParityMobiusGeometry(R, w);

  it('gives every vertex a unit normal on the side of every triangle that uses it', () => {
    const normals = g.attributes.normal;
    for (let i = 0; i < normals.count; i++) {
      expect(new THREE.Vector3().fromBufferAttribute(normals, i).length()).toBeCloseTo(1, 5);
    }
    let worst = 1;
    for (const { verts, n } of triangles(g)) {
      for (const v of verts) worst = Math.min(worst, new THREE.Vector3().fromBufferAttribute(normals, v).dot(n));
    }
    // Smooth normals lean off a facet by at most the band's curvature per step.
    expect(worst).toBeGreaterThan(0.75);
  });

  it('draws every triangle once per side, each side on its own vertices', () => {
    const tris = triangles(g);
    const key = (pts) => pts.map(keyOf).sort().join('|');
    const sides = new Map();
    for (const tri of tris) {
      const k = key(tri.points);
      if (!sides.has(k)) sides.set(k, []);
      sides.get(k).push(tri);
    }
    for (const pair of sides.values()) {
      expect(pair).toHaveLength(2);
      expect(pair[0].n.dot(pair[1].n)).toBeCloseTo(-1, 5);
      expect(pair[0].verts.some((v) => pair[1].verts.includes(v))).toBe(false);
    }
  });

  it('keeps the band on the Möbius surface with a closed loop', () => {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i);
      const ring = Math.hypot(p.x, p.y);
      // Distance from the centre circle never exceeds the half-width.
      expect(Math.hypot(ring - R, p.z)).toBeLessThanOrEqual(w + 1e-6);
    }
    // Interior edges carry two triangles on each side, boundary edges one, and
    // nothing is left open where the loop closes on itself.
    const edges = new Map();
    for (const { points } of triangles(g)) {
      for (let e = 0; e < 3; e++) {
        const k = [keyOf(points[e]), keyOf(points[(e + 1) % 3])].sort().join('|');
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    }
    const boundary = [...edges.values()].filter((n) => n === 2).length;
    const interior = [...edges.values()].filter((n) => n === 4).length;
    expect(boundary + interior).toBe(edges.size);
    // A Möbius band has one boundary loop, 2 × 48 segments long.
    expect(boundary).toBe(2 * 48);
  });
});
