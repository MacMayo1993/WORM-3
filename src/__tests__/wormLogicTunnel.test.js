import { describe, it, expect } from 'vitest';
import { getNextSurfacePosition, getTunnelWorldPosInto, makeTunnelCenterline, buildTunnelCenterlineInto, tunnelTToArc, getTunnelArcPosInto, getTunnelArcPosSmoothInto } from '../worm/wormLogic.js';
import { ARM_A_END, ARM_B_START } from '../utils/tunnelPath.js';
import * as THREE from 'three';

// ─── arc-length tunnel sampling (worm body spacing in the wormhole) ───────────
describe('tunnel arc-length sampling', () => {
  const size = 3;
  // A tunnel whose entry/exit legs differ from the core leg, so uniform-t stepping
  // produces visibly uneven world spacing (the "stretched beads" bug).
  const tunnel = {
    entry: { x: 1, y: 2, z: 1, dirKey: 'PY' },
    exit: { x: 1, y: 0, z: 1, dirKey: 'NY' }
  };

  const sample = (sampler, n) => {
    const out = new THREE.Vector3();
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(sampler(out, i / (n - 1)).clone());
    return pts;
  };

  const spacings = (pts) => pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
  const spread = (arr) => Math.max(...arr) / Math.min(...arr);

  it('uniform-t sampling produces uneven world spacing (the bug)', () => {
    const pts = sample((out, t) => getTunnelWorldPosInto(out, tunnel, t, size), 20);
    // Legs have unequal world length but equal t-spans, so spacing varies.
    //
    // The threshold used to be 1.5. Anchoring tunnels on their tiles rather than
    // on the far side of the cubie lengthened both arms from 0.23 to 1.25 world
    // units against an unchanged 0.5 core leg, so the arm/core ratio — and with
    // it the unevenness — dropped to ~1.25. The bug this test characterises is
    // milder now, not gone: uniform-t stepping is still not uniform in world
    // space, which is why the arc-length sampler below exists.
    expect(spread(spacings(pts))).toBeGreaterThan(1.15);
  });

  it('arc-length sampling keeps world spacing uniform (the fix)', () => {
    const cl = buildTunnelCenterlineInto(makeTunnelCenterline(), tunnel, size);
    const pts = sample((out, s) => getTunnelArcPosInto(out, cl, s * cl.total), 20);
    // Even spacing along the whole path — within floating-point/leg-boundary slop.
    expect(spread(spacings(pts))).toBeLessThan(1.05);
  });

  it('tunnelTToArc spans 0..total monotonically across the legs', () => {
    const cl = buildTunnelCenterlineInto(makeTunnelCenterline(), tunnel, size);
    expect(tunnelTToArc(cl, 0)).toBeCloseTo(0);
    expect(tunnelTToArc(cl, 1)).toBeCloseTo(cl.total);
    // The arm/core landmarks are still where they always were — the entry arm is
    // just subdivided into throat + run-to-the-core now (see utils/tunnelPath).
    expect(tunnelTToArc(cl, ARM_A_END)).toBeCloseTo(cl.armALen);
    expect(tunnelTToArc(cl, ARM_B_START)).toBeCloseTo(cl.armALen + cl.legLen[2]);
    // Strictly increasing
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const a = tunnelTToArc(cl, Math.min(1, t));
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });
});

