import React, { act, useContext, useLayoutEffect } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { PadProvider, FlipPadOffset } from '../3d/PadSprings.jsx';
import { PAD_PROFILES } from '../3d/padPose.js';
import { MenuPortalScene, MenuPortalAnchor } from '../components/menus/MenuPortalScene.jsx';
import { MenuPortalContext } from '../components/menus/menuPortalContext.js';
import { MENU_FLIP_PAIRS, MENU_PORTAL_OVERLAY_Z, MENU_SURFACE_HALF, flipMenuCenters } from '../components/menus/menuCenterPortals.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';

extend(THREE);
it('pops all six menu mouths out with game lightning, even with gameplay pads off; pauses and calms them correctly', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  useGameStore.setState({ wormHealerMode: false, demoMode: false,
    settings: { ...before.settings, flipPads: 'off', reducedMotion: false } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 430, height: 932 } });
  const cubies = flipMenuCenters(makeCubies(3));
  let frames;
  function Probe() {
    const value = useContext(MenuPortalContext);
    useLayoutEffect(() => { frames = value; }, [value]);
    return null;
  }
  const draw = (paused = false, shown = true) => <MenuPortalScene><PadProvider profile="menu" paused={paused}>
    <Probe />
    {shown && MENU_FLIP_PAIRS.flat().map(face => {
      const [x, y, z] = face.cubie;
      const pos = face.pos.map(v => v * (MENU_SURFACE_HALF - MENU_PORTAL_OVERLAY_Z) / MENU_SURFACE_HALF);
      return <FlipPadOffset key={face.dir} meta={cubies[x][y][z].stickers[face.dir]} size={3} pos={pos} rot={face.rot}>
        <group position={pos} rotation={face.rot}><MenuPortalAnchor dir={face.dir} /></group>
      </FlipPadOffset>;
    })}
  </PadProvider></MenuPortalScene>;
  try {
    let store;
    await act(async () => { store = root.render(draw()); });
    const scene = store.getState().scene;
    const meshes = [];
    scene.traverse(node => { if (node.isMesh || node.isPoints) meshes.push(node); });
    const columns = meshes.find(node => node.isInstancedMesh && node.material.fragmentShader?.includes('vLocal.z'));
    const arcs = meshes.find(node => node.geometry?.attributes?.aTangent);
    const solidStalk = meshes.find(node => node.isInstancedMesh && node.material.isMeshStandardMaterial);
    expect(columns).toBeTruthy();
    expect(arcs).toBeTruthy();
    let frame = 1, lit = 0;
    for (; frame <= 90; frame++) {
      store.getState().advance(frame / 60);
      if (arcs.geometry.drawRange.count) lit++;
    }
    expect(columns.count).toBe(6);
    expect(solidStalk.count).toBe(0);
    expect(lit).toBeGreaterThan(60);
    for (const mouth of frames) {
      const position = new THREE.Vector3().setFromMatrixPosition(mouth.matrix);
      expect(position.length()).toBeGreaterThan(MENU_SURFACE_HALF + 0.3);
    }
    await act(async () => root.render(draw(true)));
    store.getState().advance(frame++ / 60);
    const held = frames.map(mouth => mouth.matrix.clone());
    const time = columns.material.uniforms.uTime.value;
    for (let i = 0; i < 10; i++) store.getState().advance(frame++ / 60);
    expect(columns.material.uniforms.uTime.value).toBe(time);
    frames.forEach((mouth, i) => expect(mouth.matrix.equals(held[i])).toBe(true));

    useGameStore.setState({ settings: { ...useGameStore.getState().settings, reducedMotion: true } });
    await act(async () => root.render(draw()));
    store.getState().advance(frame++ / 60);
    expect(arcs.geometry.drawRange.count).toBe(0);
    for (const mouth of frames) expect(new THREE.Vector3().setFromMatrixPosition(mouth.matrix).length()).toBeCloseTo(MENU_SURFACE_HALF + PAD_PROFILES.menu.height, 8);
    // The carousel removes the anchors; the effect and lookup must clear too.
    await act(async () => root.render(draw(true, false)));
    store.getState().advance(frame++ / 60);
    expect(columns.count).toBe(0);
    expect(frames.every(mouth => !mouth.active)).toBe(true);
    await act(async () => root.render(draw()));
    store.getState().advance(frame++ / 60);
    expect(columns.count).toBe(6);
    expect(frames.every(mouth => mouth.active)).toBe(true);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
