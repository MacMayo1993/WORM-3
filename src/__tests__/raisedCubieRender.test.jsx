import React, { act, createRef } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import Cubie from '../3d/Cubie.jsx';
import { PadProvider } from '../3d/PadSprings.jsx';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { raisedCubieExtent } from '../3d/raisedCubieMotion.js';
import { WORM_PIECE_POP, CUBE_PIECE_POP, wormRaisedAmount } from '../game/raisedCubie.js';

// Cube modes pop a flipped piece a hair along each axis, never to full Explode.
const POP = 1 + CUBE_PIECE_POP;

// Mark every face so the assertions inspect actual descendant world positions.
vi.mock('../3d/StickerPlane.jsx', () => ({ default: ({ currentDir, pos }) => <group name={currentDir} position={pos} /> }));
extend(THREE);
it('pops the body and unflipped faces a hair out of the cube, follows turns, and comes home', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  useGameStore.setState({ size: 3, explosionT: 0, mirrorMode: false, hollowMode: false, visualMode: 'solid', chaosLevel: 0,
    randomMode: false, wormHealerMode: false, cubiePops: {}, settings: { ...before.settings, flipPads: 'full', reducedMotion: true } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const raised = createRef(), quiet = createRef();
  const source = makeCubies(3);
  const piece = flips => ({ ...source[2][2][2], stickers: { ...source[2][2][2].stickers, PZ: { ...source[2][2][2].stickers.PZ, flips, curr: flips % 2 ? 4 : 1 } } });
  const draw = (flips, wormMode = false, swap = false) => <PadProvider>
    <Cubie ref={raised} cubie={swap ? { ...source[0][0][0], x: 2, y: 2, z: 2 } : piece(flips)} position={[1, 1, 1]} size={3} wormMode={wormMode} />
    <Cubie ref={quiet} cubie={swap ? { ...piece(flips), x: 0, y: 0, z: 0 } : source[0][0][0]} position={[-1, -1, -1]} size={3} />
  </PadProvider>;
  try {
    let store;
    await act(async () => { store = root.render(draw(1)); });
    store.getState().advance(1 / 60);
    const center = raised.current.getWorldPosition(new THREE.Vector3());
    center.toArray().forEach((v) => expect(v).toBeCloseTo(POP, 10));
    expect(quiet.current.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([-1, -1, -1]);
    const ordinaryFace = raised.current.getObjectByName('PY').getWorldPosition(new THREE.Vector3());
    expect(ordinaryFace.distanceTo(new THREE.Vector3(POP, POP + 0.51, POP))).toBeLessThan(1e-8);
    const body = raised.current.children[0].children.find(o => o.isMesh);
    expect(body.getWorldPosition(new THREE.Vector3()).distanceTo(center)).toBeLessThan(1e-8);
    // Simulate CubeAssembly's live layer transform. The radial offset follows it.
    raised.current.position.set(-1, 1, 1);
    raised.current.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
    store.getState().advance(2 / 60);
    expect(raised.current.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(-POP, POP, POP))).toBeLessThan(1e-10);
    await act(async () => root.render(draw(2)));
    store.getState().advance(3 / 60);
    expect(raised.current.parent.position.length()).toBe(0);
    expect(raisedCubieExtent()).toBe(0);
    // WORM raises the piece to the tape-height landing, whatever the cosmetic settings: a corner
    // moves WORM_PIECE_POP along each axis, so the worm can still reach its pad.
    await act(async () => { useGameStore.setState({ mirrorMode: true, settings: { ...useGameStore.getState().settings, flipPads: 'off' } }); root.render(draw(1, true)); });
    store.getState().advance(4 / 60);
    expect(raised.current.parent.position.length()).toBeCloseTo(Math.sqrt(3) * WORM_PIECE_POP, 10);
    expect(raisedCubieExtent()).toBeCloseTo(wormRaisedAmount(3), 10);
    const windowBody = raised.current.children[0].children.find(o => o.isMesh);
    expect(windowBody.material.transparent).toBe(true);
    expect(windowBody.material.depthWrite).toBe(false);
    expect(windowBody.material.opacity).toBeLessThan(0.2);
    await act(async () => { useGameStore.setState({ mirrorMode: false }); root.render(draw(0)); });
    store.getState().advance(4.5 / 60);
    // Slot components survive a committed rotation; the physical piece's spring
    // must move to its new slot without restarting or raising the replacement.
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, reducedMotion: false, flipPads: 'full' } });
    await act(async () => root.render(draw(1)));
    store.getState().advance(5 / 60);
    const partial = raised.current.parent.position.length();
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(Math.sqrt(3) * CUBE_PIECE_POP * 1.5);
    await act(async () => root.render(draw(1, false, true)));
    store.getState().advance(5 / 60 + 0.000001);
    expect(raised.current.parent.position.length()).toBe(0);
    expect(quiet.current.parent.position.length()).toBeCloseTo(partial, 3);
  } finally {
    await act(async () => root.unmount());
    expect(raisedCubieExtent()).toBe(0);
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
