import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { livePortalPairs } from '../3d/portalViewMath.js';
import { registerInspectionSurface } from '../3d/inspectionBridge.js';
const context = vi.hoisted(() => ({ value: null, frame: null }));
vi.mock('@react-three/fiber', () => ({ useThree: () => context.value, useFrame: fn => { context.frame = fn; } }));
import InspectionViews from '../3d/InspectionViews.jsx';

it('captures without recursion, follows moved mouths, exposes the interior and cleans up', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  let cubies = makeCubies(3);
  const map = buildManifoldGridMap(cubies, 3);
  cubies = flipStickerPair(cubies, 3, 2, 2, 2, 'PZ', map);
  useGameStore.setState({ cubies, size: 3, showWelcome: false, showMainMenu: false, showSettings: false, showHelp: false,
    showAntipodalPiP: false, showCutawayLens: false, wormHealerMode: false, perfReducedFX: false,
    settings: { ...before.settings, livePortalViews: false } });
  const pair = livePortalPairs(cubies, 3, map, 6)[0];
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.01, 100);
  camera.position.set(0, 0, 9); camera.updateMatrixWorld(true);
  const cube = new THREE.Group(), exterior = new THREE.Group(), a = new THREE.Group(), b = new THREE.Group();
  scene.add(cube); cube.add(exterior); exterior.add(a, b);
  // Both mouths face the viewer (possible after a layer turn); still capture one.
  a.position.z = 1.55; b.position.z = -1.55;
  const batch = new THREE.Mesh(); batch.name = 'StickerInstanceMesh'; scene.add(batch);
  const cleanupA = registerInspectionSurface(pair.a, a), cleanupB = registerInspectionSurface(pair.b, b);
  const cubeRef = createRef(), exteriorRef = createRef(); cubeRef.current = cube; exteriorRef.current = exterior;
  const priorHook = vi.fn(); scene.onBeforeRender = priorHook;
  let target = null, alpha = 1, color = new THREE.Color();
  const captures = [], viewport = new THREE.Vector4(0, 0, 800, 600), scissor = viewport.clone();
  const gl = {
    domElement: document.createElement('canvas'), xr: { enabled: false }, shadowMap: { autoUpdate: true }, autoClear: true,
    getContext: () => ({ isContextLost: () => false }),
    getRenderTarget: () => target, setRenderTarget: value => { target = value; },
    getViewport: out => out.copy(viewport), setViewport: value => viewport.copy(value),
    getScissor: out => out.copy(scissor), setScissor: value => scissor.copy(value),
    getScissorTest: () => false, setScissorTest() {},
    getClearColor: out => out.copy(color), getClearAlpha: () => alpha,
    setClearColor: (value, a) => { color = new THREE.Color(value); alpha = a; }, clear() {},
    render: (s, c) => {
      s.updateMatrixWorld(true);
      s.onBeforeRender(gl, s, c, target);
      if (target) captures.push({ target, camera: c.clone(), exterior: exterior.visible, batch: batch.visible, windows: s.getObjectByName('LivePortalViews').visible });
    },
  };
  context.value = { gl, scene, camera, size: { width: 800, height: 600 } };
  const root = createRoot(document.createElement('div'));
  let time = 1000;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => time);
  try {
    await act(async () => root.render(<InspectionViews cubeRef={cubeRef} exteriorRef={exteriorRef} manifoldMap={map} />));
    expect(scene.onBeforeRender).toBe(priorHook);
    expect(scene.getObjectByName('LivePortalViews')).toBeUndefined();
    for (let i = 0; i < 60; i++) gl.render(scene, camera);
    expect(captures).toHaveLength(0);
    act(() => useGameStore.setState({ settings: { ...before.settings, livePortalViews: true } }));
    const draw = (delta = 1 / 60) => { time += delta * 1000; context.frame(); gl.render(scene, camera); };
    draw();
    expect(captures).toHaveLength(1);
    expect(captures[0]).toMatchObject({ exterior: true, batch: true, windows: false });
    const windows = scene.getObjectByName('LivePortalViews');
    expect(windows.children.filter(o => o.visible)).toHaveLength(1);
    a.position.y = 0.4; draw();
    expect(windows.children[0].matrix.elements[13]).toBeCloseTo(0.4);
    expect(captures).toHaveLength(2); // camera and image update together, every frame

    for (let i = 0; i < 30; i++) draw(1 / 20);
    const beforeFallback = captures.length;
    expect(beforeFallback).toBeLessThan(20);
    expect(windows.visible).toBe(false);
    for (let i = 0; i < 60; i++) draw();
    expect(captures).toHaveLength(beforeFallback); // no automatic retry / FPS oscillation

    act(() => useGameStore.getState().setShowCutawayLens(true));
    draw();
    expect(captures).toHaveLength(beforeFallback + 1); // lens remains independently available
    expect(captures.at(-1)).toMatchObject({ exterior: false, batch: false, windows: false });
    expect(captures.at(-1).camera.view.enabled).toBe(true);
    expect(exterior.visible).toBe(true); expect(batch.visible).toBe(true); expect(target).toBeNull();

    act(() => useGameStore.getState().setShowAntipodalPiP(true));
    draw();
    expect(captures).toHaveLength(beforeFallback + 1); expect(windows.visible).toBe(false);
    act(() => useGameStore.setState({ showAntipodalPiP: false, settings: { ...before.settings, livePortalViews: false } }));
    draw(); expect(captures).toHaveLength(beforeFallback + 1);
    expect(scene.onBeforeRender).toBe(priorHook);
    act(() => useGameStore.setState({ settings: { ...before.settings, livePortalViews: true } }));
    draw(); expect(captures).toHaveLength(beforeFallback + 2); // explicit retry
    act(() => useGameStore.setState({ perfReducedFX: true }));
    draw(); expect(captures).toHaveLength(beforeFallback + 2);
    await act(async () => root.unmount());
    expect(scene.onBeforeRender).toBe(priorHook);
    expect(scene.getObjectByName('LivePortalViews')).toBeUndefined();
  } finally {
    clock.mockRestore();
    await act(async () => root.unmount()); cleanupA(); cleanupB();
    useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
