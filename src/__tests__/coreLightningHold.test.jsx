import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import VoidCore from '../3d/VoidCore.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { coreLayout } from '../3d/antipodalCore.js';

extend(THREE);

// The core's seams hold still whenever the game does: a flip's surge and tint must
// not keep fading in or out behind a paused or dead worm, or under reduced motion.
it('holds the core lightning still while paused, dead or with reduced motion', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  useGameStore.setState({
    cubies: makeCubies(3), size: 3, wormHealerMode: true, wormPaused: false, wormAlive: true, explosionT: 0,
    visualMode: 'classic', animState: null, hollowMode: false, perfReducedFX: false, moveHistory: [],
    flipPulse: { at: 1, color: '#ffffff', danger: 0 },
    settings: { ...before.settings, colorScheme: 'standard', reducedMotion: false, biomeMode: { enabled: false } }
  });
  const refs = [];
  for (const { idx } of coreLayout(3).cells) refs[idx] = new THREE.Object3D();
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  try {
    let store, time = 0;
    await act(async () => { store = root.render(<VoidCore cubieRefs={refs} />); });
    const frame = () => store.getState().advance(time += 1 / 60);
    frame();
    const bolt = store.getState().scene.getObjectByName('antipodal-core-body').material.userData.coreLightning;
    const snapshot = () => [bolt.uCoreBoltTime.value, bolt.uCoreBoltGain.value, bolt.uCoreBoltColor.value.getHex()];
    const pulse = async at => {
      await act(async () => useGameStore.setState({ flipPulse: { at, color: '#ff2020', danger: 0 } }));
      frame();
    };

    // Running: a flip surges and tints the arcs, and the clock moves.
    const calm = snapshot();
    await pulse(10);
    const surged = snapshot();
    expect(surged[0]).toBeGreaterThan(calm[0]);
    expect(surged[1]).toBeGreaterThan(calm[1]);
    expect(surged[2]).not.toBe(calm[2]);

    // Paused or dead mid-surge: nothing about the arcs changes, frame after frame.
    for (const held of [{ wormPaused: true }, { wormPaused: false, wormAlive: false }]) {
      await act(async () => useGameStore.setState(held));
      frame();
      const frozen = snapshot();
      for (let i = 0; i < 30; i++) frame();
      expect(snapshot()).toEqual(frozen);
    }

    // Reduced motion: steady arcs, no surge or tint fading in and out after a flip.
    await act(async () => useGameStore.setState({ wormAlive: true,
      settings: { ...useGameStore.getState().settings, reducedMotion: true } }));
    await pulse(20);
    const steady = snapshot();
    expect(steady[2]).toBe(calm[2]);
    for (let i = 0; i < 30; i++) frame();
    expect(snapshot()).toEqual(steady);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
