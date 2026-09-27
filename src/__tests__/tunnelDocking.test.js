import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CORE_DIRS, CORE_STICKER_LOCAL, coreCubieMatrixInto } from '../3d/antipodalCore.js';
import {
  makeTunnelPath, buildTunnelPathInto, tunnelDockForCellInto, tunnelDockWidth,
  tunnelPathArcTangentInto, tunnelPathPointInto, tunnelPathRibbonInto, tunnelRibbonSampleU, tunnelCorePoseInto
} from '../utils/tunnelPath.js';
import { fillTunnelRideGeometry, tunnelRideSampleArc } from '../utils/tunnelRide.js';

const V = () => new THREE.Vector3();
const geometry = segments => {
  const geo = new THREE.BufferGeometry();
  for (const [key, width] of [['position', 3], ['uv', 2], ['aHeightFrac', 1], ['aTripFrac', 1]]) {
    geo.setAttribute(key, new THREE.BufferAttribute(new Float32Array((segments + 1) * 2 * width), width));
  }
  return geo;
};
function route(size, dir) {
  const n = V().fromArray(CORE_DIRS[dir]), xyz = [size - 1, size - 1, size - 1];
  xyz['XYZ'.indexOf(dir[1])] = dir[0] === 'P' ? size - 1 : 0;
  const dock = tunnelDockForCellInto(V(), ...xyz, dir, size);
  const start = V().fromArray(xyz).addScalar(-(size - 1) / 2).addScaledVector(n, 0.8);
  return { n, xyz, dock, start };
}

describe('bands seated on antipodal core stickers', () => {
  it('seats both rendered ribbon edges and rails flush on every face, including Mega', () => {
    const segments = 160, geo = geometry(segments), left = geometry(segments), right = geometry(segments);
    const p = V(), q = V(), tangent = V();
    for (const size of [2, 3, 6, 15]) for (const dir of Object.keys(CORE_DIRS)) {
      const { n, dock, start } = route(size, dir);
      const path = buildTunnelPathInto(makeTunnelPath(), start, n, start.clone().negate(), n.clone().negate(), dock, dock.clone().negate());
      const width = tunnelDockWidth(size);
      fillTunnelRideGeometry(geo, left, right, path, segments, 0.36, width);
      for (const [arc, center, normal] of [[path.armALen, path.midA, n], [path.total - path.armBLen, path.midB, n.clone().negate()]]) {
        const index = Array.from({ length: segments + 1 }, (_, i) => i)
          .find(i => Math.abs(tunnelRideSampleArc(path, i, segments) - arc) < 1e-10);
        expect(index).toBeDefined(); // A vertex must reach each dock, not stop one segment short.
        p.fromBufferAttribute(geo.attributes.position, index * 2);
        q.fromBufferAttribute(geo.attributes.position, index * 2 + 1);
        expect(p.clone().lerp(q, 0.5).distanceTo(center)).toBeLessThan(1e-7);
        expect(p.distanceTo(q)).toBeCloseTo(width, 6);
        for (const g of [geo, left, right]) for (const side of [0, 1]) {
          p.fromBufferAttribute(g.attributes.position, index * 2 + side).sub(center);
          expect(Math.abs(p.dot(normal))).toBeLessThan(1e-7);
          expect(p.length()).toBeLessThanOrEqual(width / 2 + 1e-7);
        }
        tunnelPathArcTangentInto(tangent, path, arc);
        expect(Math.abs(tangent.dot(normal))).toBeCloseTo(1, 10);
      }
    }
    [geo, left, right].forEach(g => g.dispose());
  });

  it('keeps continuous tangents at the throat, dock and center joins', () => {
    const a = route(7, 'PY'), b = route(7, 'NX');
    const path = buildTunnelPathInto(makeTunnelPath(), a.start, a.n, b.start, b.n, a.dock, b.dock);
    const before = V(), after = V();
    for (const arc of path.legArc0.slice(1)) {
      tunnelPathArcTangentInto(before, path, arc - 1e-6);
      tunnelPathArcTangentInto(after, path, arc + 1e-6);
      expect(before.dot(after)).toBeGreaterThan(0.99999);
    }
    for (const segments of [32, 96]) {
      expect(tunnelPathRibbonInto(V(), path, tunnelRibbonSampleU(segments / 2, segments)).distanceTo(path.midA)).toBeLessThan(1e-12);
      expect(tunnelPathRibbonInto(V(), path, tunnelRibbonSampleU(segments / 2 + 1, segments)).distanceTo(path.midB)).toBeLessThan(1e-12);
    }
  });

  it('moves every dock with the actual core sticker during slice turns and approach zoom', () => {
    const q = new THREE.Quaternion().setFromAxisAngle(V().set(0, 1, 0), 0.7);
    const cubie = new THREE.Matrix4(), matrix = new THREE.Matrix4();
    const anchor = route(3, 'PZ').dock;
    for (const dir of Object.keys(CORE_DIRS)) for (const zoom of [1, 2, 3]) {
      const { xyz } = route(3, dir);
      const dock = tunnelDockForCellInto(V(), ...xyz, dir, 3, q);
      tunnelCorePoseInto(dock, zoom, anchor);
      coreCubieMatrixInto(cubie, ...xyz, 3, q);
      const sticker = V().setFromMatrixPosition(matrix.multiplyMatrices(cubie, CORE_STICKER_LOCAL[dir]));
      sticker.sub(anchor).multiplyScalar(zoom).add(anchor);
      expect(dock.distanceTo(sticker)).toBeLessThan(1e-12);
    }
  });

  it('carries the complete hidden crossing with a translated and enlarged core', () => {
    const a = route(6, 'PY'), b = route(6, 'NZ');
    const base = buildTunnelPathInto(makeTunnelPath(), a.start, a.n, b.start, b.n, a.dock, b.dock);
    for (const zoom of [2, 6]) {
      const pose = p => tunnelCorePoseInto(p.clone(), zoom, a.dock);
      const enlarged = buildTunnelPathInto(makeTunnelPath(), a.start, a.n, b.start, b.n, pose(a.dock), pose(b.dock), pose(V()));
      expect(enlarged.core.distanceTo(pose(V()))).toBeLessThan(1e-12);
      for (let i = 0; i <= 20; i++) {
        const t = 0.4 + i * 0.01;
        const expected = pose(tunnelPathPointInto(V(), base, t));
        expect(tunnelPathPointInto(V(), enlarged, t).distanceTo(expected)).toBeLessThan(1e-10);
      }
    }
  });
});
