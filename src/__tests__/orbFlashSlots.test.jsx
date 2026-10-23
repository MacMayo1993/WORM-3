import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { PICKUP_BURST_SECONDS } from '../worm/healerWorm/orbPickupBurst.js';

extend(THREE);

// Orb pickups play from four bursts that stay mounted: the frame loop restarts the
// next one, so a chain of pickups costs no mount and no React state in useFrame.
let before, root, store;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; before = useGameStore.getState(); });
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  useGameStore.setState(before, true);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function mount(worm) {
  const { OrbFlashSystem } = await import('../worm/healerWorm/orbSystems.jsx');
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 400, height: 300 } });
  await act(async () => { store = root.render(<OrbFlashSystem worm={worm} />); });
}
const groups = () => store.getState().scene.children.filter(o => o.isGroup);
const count = () => { let n = 0; store.getState().scene.traverse(() => { n++; }); return n; };

it('plays each pickup in the next mounted burst, without mounting anything', async () => {
  useGameStore.setState({ wormAlive: true, wormPaused: false });
  const worm = { pendingOrbFlashRef: { current: null }, currentNormal: { current: new THREE.Vector3(0, 0, 1) } };
  await mount(worm);
  let t = 0;
  await act(async () => { store.getState().advance(t += 1 / 60); });
  expect(groups()).toHaveLength(4);
  expect(groups().every(g => !g.visible)).toBe(true);
  const objects = count();

  for (let k = 0; k < 6; k++) {
    worm.pendingOrbFlashRef.current = { color: '#ff0000', pos: [k, 0, 0], combo: k };
    await act(async () => { store.getState().advance(t += 1 / 60); });
    expect(worm.pendingOrbFlashRef.current).toBeNull();
  }
  expect(count()).toBe(objects);
  // Six pickups over four slots: every slot is playing, the newest at x = 5.
  expect(groups().filter(g => g.visible)).toHaveLength(4);
  expect(groups().map(g => g.position.x).sort()).toEqual([2, 3, 4, 5]);

  // Paused, they hold; then they finish and hide.
  useGameStore.setState({ wormPaused: true });
  worm.pendingOrbFlashRef.current = { color: '#00ff00', pos: [9, 0, 0], combo: 0 };
  await act(async () => { store.getState().advance(t += 1); });
  expect(worm.pendingOrbFlashRef.current).not.toBeNull(); // waits for play to resume
  useGameStore.setState({ wormPaused: false });
  worm.pendingOrbFlashRef.current = null;
  for (let f = 0; f < Math.ceil(PICKUP_BURST_SECONDS * 60) + 5; f++) await act(async () => { store.getState().advance(t += 1 / 60); });
  expect(groups().every(g => !g.visible)).toBe(true);

  // A dead worm stops every burst and drops a queued one.
  worm.pendingOrbFlashRef.current = { color: '#00ff00', pos: [1, 0, 0], combo: 0 };
  await act(async () => { store.getState().advance(t += 1 / 60); });
  useGameStore.setState({ wormAlive: false });
  await act(async () => { store.getState().advance(t += 1 / 60); });
  expect(groups().every(g => !g.visible)).toBe(true);
});
