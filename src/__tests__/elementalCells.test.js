// The cover cells every elemental skin is drawn over. The skins place geometry from
// these extents in world units, so the invariants here are what keep a skin on the
// cube: every face tiled exactly, nothing hanging past a cube edge, and each border
// correctly marked as a silhouette edge or a shared seam.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BufferGeometry } from 'three';
import { buildElementalCells, gridLines, attachCellAttributes } from '../worm/healerWorm/elementalCells.js';

const FACES = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
const SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 12, 15];

const frame = (c) => ({
  p: new THREE.Vector3(...c.restPos),
  X: new THREE.Vector3(1, 0, 0).applyQuaternion(c.restQuat),
  Y: new THREE.Vector3(0, 1, 0).applyQuaternion(c.restQuat)
});
const dominant = (v) => (Math.abs(v.x) > 0.5 ? 0 : Math.abs(v.y) > 0.5 ? 1 : 2);

describe('elemental cover cells', () => {
  it('tiles every face exactly, at every size and grid cap', () => {
    for (const size of SIZES) {
      for (const grid of [3, 4, 5]) {
        const cells = buildElementalCells(size, grid);
        const n = Math.min(size, grid);
        expect(cells).toHaveLength(6 * n * n);
        for (const face of FACES) {
          const area = cells
            .filter((c) => c.faceKey === face)
            .reduce((sum, c) => sum + (c.extent[0] + c.extent[1]) * (c.extent[2] + c.extent[3]), 0);
          expect(area, `${size}×${size} grid ${grid} ${face}`).toBeCloseTo(size * size, 9);
        }
      }
    }
  });

  it('never reaches past a cube edge', () => {
    // The old symmetric span let a border cell on a 7×7 hang half a sticker off the
    // cube — the ragged flaps round the water and ice silhouettes.
    for (const size of SIZES) {
      const half = size / 2;
      for (const c of buildElementalCells(size, 5)) {
        const { p, X, Y } = frame(c);
        for (const [u, v] of [[-c.extent[0], -c.extent[2]], [c.extent[1], c.extent[3]], [-c.extent[0], c.extent[3]], [c.extent[1], -c.extent[2]]]) {
          const q = p.clone().addScaledVector(X, u).addScaledVector(Y, v);
          for (const axis of [0, 1, 2]) expect(Math.abs(q.getComponent(axis))).toBeLessThanOrEqual(half + 0.021);
        }
      }
    }
  });

  it('flags exactly the borders that lie on the cube silhouette', () => {
    for (const size of SIZES) {
      const half = size / 2;
      for (const c of buildElementalCells(size, 5)) {
        const { p, X, Y } = frame(c);
        const borders = [[X, -c.extent[0]], [X, c.extent[1]], [Y, -c.extent[2]], [Y, c.extent[3]]];
        borders.forEach(([dir, d], i) => {
          const q = p.clone().addScaledVector(dir, d);
          const onBoundary = Math.abs(Math.abs(q.getComponent(dominant(dir))) - half) < 1e-6;
          expect(c.edge[i], `${size} ${c.key} border ${i}`).toBe(onBoundary ? 1 : 0);
        });
      }
    }
  });

  it('keeps one cell per sticker at or below the cap, each exactly one sticker wide', () => {
    for (const size of [2, 3, 4, 5]) {
      for (const c of buildElementalCells(size, 5)) {
        expect(c.extent).toEqual([0.5, 0.5, 0.5, 0.5]);
      }
    }
  });

  it('centres every cell on a sticker, so the sticker lattice is recoverable inside it', () => {
    // Shaders find seams with fract(local + 0.5): only true if each cell origin sits
    // on a sticker centre, one unit from its neighbours.
    for (const size of [6, 7, 15]) {
      const k = (size - 1) / 2;
      for (const c of buildElementalCells(size, 5)) {
        for (const axis of ['x', 'y', 'z']) expect(Number.isInteger(c[axis])).toBe(true);
        const { p } = frame(c);
        const lattice = [p.x, p.y, p.z].filter((v) => Math.abs(Math.abs(v) - (size / 2 + 0.02)) > 1e-6);
        for (const v of lattice) expect(Math.abs((v + k) - Math.round(v + k))).toBeLessThan(1e-9);
      }
    }
  });

  it('grid lines span the face with no gaps', () => {
    for (const size of SIZES) {
      const lines = gridLines(size, 5);
      let reach = -0.5;
      for (const l of lines) {
        expect(l.index - l.low).toBeCloseTo(reach, 9);
        reach = l.index + l.high;
      }
      expect(reach).toBeCloseTo(size - 0.5, 9);
      expect(lines[0].lowEdge).toBe(true);
      expect(lines[lines.length - 1].highEdge).toBe(true);
    }
  });

  it('attaches the four per-instance attributes the skins read', () => {
    const n = 3;
    const data = {
      cell: new Float32Array(n * 4),
      extent: new Float32Array(n * 4),
      edges: new Float32Array(n * 4),
      sweep: new Float32Array(n)
    };
    const geo = attachCellAttributes(new BufferGeometry(), data);
    for (const [name, size] of [['aCell', 4], ['aExtent', 4], ['aEdge', 4], ['aSweep', 1]]) {
      const attr = geo.getAttribute(name);
      expect(attr.isInstancedBufferAttribute, name).toBe(true);
      expect(attr.itemSize).toBe(size);
    }
    geo.dispose();
  });
});
