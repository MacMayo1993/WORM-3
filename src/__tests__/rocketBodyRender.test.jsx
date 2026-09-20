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

extend(THREE);
it('renders a connected airborne body around a corner and anchors exhaust at its rendered tail', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const sim = makeWormSim(3);
  Object.assign(sim, { phase: 'crawling', rocketActive: true, rocketT: 2, rocketFlight: 1, tailLength: 30 });
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
  useGameStore.setState({ wormAlive: true, wormPaused: false, wormCharacter: 'classic', wormColor: '#55dd88', wormGamePhase: 'active' });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let state;
  try {
    await act(async () => { state = root.render(<><WormBody worm={worm} size={3}/><RocketExhaust worm={worm}/></>); });
    state.getState().advance(1 / 60);
    expect(wormSegments.count).toBe(30);
    for (let i = 1; i < wormSegments.count; i++) {
      const a = new THREE.Vector3().fromArray(wormSegments.positions, (i - 1) * 3);
      const b = new THREE.Vector3().fromArray(wormSegments.positions, i * 3);
      expect(a.distanceTo(b)).toBeCloseTo(BODY_BALL_SPACING, 3);
    }
    const exhaust = state.getState().scene.children.find(group => group.children.some(mesh => mesh.material?.uniforms?.uTime));
    expect(exhaust?.visible).toBe(true);
    expect(exhaust.position.distanceTo(new THREE.Vector3().fromArray(wormSegments.tail))).toBeCloseTo(.055, 6);
  } finally {
    await act(async () => root.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