// ─── corner smoothing (the worm's motion, not the tube/camera) ────────────────
describe('tunnel corner smoothing', () => {
  const size = 3;
  // Off-centre on both mouths, so the entry/exit arms run diagonally into the core
  // and there are real bends where the legs meet.
  const tunnel = {
    entry: { x: 0, y: 2, z: 0, dirKey: 'PY' },
    exit: { x: 2, y: 0, z: 2, dirKey: 'NY' }
  };
  const cl = buildTunnelCenterlineInto(makeTunnelCenterline(), tunnel, size);
  const sharp = new THREE.Vector3();
  const smooth = new THREE.Vector3();

  it('rounds an interior corner — the smoothed point sits off the sharp vertex', () => {
    const corner = cl.armALen; // where the entry diagonal meets the core crossing
    getTunnelArcPosInto(sharp, cl, corner);
    getTunnelArcPosSmoothInto(smooth, cl, corner);
    expect(smooth.distanceTo(sharp)).toBeGreaterThan(0.01);
  });

  it('fades to the exact route at the mouths so the throat still threads the hole', () => {
    getTunnelArcPosInto(sharp, cl, 0.001);
    getTunnelArcPosSmoothInto(smooth, cl, 0.001);
    expect(smooth.distanceTo(sharp)).toBeLessThan(1e-3);
    getTunnelArcPosInto(sharp, cl, cl.total - 0.001);
    getTunnelArcPosSmoothInto(smooth, cl, cl.total - 0.001);
    expect(smooth.distanceTo(sharp)).toBeLessThan(1e-3);
  });
});

// ─── getNextSurfacePosition (covers FACE_TRANSITION_DIR paths) ────────────────
describe('getNextSurfacePosition', () => {
  const size = 3;

  it('moves within the same face without crossing an edge', () => {
    const pos = { x: 1, y: 1, z: 2, dirKey: 'PZ' };
    const next = getNextSurfacePosition(pos, 'right', size);
    expect(next).toBeTruthy();
    expect(next.x).toBe(2);
    expect(next.y).toBe(1);
    expect(next.z).toBe(2);
    expect(next.dirKey).toBe('PZ');
  });

  it('transitions from PZ face to PY face when moving up off the top edge', () => {
    // Top row of PZ face: moving 'up' crosses to PY
    const pos = { x: 1, y: 2, z: 2, dirKey: 'PZ' };
    const next = getNextSurfacePosition(pos, 'up', size);
    expect(next).toBeTruthy();
    expect(next.dirKey).toBe('PY');
  });

  it('transitions from PZ face to NY face when moving down off the bottom edge', () => {
    const pos = { x: 1, y: 0, z: 2, dirKey: 'PZ' };
    const next = getNextSurfacePosition(pos, 'down', size);
    expect(next).toBeTruthy();
    expect(next.dirKey).toBe('NY');
  });

  it('transitions from PZ face to PX face when moving right off the right edge', () => {
    const pos = { x: 2, y: 1, z: 2, dirKey: 'PZ' };
    const next = getNextSurfacePosition(pos, 'right', size);
    expect(next).toBeTruthy();
    expect(next.dirKey).toBe('PX');
  });

  it('transitions from PZ face to NX face when moving left off the left edge', () => {
    const pos = { x: 0, y: 1, z: 2, dirKey: 'PZ' };
    const next = getNextSurfacePosition(pos, 'left', size);
    expect(next).toBeTruthy();
    expect(next.dirKey).toBe('NX');
  });

  it('transitions from PX face to PY face when moving up off the top edge', () => {
    const pos = { x: 2, y: 2, z: 1, dirKey: 'PX' };
    const next = getNextSurfacePosition(pos, 'up', size);
    expect(next).toBeTruthy();
    expect(next.dirKey).toBe('PY');
  });

  it('transitions from PX face to NZ face when moving right off the right edge', () => {
    const pos = { x: 2, y: 1, z: 0, dirKey: 'PX' };
    const next = getNextSurfacePosition(pos, 'right', size);
    expect(next).toBeTruthy();
    expect(next.dirKey).toBe('NZ');
  });

  it('transitions from PY face to PZ face when moving down off the front edge', () => {
    const pos = { x: 1, y: 2, z: 2, dirKey: 'PY' };
    const next = getNextSurfacePosition(pos, 'down', size);
    expect(next).toBeTruthy();
    expect(next.dirKey).toBe('PZ');
  });

  it('returns null for an invalid face direction key', () => {
    const pos = { x: 1, y: 1, z: 1, dirKey: 'INVALID' };
    const next = getNextSurfacePosition(pos, 'up', size);
    expect(next).toBeNull();
  });
});
