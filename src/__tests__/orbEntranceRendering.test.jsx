import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import ParityOrbs from '../worm/ParityOrb.jsx';
import { PARITY_ORB_GEOMETRIES } from '../worm/parityOrbGeometries.js';
import { getSegmentWorldPos } from '../worm/wormLogic.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { holdOrbEntrance, setOrbEntranceClock, releaseOrbEntrance, orbWaveReach, orbWaveStart } from '../worm/orbEntrance.js';

extend(THREE);

// The orbs on the board when a run starts wait off the board through the scramble,
// then rise out of their tiles in a wave from the portal: nearest first, all up
// once play starts. They used to be hidden through the arrival and pop in whole.
it('holds a run\'s orbs off the board, warms them once, and raises them nearest-first on the arrival clock', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const previous = useGameStore.getState();
  useGameStore.setState({ showAntipodalPiP: true, wormPaused: false });
  const canvas = document.createElement('canvas');
  const compile = vi.fn();
  const gl = { render: vi.fn(), compile, setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const size = 5;
  const start = { x: 2, y: 2, z: 4, dirKey: 'PZ' };
  const head = { current: new THREE.Vector3(...getSegmentWorldPos(start, size, 0)) };
  const near = { x: 3, y: 2, z: 4, dirKey: 'PZ', spawnId: 'near', color: '#ff0000', antipodalColor: '#ff7a00' };
  const far = { x: 2, y: 2, z: 0, dirKey: 'NZ', spawnId: 'far', color: '#0000ff', antipodalColor: '#00ff00' };
  const g = PARITY_ORB_GEOMETRIES.normal;
  let store, frame = 0;
  const advance = count => { for (let i = 0; i < count; i++) store.advance(++frame / 60); };
  // Each orb's glass shell, found by which side of the cube its group sits on.
  const shells = () => {
    const found = {};
    store.scene.traverse(o => { if (o.isMesh && o.geometry === g.shell) found[o.parent.position.z > 0 ? 'near' : 'far'] = o; });
    return found;
  };
  const shown = mesh => { for (let o = mesh; o; o = o.parent) if (!o.visible) return false; return true; };
  try {
    holdOrbEntrance();
    await act(async () => {
      store = root.render(<ParityOrbs wormMode size={size} orbs={[near, far]} focusRef={head} />).getState();
    });
    advance(30);
    // The scramble: nothing on the board, and the waiting orbs compiled once, with
    // the opaque batches they join on arrival already made (empty) in their own
    // materials, so the wave links no program when it reaches them.
    expect(shown(shells().near)).toBe(false);
    expect(shown(shells().far)).toBe(false);
    expect(compile).toHaveBeenCalledTimes(1);
    const batches = store.scene.getObjectByName('ParityOrbOpaqueBatches');
    const prepared = [...batches.children];
    expect(prepared.length).toBeGreaterThan(0);
    expect(prepared.every(mesh => mesh.count === 0 && !mesh.material.transparent)).toBe(true);

    // The arrival, just past the point the wave reaches the near orb.
    const duration = 3.4;
    const reachOf = tile => orbWaveReach(new THREE.Vector3(...getSegmentWorldPos(tile, size, 0)).distanceTo(head.current), size);
    expect(reachOf(near)).toBeLessThan(reachOf(far));
    let elapsed = 0.01;
    setOrbEntranceClock(elapsed, duration);
    advance(1);
    const tick = () => { elapsed += 1 / 60; setOrbEntranceClock(elapsed, duration); advance(1); };
    while (elapsed / duration < orbWaveStart(reachOf(near)) + 0.01) tick();
    tick();
    expect(shown(shells().near)).toBe(true);
    expect(shown(shells().far)).toBe(false);
    // Rising: still below its hover and small.
    expect(shells().near.parent.scale.x).toBeLessThan(1);

    // GO: the far orb has come up too, and each wears its own materials again.
    while (elapsed < duration) tick();
    releaseOrbEntrance();
    advance(60);
    expect(shown(shells().near)).toBe(true);
    expect(shown(shells().far)).toBe(true);
    expect(shells().far.parent.scale.x).toBeGreaterThan(0.99);
    expect(compile).toHaveBeenCalledTimes(1);
    expect(batches.children).toEqual(prepared);
    expect(prepared.some(mesh => mesh.count > 0)).toBe(true);

    // Once play runs, a new orb gets its ordinary reveal straight away.
    const later = { x: 1, y: 1, z: 4, dirKey: 'PZ', spawnId: 'later', color: '#ffff00', antipodalColor: '#ffffff' };
    await act(async () => { root.render(<ParityOrbs wormMode size={size} orbs={[near, far, later]} focusRef={head} />); });
    advance(1);
    let laterShell;
    store.scene.traverse(o => { if (o.isMesh && o.geometry === g.shell && o.parent.position.x < -0.5 && o.parent.position.z > 0) laterShell = o; });
    expect(shown(laterShell)).toBe(true);
  } finally {
    releaseOrbEntrance();
    await act(async () => root.unmount());
    useGameStore.setState({ showAntipodalPiP: previous.showAntipodalPiP, wormPaused: previous.wormPaused });
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
