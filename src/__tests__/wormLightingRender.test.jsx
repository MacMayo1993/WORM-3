import React, { act, createRef } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { WormLighting, WormPointLight } from '../worm/WormLighting.jsx';

extend(THREE);
it('keeps only pool lights in the real scene while source refs animate and remount', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const canvas = document.createElement('canvas'), source = createRef();
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 1280, height: 800 } });
  const draw = on => <WormLighting>{on && <group position={[2, 3, 1]}>
    <WormPointLight ref={source} color="#ff6600" intensity={1.2} distance={3.2} decay={2} />
  </group>}</WormLighting>;
  try {
    let store;
    await act(async () => { store = root.render(draw(true)); });
    store.getState().advance(0);
    const pool = store.getState().scene.getObjectByName('WormPointLightPool');
    const count = pool.children.length;
    const lights = () => { const result = []; store.getState().scene.traverseVisible(o => { if (o.isLight) result.push(o); }); return result; };
    expect(lights()).toHaveLength(count);
    expect(source.current.isLight).toBeUndefined();
    expect(pool.children[0].color.getHexString()).toBe('ff6600');
    expect(pool.children[0].getWorldPosition(new THREE.Vector3()).toArray()).toEqual([2, 3, 1]);
    source.current.intensity = 0.25;
    store.getState().advance(1 / 60);
    expect(pool.children[0].intensity).toBe(0.25);
    await act(async () => root.render(draw(false)));
    store.getState().advance(2 / 60);
    expect(lights()).toHaveLength(count);
    expect(pool.children.every(l => l.intensity === 0)).toBe(true);
    await act(async () => root.render(draw(true)));
    store.getState().advance(3 / 60);
    expect(lights()).toHaveLength(count);
    expect(pool.children[0].intensity).toBe(1.2);
  } finally {
    await act(async () => root.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
