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

it.each([3, 6, 10, 11, 14, 15])('keeps the actual lattice and raised corner aligned without React commits on a %s cube', async size => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), canvas = document.createElement('canvas');
  const cubies = makeCubies(size), k = (size - 1) / 2;
  const corner = cubies[size - 1][size - 1][size - 1];
  corner.stickers.PZ = { ...corner.stickers.PZ, flips: 1, curr: 4 };
  useGameStore.setState({ size, cubies, wormHealerMode: true, explosionT: 0, animState: null, rotationEpoch: 0,
    demoMode: false, chaosLevel: 0, wormViewPower: null, randomMode: false, mirrorMode: false, hollowMode: false,
    showAntipodalPiP: true, wormPaused: false, wormPauseMenuOpen: false, wormPhase: 'crawling', wormGamePhase: 'active',
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
    const scene = store.getState().scene;
    const shell = scene.getObjectByName('CubieBodyBatch');
    const chassis = scene.getObjectByName('mega-chassis');
    const shellCount = size ** 3 - (size - 2) ** 3 - 1; // raised corner has its own translucent body
    expect(shell?.count ?? 0).toBe(size >= 15 ? 0 : shellCount);
    const initialObjects = [];
    scene.traverse(object => initialObjects.push(object));
    for (const [frame, next] of [0.01, 0.07, 0.15, 0.27, 0.6, 0.2, 0.03, 0, 0.01, 0.6, 0].entries()) {
      amount = next;
      await act(async () => store.getState().advance((frame + 1) / 60));
      expect(shell?.count ?? 0).toBe(size >= 15 && amount === 0 ? 0 : shellCount);
      expect(chassis.visible).toBe(amount === 0);
      const objects = [];
      scene.traverse(object => objects.push(object));
      expect(objects).toEqual(initialObjects); // no per-piece mounts on opening/closing
      const ordinary = liveCubies.refs[0], raised = liveCubies.refs[size ** 3 - 1];
      const base = k * cubeExpansionScale(size, amount);
      if (shell.count) {
        const matrix = new THREE.Matrix4();
        shell.getMatrixAt(0, matrix);
        matrix.premultiply(shell.matrixWorld);
        expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(-base, -base, -base))).toBeLessThan(2e-6);
        expect(new THREE.Vector3().setFromMatrixScale(matrix).toArray()).toEqual([1, 1, 1]);
      }
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

it('restores ordinary bodies for the non-WORM Mega Explode view and removes them after closing', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), canvas = document.createElement('canvas');
  const size = 15, cubies = makeCubies(size), k = (size - 1) / 2;
  useGameStore.setState({ size, cubies, wormHealerMode: false, explosionT: 0, animState: null, rotationEpoch: 0,
    demoMode: false, chaosLevel: 0, wormViewPower: null, randomMode: false, mirrorMode: false, hollowMode: false,
    visualMode: 'solid', settings: { ...before.settings, reducedMotion: true } });
  const gl = { render: vi.fn(), compile: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 1280, height: 800 } });
  let store;
  try {
    await act(async () => { store = root.render(<CubeAssembly size={size} cubies={cubies} animState={null} />); });
    for (const [frame, amount] of [0, 0.01, 0.6, 0.2, 0].entries()) {
      await act(async () => useGameStore.setState({ explosionT: amount }));
      await act(async () => store.getState().advance(frame / 60));
      const piece = liveCubies.refs[0];
      const bodies = piece.children[0].children.filter(child => child.isMesh);
      expect(bodies).toHaveLength(amount > 0 ? 1 : 0);
      expect(store.getState().scene.getObjectByName('mega-chassis').visible).toBe(amount === 0);
      const base = k * cubeExpansionScale(size, amount);
      expect(piece.position.distanceTo(new THREE.Vector3(-base, -base, -base))).toBeLessThan(1e-8);
    }
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
