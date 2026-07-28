import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  makeTunnelPath,
  buildTunnelPathInto,
  tunnelPathPointInto,
  tunnelPathTToArc,
  tunnelPathArcPointInto,
  tunnelPathArcPointExtendedInto,
  tunnelPathRibbonInto,
  tunnelPathRibbonTangentInto,
  TUNNEL_MINI_FACE_R,
  TUNNEL_THROAT,
  ARM_A_END,
  ARM_B_START
} from '../utils/tunnelPath.js';
import { SURFACE_OFFSET } from '../utils/constants.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Surface anchor of a tile on the +Y face of a `size` cube, at grid column
 * (gx, gz). The corner tiles are the interesting ones: their route to the core
 * dock is almost entirely lateral.
 */
const topAnchor = (size, gx, gz) => {
  const k = (size - 1) / 2;
  return V(gx - k, size - 1 - k + SURFACE_OFFSET, gz - k);
};

const buildTop = (size, gx, gz, exitAnchor = null, exitNormal = null) => {
  const path = makeTunnelPath();
  const n1 = V(0, 1, 0);
  const n2 = exitNormal ?? V(0, -1, 0);
  const vEnd = exitAnchor ?? topAnchor(size, gx, gz).clone().setY(-(topAnchor(size, gx, gz).y));
  return buildTunnelPathInto(path, topAnchor(size, gx, gz), n1, vEnd, n2);
};

/** Lateral (in-face) distance of `p` from the entry tile's centre axis. */
const lateralFromEntryAxis = (p, anchor) => Math.hypot(p.x - anchor.x, p.z - anchor.z);

describe('buildTunnelPathInto', () => {
  it('opens each mouth with a straight run along that tile\'s own normal', () => {
    for (const size of [2, 3, 4, 5]) {
      const path = buildTop(size, 0, 0); // corner tile — worst case
      const anchor = topAnchor(size, 0, 0);
      // The throat is purely axial: same x/z as the surface anchor, strictly below it.
      expect(path.throatA.x).toBeCloseTo(anchor.x, 10);
      expect(path.throatA.z).toBeCloseTo(anchor.z, 10);
      expect(path.throatA.y).toBeLessThan(anchor.y);
      expect(path.legLen[0]).toBeGreaterThan(0);
    }
  });

  it('never drives a throat past the core dock', () => {
    for (const size of [2, 3, 4, 5]) {
      const path = buildTop(size, 0, 0);
      // Dock plane on the entry side sits at y = TUNNEL_MINI_FACE_R.
      expect(path.throatA.y).toBeGreaterThan(TUNNEL_MINI_FACE_R);
      expect(path.legLen[0]).toBeLessThanOrEqual(TUNNEL_THROAT + 1e-9);
    }
  });

  it('docks on the mini-cube faces', () => {
    const path = buildTop(4, 0, 3);
    expect(path.midA.toArray()).toEqual([0, TUNNEL_MINI_FACE_R, 0]);
    expect(path.midB.toArray()).toEqual([0, -TUNNEL_MINI_FACE_R, 0]);
  });

  it('accepts a dock direction that differs from the throat direction', () => {
    // A tile mid-flip has a world normal that no longer matches its colour's face:
    // the throat must follow the tile, the dock the colour.
    const path = makeTunnelPath();
    buildTunnelPathInto(path, V(0, 2, 0), V(0, 1, 0), V(0, -2, 0), V(0, -1, 0), V(1, 0, 0), V(-1, 0, 0));
    expect(path.throatA.x).toBe(0);            // straight down the tile's own normal
    expect(path.midA.x).toBe(TUNNEL_MINI_FACE_R); // docked on the colour's face
  });
});

