import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { tunnelMouthGlow } from '../worm/tunnelMouthGlow.js';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';
import { makeTunnelPath } from '../utils/tunnelPath.js';
import { interiorPortalFrameInto } from '../worm/healerWorm/interiorPortals.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { WORM_PAD_HEIGHT, wormRaisedAmount } from '../game/raisedCubie.js';
import { SURFACE_OFFSET } from '../utils/constants.js';

it.each([2, 3, 6, 15])('lights the complete wall on every entry/exit face at size %s', size => {
  const center = new Vector3(), axis = new Vector3();
  for (const face of ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ']) for (const raised of [false, true]) {
    const n = size - 1, entry = { x: n, y: n, z: n, dirKey: face };
    entry[face[1].toLowerCase()] = face[0] === 'P' ? n : 0;
    const exit = { x: n - entry.x, y: n - entry.y, z: n - entry.z,
      dirKey: (face[0] === 'P' ? 'N' : 'P') + face[1] };
    const tunnel = { entry, exit, padExpansion: raised ? wormRaisedAmount(size) : 0, padHeight: raised ? WORM_PAD_HEIGHT : 0 };
    const path = buildTunnelPathForTunnel(makeTunnelPath(), tunnel, size);
    for (const side of [0, 1]) {
      const mouth = side ? path.vEnd : path.vStart, normal = side ? path.nEnd : path.nStart;
      // The raised mouth, sticker, dimming shell and black backing all sit in
      // this interval. Check world-space positions, independently of head t.
      const inner = (size - 1) / 2 * cubeExpansionScale(size, 0) + SURFACE_OFFSET - .1;
      for (let i = 0; i <= 10; i++) {
        const height = inner + (mouth.dot(normal) - inner) * i / 10;
        interiorPortalFrameInto(center, axis, path, side, height);
        expect(tunnelMouthGlow(center, tunnel, size)).toBeCloseTo(1, 5);
      }
      let last = 1;
      for (let i = 0; i <= 50; i++) {
        center.copy(mouth).addScaledVector(normal, i / 100);
        const light = tunnelMouthGlow(center, tunnel, size);
        expect(light).toBeLessThanOrEqual(last + 1e-10);
        expect(Math.abs(light - last)).toBeLessThan(.04);
        last = light;
      }
      expect(last).toBe(0);
    }
  }
});

it('leaves unrelated tiles and an inactive passage clear', () => {
  const tunnel = { entry: { x: 2, y: 2, z: 4, dirKey: 'PZ' }, exit: { x: 2, y: 2, z: 0, dirKey: 'NZ' } };
  expect(tunnelMouthGlow(new Vector3(2, 2, 2.5), tunnel, 5)).toBe(0);
  expect(tunnelMouthGlow(new Vector3(), tunnel, 5)).toBe(0);
  expect(tunnelMouthGlow(new Vector3(0, 0, 2.5), null, 5)).toBe(0);
});
