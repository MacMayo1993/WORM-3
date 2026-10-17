import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { subscribeBombRotations } from '../worm/healerWorm/bombRotation.js';
import { setLiveRotation, resetLiveRotation, cancelLiveRotation } from '../worm/liveRotation.js';

extend(THREE);

it('moves the mounted bomb, ring, fuse and countdown without membership changes or React rerenders', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    beginPath() {}, moveTo() {}, bezierCurveTo() {}, closePath() {}, fill() {},
    clearRect() {}, strokeText() {}, fillText() {},
    createLinearGradient: () => ({ addColorStop() {} }),
  });
  const { HealerBombs } = await import('../worm/healerWorm/HealerBombs.jsx');
  const before = useGameStore.getState();
  useGameStore.setState({ size: 5, lastRotation: null, wormGamePhase: 'active' });
  const bombsRef = { current: [{ id: 1, tile: { x: 2, y: 2, z: 4, dirKey: 'PZ' }, fuse: 4 }] };
  const stop = subscribeBombRotations(useGameStore, bombsRef);
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize() {}, setPixelRatio() {}, domElement: canvas,
    xr: { addEventListener() {}, removeEventListener() {} }, shadowMap: {}, renderLists: { dispose() {} }, forceContextLoss() {} };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 390, height: 844 } });
  try {
    let store;
    await act(async () => { store = root.render(<HealerBombs bombsRef={bombsRef} membershipRef={{ current: 1 }} size={5} />); });
    const state = store.getState();
    await act(async () => state.advance(1 / 60));
    state.advance(2 / 60);
    const bomb = state.scene.getObjectByName('worm-bomb-1');
    expect(bomb.position.z).toBeGreaterThan(2);
    const initial = bomb.position.clone();
    const xAxis = new THREE.Vector3(1, 0, 0);
    setLiveRotation('col', [2], [Math.PI / 4], 2, Math.PI / 4);
    state.advance(3 / 60);
    expect(bomb.position.distanceTo(initial.clone().applyAxisAngle(xAxis, Math.PI / 4))).toBeLessThan(1e-8);
    setLiveRotation('col', [2], [Math.PI / 2], 2, Math.PI / 2);
    state.advance(4 / 60);
    state.scene.updateMatrixWorld(true);
    const meshes = [];
    bomb.traverse(child => { if (child.isMesh || child.isSprite) meshes.push(child); });
    expect(meshes.length).toBeGreaterThan(8);
    const positions = meshes.map(child => child.getWorldPosition(new THREE.Vector3()));
    resetLiveRotation();
    useGameStore.setState(s => ({ rotationEpoch: s.rotationEpoch + 1,
      lastRotation: { axis: 'col', sliceIndex: 2, dir: 1 } }));
    state.advance(5 / 60);
    state.scene.updateMatrixWorld(true);
    // The sphere's decorative highlight is world-lit; all tile furniture stays attached.
    meshes.forEach((child, i) => {
      if (child.geometry?.type === 'SphereGeometry') return;
      expect(child.getWorldPosition(new THREE.Vector3()).distanceTo(positions[i])).toBeLessThan(1e-8);
    });
    expect(state.scene.getObjectByName('worm-bomb-1')).toBe(bomb);
  } finally {
    stop();
    await act(async () => root.unmount());
    cancelLiveRotation(); useGameStore.setState(before, true);
    context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
