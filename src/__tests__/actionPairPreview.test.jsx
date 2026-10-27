import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import ActionPairPreview from '../components/overlays/ActionPairPreview.jsx';
import { registerInspectionSurface } from '../3d/inspectionBridge.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { resetManifoldMap } from '../game/manifoldMapStore.js';
import { ACTION_CUES } from '../game/actionCues.js';
extend(THREE);

it('follows both live sticker transforms, survives remounts, and removes all markers on exit', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(); resetManifoldMap();
  useGameStore.setState({ cubies: makeCubies(3), size: 3, rotationEpoch: 200, currentLevelData: { actionFocus: 'M1-005' },
    showMainMenu: false, showWelcome: false, victory: null, wormHealerMode: false, showCursor: false });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 390, height: 844 } });
  let store, time = 0;
  const a = new THREE.Object3D(), b = new THREE.Object3D();
  a.position.set(1, 2, 3); b.position.set(-1, -2, -3);
  let unregisterA = registerInspectionSurface('M1-005', a);
  const unregisterB = registerInspectionSurface('M4-005', b);
  const tick = async () => act(async () => store.getState().advance(time += 1 / 60));
  try {
    await act(async () => { store = root.render(<ActionPairPreview />); });
    await tick();
    const pair = store.getState().scene.getObjectByName('action-linked-pair');
    expect(pair.children).toHaveLength(2);
    expect(pair.children[0].matrix.elements.slice(12, 15)).toEqual([1, 2, 3]);
    expect(pair.children[1].matrix.elements.slice(12, 15)).toEqual([-1, -2, -3]);
    const ring = pair.children[0].children[0];
    expect(ring.geometry.type).toBe('RingGeometry');
    expect(ring.material.color.getHexString()).toBe(ACTION_CUES.link.color.slice(1));
    expect(ring.material.depthTest).toBe(true);
    expect(ring.raycast()).toBeNull();
    unregisterA();
    const moved = new THREE.Object3D(); moved.position.set(4, 5, 6); moved.rotation.y = Math.PI / 2;
    unregisterA = registerInspectionSurface('M1-005', moved);
    await tick();
    expect(pair.children[0].matrix.elements).toEqual(moved.matrixWorld.elements);
    unregisterB(); await tick(); expect(pair.children[1].visible).toBe(false);
    await act(async () => useGameStore.setState({ currentLevelData: null }));
    expect(store.getState().scene.getObjectByName('action-linked-pair')).toBeUndefined();
  } finally {
    unregisterA(); unregisterB(); await act(async () => root.unmount());
    useGameStore.setState(before, true); resetManifoldMap(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
