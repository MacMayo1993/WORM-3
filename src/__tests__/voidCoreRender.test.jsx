import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import VoidCore from '../3d/VoidCore.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';

// jsdom has touch events, so it reads as mobile; the heart's light is desktop-only.
vi.mock('../utils/device.js', async (importOriginal) => ({ ...(await importOriginal()), isMobile: false }));

extend(THREE);

it('reacts to flips, lights only an opened cube, and closes up for WORM', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  // A pulse left over from earlier play must not fire when the core mounts.
  useGameStore.setState({
    cubies: makeCubies(3), size: 3, wormHealerMode: false, wormPaused: false, explosionT: 0, visualMode: 'classic',
    hollowMode: false, perfReducedFX: false, moveHistory: [], flipPulse: { at: 1, color: '#ffffff', danger: 0 },
    settings: { ...before.settings, colorScheme: 'standard', reducedMotion: false, biomeMode: { enabled: false } }
  });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 }, camera: { position: [0, 0, 5] } });
  try {
    let store, time = 0;
    await act(async () => { store = root.render(<VoidCore />); });
    const frame = () => store.getState().advance(time += 1 / 60);
    frame();
    const scene = store.getState().scene;
    const flare = scene.getObjectByName('void-core-mouths').material.uniforms.uFlare.value;
    const heart = scene.getObjectByName('void-core-heart').material.uniforms;
    const light = scene.getObjectByName('void-core-light');
    expect(heart.uFlash.value).toBe(0);
    expect(flare.every(v => v === 0)).toBe(true);
    // Closed cube: the heart must not light the groove walls between pieces.
    expect(light).toBeInstanceOf(THREE.PointLight);
    expect(light.intensity).toBe(0);

    // Flip a +X tile: its port (id 5) and the antipodal −X port (id 2) flare.
    await act(async () => useGameStore.setState({
      moveHistory: [{ type: 'flip', pos: { x: 2, y: 1, z: 1 }, dirKey: 'PX', timestamp: 50 }],
      flipPulse: { at: 50, color: '#3973e8', danger: 0 }
    }));
    frame();
    expect(heart.uFlash.value).toBeGreaterThan(0.9);
    expect(heart.uFlipT.value).toBeGreaterThan(0);
    expect(heart.uFlipDir.value.toArray()).toEqual([1, 0, 0]);
    expect(flare[4]).toBeGreaterThan(0.9);
    expect(flare[1]).toBeGreaterThan(0.9);
    expect([0, 2, 3, 5].every(i => flare[i] === 0)).toBe(true);
    const flashed = heart.uFlash.value;
    frame();
    expect(heart.uFlash.value).toBeLessThan(flashed); // and it fades

    await act(async () => useGameStore.setState({ explosionT: 1 })); frame();
    expect(light.intensity).toBeGreaterThan(0);

    // WORM: the portholes close so the piece hides the worm's turn; the light
    // stays mounted (dark) so the scene's light count never changes.
    await act(async () => useGameStore.setState({ wormHealerMode: true })); frame();
    const body = scene.getObjectByName('worm-core-body');
    expect(body.material.transparent).toBe(false);
    expect(body.material.depthWrite).toBe(true);
    expect(scene.getObjectByName('worm-core-mouths').material.transparent).toBe(false);
    expect(scene.getObjectByName('void-core-heart')).toBeUndefined();
    expect(scene.getObjectByName('void-core-light')).toBe(light);
    expect(light.intensity).toBe(0);
  } finally {
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
