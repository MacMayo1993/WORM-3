import React, { act, createRef } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { PadProvider, FlipPadOffset } from '../3d/PadSprings.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { padBackFace } from '../game/raisedCubie.js';
import { padMotion } from '../3d/padMotionBridge.js';

extend(THREE);
it('renders twin lifts along their normals, keeps slots fixed, and clears on heal/unmount', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  useGameStore.setState({ size: 3, chaosLevel: 0, wormHealerMode: false, settings: { ...before.settings, flipPads: 'full', reducedMotion: true } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const front = createRef(), back = createRef();
  const cubies = makeCubies(3);
  const a = cubies[1][1][2].stickers.PZ, b = cubies[1][1][0].stickers.NZ;
  const draw = (flips, backKey = 'back') => <PadProvider>
    <FlipPadOffset meta={{ ...a, flips }} size={3} pos={[0, 0, 0.51]} rot={[0, 0, 0]}><group ref={front} position={[0, 0, 0.51]} /></FlipPadOffset>
    <FlipPadOffset key={backKey} meta={{ ...b, flips }} size={3} pos={[0, 0, -0.51]} rot={[0, Math.PI, 0]}><group ref={back} position={[0, 0, -0.51]} /></FlipPadOffset>
  </PadProvider>;
  try {
    let store;
    await act(async () => { store = root.render(draw(1)); });
    store.getState().advance(1 / 60);
    expect(front.current.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(0.81);
    expect(back.current.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(-0.81);
    const meshes = store.getState().scene.children.filter(o => o.isInstancedMesh);
    expect(meshes.map(m => m.count)).toEqual([2, 2]);
    const color = new THREE.Color();
    meshes[0].getColorAt(0, color);
    expect(color.getHexString()).toBe(new THREE.Color(resolveColors(useGameStore.getState().settings)[padBackFace(a)]).getHexString());
    expect(meshes[0].material.color.getHexString()).toBe('ffffff');
    expect(meshes[0].material.emissiveIntensity).toBe(0);
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, colorScheme: 'custom', customColors: { [padBackFace(a)]: '#ab42ef' } } });
    store.getState().advance(1.5 / 60);
    meshes[0].getColorAt(0, color);
    expect(color.getHexString()).toBe('ab42ef');
    const slot = new THREE.Matrix4(); meshes[1].getMatrixAt(0, slot);
    expect(new THREE.Vector3().setFromMatrixPosition(slot).z).toBeCloseTo(0.51);
    expect(padMotion.size).toBe(1);
    useGameStore.setState({ settings: { ...before.settings, flipPads: 'full', reducedMotion: false } });
    for (let frame = 2; frame < 120; frame++) {
      store.getState().advance(frame / 60);
      expect(front.current.parent.position.length()).toBeCloseTo(back.current.parent.position.length(), 12);
    }
    // A slice can remount one member while the other stays alive. It must adopt
    // the existing pair spring rather than restart from zero.
    await act(async () => { root.render(draw(1, 'rotated-back')); });
    store.getState().advance(2);
    expect(front.current.parent.position.length()).toBeCloseTo(back.current.parent.position.length(), 12);
    useGameStore.setState({ settings: { ...before.settings, flipPads: 'full', reducedMotion: true } });
    await act(async () => root.render(draw(0)));
    store.getState().advance(3);
    expect(front.current.parent.position.length()).toBe(0);
    expect(meshes.map(m => m.count)).toEqual([0, 0]);
    expect(padMotion.size).toBe(0);
    await act(async () => root.render(draw(1)));
    store.getState().advance(4);
    expect(padMotion.size).toBe(1);
  } finally {
    await act(async () => root.unmount());
    expect(padMotion.size).toBe(0);
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
