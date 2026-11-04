import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';
import { makeTunnelPath, tunnelThroatShare, TUNNEL_THROAT_SLOWDOWN, TUNNEL_THROAT_T_SHARE } from '../utils/tunnelPath.js';
import { coreZoomLimit } from '../3d/antipodalCore.js';
import { TUNNEL_CROSSING_SECONDS, defaultTunnelArmSeconds, tunnelArmSeconds, tunnelCrossingSeconds,
  tunnelHandoffSeconds, WORM_PAD_HEIGHT } from '../worm/healerWorm/constants.js';
import { tunnelRideTiming, CROSSING_SECONDS_MIN, CROSSING_SECONDS_MAX } from '../worm/healerWorm/tunnelTiming.js';
import { makeStepHistory, shPush } from '../worm/circularBuffers.js';
import { makeCorePass, resetCorePass, watchCorePass, corePassRate, CORE_PASS_RATE, CORE_PASS_SLOW_SECONDS,
  CORE_PASS_RADIUS } from '../worm/healerWorm/corePass.js';
import { makeWormSim, resetWormSim, stepWormSim } from '../worm/healerWorm/wormSim.js';
import { resetLiveRotation, liveRotation } from '../worm/liveRotation.js';

// A ride's time inside the cube follows what the player sees: no stretch of it
// should run many times faster than another (it used to reach 11× on a 15×15,
// dawdling in the throat, streaking down the shoulder, crawling through the core).
const routes = size => {
  const n = size - 1, m = Math.floor(size / 2);
  return {
    straight: { entry: { x: m, y: n, z: m, dirKey: 'PY' }, exit: { x: m, y: 0, z: m, dirKey: 'NY' } },
    corner: { entry: { x: 0, y: n, z: 0, dirKey: 'PY' }, exit: { x: n, y: 0, z: n, dirKey: 'PZ' } },
    mixed: { entry: { x: 0, y: n, z: 0, dirKey: 'PY' }, exit: { x: m, y: 0, z: m, dirKey: 'NY' } },
  };
};
const legPaces = (tunnel, size) => {
  const path = makeTunnelPath();
  buildTunnelPathForTunnel(path, tunnel, size);
  const zoom = coreZoomLimit(path.midA, size);
  const span = [0.4, 0.4, 0.2, 0.2, 0.4, 0.4];
  const secs = [tunnelArmSeconds(tunnel), tunnelArmSeconds(tunnel), tunnelCrossingSeconds(tunnel), tunnelCrossingSeconds(tunnel),
    tunnelArmSeconds(tunnel, 'exit'), tunnelArmSeconds(tunnel, 'exit')];
  return [...path.legLen].map((len, i) => len * (i === 2 || i === 3 ? zoom : 1) / (path.legT[i] / span[i] * secs[i]));
};

describe('balanced ride timing', () => {
  for (const size of [2, 3, 5, 8, 15]) for (const [name, route] of Object.entries(routes(size))) {
    it(`keeps a ${size}×${size} ${name} ride's total and evens its pace`, () => {
      for (const pad of [false, true]) {
        const base = pad ? { ...route, padHeight: WORM_PAD_HEIGHT, padExpansion: 0 } : route;
        const arm = defaultTunnelArmSeconds(base);
        const timing = tunnelRideTiming(base, size, 0, arm, TUNNEL_CROSSING_SECONDS);
        expect(timing.armSeconds + timing.exitArmSeconds + timing.crossingSeconds).toBeCloseTo(2 * arm + TUNNEL_CROSSING_SECONDS, 10);
        expect(timing.crossingSeconds).toBeGreaterThanOrEqual(CROSSING_SECONDS_MIN);
        expect(timing.crossingSeconds).toBeLessThanOrEqual(CROSSING_SECONDS_MAX);
        const tunnel = { ...base, ...timing };
        expect(tunnelHandoffSeconds(tunnel) + tunnelArmSeconds(tunnel) + tunnelCrossingSeconds(tunnel)
          + tunnelArmSeconds(tunnel, 'exit') + tunnelHandoffSeconds(tunnel)).toBeCloseTo(10, 10);
        const paces = legPaces(tunnel, size);
        expect(Math.max(...paces) / Math.min(...paces)).toBeLessThan(2.6);
      }
    });
  }

  it('keeps the old split for a tunnel that carries none', () => {
    const tunnel = routes(3).straight;
    expect(tunnelArmSeconds(tunnel)).toBe(defaultTunnelArmSeconds(tunnel));
    expect(tunnelArmSeconds(tunnel, 'exit')).toBe(defaultTunnelArmSeconds(tunnel));
    expect(tunnelCrossingSeconds(tunnel)).toBe(TUNNEL_CROSSING_SECONDS);
  });

  it('holds the throat back, but never more than the slowdown ratio behind its shoulder', () => {
    expect(tunnelThroatShare(0.7, 0.6)).toBeCloseTo(0.7 / 1.3, 10); // long throat: even pace
    expect(tunnelThroatShare(0.9, 1.4)).toBe(TUNNEL_THROAT_T_SHARE); // small cubes keep the old beat
    const s = tunnelThroatShare(0.9, 12);
    const ratio = (12 / (1 - s)) / (0.9 / s);
    expect(ratio).toBeCloseTo(TUNNEL_THROAT_SLOWDOWN, 10);
  });
});

