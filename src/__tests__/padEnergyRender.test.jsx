import React, { act, createRef } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { PadProvider, FlipPadOffset } from '../3d/PadSprings.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { WORM_PAD_HEIGHT } from '../game/raisedCubie.js';
import { PAD_PROFILES } from '../3d/padPose.js';
import { TREMBLE_NORMAL, TREMBLE_PLANE } from '../3d/padEnergy.js';

extend(THREE);
it.each([[true, 0, 'off', true], [true, 0, 'full'], [false, 0, 'full'], [false, 3, 'off'], [false, 3, 'subtle'], [false, 0, 'off', true], [false, 0, 'subtle', true]])('renders energy pads with pause, healing and reduced motion (WORM=%s, chaos=%i, saved=%s)', async (wormHealerMode, chaosLevel, flipPads, demoMode = false) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  useGameStore.setState({ size: 3, chaosLevel, wormHealerMode, mirrorMode: false, demoMode, wormPauseMenuOpen: false,
    settings: { ...before.settings, flipPads, reducedMotion: false } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const front = createRef(), back = createRef();
  const cubies = makeCubies(3);
  const a = cubies[1][1][2].stickers.PZ, b = cubies[1][1][0].stickers.NZ;
  const draw = flips => <PadProvider>
    <FlipPadOffset meta={{ ...a, flips }} size={3} pos={[0, 0, 0.51]} rot={[0, 0, 0]}><group ref={front} position={[0, 0, 0.51]} /></FlipPadOffset>
    <FlipPadOffset meta={{ ...b, flips }} size={3} pos={[0, 0, -0.51]} rot={[0, Math.PI, 0]}><group ref={back} position={[0, 0, -0.51]} /></FlipPadOffset>
  </PadProvider>;
  let store;
  try {
    await act(async () => { store = root.render(draw(1)); });
    const scene = store.getState().scene;
    const find = test => { let hit = null; scene.traverse(o => { if (!hit && test(o)) hit = o; }); return hit; };
    const arcs = find(o => o.isMesh && !o.isInstancedMesh && o.geometry?.attributes?.aTangent);
    const sparks = find(o => o.isPoints);
    expect(arcs).toBeTruthy();
    expect(sparks).toBeTruthy();
    const liveSparks = () => sparks.geometry.attributes.aAlpha.array.filter(v => v > 0).length;
    const bound = TREMBLE_NORMAL + Math.SQRT2 * TREMBLE_PLANE + 1e-9;
    let frame = 1, lit = 0, shook = false;
    for (; frame <= 90; frame++) {
      store.getState().advance(frame / 60);
      const f = front.current.parent.position.length(), k = back.current.parent.position.length();
      // Twins shudder as one, a few millimetres around the fixed landing height.
      expect(f).toBeCloseTo(k, 12);
      if (wormHealerMode) expect(Math.abs(f - WORM_PAD_HEIGHT)).toBeLessThanOrEqual(bound);
      else {
        expect(f).toBeGreaterThan(0);
        expect(f).toBeLessThan(PAD_PROFILES.cube.height + PAD_PROFILES.cube.amplitude + PAD_PROFILES.cube.wearAmplitude);
      }
      shook ||= Math.abs(f - WORM_PAD_HEIGHT) > TREMBLE_NORMAL / 4;
      if (arcs.geometry.drawRange.count > 0) lit++;
    }
    expect(shook).toBe(true);
    const columns = find(o => o.isInstancedMesh && o.material.fragmentShader?.includes('vLocal.z'));
    expect(columns.count).toBe(2);
    expect(columns.material.transparent).toBe(true);
    expect(columns.material.depthWrite).toBe(false);
    expect(find(o => o.isInstancedMesh && o.material.isMeshStandardMaterial).count).toBe(0);
    expect(lit).toBeGreaterThan(60);
    expect(liveSparks()).toBeGreaterThan(0);

    // Pause holds every pose where it is.
    useGameStore.setState({ wormPauseMenuOpen: true });
    store.getState().advance(frame++ / 60);
    const held = front.current.parent.position.clone();
    const heldRange = arcs.geometry.drawRange.count;
    for (let i = 0; i < 10; i++) store.getState().advance(frame++ / 60);
    expect(front.current.parent.position.equals(held)).toBe(true);
    expect(arcs.geometry.drawRange.count).toBe(heldRange);

    // Reduced motion: a steady glow at exactly the landing height, no arcs or sparks.
    useGameStore.setState({ wormPauseMenuOpen: false, settings: { ...useGameStore.getState().settings, reducedMotion: true } });
    for (let i = 0; i < 5; i++) store.getState().advance(frame++ / 60);
    expect(front.current.parent.position.length()).toBeCloseTo(wormHealerMode ? WORM_PAD_HEIGHT : PAD_PROFILES.cube.height, 12);
    expect(arcs.geometry.drawRange.count).toBe(0);
    expect(liveSparks()).toBe(0);

    // Healed home: the pad settles and the storm has nothing left to draw.
    await act(async () => root.render(draw(2)));
    store.getState().advance(frame++ / 60);
    expect(front.current.parent.position.length()).toBe(0);
    const counts = [];
    scene.traverse(o => { if (o.isInstancedMesh) counts.push(o.count); });
    expect(counts.every(count => count === 0)).toBe(true);
    if (!wormHealerMode && (chaosLevel > 0 || demoMode)) {
      // Exiting Chaos or the demo restores the saved pad behavior on the same scene.
      await act(async () => useGameStore.setState({ chaosLevel: 0, demoMode: false }));
      await act(async () => root.render(draw(1)));
      store.getState().advance(frame++ / 60);
      expect(front.current.parent.position.length()).toBeCloseTo(flipPads === 'off' ? 0 : PAD_PROFILES.cube.height, 12);
      expect(useGameStore.getState().settings.flipPads).toBe(flipPads);
    }
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
