import { describe, expect, it } from 'vitest';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';
import { makeTunnelPath, tunnelPathTToArc, ARM_A_END, ARM_B_START } from '../utils/tunnelPath.js';

// The worm rides the route at a pace set per leg: a steady throat at each mouth,
// a slow steady crossing through the core, curved shoulders between. The
// shoulders used to be linear too, so the pace switched in a single frame at
// each dock: a lurch of 3× on a 5×5 and 14× on a 15×15, felt by the worm and by
// the lens trailing it. The shoulders now ease between their neighbours' paces.
const routes = size => {
  const n = size - 1, m = Math.floor(size / 2);
  return {
    straight: { entry: { x: m, y: n, z: m, dirKey: 'PY' }, exit: { x: m, y: 0, z: m, dirKey: 'NY' } },
    bent: { entry: { x: m, y: n, z: m, dirKey: 'PY' }, exit: { x: n, y: m, z: m, dirKey: 'PX' } },
    corner: { entry: { x: 0, y: n, z: 0, dirKey: 'PY' }, exit: { x: n, y: 0, z: n, dirKey: 'PZ' } },
  };
};

describe('tunnel pacing', () => {
  for (const size of [2, 3, 5, 8, 15]) for (const [name, tunnel] of Object.entries(routes(size))) {
    it(`keeps its landmarks and changes pace smoothly on a ${size}×${size} ${name} route`, () => {
      const path = makeTunnelPath();
      buildTunnelPathForTunnel(path, tunnel, size);
      // Phase landmarks and every leg boundary land where they always did.
      for (let i = 0; i < 6; i++) if (path.legT[i] > 0) expect(tunnelPathTToArc(path, path.legT0[i])).toBeCloseTo(path.legArc0[i], 10);
      expect(tunnelPathTToArc(path, 1)).toBeCloseTo(path.total, 10);
      expect(tunnelPathTToArc(path, ARM_A_END)).toBeCloseTo(path.armALen, 10);
      expect(tunnelPathTToArc(path, ARM_B_START)).toBeCloseTo(path.total - path.armBLen, 10);
      // Forward only, and no step in pace anywhere.
      const h = 1e-7;
      let last = -Infinity;
      for (let i = 0; i <= 2000; i++) {
        const arc = tunnelPathTToArc(path, i / 2000);
        expect(arc).toBeGreaterThanOrEqual(last - 1e-12);
        last = arc;
      }
      for (let i = 1; i < 6; i++) {
        if (!(path.legT[i] > 0) || !(path.legT[i - 1] > 0)) continue;
        const t = path.legT0[i], at = tunnelPathTToArc(path, t);
        const before = (at - tunnelPathTToArc(path, t - h)) / h, after = (tunnelPathTToArc(path, t + h) - at) / h;
        expect(Math.abs(after - before) / Math.max(before, after)).toBeLessThan(0.02);
      }
    });
  }
});
