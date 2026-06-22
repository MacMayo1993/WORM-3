import { describe, it, expect } from 'vitest';
import { createInitialTunnelWorm, findNextTunnel, getTunnelSideKey, checkSelfCollision, getNextSurfacePosition, getTunnelWorldPosInto, makeTunnelCenterline, buildTunnelCenterlineInto, tunnelTToArc, getTunnelArcPosInto } from '../worm/wormLogic.js';
import * as THREE from 'three';

describe('tunnel worm logic', () => {
  const size = 3;

  const tunnelA = {
    id: 'tunnel-a',
    entry: { x: 0, y: 1, z: 1, dirKey: 'NX' },
    exit: { x: 2, y: 1, z: 1, dirKey: 'PX' }
  };

  const tunnelB = {
    id: 'tunnel-b',
    entry: { x: 2, y: 1, z: 2, dirKey: 'PZ' },
    exit: { x: 0, y: 1, z: 2, dirKey: 'NZ' }
  };

  it('initial tunnel worm starts with forward tunnel direction', () => {
    const worm = createInitialTunnelWorm([tunnelA], 3);
    expect(worm).toHaveLength(3);
    expect(worm.every(seg => seg.direction === 1)).toBe(true);
  });

  it('finds a next tunnel entry when side is active', () => {
    const result = findNextTunnel(tunnelA.exit, [tunnelA, tunnelB], tunnelA.id, size, new Set());
    expect(result).toBeTruthy();
    expect(result.tunnel.id).toBe('tunnel-b');
    expect(result.enteredSideKey).toBe(getTunnelSideKey(tunnelB.entry));
  });

  it('skips tunnels when the chosen entry side was already consumed', () => {
    const inactive = new Set([getTunnelSideKey(tunnelB.entry)]);
    const result = findNextTunnel(tunnelA.exit, [tunnelA, tunnelB], tunnelA.id, size, inactive);
    expect(result).toBeTruthy();
    expect(result.tunnel.id).toBe('tunnel-b');
    expect(result.enteredSideKey).toBe(getTunnelSideKey(tunnelB.exit));
    expect(result.enterFromEntry).toBe(false);
  });
});

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
    // Legs have unequal world length but equal t-spans, so spacing varies a lot.
    expect(spread(spacings(pts))).toBeGreaterThan(1.5);
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
    expect(tunnelTToArc(cl, 0.4)).toBeCloseTo(cl.l1);
    expect(tunnelTToArc(cl, 0.6)).toBeCloseTo(cl.l1 + cl.l2);
    // Strictly increasing
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const a = tunnelTToArc(cl, Math.min(1, t));
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });
});

// ─── checkSelfCollision ───────────────────────────────────────────────────────
describe('checkSelfCollision', () => {
  const h = (x, y, z, dirKey = 'PZ') => ({ x, y, z, dirKey });

  it('returns false when fewer than 3 segments', () => {
    expect(checkSelfCollision(h(1, 1, 2), [h(1, 1, 2), h(1, 1, 1)])).toBe(false);
  });

  it('returns false when head matches only the tail (not growing)', () => {
    // tail is excluded when isGrowing=false
    const segs = [h(1, 1, 2), h(1, 1, 1), h(1, 1, 0)];
    expect(checkSelfCollision(h(1, 1, 0), segs, false)).toBe(false);
  });

  it('returns true when head matches a non-tail body segment', () => {
    const segs = [h(2, 1, 2), h(1, 1, 2), h(1, 1, 1), h(1, 1, 0)];
    expect(checkSelfCollision(h(1, 1, 2), segs)).toBe(true);
  });

  it('returns true when head matches tail while growing', () => {
    const segs = [h(1, 1, 2), h(1, 1, 1), h(1, 1, 0)];
    expect(checkSelfCollision(h(1, 1, 0), segs, true)).toBe(true);
  });

  it('returns false when head does not match any body segment', () => {
    const segs = [h(0, 1, 2), h(0, 1, 1), h(0, 1, 0), h(0, 0, 0)];
    expect(checkSelfCollision(h(1, 0, 0), segs)).toBe(false);
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
