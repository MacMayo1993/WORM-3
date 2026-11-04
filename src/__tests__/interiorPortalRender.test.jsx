import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import VoidCore from '../3d/VoidCore.jsx';
import { TunnelInteriorView } from '../worm/healerWorm/TunnelInteriorView.jsx';
import { TunnelTube } from '../worm/healerWorm/TunnelTube.jsx';
import { tunnelState } from '../worm/tunnelProgressBridge.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { CHROME_TILE_FINISH } from '../3d/cubeViewStyles.js';
import { tunnelCoreClipUniforms } from '../manifold/tunnelCoreClip.js';
import { CORE_HALF } from '../3d/antipodalCore.js';
import { CORE_MIRROR_HALF } from '../3d/corePassage.js';
extend(THREE);
const interiorTile = (scene, key) => scene.getObjectByName('tunnel-interior-tiles').children.find(mesh => mesh.userData.tileKeys.includes(key));

it('opens both backs and core materials, retains the tail passage, and restores a clean exterior', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), bridge = { ...tunnelState };
  useGameStore.setState({ size: 3, cubies: makeCubies(3), wormHealerMode: true, wormAlive: true, wormPhase: 'tunnel',
    wormPaused: false, explosionT: 0, visualMode: 'classic',
    settings: { ...before.settings, colorScheme: 'standard', reducedMotion: true, manifoldStyles: { 5: 'checkerboard' } } });
  const tunnel = { pairId: 'openings', entry: { x: 2, y: 1, z: 1, dirKey: 'PX' }, exit: { x: 0, y: 1, z: 1, dirKey: 'NX' } };
  const worm = { phase: { current: 'tunnel' }, activeTunnel: { current: tunnel },
    tunnelPassages: { current: [] }, tunnelProgress: { current: 0.5 } };
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 }, camera: { position: [0, 0, 1] } });
  try {
    let store, time = 0;
    await act(async () => { store = root.render(<><VoidCore /><TunnelInteriorView worm={worm} size={3} /><TunnelTube worm={worm} size={3} /></>); });
    const frame = async () => { await act(async () => store.getState().advance(time += 1 / 60)); };
    await frame(); await frame();
    const scene = store.getState().scene;
    const interior = scene.getObjectByName('tunnel-interior');
    expect(interior.visible).toBe(true);
    // Ready through the opening while the lens is still outside the shell.
    worm.phase.current = 'entering';
    store.getState().camera.position.set(0, 0, 4);
    await frame();
    expect(interior.visible).toBe(true);
    expect(interiorTile(scene, '0-1-1-NX').visible).toBe(true);
    const wall = interiorTile(scene, '0-1-1-NX'), pose = new THREE.Matrix4();
    wall.getMatrixAt(wall.userData.tileKeys.indexOf('0-1-1-NX'), pose);
    // The polished wall must be in front of the existing 0.018-inset backs.
    expect(Math.abs(pose.elements[12])).toBeLessThan(1.5);
    expect(Math.abs(pose.elements[12])).toBeCloseTo(1.48);
    expect(tunnelCoreClipUniforms.uTunnelCoreHalf.value).toBeCloseTo(CORE_HALF + .002);
    worm.phase.current = 'tunnel';
    store.getState().camera.position.set(0, 0, 1);
    await frame();
    for (const side of [0, 1]) {
      const mouth = scene.getObjectByName(`tunnel-interior-mouth-${side}`);
      expect(mouth.visible).toBe(true);
      expect(mouth.geometry.parameters.openEnded).toBe(true);
    }
    const body = scene.getObjectByName('antipodal-core-body').material;
    const sticker = scene.getObjectByName('antipodal-core-stickers').material;
    const styled = scene.getObjectByName('antipodal-core-style-5-checkerboard').material;
    expect(body.userData.portalCutout.uPassageOpen.value).toBe(1);
    expect(body.userData.portalCutout).toBe(sticker.userData.portalCutout);
    expect(styled.uniforms.uPassagePoints).toBe(body.userData.portalCutout.uPassagePoints);
    const room = scene.getObjectByName('anticube-mirror-room');
    const mirrors = scene.getObjectByName('anticube-mirror-tiles');
    expect(room.visible).toBe(true);
    // Live mirrors: a reflection shader fed by the room's own capture.
    expect(mirrors.material.uniforms.uMirrorEnv).toBeDefined();
    expect(mirrors.count).toBe(6 * 3 * 3);
    expect(body.userData.portalCutout.uCoreRoomHalf.value).toBeCloseTo(CORE_MIRROR_HALF);
    // Both the mirror faces and the dark grout leave the same passage clear.
    for (const mesh of room.children) expect(mesh.material.userData.portalCutout).toBe(body.userData.portalCutout);
    // The stained glass follows the cube state the core shows.
    const tints = Array.from(mirrors.instanceColor.array);
    const recoloured = makeCubies(3);
    recoloured[2][1][1].stickers.PX.curr = 1;
    await act(async () => useGameStore.setState({ cubies: recoloured }));
    expect(Array.from(mirrors.instanceColor.array)).not.toEqual(tints);
    const inner = interiorTile(scene, '0-1-1-NX').material;
    expect(inner.isMeshStandardMaterial).toBe(true);
    expect(inner).toMatchObject(CHROME_TILE_FINISH);
    for (const mesh of interior.children.filter(mesh => mesh.material?.isMeshBasicMaterial)) {
      expect(mesh.material.userData.portalCutout).toBe(inner.userData.portalCutout);
    }
    const mouthTime = scene.getObjectByName('tunnel-interior-mouth-0').material.uniforms.uTime.value;
    await frame();
    expect(scene.getObjectByName('tunnel-interior-mouth-0').material.uniforms.uTime.value).toBe(mouthTime);
    worm.activeTunnel.current = null;
    worm.tunnelPassages.current = [{ tunnel }];
    worm.phase.current = 'crawling';
    await frame();
    expect(interior.visible).toBe(true);
    expect(body.userData.portalCutout.uPassageOpen.value).toBe(1);
    expect(room.visible).toBe(true);
    worm.tunnelPassages.current = [];
    worm.phase.current = 'crawling';
    await frame();
    expect(body.userData.portalCutout.uPassageOpen.value).toBe(0);
    expect(body.userData.portalCutout.uCoreRoomHalf.value).toBe(0);
    expect(room.visible).toBe(false);
    expect(interior.visible).toBe(false); // no invisible depth-writing wall or floating mouth
    expect(scene.getObjectByName('tunnel-interior-mouth-0').visible).toBe(false);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); Object.assign(tunnelState, bridge);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
