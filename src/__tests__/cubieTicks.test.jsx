import React, { act, createRef } from 'react';
import { createRoot, extend, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Cubie from '../3d/Cubie.jsx';
import { PadProvider } from '../3d/PadSprings.jsx';
import { createCubieTicks, CubieTicksProvider } from '../3d/cubieTicks.js';
import { cubieKicks } from '../3d/cubieKick.js';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { CUBE_PIECE_POP } from '../game/raisedCubie.js';

vi.mock('../3d/StickerPlane.jsx', () => ({ default: () => null }));
extend(THREE);

describe('createCubieTicks', () => {
  it('keeps only moving cubies active, wakes one on request and ticks every cubie on a board-wide cause', () => {
    const ticks = createCubieTicks();
    const moving = new Set(['a']);
    const calls = [];
    const make = name => delta => { calls.push(name); return moving.has(name) && delta > 0; };
    const a = make('a'), b = make('b'), c = make('c');
    const release = [a, b, c].map(tick => ticks.register(tick));
    ticks.run(1 / 60);
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(ticks.activeCount()).toBe(1);
    calls.length = 0; ticks.run(1 / 60);
    expect(calls).toEqual(['a']);
    moving.clear(); calls.length = 0; ticks.run(1 / 60);
    expect(ticks.activeCount()).toBe(0);
    calls.length = 0; ticks.run(1 / 60);
    expect(calls).toEqual([]);
    ticks.wake(b); moving.add('b'); ticks.run(1 / 60);
    expect(calls).toEqual(['b']);
    // A kick anywhere ticks every cubie that frame, as each own callback did.
    cubieKicks.set('0,0,0', { startMs: performance.now(), amp: 0.1, x: 0, y: 0, z: 1 });
    try {
      calls.length = 0; ticks.run(1 / 60);
      expect(calls.sort()).toEqual(['a', 'b', 'c']);
    } finally { cubieKicks.clear(); }
    release.forEach(off => off());
    calls.length = 0; ticks.run(1 / 60);
    expect(calls).toEqual([]);
  });
});

describe('cubies under one driver', () => {
  const before = useGameStore.getState();
  afterEach(() => { useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

  it('raise a flipped piece, return it home and then stop ticking', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    useGameStore.setState({ size: 3, explosionT: 0, mirrorMode: false, hollowMode: false, visualMode: 'solid', chaosLevel: 0,
      randomMode: false, wormHealerMode: false, demoMode: false, cubiePops: {}, settings: { ...before.settings, flipPads: 'full', reducedMotion: true } });
    const canvas = document.createElement('canvas');
    const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
      xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
    const root = createRoot(canvas);
    root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
    const ticks = createCubieTicks(), raised = createRef(), quiet = createRef();
    const source = makeCubies(3);
    const piece = flips => ({ ...source[2][2][2], stickers: { ...source[2][2][2].stickers,
      PZ: { ...source[2][2][2].stickers.PZ, flips, curr: flips % 2 ? 4 : 1 } } });
    function Driver() { useFrame((_s, delta) => ticks.run(delta), -0.75); return null; }
    const draw = flips => <PadProvider><CubieTicksProvider value={ticks}>
      <Driver />
      <Cubie ref={raised} cubie={piece(flips)} position={[1, 1, 1]} size={3} />
      <Cubie ref={quiet} cubie={source[0][0][0]} position={[-1, -1, -1]} size={3} />
    </CubieTicksProvider></PadProvider>;
    let store, time = 0;
    const frame = () => store.getState().advance(time += 1 / 60);
    try {
      await act(async () => { store = root.render(draw(1)); });
      frame();
      raised.current.getWorldPosition(new THREE.Vector3()).toArray().forEach(v => expect(v).toBeCloseTo(1 + CUBE_PIECE_POP, 10));
      expect(quiet.current.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([-1, -1, -1]);
      // The quiet piece left the active set on its first tick; the raised one stays.
      expect(ticks.activeCount()).toBe(1);
      await act(async () => { root.render(draw(2)); });
      frame(); frame();
      expect(raised.current.parent.position.length()).toBe(0);
      expect(ticks.activeCount()).toBe(0);
    } finally {
      await act(async () => root.unmount());
    }
  });
});
