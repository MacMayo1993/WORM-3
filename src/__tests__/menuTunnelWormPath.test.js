import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { makeMenuTunnelWormPath, sampleMenuTunnelWorm, MENU_WORM_RADIUS, MENU_WORM_TAIL, MENU_WORM_SPEED, MENU_WORM_SPACING } from '../components/menus/menuTunnelWormPath.js';

const p = new Vector3(), n = new Vector3(), f = new Vector3();
describe('menu surface and antipodal tunnel trail', () => {
  for (const axis of [[1.501, 0, 0], [0, 1.501, 0], [0, 0, 1.501]]) {
    it(`crawls on both faces and crosses the center for ${axis}`, () => {
      const path = makeMenuTunnelWormPath(axis, 0.73);
      let source = 0, exit = 0, core = false;
      const h = 1.501 + MENU_WORM_RADIUS * 0.86;
      path.points.forEach(point => {
        const axial = point.dot(path.normal);
        const lateral = point.clone().addScaledVector(path.normal, -axial).length();
        expect(Math.abs(axial)).toBeLessThanOrEqual(h + 1e-9);
        expect(lateral).toBeLessThan(1.3);
        if (Math.abs(axial - h) < 1e-8) source++;
        if (Math.abs(axial + h) < 1e-8) exit++;
        if (point.length() < 0.01) core = true;
        if (Math.abs(axial) < 1) expect(lateral).toBeLessThan(0.13);
      });
      expect(source).toBeGreaterThan(250);
      expect(exit).toBeGreaterThan(250);
      expect(core).toBe(true);
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
