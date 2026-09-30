// A jump onto a raised flip pad and the dive into its tunnel, measured the way a
// player sees it: the head's speed frame by frame, and the chase camera's speed and
// turn rate. The old route froze the head at launch, stopped it in mid-air above
// the pad, whipped a full loop at 15 units/s on touchdown, and rolled the camera
// 180 degrees while it dived through the mouth.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { makeCubies } from '../game/cubeState.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { makeWormSim, resetWormSim, queueTurn, startJump, stepWormSim, jumpLiftOf, tileKey } from '../worm/healerWorm/wormSim.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { liveCubies } from '../worm/liveCubies.js';
import { advancePlatformFormation } from '../worm/platformFormation.js';
import { ttReset } from '../worm/circularBuffers.js';
import { WORM_LIFT, DIR_FORWARD, FACE_NORMALS } from '../worm/healerWorm/constants.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { rideLiveRotation } from '../worm/wormHelpers.js';

const scene = vi.hoisted(() => ({ frame: null, camera: null, size: null, mobile: false }));
vi.mock('@react-three/fiber', () => ({ useThree: () => scene, useFrame: callback => { scene.frame = callback; } }));
vi.mock('../hooks/useIsMobile.js', () => ({ useIsMobile: () => scene.mobile }));
import WormChaseCamera from '../worm/WormChaseCamera.jsx';

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const noop = () => {};

// A flipped pad at the centre of PZ, its antipodal exit on NZ, and the worm
// crawling toward it from the face edge at medium speed.
function stage(size, heading) {
  resetLiveRotation();
  const cubies = makeCubies(size), mid = Math.floor(size / 2), last = size - 1;
  const target = { x: mid, y: mid, z: last, dirKey: 'PZ' };
  const exit = { x: mid, y: mid, z: 0, dirKey: 'NZ' };
  Object.assign(cubies[mid][mid][last].stickers.PZ, { flips: 1, curr: 4 });
  Object.assign(cubies[mid][mid][0].stickers.NZ, { flips: 1, curr: 1 });
  const sim = makeWormSim(size);
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  const back = DIR_FORWARD.PZ[OPPOSITE[heading]];
  sim.pos = { ...target, x: mid + back[0] * mid, y: mid + back[1] * mid };
  sim.moveDir = heading;
  sim.pendingTurns = [];
  sim.selfCollisionGraceSteps = 3;
  sim._curWP.fromArray(getStickerWorldPos(sim.pos.x, sim.pos.y, sim.pos.z, 'PZ', size, 0));
  sim.headInterpPos.copy(sim._curWP);
  sim.curWorldPos = sim._curWP;
  sim.prevWorldPos = null;
  ttReset(sim.tileTrail, tileKey(sim.pos));
  ttReset(sim.pathHistory, tileKey(sim.pos));
  const ctx = {
    getCubies: () => cubies, getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 2.75 * 0.8,
    getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }), getHealingProgress: () => ({}),
    getOrbColor: () => '#ffffff', getTunnelEntry: () => 'pad',
    resolveTunnel: () => ({ tunnel: { entry: { ...target }, exit }, tunnelKey: 'smooth' }),
    feel: noop, onDeath: noop, onTunnelEnter: noop, onCrawlResume: noop, onPhase: noop, onBoostState: noop,
    onSurvivalTick: noop, spawnWormholePair: noop, onFlippedTile: noop, applyDeposit: noop, onOrbPickup: noop,
    onPowerupsChanged: noop, applyHeal: noop, onSpecialsChanged: noop, onRocketState: noop, onStoryMechanic: noop,
  };
  const center = new THREE.Vector3().fromArray(getStickerWorldPos(mid, mid, last, 'PZ', size, 0));
  return { sim, ctx, cubies, center };
}

const renderedHead = sim => {
  const transit = sim.phase !== 'crawling' && !!sim.activeTunnel;
  return sim.headInterpPos.clone().addScaledVector(sim.currentNormal, transit ? 0 : WORM_LIFT + (sim.isJumping ? jumpLiftOf(sim) : 0));
};

