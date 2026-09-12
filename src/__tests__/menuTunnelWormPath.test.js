import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { makeMenuTunnelWormPath, sampleMenuTunnelWorm, MENU_WORM_RADIUS, MENU_WORM_TAIL, MENU_WORM_SPEED, MENU_WORM_SPACING } from '../components/menus/menuTunnelWormPath.js';

const p = new Vector3(), n = new Vector3(), f = new Vector3();
describe('menu surface and antipodal tunnel trail', () => {
  for (const axis of [[1.501, 0, 0], [0, 1.501, 0], [0, 0, 1.501]]) {
    it(`crawls on both faces and crosses the center for ${axis}`, () => {
      const path = makeMenuTunnelWormPath(axis, 0.73);
      expect(path.portals.source.distanceTo(path.portals.entry)).toBeGreaterThan(2);
      expect(path.portals.exit.distanceTo(path.portals.destination)).toBeGreaterThan(2);
      expect(path.portals.entry.clone().add(path.portals.exit).length()).toBeLessThan(1e-8);
      for (const portal of Object.values(path.portals)) {
        expect(portal.toArray().filter(v => Math.abs(v) > 1e-8)).toHaveLength(1);
        expect(portal.length()).toBeCloseTo(1.501);
      }
      for (const [from, to] of path.surfaceRanges) {
        for (let i = from; i < to; i++) {
          const clearance = Math.hypot(...path.points[i].toArray().map(v => Math.max(0, Math.abs(v) - 1.501)));
          expect(clearance).toBeCloseTo(MENU_WORM_RADIUS * 0.86, 6);
        }
      }
      expect(path.points.some(point => point.length() < 0.01)).toBe(true);
    });
  }
  it('keeps following beads on the same continuous arc-length trail after head exit', () => {
    const path = makeMenuTunnelWormPath([0, 0, 1.501]);
    const previous = new Vector3();
    sampleMenuTunnelWorm(path, 0, previous, n, f);
    for (let s = 0.01; s < path.length; s += 0.01) {
      sampleMenuTunnelWorm(path, s, p, n, f);
      expect(p.distanceTo(previous)).toBeLessThanOrEqual(0.01001);
      expect(n.length()).toBeCloseTo(1, 8);
      expect(f.length()).toBeCloseTo(1, 8);
      expect(n.dot(f)).toBeCloseTo(0, 8);
      previous.copy(p);
      if (s > MENU_WORM_SPACING) {
        const behind = new Vector3();
        sampleMenuTunnelWorm(path, s - MENU_WORM_SPACING, behind, n, f);
        expect(p.distanceTo(behind)).toBeLessThanOrEqual(MENU_WORM_SPACING + 1e-8);
      }
    }
  });
  it('finishes only after the tail completes the final dive', () => {
    const path = makeMenuTunnelWormPath([0, 1.501, 0]);
    const head = path.length + MENU_WORM_TAIL / 2;
    expect(sampleMenuTunnelWorm(path, head, p, n, f)).toBe(false);
    expect(sampleMenuTunnelWorm(path, head - MENU_WORM_TAIL, p, n, f)).toBe(true);
    expect(path.duration * MENU_WORM_SPEED).toBeCloseTo(path.length + MENU_WORM_TAIL, 8);
    expect(sampleMenuTunnelWorm(path, path.duration * MENU_WORM_SPEED + 0.001 - MENU_WORM_TAIL, p, n, f)).toBe(false);
    expect(sampleMenuTunnelWorm(path, -0.01, p, n, f)).toBe(false);
  });
});
