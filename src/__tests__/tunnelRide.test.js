import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeTunnelCenterline, buildTunnelCenterlineInto } from '../worm/wormLogic.js';
import { makeTunnelRideFrame, tunnelRideFrameInto, TUNNEL_RIDE_CLEARANCE, fillTunnelRideGeometry, tunnelRideCoreArc, tunnelRideTwistAt } from '../utils/tunnelRide.js';
import { FACE_NORMALS } from '../worm/healerWorm/constants.js';

const tile = (dirKey, size, corner = false) => {
  const normal = FACE_NORMALS[dirKey];
  const axis = normal.x ? 'x' : normal.y ? 'y' : 'z';
  const p = { x: corner ? 0 : Math.floor(size / 2), y: corner ? 0 : Math.floor(size / 2), z: corner ? 0 : Math.floor(size / 2), dirKey };
  p[axis] = normal[axis] > 0 ? size - 1 : 0;
  return p;
};
const build = (entry, exit, size) => buildTunnelCenterlineInto(makeTunnelCenterline(), { entry, exit }, size);

describe('Möbius surface riding', () => {
  it('centers the half-twist on the core for unequal arms and reverse visits', () => {
    const entry = tile('PZ', 7, true), exit = tile('NX', 7);
    const path = build(entry, exit, 7), reverse = build(exit, entry, 7);
    const core = tunnelRideCoreArc(path);
    expect(Math.abs(core - path.total / 2)).toBeGreaterThan(0.1);
    expect(tunnelRideTwistAt(path, core)).toBeCloseTo(0.5, 10);
    expect(tunnelRideTwistAt(path, 0)).toBe(0);
    expect(tunnelRideTwistAt(path, path.total)).toBe(1);
    expect(tunnelRideTwistAt(path, path.armALen)).toBe(0);
    expect(tunnelRideTwistAt(path, path.armALen + path.legLen[2])).toBe(1);
    // The exposed arms stay level; the physical turn is concealed in the cube.
    for (let i = 1; i < 100; i++) {
      const arc = path.total * i / 100, twist = tunnelRideTwistAt(path, arc);
      if (twist > 0 && twist < 1) {
        expect(arc).toBeGreaterThan(path.armALen);
        expect(arc).toBeLessThan(path.armALen + path.legLen[2]);
      }
    }
    for (let i = 0; i <= 100; i++) {
      const arc = path.total * i / 100;
      expect(tunnelRideTwistAt(path, arc) + tunnelRideTwistAt(reverse, path.total - arc)).toBeCloseTo(1, 10);
    }
  });
  it('keeps the floor below the body and identical on reverse visits on every face pair', () => {
    const f = makeTunnelRideFrame(), r = makeTunnelRideFrame();
    for (const size of [2, 3, 7, 15]) for (const entryDir of Object.keys(FACE_NORMALS)) for (const exitDir of Object.keys(FACE_NORMALS)) {
      const entry = tile(entryDir, size, true), exit = tile(exitDir, size);
      const path = build(entry, exit, size), reverse = build(exit, entry, size);
      for (let i = 0; i <= 200; i++) {
        const arc = path.total * i / 200;
        tunnelRideFrameInto(f, path, arc);
        tunnelRideFrameInto(r, reverse, path.total - arc);
        expect(f.normal.toArray().every(Number.isFinite)).toBe(true);
        expect(f.normal.length()).toBeCloseTo(1, 8);
        expect(f.normal.dot(f.tangent)).toBeCloseTo(0, 8);
        expect(f.center.distanceTo(r.center)).toBeLessThan(1e-8);
        expect(f.floor.distanceTo(r.floor)).toBeLessThan(1e-8);
        expect(f.normal.distanceTo(r.normal)).toBeLessThan(1e-8);
        const clearance = f.center.clone().sub(f.floor).dot(f.normal);
        expect(clearance).toBeGreaterThanOrEqual(-1e-10);
        if (arc >= 0.25 && path.total - arc >= 0.25) expect(clearance).toBeCloseTo(TUNNEL_RIDE_CLEARANCE, 8);
      }
    }
  });

  it('sweeps a half turn while keeping continuous normals through bent core crossings', () => {
    for (const exitDir of ['NZ', 'PX', 'PZ', 'NY']) {
      const path = build(tile('PZ', 7, true), tile(exitDir, 7), 7);
      const f = makeTunnelRideFrame(), previous = new THREE.Vector3();
      for (let i = 0; i <= 5000; i++) {
        tunnelRideFrameInto(f, path, path.total * i / 5000);
        if (i) expect(previous.dot(f.normal)).toBeGreaterThan(0.99);
        previous.copy(f.normal);
      }
    }
    const path = build(tile('PZ', 3), tile('NZ', 3), 3);
    const start = makeTunnelRideFrame(), end = makeTunnelRideFrame();
    tunnelRideFrameInto(start, path, 0); tunnelRideFrameInto(end, path, path.total);
    expect(start.normal.dot(end.normal)).toBeCloseTo(-1, 8);
  });

  it('writes the rendered floor and rails at their actual riding positions', () => {
    const count = 161 * 2;
    const geometry = () => {
      const g = new THREE.BufferGeometry();
      for (const [name, width] of [['position', 3], ['uv', 2], ['aHeightFrac', 1], ['aTripFrac', 1]])
        g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(count * width), width));
      return g;
    };
    const geo = geometry(), left = geometry(), right = geometry();
    const path = build(tile('PY', 7, true), tile('NX', 7), 7);
    fillTunnelRideGeometry(geo, left, right, path, 160);
    const f = makeTunnelRideFrame(), l = new THREE.Vector3(), r = new THREE.Vector3();
    for (let i = 0; i <= 160; i++) {
      tunnelRideFrameInto(f, path, path.total * i / 160);
      l.fromBufferAttribute(geo.attributes.position, i * 2);
      r.fromBufferAttribute(geo.attributes.position, i * 2 + 1);
      expect(l.clone().lerp(r, 0.5).distanceTo(f.floor)).toBeLessThan(1e-6);
      expect(l.distanceTo(new THREE.Vector3().fromBufferAttribute(left.attributes.position, i * 2))).toBeLessThan(1e-6);
      expect(r.distanceTo(new THREE.Vector3().fromBufferAttribute(right.attributes.position, i * 2))).toBeLessThan(1e-6);
    }
  });
});
