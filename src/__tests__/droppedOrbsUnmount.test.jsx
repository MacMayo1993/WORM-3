import React, { act } from 'react';
import { expect, it, vi } from 'vitest';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { DroppedOrbs } from '../worm/healerWorm/DroppedOrbs.jsx';

extend(THREE);

// Leaving a WORM run (or skipping out of the demo's practice) unmounts the
// dropped-orb pools. <primitive dispose={null}> writes `dispose = null` onto
// each mesh, so the cleanup must not call the instance's own dispose: it used
// to throw and take the whole canvas through its error boundary.
it('releases its instanced pools on unmount without throwing', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const worm = { droppedOrbs: { current: [] }, pendingDropDissolves: { current: [] } };
  try {
    let state;
    await act(async () => { state = root.render(<DroppedOrbs worm={worm} size={3} />); });
    const pools = state.getState().scene.children.filter(o => o.isInstancedMesh);
    expect(pools).toHaveLength(2);
    expect(pools.every(mesh => mesh.dispose === null)).toBe(true); // what R3F does with dispose={null}
    const released = vi.fn();
    for (const mesh of pools) mesh.addEventListener('dispose', released);
    await act(async () => root.unmount());
    expect(released).toHaveBeenCalledTimes(2);
  } finally {
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
