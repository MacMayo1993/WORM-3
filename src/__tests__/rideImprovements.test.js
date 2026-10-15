import { expect, it } from 'vitest';
import * as THREE from 'three';
import { makeTunnelCamPose, tunnelCamPoseInto, tunnelEntryPoseInto } from '../worm/tunnelCameraRails.js';
import { auditRide } from '../../scripts/perf-worm/ride-framing.mjs';
import { makeTunnelPath, buildTunnelPathInto, tunnelRiderDockWidth } from '../utils/tunnelPath.js';
import { makeStepHistory, shAt } from '../worm/circularBuffers.js';
import { advanceTunnelHead } from '../worm/healerWorm/tunnelTrail.js';
import { tunnelBodyScale } from '../worm/healerWorm/tunnelBodyFit.js';

it('keeps large same-face rides readable and bounds both aim and bank across frame rates and faces', () => {
  for (const fps of [30, 60, 120]) for (const aspect of [.45, 1.6]) {
    for (const axis of [0, 1, 2]) for (const reverse of [false, true]) {
      const a = [7, 7, 7], b = [7, 7, 7];
      a[axis] = 0; b[axis] = 1;
      // Two neighboring mouths on one face: the closest return pass.
      const face = (axis + 1) % 3;
      a[face] = b[face] = 14;
      const cell = xyz => ({x: xyz[0], y: xyz[1], z: xyz[2], dirKey: ['PX','PY','PZ'][face]});
      const route = {entry: cell(reverse ? b : a), exit: cell(reverse ? a : b), padHeight: .2};
      const result = auditRide(15, route, aspect, fps);
      expect(result.worstFrame).toBeLessThan(.94);
      expect(result.minCoreHeight).toBeGreaterThan(.045);
      expect(result.maxRotation * fps, JSON.stringify({fps,aspect,axis,reverse,result})).toBeLessThan(310);
    }
  }
});

it('records the larger physical gauge so contacts and trailing beads use the same fit', () => {
  for (const size of [3, 7, 15]) {
    const sim = {activeTunnel: {entry:{x:0,y:size-1,z:0,dirKey:'PY'},exit:{x:size-1,y:0,z:0,dirKey:'NY'}},
      tunnelProgress: 0, headInterpPos: new THREE.Vector3(), currentNormal: new THREE.Vector3(), stepHistory: makeStepHistory(4096)};
    advanceTunnelHead(sim, 'tunnel', .5, size);
    expect(sim.tunnelRide.rideWidth).toBeCloseTo(tunnelRiderDockWidth(size), 9);
    expect(shAt(sim.stepHistory, 0).rideWidth).toBeCloseTo(sim.tunnelRide.rideWidth, 9);
    expect(.12 * tunnelBodyScale(sim.tunnelRide, .12)).toBeGreaterThanOrEqual(.0228 - 1e-9);
  }
});

it('reuses route tables and invalidates every mutable geometric input', () => {
  const cached = makeTunnelPath(), fresh = makeTunnelPath();
  const args = [new THREE.Vector3(0,2,0), new THREE.Vector3(0,1,0), new THREE.Vector3(2,0,0),
    new THREE.Vector3(1,0,0), new THREE.Vector3(0,.2,0), new THREE.Vector3(.2,0,0), new THREE.Vector3()];
  buildTunnelPathInto(cached, ...args);
  const version = cached.version;
  for (let i=0;i<100;i++) buildTunnelPathInto(cached, ...args);
  expect(cached.version).toBe(version);
  for (let i=0;i<args.length;i++) {
    args[i].z += .04;
    buildTunnelPathInto(cached, ...args);
    fresh.buildMask = -1;
    buildTunnelPathInto(fresh, ...args);
    expect(cached.version).toBe(version+i+1);
    expect(cached.legArc).toEqual(fresh.legArc);
    expect(cached.legM0).toEqual(fresh.legM0);
    expect(cached.total).toBe(fresh.total);
  }
  buildTunnelPathInto(cached, ...args.slice(0,4));
  expect(cached.version).toBe(version+8);
});

it('hands the offset return camera from the dive to the ride without a position cut', () => {
  const tunnel = {entry:{x:0,y:14,z:7,dirKey:'PY'}, exit:{x:14,y:14,z:7,dirKey:'PY'}};
  const from = makeTunnelCamPose(), entry = makeTunnelCamPose(), ride = makeTunnelCamPose();
  from.cam.set(-7,9,0); from.look.set(-7,7,0); from.up.set(1,0,0);
  tunnelEntryPoseInto(entry,tunnel,1,15,from);
  tunnelCamPoseInto(ride,tunnel,.4,15);
  expect(entry.cam.distanceTo(ride.cam)).toBeLessThan(1e-10);
  expect(entry.look.clone().sub(entry.cam).normalize().angleTo(ride.look.clone().sub(ride.cam).normalize())).toBeLessThan(1e-7);
});
