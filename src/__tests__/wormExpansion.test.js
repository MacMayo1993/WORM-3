import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getStickerWorldPos } from '../game/coordinates.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { remapExpansionPoint, EXPLODE_AMOUNT, wormExpansion, getWormStickerWorldPos } from '../worm/wormExpansion.js';
import { makeWormSim, resetWormSim, evaluatePosAndNormal } from '../worm/healerWorm/wormSim.js';
import { tickExpansion } from '../worm/healerWorm/expansion.js';
import { advanceTunnelHead } from '../worm/healerWorm/tunnelTrail.js';
import { FACE_NORMALS, WORM_LIFT } from '../worm/healerWorm/constants.js';
import { shPush, shAt, shReset } from '../worm/circularBuffers.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { getWindWorldPosInto, makeTunnelCenterline, buildTunnelCenterlineInto, getTunnelArcPosSmoothInto } from '../worm/wormLogic.js';

afterEach(() => { wormExpansion.amount = 0; resetLiveRotation(); });

const surfaceTile = (face, size) => {
  const p = { x: Math.floor(size / 2), y: Math.floor(size / 2), z: Math.floor(size / 2), dirKey: face };
  p[face[1].toLowerCase()] = face[0] === 'P' ? size - 1 : 0;
  return p;
};
const point = (p, size, amount) => new THREE.Vector3().fromArray(getStickerWorldPos(p.x, p.y, p.z, p.dirKey, size, amount));

describe('expanded worm geometry', () => {
  it.each([2, 3, 5, 10, 15])('anchors every face and preserves lift on a %s cube', size => {
    for (const face of Object.keys(FACE_NORMALS)) {
      const tile = surfaceTile(face, size), normal = FACE_NORMALS[face];
      const start = point(tile, size, 0).addScaledVector(normal, WORM_LIFT + 0.8);
      const expanded = start.clone();
      remapExpansionPoint(expanded, size, 0, EXPLODE_AMOUNT);
      const target = point(tile, size, EXPLODE_AMOUNT).addScaledVector(normal, WORM_LIFT + 0.8);
      expect(expanded.distanceTo(target)).toBeLessThan(1e-8);
      remapExpansionPoint(expanded, size, EXPLODE_AMOUNT, 0);
      expect(expanded.distanceTo(start)).toBeLessThan(1e-8);
      wormExpansion.amount = EXPLODE_AMOUNT;
      expect(new THREE.Vector3().fromArray(getWormStickerWorldPos(tile.x, tile.y, tile.z, face, size)).distanceTo(point(tile, size, EXPLODE_AMOUNT))).toBeLessThan(1e-8);
    }
  });

  it('carries the in-progress step and history together without changing grid tags', () => {
    const size = 5, sim = makeWormSim(size);
    resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
    sim.prevTile = { x: 2, y: 2, z: 4, dirKey: 'PZ' };
    sim.pos = { x: 2, y: 3, z: 4, dirKey: 'PZ' };
    sim.prevWorldPos = sim._prevWP.copy(point(sim.prevTile, size, 0));
    sim.curWorldPos.copy(point(sim.pos, size, 0));
    sim.interpT = 0.4;
    sim.explodeT = 12;
    shReset(sim.stepHistory);
    shPush(sim.stepHistory, point(sim.prevTile, size, 0).addScaledVector(FACE_NORMALS.PZ, WORM_LIFT), FACE_NORMALS.PZ, 2, 2, 4);
    for (let i = 0; i < 12; i++) tickExpansion(sim, size, 0.1, {});
    const actual = new THREE.Vector3();
    evaluatePosAndNormal(sim, 0.4, actual);
    const expected = point(sim.prevTile, size, sim.expansionAmount).lerp(point(sim.pos, size, sim.expansionAmount), 0.4);
    expect(actual.distanceTo(expected)).toBeLessThan(1e-8);
    const record = shAt(sim.stepHistory, 0);
    expect([record.tx, record.ty, record.tz]).toEqual([2, 2, 4]);
    expect(record.pos.distanceTo(point(sim.prevTile, size, sim.expansionAmount).addScaledVector(FACE_NORMALS.PZ, WORM_LIFT))).toBeLessThan(1e-8);
    expect(cubeExpansionScale(size, sim.expansionAmount)).toBeGreaterThan(1.5);
  });

  it.each([3, 7, 15])('joins expanded tunnel mouths to their surface on a %s cube', size => {
    const tunnel = { entry: surfaceTile('PZ', size), exit: surfaceTile('NX', size) };
    const sim = makeWormSim(size);
    resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
    sim.expansionAmount = wormExpansion.amount = EXPLODE_AMOUNT;
    sim.activeTunnel = tunnel;
    const path = makeTunnelCenterline();
    buildTunnelCenterlineInto(path, tunnel, size);
    const aperture = new THREE.Vector3(), handoff = new THREE.Vector3();
    for (const [side, arc] of [['entry', 0], ['exit', 1]]) {
      getTunnelArcPosSmoothInto(aperture, path, arc * path.total);
      getWindWorldPosInto(handoff, tunnel, side, 1, size);
      expect(aperture.distanceTo(handoff)).toBeLessThan(1e-7);
      getWindWorldPosInto(handoff, tunnel, side, 0, size);
      expect(handoff.distanceTo(point(tunnel[side], size, EXPLODE_AMOUNT).addScaledVector(FACE_NORMALS[tunnel[side].dirKey], WORM_LIFT))).toBeLessThan(1e-7);
    }
    sim.tunnelProgress = 0;
    advanceTunnelHead(sim, 'windout', 1, size);
    expect(sim.headInterpPos.distanceTo(handoff)).toBeLessThan(1e-7);
  });
});
