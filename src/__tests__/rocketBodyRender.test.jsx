import React, { act } from 'react';
import { expect, it, vi } from 'vitest';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { WormBody } from '../worm/healerWorm/WormBody.jsx';
import RocketExhaust from '../worm/healerWorm/RocketExhaust.jsx';
import { makeWormSim } from '../worm/healerWorm/wormSim.js';
import { shPush } from '../worm/circularBuffers.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormSegments } from '../worm/wormSegments.js';
import { WORM_LIFT, BODY_BALL_SPACING } from '../worm/healerWorm/constants.js';
import { advanceInchGaitState } from '../worm/healerWorm/inchGait.js';
import { cubeHalfExtent, ROCKET_ORBIT_CLEARANCE } from '../worm/healerWorm/rocketOrbit.js';

extend(THREE);
it.each(['classic', 'wiggle', 'inch'])('keeps %s connected around an airborne corner with exhaust on its moving tail', async character => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const sim = makeWormSim(3);
  Object.assign(sim, { phase: 'crawling', rocketActive: true, rocketT: 2, rocketFlight: 1, tailLength: 30 });
  advanceInchGaitState(sim.bodyGait, 1, sim.tailLength, 10);
  Object.assign(sim.bodyGait, { enabled: true, move: 1 });
  const position = new THREE.Vector3(), normal = new THREE.Vector3();
  // A dense route bending from the X face over the XY edge to the Y face.
  for (let i = 0; i <= 160; i++) {
    const angle = i / 160 * Math.PI / 2;
    normal.set(Math.cos(angle), Math.sin(angle), 0);
    position.set(1, 1, 0).addScaledVector(normal, 0.6);
    shPush(sim.stepHistory, position, normal, -1, -1, -1);
  }
  sim.headInterpPos.copy(position).addScaledVector(normal, -WORM_LIFT);
  sim.currentNormal.copy(normal);
  const aliases = { orbPickupColorsRef: 'orbPickupColors', orbPickupFaceIdsRef: 'orbPickupFaceIds', colorEpochRef: 'colorEpoch' };
  const worm = Object.fromEntries([...Object.keys(sim), ...Object.keys(aliases)].map(key => [key, { current: sim[aliases[key] || key] }]));
  useGameStore.setState({ wormAlive: true, wormPaused: false, wormCharacter: character, wormColor: '#55dd88', wormGamePhase: 'active' });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let state;
  try {
    await act(async () => { state = root.render(<><WormBody worm={worm} size={3}/><RocketExhaust worm={worm} size={3}/></>); });
    for (let frame = 1; frame <= 30; frame++) {
      sim.bodyGait.phase += 0.02;
      state.getState().advance(frame / 60);
      expect(wormSegments.count).toBe(30);
      for (let i = 1; i < wormSegments.count; i++) {
        const a = new THREE.Vector3().fromArray(wormSegments.positions, (i - 1) * 3);
        const b = new THREE.Vector3().fromArray(wormSegments.positions, i * 3);
        // The wave adds lateral distance; the links still overlap, even at its crest.
        expect(a.distanceTo(b)).toBeGreaterThan(BODY_BALL_SPACING * 0.6);
        expect(a.distanceTo(b)).toBeLessThanOrEqual(0.14);
        const half = cubeHalfExtent(3);
        const clearance = Math.hypot(...b.toArray().map(v => Math.max(0, Math.abs(v) - half)));
        expect(clearance).toBeGreaterThan(ROCKET_ORBIT_CLEARANCE);
      }
      // The booster (and the plume inside it) sits on the rendered tail, nozzle
      // pointing straight back along the body.
      const hasPlume = object => object.children.some(child => child.material?.uniforms?.uTime);
      const booster = state.getState().scene.children.find(group => group.children.some(hasPlume));
      expect(booster?.visible).toBe(true);
      expect(booster.children.find(hasPlume).visible).toBe(true);
      const tail = new THREE.Vector3().fromArray(wormSegments.tail);
      expect(booster.position.distanceTo(tail)).toBeCloseTo(0, 6);
      const away = tail.clone().sub(new THREE.Vector3().fromArray(wormSegments.beforeTail)).normalize();
      expect(new THREE.Vector3(0, 1, 0).applyQuaternion(booster.quaternion).dot(away)).toBeCloseTo(1, 6);
    }
  } finally {
    await act(async () => root.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

it.each(['classic', 'wiggle', 'inch'])('preserves the %s gait through takeoff, cruise and landing, and freezes it on pause', async character => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const sim = makeWormSim(15);
  Object.assign(sim, { phase: 'crawling', tailLength: 30 });
  sim.currentNormal.set(0, 1, 0);
  sim.headInterpPos.set(2, 7.6 - WORM_LIFT, 0);
  sim.pos.dirKey = 'PY'; sim.moveDir = 'right';
  for (let i = 0; i <= 400; i++) {
    shPush(sim.stepHistory, new THREE.Vector3(-2 + i * 0.01, 7.6, 0), sim.currentNormal, -1, -1, -1);
  }
  advanceInchGaitState(sim.bodyGait, 1, sim.tailLength, 10);
  Object.assign(sim.bodyGait, { enabled: true, move: 1 });
  const worm = Object.fromEntries(Object.keys(sim).map(key => [key, {
    get current() { return sim[key]; },
  }]));
  for (const key of ['orbPickupColors', 'orbPickupFaceIds', 'colorEpoch']) worm[`${key}Ref`] = worm[key];
  useGameStore.setState({ wormAlive: true, wormPaused: true, wormCharacter: character, wormGamePhase: 'active' });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let state, time = 0;
  const points = () => {
    state.getState().advance(time += 1 / 60);
    return Array.from({ length: wormSegments.count }, (_, i) => new THREE.Vector3().fromArray(wormSegments.positions, i * 3));
  };
  try {
    await act(async () => { state = root.render(<WormBody worm={worm} size={15}/>); });
    const ground = points();
    const shape = p => character === 'inch' ? p.y - ground[0].y : p.z;
    expect(Math.max(...ground.slice(1).map(p => Math.abs(shape(p))))).toBeGreaterThan(0.05);
    sim.rocketActive = true; sim.rocketT = 2;
    for (const phase of [0.1, 0.5, 1, 0.5, 0.1, 0]) {
      sim.rocketFlight = phase;
      const airborne = points();
      const lift = airborne[0].y - ground[0].y;
      for (let i = 1; i < ground.length; i++) {
        expect(airborne[i].x).toBeCloseTo(ground[i].x, 5);
        expect(airborne[i].z).toBeCloseTo(ground[i].z, 5);
        if (character === 'inch') expect(airborne[i].y - lift).toBeCloseTo(ground[i].y, 5);
      }
    }
    sim.rocketFlight = 1;
    const before = points();
    await act(async () => useGameStore.setState({ wormPaused: false }));
    for (let i = 0; i < 15; i++) { sim.bodyGait.phase += 0.01; points(); }
    const after = points();
    expect(Math.max(...after.map((p, i) => p.distanceTo(before[i])))).toBeGreaterThan(0.03);
    await act(async () => useGameStore.setState({ wormPaused: true }));
    const paused = points();
    for (let i = 0; i < 5; i++) expect(points()).toEqual(paused);
  } finally {
    await act(async () => root.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
