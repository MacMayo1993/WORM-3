import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import Cubie from '../3d/Cubie.jsx';
import { PadProvider } from '../3d/PadSprings.jsx';
import MobiusTunnel from '../manifold/MobiusTunnel.jsx';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { liveCubies } from '../worm/liveCubies.js';
import { raisedPortalPosition } from '../worm/raisedPortalPosition.js';
import { makeWormSim, resetWormSim, startJump, stepWormSim } from '../worm/healerWorm/wormSim.js';
vi.mock('../3d/StickerPlane.jsx', () => ({ default: () => null }));
extend(THREE);

it('shows the real cubies rising, grows ribbon and rails together, and lands after formation', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), liveBefore = { ...liveCubies };
  const cubies = makeCubies(3), refs = [], indices = [14, 12], gridRefs = [];
  useGameStore.setState({ size: 3, cubies, explosionT: 0, wormHealerMode: true, demoMode: false,
    wormPaused: false, wormPauseMenuOpen: false, mirrorMode: false, hollowMode: false, visualMode: 'solid',
    randomMode: false, chaosLevel: 0, cubiePops: {}, settings: { ...before.settings, flipPads: 'off', reducedMotion: false } });
  liveCubies.size = 3; liveCubies.refs = gridRefs;
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas); root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const draw = raised => <PadProvider>
    {[2, 0].map((z, i) => <Cubie key={i} ref={el => { refs[i] = el; gridRefs[indices[i]] = el; }}
      cubie={cubies[1][1][z]} position={[0, 0, z - 1]} size={3} wormMode />)}
    {raised && <MobiusTunnel meshIdx1={0} meshIdx2={1} dirKey1="PZ" dirKey2="NZ" cubieRefs={refs}
      flips={1} color1="#e83a50" color2="#ffaa00" gridId1="a" gridId2="b" tunnelId="a|b" />}
  </PadProvider>;
  try {
    let store, time = 0;
    await act(async () => { store = root.render(draw(false)); });
    const frame = (dt = 1 / 60) => { time += dt; store.getState().advance(time); };
    frame();
    for (const [z, dir] of [[2, 'PZ'], [0, 'NZ']]) {
      cubies[1][1][z].stickers[dir].flips = 1;
      cubies[1][1][z] = { ...cubies[1][1][z] };
    }
    await act(async () => root.render(draw(true)));
    frame();
    expect(refs[0].getWorldPosition(new THREE.Vector3()).z).toBeLessThan(1.001);
    const materials = [];
    store.getState().scene.traverse(o => { if (o.material?.uniforms?.uGrowT) materials.push(o.material); });
    expect(materials).toHaveLength(3);
    expect(materials[1].uniforms.uGrowT).toBe(materials[0].uniforms.uGrowT);
    expect(materials[2].uniforms.uGrowT).toBe(materials[0].uniforms.uGrowT);
    expect(materials[0].uniforms.uGrowT.value).toBeLessThan(.02);
    const sim = makeWormSim(3); resetWormSim(sim, 3, { orbCount: 0, wormholeInterval: 9999 });
    sim.pos = { x: 1, y: 1, z: 2, dirKey: 'PZ' }; sim.headInterpPos.set(0, 0, 1.52);
    const ctx = { getCubies: () => cubies, getTunnelEntry: () => 'pad', feel: () => {},
      isPaused: () => false, getSpeed: () => 2, getGamePhase: () => 'active', getControlMode: () => 'non-oriented',
      getWormholeInterval: () => 9999, resolveTunnel: () => null };
    startJump(sim, ctx, 3, { allowDive: false });
    expect(sim.padFlight.duration).toBeGreaterThan(1.9);
    for (let i = 0; i < 59; i++) { frame(); stepWormSim(sim, 1 / 60, 3, ctx); }
    expect(refs[0].getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(1.45, 5);
    expect(materials[0].uniforms.uGrowT.value).toBeCloseTo(.5, 5);
    expect(sim.padFlight).toBeTruthy();
    const point = raisedPortalPosition(1, 1, 2, 'PZ', 3, useGameStore.getState());
    expect(point[2]).toBeCloseTo(1.45 + .52 + .5, 5);
    await act(async () => useGameStore.setState({ wormPaused: true }));
    for (let i = 0; i < 30; i++) frame();
    expect(refs[0].getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(1.45, 5);
    expect(materials[0].uniforms.uGrowT.value).toBeCloseTo(.5, 5);
    await act(async () => useGameStore.setState({ wormPaused: false }));
    for (let i = 0; i < 65; i++) { frame(); if (sim.padFlight) stepWormSim(sim, 1 / 60, 3, ctx); }
    expect(refs[0].getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(1.9, 8);
    expect(materials[0].uniforms.uGrowT.value).toBe(1);
    expect(sim.padFlight).toBeNull();
    expect(sim.headInterpPos.z).toBeCloseTo(1.9 + .52 + .5, 6);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); Object.assign(liveCubies, liveBefore);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
