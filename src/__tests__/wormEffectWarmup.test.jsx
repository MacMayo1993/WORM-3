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
import { distinctProgramObjects } from '../3d/compileDistinct.js';
import { LEGO_STUD_PARTS } from '../3d/legoStud.js';

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
  // The run's scene compile goes through one stand-in per program variant
  // (compileDistinct.js): each a copy of an object of the live scene, and the
  // scene's own lights, fog and environment are the target.
  const expectSceneCompile = ([root, _camera, target]) => {
    const scene = store.getState().scene;
    expect(target).toBe(scene);
    const drawn = o => [o.material, o.geometry, o.isInstancedMesh, o.instanceColor];
    expect(root.children.map(drawn)).toEqual(distinctProgramObjects(scene).map(drawn));
  };
  // The run-start scene compile and the fall-dissolve warm are checked at the end.
  useGameStore.setState({ wormGamePhase: 'active', wormAlive: false, wormStoryLevel: null });
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
    // The scene, then the looks it does not hold yet (equipped styles, Glass, LEGO).
    expect(gl.compile).toHaveBeenCalledTimes(11);
    expectSceneCompile(gl.compile.mock.calls[9]);
    // A live crawling worm gets its caution-fall dissolve warmed once per look,
    // before play rather than in the middle of it.
    useGameStore.setState({ wormGamePhase: 'active', wormAlive: true, wormPhase: 'crawling' });
    store.getState().advance(.8);
    expect(gl.compile).toHaveBeenCalledTimes(11);
    useGameStore.setState({ wormGamePhase: 'countdown' });
    store.getState().advance(.9); store.getState().advance(1);
    expect(gl.compile).toHaveBeenCalledTimes(12);
    expect(gl.compile.mock.calls[11][0]).toBe(body.current);
    // Story runs skip scrambling. Warm their mounted interior behind the ready
    // card too, once the authored board is staged, and never again after Start.
    useGameStore.setState({ wormRunId: before.wormRunId + 2, wormGamePhase: 'active',
      wormStoryLevel: 1, wormStoryReady: false, wormStoryStarted: false });
    store.getState().advance(1.1); expect(gl.compile).toHaveBeenCalledTimes(12);
    useGameStore.setState({ wormStoryReady: true });
    store.getState().advance(1.2); store.getState().advance(1.3);
    expect(gl.compile).toHaveBeenCalledTimes(14);
    expectSceneCompile(gl.compile.mock.calls[12]);
    useGameStore.setState({ wormStoryStarted: true });
    store.getState().advance(1.4); expect(gl.compile).toHaveBeenCalledTimes(14);
    // Styled tiles at rest are batched, so the scene holds none of the programs a
    // flipping tile's own mesh draws: each equipped style, and its portal-bored
    // copy, compile with the run's scene. The style cache owns the sources.
    const styled = { ...before.settings, manifoldStyles: { 1: 'eyeball', 2: 'marble', 3: 'eyeball', 4: 'solid', 5: 'marble', 6: 'eyeball' } };
    useGameStore.setState({ settings: styled, wormRunId: before.wormRunId + 3, wormGamePhase: 'scrambling', wormStoryLevel: null });
    store.getState().advance(1.5); store.getState().advance(1.6);
    expect(gl.compile).toHaveBeenCalledTimes(16);
    const styleScene = gl.compile.mock.calls[15][0];
    const styleMaterials = styleScene.children.map(mesh => mesh.material);
    const sources = styleMaterials.filter(m => !m.userData.portalCutout), bored = styleMaterials.filter(m => m.userData.portalCutout);
    // Five styled faces' sources, and the bare glass the Glass view's backs draw.
    expect(sources).toHaveLength(6);
    // Eyeball, Marble and the Glass view's sticker, each once, bored.
    const boredStyles = bored.filter(m => m.isShaderMaterial);
    expect(new Set(boredStyles.map(m => m.userData.styleFragmentShader)).size).toBe(3);
    expect(boredStyles).toHaveLength(3);
    // The LEGO view's three stud parts, as the instanced, tinted batches draw them.
    const studs = styleScene.children.filter(mesh => mesh.isInstancedMesh);
    expect(studs).toHaveLength(LEGO_STUD_PARTS.length);
    studs.forEach(mesh => { expect(mesh.instanceColor).not.toBeNull(); expect(mesh.material.userData.portalCutout).toBeTruthy(); });
    const boredSpies = bored.map(m => vi.spyOn(m, 'dispose'));
    const sourceSpies = [...sources, ...LEGO_STUD_PARTS.map(part => part.material)].map(m => vi.spyOn(m, 'dispose'));
    await act(async () => root.unmount());
    disposed.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    kept.forEach(spy => expect(spy).not.toHaveBeenCalled());
    boredSpies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    sourceSpies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  } finally {
    useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
