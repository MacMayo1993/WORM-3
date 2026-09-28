import React, { act } from 'react';
import { expect, it, vi } from 'vitest';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import RocketExhaust from '../worm/healerWorm/RocketExhaust.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { beginWormSegments, pushWormSegment, endWormSegments, resetWormSegments } from '../worm/wormSegments.js';
import { ROCKET_DURATION, ROCKET_LANDING_GRACE } from '../worm/healerWorm/constants.js';

extend(THREE);
const ref = current => ({ current });

// A short worm lying along +X on the +Y face of a 3×3, head first.
function publishBody() {
  beginWormSegments();
  for (let i = 0; i < 6; i++) pushWormSegment(0.6 - i * 0.2, 1.58, 0);
  endWormSegments();
}

it('launches with a pad cloud and ring, freezes with the game, and puffs dust at touchdown', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const worm = {
    phase: ref('crawling'), rocketActive: ref(false), rocketT: ref(0), rocketFlight: ref(0), landingGraceT: ref(0)
  };
  useGameStore.setState({ wormAlive: true, wormPaused: false, wormCharacter: 'classic', perfReducedFX: false });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let state;
  const frame = (dt = 1 / 60) => { publishBody(); state.getState().advance(dt); };
  try {
    await act(async () => { state = root.render(<RocketExhaust worm={worm} size={3} />); });
    const scene = state.getState().scene;
    const points = scene.children.find(o => o.isPoints);
    const ring = scene.children.find(o => o.isMesh && o.geometry.type === 'RingGeometry');
    const booster = scene.children.find(o => o.isGroup);
    frame();
    expect(booster.visible).toBe(false);
    expect(points.visible).toBe(false);

    // Ignition: the sim has just claimed the rocket.
    Object.assign(worm, { rocketActive: ref(true), rocketT: ref(ROCKET_DURATION - 1 / 60), rocketFlight: ref(1 / 60) });
    frame();
    expect(booster.visible).toBe(true);
    expect(ring.visible).toBe(true);
    const launched = points.geometry.drawRange.count;
    expect(launched).toBeGreaterThan(40);
    // The ring lies on the pad under the tail, facing out of the +Y face.
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(ring.quaternion).y).toBeCloseTo(1, 6);
    expect(ring.position.y).toBeLessThan(1.58);

    // Paused: nothing drifts, nothing new is exhaled.
    const snapshot = points.geometry.attributes.position.array.slice(0, launched * 3);
    useGameStore.setState({ wormPaused: true });
    for (let i = 0; i < 10; i++) frame();
    expect(points.geometry.drawRange.count).toBe(launched);
    expect(points.geometry.attributes.position.array.slice(0, launched * 3)).toEqual(snapshot);
    useGameStore.setState({ wormPaused: false });

    // Cruise: the contrail keeps coming, bounded by the pool.
    for (let i = 0; i < 90; i++) {
      worm.rocketT.current -= 1 / 60;
      worm.rocketFlight.current = Math.min(1, worm.rocketFlight.current + 1 / 60);
      frame();
    }
    expect(points.geometry.drawRange.count).toBeGreaterThan(20);
    expect(points.geometry.drawRange.count).toBeLessThanOrEqual(points.geometry.attributes.aSize.count);

    // Touchdown: the burn ends and the landing grace starts.
    const cruising = points.geometry.drawRange.count;
    Object.assign(worm, { rocketActive: ref(false), rocketT: ref(0), rocketFlight: ref(0), landingGraceT: ref(ROCKET_LANDING_GRACE) });
    frame();
    expect(ring.visible).toBe(true);
    expect(booster.visible).toBe(true);
    expect(points.geometry.drawRange.count).toBeGreaterThan(cruising);

    // The booster stows once the grace runs down; a new run clears the sky.
    worm.landingGraceT.current = 0;
    frame();
    expect(booster.visible).toBe(false);
    useGameStore.setState({ wormRunId: (useGameStore.getState().wormRunId ?? 0) + 1 });
    frame();
    expect(points.visible).toBe(false);
  } finally {
    await act(async () => root.unmount());
    resetWormSegments();
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
