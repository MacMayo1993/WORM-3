import { it, expect } from 'vitest';
import { Vector3 } from 'three';
import { makeCubies } from '../game/cubeState.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { makeWormSim, resetWormSim, startJump, jumpLiftOf, queueTurn, stepWormSim } from '../worm/healerWorm/wormSim.js';
import { FACE_NORMALS } from '../worm/healerWorm/constants.js';
import { samplePlatformArc, tickPlatformJump } from '../worm/healerWorm/raisedPlatforms.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { nearbyPlatform } from '../worm/platformFraming.js';

function setup(size, ahead = 0, face = 'PZ') {
  resetLiveRotation();
  const cubies = makeCubies(size), mid = Math.floor(size / 2), normal = FACE_NORMALS[face];
  const axis = normal.toArray().findIndex(v => v !== 0), xyz = [mid, mid, mid];
  xyz[axis] = normal.getComponent(axis) > 0 ? size - 1 : 0;
  const target = { x: xyz[0], y: xyz[1], z: xyz[2], dirKey: face };
  cubies[xyz[0]][xyz[1]][xyz[2]].stickers[face].flips = 1;
  // Shift along PZ's rightward approach for the two-cell integration cases.
  const pos = { ...target, x: target.x - ahead };
  const sim = makeWormSim(size); resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  sim.pos = pos; sim.moveDir = 'right'; sim.currentNormal.copy(normal);
  sim.headInterpPos.fromArray(getStickerWorldPos(pos.x, pos.y, pos.z, face, size));
  sim.curWorldPos.copy(sim.headInterpPos); sim.selfCollisionGraceSteps = 1;
  const ctx = { getCubies: () => cubies, getTunnelEntry: () => 'pad', feel: () => {},
    isPaused: () => false, getSpeed: () => 2, getGamePhase: () => 'active', getControlMode: () => 'non-oriented',
    getWormholeInterval: () => 9999, resolveTunnel: () => null };
  return { sim, ctx, target, cubies, normal };
}

it.each([3, 7, 15])('clears the actual raised cubie on every face of a %i cube', size => {
  for (const face of Object.keys(FACE_NORMALS)) {
    const { sim, ctx, normal } = setup(size, 0, face);
    startJump(sim, ctx, size, { allowDive: false });
    const flight = sim.padFlight;
    expect(flight).toBeTruthy();
    const center = flight.end.clone().addScaledVector(normal, -.52 - .5);
    for (let i = 0; i <= 120; i++) {
      const point = samplePlatformArc(flight, i / 120, new Vector3());
      const delta = point.clone().sub(center).toArray().map(Math.abs);
      // A worm-radius margin around the solid 0.96-unit body.
      expect(delta.some(v => v >= .65)).toBe(true);
    }
    for (let i = 0; i < 160 && sim.padFlight; i++) tickPlatformJump(sim, 1 / 120);
    expect(sim.onRaisedPlatform).toBe(true);
    expect(sim.headInterpPos.distanceTo(flight.end)).toBeLessThan(1e-8);
  }
});

it.each([7, 15])('captures an early queued jump two cells before a raised %i cubie', size => {
  const { sim, ctx, target, cubies } = setup(size, 2);
  const worm = { pos: { current: sim.pos }, moveDir: { current: sim.moveDir } };
  const cameraTarget = nearbyPlatform(worm, size, { cubies, wormHealerMode: true, demoMode: false });
  const origin = sim.headInterpPos.clone();
  queueTurn(sim, 'jump', ctx);
  stepWormSim(sim, 1 / 60, size, ctx);
  expect(sim.padFlight.target).toMatchObject(target);
  expect(sim.padFlight.end.toArray()).toEqual(cameraTarget);
  expect(sim.headInterpPos.distanceTo(origin)).toBeLessThan(1e-8);
  for (let i = 0; i < 100 && sim.padFlight; i++) stepWormSim(sim, 1 / 60, size, ctx);
  expect(sim.onRaisedPlatform).toBe(true);
  expect(sim.pos).toMatchObject(target);
});

it('retargets an airborne jump from its visible height and keeps rocket/demo jumps separate', () => {
  const { sim, ctx } = setup(7, 1);
  sim.isJumping = true; sim.jumpT = .4; sim.jumpHeight = 1.3;
  const visible = sim.headInterpPos.clone().addScaledVector(sim.currentNormal, jumpLiftOf(sim));
  startJump(sim, ctx, 7);
  expect(sim.padFlight.start.distanceTo(visible)).toBeLessThan(1e-8);
  const rocket = setup(7, 1); rocket.sim.rocketActive = true;
  startJump(rocket.sim, rocket.ctx, 7); expect(rocket.sim.padFlight).toBeNull();
  const demo = setup(7, 1);
  startJump(demo.sim, { ...demo.ctx, getTunnelEntry: () => 'crawl' }, 7);
  expect(demo.sim.padFlight).toBeNull();
  expect(demo.sim.jumpHeight).toBe(1.3);
});
