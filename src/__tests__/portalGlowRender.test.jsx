import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { PortalGlow } from '../worm/healerWorm/portalFx.jsx';
import { FACE_NORMALS } from '../worm/healerWorm/constants.js';

extend(THREE);

it('never leaves an invisible depth-writing ring ahead of the worm and lays active glow on each face', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 390, height: 844 } });
  const worm = { pos: { current: { x: 1, y: 1, z: 2, dirKey: 'PZ' } }, phase: { current: 'crawling' }, onFlippedTile: { current: false } };
  let store, t = 0;
  const tick = async () => act(async () => store.getState().advance(t += 1 / 60));
  try {
    await act(async () => { store = root.render(<PortalGlow worm={worm} size={3} />); });
    const mesh = store.getState().scene.children.find(o => o.isMesh);
    expect(mesh.visible).toBe(false);
    expect(mesh.material.depthWrite).toBe(false);
    await tick();
    expect(mesh.visible).toBe(false);
    for (const dirKey of Object.keys(FACE_NORMALS)) {
      const tile = { x: 1, y: 1, z: 1, dirKey };
      tile[dirKey[1].toLowerCase()] = dirKey[0] === 'P' ? 2 : 0;
      worm.pos.current = tile;
      worm.onFlippedTile.current = true;
      await tick();
      expect(mesh.visible).toBe(true);
      expect(mesh.material.opacity).toBeGreaterThan(0);
      expect(new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion).distanceTo(FACE_NORMALS[dirKey])).toBeLessThan(1e-8);
    }
    for (const phase of ['windup', 'entering', 'tunnel', 'exiting', 'windout', 'dead']) {
      worm.phase.current = phase;
      await tick();
      expect(mesh.visible).toBe(false);
    }
    worm.phase.current = 'crawling';
    worm.onFlippedTile.current = false;
    await tick();
    expect(mesh.visible).toBe(false);
  } finally {
    await act(async () => root.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