const tunnelA = { entry: { x: 1, y: 2, z: 1, dirKey: 'PY' }, exit: { x: 1, y: 0, z: 1, dirKey: 'NY' } };
const tunnelB = { entry: { x: 2, y: 1, z: 1, dirKey: 'PX' }, exit: { x: 0, y: 1, z: 1, dirKey: 'NX' } };
const N = new THREE.Vector3(0, 1, 0);
const P = new THREE.Vector3();

// Lay a straight run of samples from a to b into the history.
const lay = (history, a, b, steps, transit = true) => {
  for (let i = 0; i <= steps; i++) shPush(history, P.lerpVectors(a, b, i / steps), N, -1, -1, -1, transit);
};

describe('passing yourself in the Core', () => {
  beforeEach(() => { resetLiveRotation(); liveRotation.active = false; });

  it('meets the riding body at the closest approach, once', () => {
    const history = makeStepHistory(4096), pass = makeCorePass();
    // The earlier ride's body runs through the core along x.
    lay(history, new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0), 200);
    resetCorePass(pass, history.distance);
    // This ride's head comes down through the core along y.
    const head = new THREE.Vector3();
    let fired = 0, at = null;
    for (let i = 0; i <= 100; i++) {
      head.set(0, 0.6 - 1.2 * i / 100, 0.01);
      shPush(history, head, N, -1, -1, -1, true);
      if (watchCorePass(pass, history, head, 400)) { fired++; at = head.y; }
    }
    expect(fired).toBe(1);
    expect(pass.seq).toBe(1);
    expect(Math.abs(at)).toBeLessThan(0.05);
    expect(pass.point.length()).toBeLessThan(0.05);
    expect(pass.head.distanceTo(pass.point)).toBeLessThan(CORE_PASS_RADIUS);
  });

  it('does not meet its own ride, or a body that has already left the core', () => {
    const history = makeStepHistory(4096), pass = makeCorePass();
    lay(history, new THREE.Vector3(3, 2, 0), new THREE.Vector3(3, 4, 0), 50); // far from the core
    resetCorePass(pass, history.distance);
    const head = new THREE.Vector3();
    for (let i = 0; i <= 100; i++) {
      head.set(0, 0.6 - 1.2 * i / 100, 0);
      shPush(history, head, N, -1, -1, -1, true);
      expect(watchCorePass(pass, history, head, 400)).toBe(false);
    }
    expect(pass.met).toBe(false);
  });

  it('slows the crossing for a beat and lets go', () => {
    const pass = makeCorePass();
    expect(corePassRate(pass, 0.1)).toBe(1);
    pass.slowT = CORE_PASS_SLOW_SECONDS;
    let min = 1, steps = 0;
    while (pass.slowT > 0 && steps++ < 1000) min = Math.min(min, corePassRate(pass, 1 / 120));
    expect(min).toBeCloseTo(CORE_PASS_RATE, 1);
    expect(corePassRate(pass, 1 / 120)).toBe(1);
  });

  it('runs in the sim: a pending self-pass meets its body, charges the tunnel and is called out once', () => {
    const size = 3, sim = makeWormSim(size), events = [];
    resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
    sim.tailLength = 200;
    const log = type => (...args) => events.push({ type, args });
    const ctx = new Proxy({ getCubies: () => null, getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 1,
      getHealingProgress: () => ({}), getOrbInventory: () => ({}), resolveTunnel: () => null, getDoubleHealWindow: () => 0 },
    { get: (t, k) => (k in t ? t[k] : log(k)) });
    // The earlier ride's body lies through the core along x, still inside its tunnel.
    lay(sim.stepHistory, new THREE.Vector3(-1, 0, 0.0), new THREE.Vector3(1, 0, 0), 200);
    sim.tunnelPassages.push({ tunnel: tunnelB, tunnelKey: 'B', exitDistance: sim.stepHistory.distance, heal: null, clearFrame: false });
    resetCorePass(sim.corePass, sim.stepHistory.distance);
    sim.selfPassPending = true;
    sim.activeTunnel = { ...tunnelA };
    sim.currentTunnelKey = 'A';
    sim.phase = 'tunnel';
    sim.tunnelProgress = 0;
    let slowed = false;
    for (let i = 0; i < 400 && sim.phase === 'tunnel'; i++) {
      const before = sim.tunnelProgress;
      stepWormSim(sim, 1 / 60, size, ctx);
      if (sim.corePass.met && sim.tunnelProgress - before < 0.5 / (60 * TUNNEL_CROSSING_SECONDS)) slowed = true;
    }
    expect(sim.corePass.met).toBe(true);
    expect(sim.corePass.seq).toBe(1);
    expect(slowed).toBe(true);
    expect(sim.chargedTunnels.has('A')).toBe(true);
    expect(events.filter(e => e.type === 'onSkill').map(e => e.args[0])).toEqual(['core']);
  });
});
