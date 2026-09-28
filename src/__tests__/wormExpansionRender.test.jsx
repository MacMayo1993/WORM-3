import React, { act, Profiler } from 'react';
import { createRoot, extend, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import CubeAssembly from '../3d/CubeAssembly.jsx';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { liveCubies } from '../worm/liveCubies.js';
import { wormExpansion } from '../worm/wormExpansion.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { WORM_PIECE_POP } from '../game/raisedCubie.js';

vi.mock('../3d/StickerPlane.jsx', () => ({ default: ({ pos }) => <group position={pos} /> }));
vi.mock('../3d/PuzzleOrbitControls.jsx', () => ({ default: () => null }));
vi.mock('../3d/CameraFlipKick.jsx', () => ({ default: () => null }));
vi.mock('../3d/VoidCore.jsx', () => ({ default: () => null }));
vi.mock('../3d/InspectionViews.jsx', () => ({ default: () => null }));
vi.mock('../manifold/WormholeNetwork.jsx', () => ({ default: () => null }));
extend(THREE);

it.each([3, 6])('keeps the actual lattice and raised corner aligned without React commits on a %s cube', async size => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), canvas = document.createElement('canvas');
  const cubies = makeCubies(size), k = (size - 1) / 2;
  const corner = cubies[size - 1][size - 1][size - 1];
  corner.stickers.PZ = { ...corner.stickers.PZ, flips: 1, curr: 4 };
  useGameStore.setState({ size, cubies, wormHealerMode: true, explosionT: 0, animState: null, rotationEpoch: 0,
    demoMode: false, chaosLevel: 0, wormViewPower: null, randomMode: false, mirrorMode: false, hollowMode: false,
    wormPaused: false, wormPauseMenuOpen: false, wormPhase: 'crawling', wormGamePhase: 'active',
    settings: { ...before.settings, reducedMotion: true } });
  wormExpansion.amount = 0;
  const gl = { render: vi.fn(), compile: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 1280, height: 800 } });
  let amount = 0, commits = 0;
  function Simulation() { useFrame(() => { wormExpansion.amount = amount; }, -0.5); return null; }
  let store;
  try {
    await act(async () => { store = root.render(<>
      <Profiler id="cube" onRender={() => { commits++; }}><CubeAssembly size={size} cubies={cubies} animState={null} /></Profiler>
      <Simulation />
    </>); });
    await act(async () => store.getState().advance(0));
    const initialCommits = commits;
    for (const [frame, next] of [0.01, 0.07, 0.15, 0.27, 0.35, 0.2, 0.03, 0].entries()) {
      amount = next;
      await act(async () => store.getState().advance((frame + 1) / 60));
      const ordinary = liveCubies.refs[0], raised = liveCubies.refs[size ** 3 - 1];
      const base = k * cubeExpansionScale(size, amount);
      expect(ordinary.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(-base, -base, -base))).toBeLessThan(1e-8);
      const raisedCentre = Math.max(base, k + WORM_PIECE_POP);
      expect(raised.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(raisedCentre, raisedCentre, raisedCentre))).toBeLessThan(1e-8);
    }
    expect(commits).toBe(initialCommits);
    expect(useGameStore.getState().explosionT).toBe(0);
  } finally {
    await act(async () => root.unmount());
    wormExpansion.amount = 0;
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
