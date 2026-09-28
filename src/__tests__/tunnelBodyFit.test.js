import { coreOpeningRadius } from '../3d/corePassage.js';
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { makeStepHistory, shPush, shAt } from '../worm/circularBuffers.js';
import { makeTunnelBodyProfile, blendTunnelBodyProfile, fitTunnelBodyInto } from '../worm/healerWorm/tunnelBodyFit.js';
import { makeTunnelCenterline, buildTunnelCenterlineInto } from '../worm/wormLogic.js';
import { makeTunnelRideFrame, tunnelRideFrameInto, tunnelRideWidthAt } from '../utils/tunnelRide.js';
import { tunnelDockWidth } from '../utils/tunnelPath.js';

it('fits every character footprint and swimming stroke between the rails, from mouth through the core', () => {
  const frame = makeTunnelRideFrame(), profile = makeTunnelBodyProfile(), fit = {};
  for (const size of [2, 3, 6, 15]) for (const reverse of [false, true]) {
    const entry = { x: 0, y: size - 1, z: 0, dirKey: 'PY' };
    const exit = { x: size - 1, y: 0, z: size - 1, dirKey: 'PZ' };
    const route = reverse ? { entry: exit, exit: entry } : { entry, exit };
    const path = buildTunnelCenterlineInto(makeTunnelCenterline(), route, size);
    for (let step = 0; step <= 200; step++) {
      const arc = step / 200 * path.total;
      tunnelRideFrameInto(frame, path, arc);
      Object.assign(profile, { rideWeight: 1, rideWidth: tunnelRideWidthAt(path, arc, tunnelDockWidth(size)),
        rideClearance: frame.center.distanceTo(frame.floor) });
      for (const radius of [0.082, 0.092, 0.12, 0.16, 0.22]) for (const side of [-0.07, 0, 0.07]) {
        fitTunnelBodyInto(fit, profile, radius, side, 0.014);
        expect(radius * fit.scale + Math.abs(fit.side)).toBeLessThan(profile.rideWidth / 2);
        const belly = profile.rideClearance + fit.shift - radius * fit.scale;
        expect(belly).toBeCloseTo(0, 10);
        expect(fit.scale).toBeGreaterThan(0);
      }
    }
  }
});

it('retains the tail gauge independently of the head and clears reused surface slots', () => {
  const history = makeStepHistory(2), position = new THREE.Vector3(), normal = new THREE.Vector3(0, 1, 0);
  const head = { rideWidth: 0.04, rideClearance: 0.015, rideWeight: 1 };
  shPush(history, position, normal, -1, -1, -1, true, head);
  head.rideWidth = 0.36; head.rideWeight = 0;
  expect(shAt(history, 0).rideWidth).toBe(0.04);
  expect(shAt(history, 0).rideWeight).toBe(1);
  shPush(history, position, normal, 0, 0, 0);
  const profile = blendTunnelBodyProfile(makeTunnelBodyProfile(), shAt(history, 0), shAt(history, 1), 0.5);
  expect(profile.rideWidth).toBeCloseTo(0.2);
  expect(profile.rideWeight).toBe(0.5);
  shPush(history, position, normal, 0, 0, 0);
  expect(shAt(history, 0).rideWeight).toBe(0);
  expect(shAt(history, 0).rideClearance).toBe(0);
  const untouched = fitTunnelBodyInto({}, makeTunnelBodyProfile(), 0.12, 0.04, 0.01);
  expect(untouched).toEqual({ scale: 1, side: 0.04, lift: 0.01, shift: 0 });
});

it('fits the complete seated head and its face through one tile even without core zoom', () => {
  for (const size of [2,3,6,15]) for (const radius of [.092,.16,.22]) {
    const width=tunnelDockWidth(size);
    const fit=fitTunnelBodyInto({}, {rideWeight:1,rideWidth:width,rideClearance:0},radius,.07,.014);
    expect(Math.hypot(fit.shift + radius*fit.scale*1.1 + fit.lift,fit.side)).toBeLessThan(coreOpeningRadius(size));
  }
});