// Crawl in, press JUMP once the head is `pressAt` from the pad centre, and record
// the head until it is a quarter of the way down the entry arm.
function ride(size, heading, pressAt, hz = 60, beforeJump = noop) {
  const staged = stage(size, heading), { sim, ctx, center } = staged;
  const dt = 1 / hz, frames = [];
  let pressed = false, previous = renderedHead(sim);
  for (let i = 0; i < hz * 8 && sim.alive; i++) {
    if (!pressed && (sim.headInterpPos.distanceTo(center) <= pressAt || sim.cautionRescue)) {
      beforeJump(staged);
      if (sim.cautionRescue) queueTurn(sim, 'jump'); else startJump(sim, ctx, size);
      pressed = true;
    }
    stepWormSim(sim, dt, size, ctx);
    const head = renderedHead(sim);
    if (pressed) frames.push({ phase: sim.padFlight ? 'flight' : sim.phase, speed: head.distanceTo(previous) / dt, height: head.clone().sub(center).dot(FACE_NORMALS.PZ) });
    previous = head;
    if (sim.phase === 'entering' && sim.tunnelProgress > 0.25) break;
  }
  return { frames, sim };
}

describe('jumping into a raised tunnel', () => {
  afterEach(() => { liveCubies.refs = null; liveCubies.size = 0; });

  // Early jumps and late attempts caught by the caution-tape rescue both retain a smooth arc.
  it.each([3, 5, 7, 15].flatMap(size => [[size, 1.5], [size, 0.35]]))('never stalls or lurches on a %i cube, pressed %s from the pad', (size, pressAt) => {
    for (const hz of [30, 60, 120]) {
      for (const heading of ['up', 'right']) {
        const { frames, sim } = ride(size, heading, size === 3 && pressAt > 1 ? 0.95 : pressAt, hz);
        expect(sim.alive).toBe(true);
        expect(sim.phase).toBe('entering');
        const route = frames.slice(1);
        expect(['flight', 'windup', 'entering'].every(phase => route.some(frame => frame.phase === phase))).toBe(true);
        // Never held: every frame from launch to the arm moves the head.
        expect(Math.min(...route.map(frame => frame.speed))).toBeGreaterThan(0.45);
        // No whip on the pad and no rocket out of the launch.
        expect(Math.max(...route.filter(frame => frame.phase === 'windup').map(frame => frame.speed))).toBeLessThan(3.6);
        expect(Math.max(...route.map(frame => frame.speed))).toBeLessThan(7.5);
        // Speed changes by at most 3 units/s a frame after the launch impulse
        // (touchdown included), at 60 Hz and above.
        if (hz >= 60) {
          for (let i = 1; i < route.length; i++) expect(Math.abs(route[i].speed - route[i - 1].speed)).toBeLessThan(3);
        }
      }
    }
  });

  it('hurries a freshly flipped pad up to meet an ordinary-length jump', () => {
    const size = 5, formation = { lift: 0, velocity: 0 };
    advancePlatformFormation(formation, true, 0.1);
    const { frames } = ride(size, 'up', 1.5, 60, () => {
      const mid = Math.floor(size / 2);
      liveCubies.size = size;
      liveCubies.refs = [];
      liveCubies.refs[((mid * size) + mid) * size + size - 1] = { userData: { wormPlatformFormation: formation } };
    });
    const flight = frames.filter(frame => frame.phase === 'flight');
    expect(flight.length / 60).toBeLessThan(0.9);
    expect(formation.formationRemaining).toBeLessThan(flight.length / 60);
  });

  // A formation that cannot be hurried still never holds the worm still.
  it('turns the wait for a still-rising pad into hang time at the top of the arc', () => {
    const size = 5, formation = { formationRemaining: 1.5 };
    const { frames } = ride(size, 'up', 1.5, 60, ({ sim }) => {
      const mid = Math.floor(size / 2);
      liveCubies.size = size;
      liveCubies.refs = [];
      liveCubies.refs[((mid * size) + mid) * size + size - 1] = { userData: { wormPlatformFormation: formation } };
      expect(sim.padFlight).toBeNull();
    });
    const flight = frames.filter(frame => frame.phase === 'flight');
    // The landing waits for the pad, and the head keeps drifting while it waits.
    expect(flight.length / 60).toBeGreaterThanOrEqual(1.5 - 1 / 60);
    expect(Math.min(...flight.slice(1).map(frame => frame.speed))).toBeGreaterThan(0.05);
    // Most of that wait is spent near the apex, not crawling along the launch.
    const apex = Math.max(...flight.map(frame => frame.height));
    const nearTop = flight.filter(frame => frame.height > apex - 0.2).length / 60;
    expect(nearTop).toBeGreaterThan(0.8);
  });
});

