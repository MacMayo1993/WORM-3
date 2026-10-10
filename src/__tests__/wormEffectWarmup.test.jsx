import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { PickupMaterialProvider } from '../worm/healerWorm/PickupMaterials.jsx';
import WormEffectWarmup from '../worm/healerWorm/WormEffectWarmup.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { ordinaryMaterial, flippedMaterial } from '../3d/tileBoundaryMaterials.js';
import { stickerWormBodyMaterial, stickerWormGlowMaterial } from '../3d/stickerWormMaterials.js';
import { healthBarMaterial } from '../3d/disparityHealthBarMaterial.js';
import { elementalWarmupObjects } from '../worm/healerWorm/elementalWarmup.js';

extend(THREE);
it('retains warmed programs across events, warms changed scene variants, and disposes on mode exit', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), canvas = document.createElement('canvas');
  const warmMaterials = new Set(), lineKeys = [];
  const gl = { render: vi.fn(), compile: vi.fn((group, _camera, scene) => {
    expect(scene.isScene).toBe(true);
    const lineDefines = [];
    group.traverse(o => {
      if (o.material) warmMaterials.add(o.material);
      if (o.material?.isLineMaterial) {
        lineDefines.push(o.material.defines.USE_LINE_COLOR_ALPHA);
        o.material.onBeforeCompile();
      }
    });
    if (lineDefines.length) lineKeys.push(lineDefines);
  }), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
  xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas), body = { current: new THREE.Group() };
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let store;
  // The run-start scene compile and the fall-dissolve warm are checked at the end.
  useGameStore.setState({ wormGamePhase: 'active', wormAlive: false });
  try {
    await act(async () => { store = root.render(<PickupMaterialProvider><WormEffectWarmup body={body} /></PickupMaterialProvider>); });
    store.getState().advance(.01);
    expect(gl.compile).toHaveBeenCalledTimes(3);
    // Module-owned materials ride in the warm scene but belong to their modules.
    const shared = new Set([ordinaryMaterial, flippedMaterial, stickerWormBodyMaterial, stickerWormGlowMaterial, healthBarMaterial,
      ...elementalWarmupObjects(new THREE.PlaneGeometry()).map(o => o.material)]);
    const disposed = [...warmMaterials].filter(m => !shared.has(m)).map(m => vi.spyOn(m, 'dispose'));
    const kept = [...shared].map(m => vi.spyOn(m, 'dispose'));
    for (let i = 1; i <= 10; i++) store.getState().advance(i / 60);
    expect(gl.compile).toHaveBeenCalledTimes(3);
    disposed.forEach(spy => expect(spy).not.toHaveBeenCalled());
    useGameStore.setState({ perfReducedFX: !before.perfReducedFX });
    store.getState().advance(.3); expect(gl.compile).toHaveBeenCalledTimes(6);
    store.getState().scene.fog = new THREE.FogExp2('#000000', .01);
    store.getState().advance(.4); expect(gl.compile).toHaveBeenCalledTimes(9);
    // Each scene variant pins both the fresh-mount and post-compile Line key, for
    // the plain lines and for their portal-bored copies on the cube exterior.
    const fresh = Array(4).fill(undefined), settled = Array(4).fill('1');
    expect(lineKeys).toEqual(Array.from({ length: 3 }, () => [fresh, settled]).flat());
    // Transient events and run resets do not replace the warm materials.
    useGameStore.setState({ wormRunId: before.wormRunId + 1, wormOrbFlash: { seq: 9 } });
    store.getState().advance(.5); expect(gl.compile).toHaveBeenCalledTimes(9);
    // While the board scrambles, the live scene (hidden pools included) compiles
    // once per run and look, never again mid-run.
    useGameStore.setState({ wormGamePhase: 'scrambling' });
    store.getState().advance(.6); store.getState().advance(.7);
    expect(gl.compile).toHaveBeenCalledTimes(10);
    expect(gl.compile.mock.calls[9][0]).toBe(store.getState().scene);
    // A live crawling worm gets its caution-fall dissolve warmed once per look,
    // before play rather than in the middle of it.
    useGameStore.setState({ wormGamePhase: 'active', wormAlive: true, wormPhase: 'crawling' });
    store.getState().advance(.8);
    expect(gl.compile).toHaveBeenCalledTimes(10);
    useGameStore.setState({ wormGamePhase: 'countdown' });
    store.getState().advance(.9); store.getState().advance(1);
    expect(gl.compile).toHaveBeenCalledTimes(11);
    expect(gl.compile.mock.calls[10][0]).toBe(body.current);
    await act(async () => root.unmount());
    disposed.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    kept.forEach(spy => expect(spy).not.toHaveBeenCalled());
  } finally {
    useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