describe('the entry run stays on the tile axis', () => {
  it('keeps the head dead centre in the hole until it is a throat deep', () => {
    for (const size of [3, 5]) {
      for (const [gx, gz] of [[0, 0], [1, 0], [size - 1, size - 1]]) {
        const path = buildTop(size, gx, gz);
        const anchor = topAnchor(size, gx, gz);
        const p = new THREE.Vector3();
        // Everything up to the end of the throat's parameter span is axial.
        for (let t = 0; t <= path.legT[0] + 1e-9; t += path.legT[0] / 20) {
          tunnelPathPointInto(p, path, t);
          expect(lateralFromEntryAxis(p, anchor)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('mirrors the throat on the exit mouth', () => {
    const path = buildTop(5, 0, 0);
    const p = new THREE.Vector3();
    const exitLateral = (v) => Math.hypot(v.x - path.vEnd.x, v.z - path.vEnd.z);
    for (let t = 1; t >= 1 - path.legT[4] - 1e-9; t -= path.legT[4] / 20) {
      tunnelPathPointInto(p, path, t);
      expect(exitLateral(p)).toBeLessThan(1e-9);
    }
  });
});

describe('parameterisation', () => {
  const path = buildTop(4, 0, 3);

  it('pins the mouths and the arm/core landmarks', () => {
    const p = new THREE.Vector3();
    expect(tunnelPathPointInto(p, path, 0).distanceTo(path.vStart)).toBeCloseTo(0, 10);
    expect(tunnelPathPointInto(p, path, 1).distanceTo(path.vEnd)).toBeCloseTo(0, 10);
    expect(tunnelPathPointInto(p, path, ARM_A_END).distanceTo(path.midA)).toBeCloseTo(0, 10);
    expect(tunnelPathPointInto(p, path, ARM_B_START).distanceTo(path.midB)).toBeCloseTo(0, 10);
  });

  it('advances monotonically in arc-length and never jumps', () => {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    let prevArc = -1;
    tunnelPathPointInto(a, path, 0);
    for (let t = 0.005; t <= 1.0001; t += 0.005) {
      const arc = tunnelPathTToArc(path, Math.min(1, t));
      expect(arc).toBeGreaterThanOrEqual(prevArc);
      prevArc = arc;
      tunnelPathPointInto(b, path, Math.min(1, t));
      // No teleports: the longest leg is well under a cube's width, so a 0.005
      // step can never cover more than a fraction of a unit.
      expect(a.distanceTo(b)).toBeLessThan(0.25);
      a.copy(b);
    }
    expect(prevArc).toBeCloseTo(path.total, 6);
  });

  it('samples evenly in world space when stepped by arc-length', () => {
    const pts = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < 40; i++) pts.push(tunnelPathArcPointInto(p, path, (i / 39) * path.total).clone());
    const gaps = pts.slice(1).map((q, i) => q.distanceTo(pts[i]));
    // Only the step that straddles a corner is short (it cuts the chord), so the
    // tolerance is a hair over exact — nothing like the stretched beads that
    // uniform-t stepping produces.
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.1);
  });
});

describe('tunnelPathArcPointExtendedInto', () => {
  it('continues straight out of the mouth it left by', () => {
    const path = buildTop(3, 0, 0);
    const p = new THREE.Vector3();
    // A camera trailing 1.5 units behind a head that has only just entered is
    // still outside the cube — on the entry tile's axis, above its surface.
    tunnelPathArcPointExtendedInto(p, path, -1.5);
    expect(p.x).toBeCloseTo(path.vStart.x, 10);
    expect(p.z).toBeCloseTo(path.vStart.z, 10);
    expect(p.y).toBeCloseTo(path.vStart.y + 1.5, 10);

    tunnelPathArcPointExtendedInto(p, path, path.total + 0.8);
    expect(p.x).toBeCloseTo(path.vEnd.x, 10);
    expect(p.y).toBeCloseTo(path.vEnd.y - 0.8, 10);
  });
});

describe('ribbon sampling', () => {
  const path = buildTop(5, 0, 0);

  it('spans mouth to dock on each arm, with the core skipped', () => {
    const p = new THREE.Vector3();
    expect(tunnelPathRibbonInto(p, path, 0).distanceTo(path.vStart)).toBeCloseTo(0, 10);
    expect(tunnelPathRibbonInto(p, path, 0.5).distanceTo(path.midA)).toBeCloseTo(0, 6);
    expect(tunnelPathRibbonInto(p, path, 0.5 + 1e-9).distanceTo(path.midB)).toBeCloseTo(0, 6);
    expect(tunnelPathRibbonInto(p, path, 1).distanceTo(path.vEnd)).toBeCloseTo(0, 10);
  });

  it('tessellates evenly along each arm', () => {
    const p = new THREE.Vector3();
    const pts = [];
    for (let i = 0; i <= 32; i++) pts.push(tunnelPathRibbonInto(p, path, i / 64).clone());
    const gaps = pts.slice(1).map((q, i) => q.distanceTo(pts[i]));
    // As above: the one step across the throat's corner is a chord, so slightly short.
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.1);
  });

  it('reports the tangent of the leg it is on, so rails follow the bend', () => {
    const tan = new THREE.Vector3();
    tunnelPathRibbonTangentInto(tan, path, 0.001);
    // Leaving the entry mouth: straight down the tile's normal.
    expect(tan.x).toBeCloseTo(0, 10);
    expect(tan.y).toBeCloseTo(-1, 10);
    tunnelPathRibbonTangentInto(tan, path, 0.999);
    // Arriving at the exit mouth: straight out along its normal.
    expect(tan.y).toBeCloseTo(-1, 10);
    expect(tan.x).toBeCloseTo(0, 10);
  });
});