describe('the rendered head during a pad jump', () => {
  afterEach(() => { liveCubies.refs = null; liveCubies.size = 0; });

  it('is not pulled back onto the crawl tiles by live-mesh anchoring', () => {
    const size = 5, { sim, ctx, center } = stage(size, 'up');
    // Live cubie meshes at rest, as CubeAssembly publishes them.
    liveCubies.size = size;
    liveCubies.refs = [];
    const k = (size - 1) / 2;
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) {
      liveCubies.refs[(x * size + y) * size + z] = { position: new THREE.Vector3(x - k, y - k, z - k), quaternion: new THREE.Quaternion() };
    }
    const worm = new Proxy({}, { get: (_, key) => ({ get current() { return sim[key]; }, set current(value) { sim[key] = value; } }) });
    for (let i = 0; i < 120 && sim.headInterpPos.distanceTo(center) > 1.5; i++) stepWormSim(sim, 1 / 60, size, ctx);
    startJump(sim, ctx, size);
    expect(sim.padFlight).toBeTruthy();
    for (let i = 0; i < 20; i++) {
      stepWormSim(sim, 1 / 60, size, ctx);
      const flying = sim.headInterpPos.clone();
      expect(rideLiveRotation(worm)).toBe(false);
      expect(sim.headInterpPos.distanceTo(flying)).toBe(0);
    }
    // Standing on a raised pad with no layer turning: the sim's pose, hover included.
    sim.padFlight = null;
    sim.onRaisedPlatform = true;
    const standing = sim.headInterpPos.clone();
    expect(rideLiveRotation(worm)).toBe(false);
    expect(sim.headInterpPos.distanceTo(standing)).toBe(0);
  });
});

describe('the camera through a pad jump and dive', () => {
  let host, root;
  afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

  it.each([[3, false], [3, true], [5, false], [5, true], [7, false]])('neither snaps nor spins on a %i cube (phone: %s)', (size, mobile) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    for (const heading of ['up', 'right', 'down', 'left']) {
      const { sim, ctx, cubies, center } = stage(size, heading);
      const worm = new Proxy({}, { get: (_, key) => key === 'jumpLift' ? () => jumpLiftOf(sim)
        : { get current() { return sim[key]; }, set current(value) { sim[key] = value; } } });
      scene.mobile = mobile;
      scene.size = mobile ? { width: 412, height: 915 } : { width: 1280, height: 800 };
      scene.camera = new THREE.PerspectiveCamera(70, scene.size.width / scene.size.height, 0.1, 200);
      host = document.createElement('div'); root = createRoot(host);
      useGameStore.setState({ wormGamePhase: 'active', wormAlive: true, wormCameraHorizon: 'face', wormDeathDetails: null,
        wormStoryLevel: null, wormCombatMode: false, demoMode: false, wormHealerMode: true, cubies, size });
      act(() => root.render(<WormChaseCamera key={`${size}${heading}`} worm={worm} size={size} />));
      const dt = 1 / 60;
      let pressed = false, position = null, orientation = null, turn = 0, speed = 0, offscreen = 0;
      const padTop = center.clone().addScaledVector(FACE_NORMALS.PZ, 0.655);
      for (let i = 0; i < 60 * 8; i++) {
        if (!pressed && ((i > 30 && sim.headInterpPos.distanceTo(center) <= (size === 3 ? 0.95 : 1.5)) || sim.cautionRescue)) {
          if (sim.cautionRescue) queueTurn(sim, 'jump'); else startJump(sim, ctx, size);
          pressed = true;
        }
        stepWormSim(sim, dt, size, ctx);
        scene.frame({}, dt);
        scene.camera.updateMatrixWorld(true);
        const airborneOrOnPad = sim.padFlight || sim.phase === 'windup';
        if (pressed && airborneOrOnPad) {
          // The worm and its landing stay in view, well inside the frame edges.
          for (const point of [padTop.clone(), renderedHead(sim)]) {
            const ndc = point.project(scene.camera);
            offscreen = Math.max(offscreen, Math.abs(ndc.x), Math.abs(ndc.y));
          }
        }
        if (pressed && position) {
          speed = Math.max(speed, scene.camera.position.distanceTo(position) / dt);
          turn = Math.max(turn, THREE.MathUtils.radToDeg(scene.camera.quaternion.angleTo(orientation)) / dt);
        }
        position = scene.camera.position.clone();
        orientation = scene.camera.quaternion.clone();
        if (sim.phase === 'tunnel') break;
      }
      expect(sim.phase).toBe('tunnel');
      // Before: up to 20 units/s at the press and a 585-1380 degree/s spin.
      expect(speed).toBeLessThan(7);
      expect(turn).toBeLessThan(160);
      expect(offscreen).toBeLessThan(0.75);
      act(() => root.unmount()); root = null;
    }
  });
});
