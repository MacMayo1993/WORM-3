import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect } from 'vitest';
import VoidCore from '../3d/VoidCore.jsx';
import { TunnelInteriorView } from '../worm/healerWorm/TunnelInteriorView.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { ANTIPODAL_COLOR, RUBIKS_FACE_COLORS } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { coreLayout, corePartnerColorId } from '../3d/antipodalCore.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { coreMirrorTileKeys } from '../3d/coreMirrorRoom.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';

extend(THREE);

it.each(['crawling', 'tunnel'])('refreshes Classic interiors from %s without changing settings or cubies, then restores them', async phase => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), bridge = { ...tunnelState };
  const cubies = makeCubies(3);
  const settings = { ...before.settings, colorScheme: 'custom', customColors: { 1: '#aa22cc', 2: '#22ccaa', 3: '#ccaa22',
    4: '#2244cc', 5: '#cc4422', 6: '#44cc22' }, manifoldStyles: { 1: 'checkerboard', 2: 'circuit', 3: 'carbonFiber',
    4: 'checkerboard', 5: 'circuit', 6: 'carbonFiber' }, biomeMode: { enabled: false }, reducedMotion: true };
  useGameStore.setState({ size: 3, cubies, settings, wormHealerMode: true, wormViewPower: null,
    wormAlive: true, wormPaused: true, wormPhase: 'tunnel', visualMode: 'classic', chaosLevel: 0, flipPulse: null });
  const tunnel = { pairId: 'classic-ride', entry: { x: 2, y: 1, z: 1, dirKey: 'PX' }, exit: { x: 0, y: 1, z: 1, dirKey: 'NX' } };
  const worm = { phase: { current: phase }, activeTunnel: { current: tunnel } };
  Object.assign(tunnelState, { active: false, portalTunnel: tunnel });
  const canvas = document.createElement('canvas');
  const gl = { render() {}, setSize() {}, setPixelRatio() {}, domElement: canvas,
    xr: { addEventListener() {}, removeEventListener() {} }, shadowMap: {}, renderLists: { dispose() {} }, forceContextLoss() {} };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 }, camera: { position: [0, 0, 1] } });
  try {
    let store, time = 0;
    await act(async () => { store = root.render(<><VoidCore /><TunnelInteriorView worm={worm} size={3} /></>); });
    const frame = async () => act(async () => store.getState().advance(time += 1 / 60));
    const set = async patch => { await act(async () => useGameStore.setState(patch)); await frame(); };
    await frame();
    const scene = store.getState().scene;
    const walls = scene.getObjectByName('tunnel-interior-tiles');
    const plainCore = scene.getObjectByName('antipodal-core-stickers');
    const mirrors = scene.getObjectByName('anticube-mirror-tiles');
    const universe = scene.getObjectByName('antiverse-space').material.uniforms;
    const coreLayout0 = coreLayout(3), map = buildManifoldGridMap(cubies, 3);
    const checkAppearance = classic => {
      const palette = classic ? RUBIKS_FACE_COLORS : resolveColors(settings);
      expect(scene.getObjectByName('tunnel-interior').visible).toBe(worm.phase.current === 'tunnel');
      expect(walls.children.reduce((n, m) => n + m.count, 0)).toBe(54);
      for (const mesh of walls.children) {
        for (const key of mesh.userData.tileKeys) {
          const [x, y, z, dir] = key.split('-');
          const face = ANTIPODAL_COLOR[cubies[x][y][z].stickers[dir].curr];
          const style = classic ? 'solid' : settings.manifoldStyles[face];
          expect(mesh.name).toBe(`tunnel-interior-batch-${face}-${style}`);
          expect(mesh.material.uniforms.baseColor.value.getHexString()).toBe(palette[face].slice(1).toLowerCase());
        }
      }
      for (const [i, cell] of coreLayout0.stickers.entries()) {
        const face = corePartnerColorId(cubies, map, 3, cell, findAntipodalStickerByGrid);
        const actual = new THREE.Color().fromArray(plainCore.instanceColor.array, i * 3);
        expect(actual.getHexString()).toBe(palette[face].slice(1).toLowerCase());
      }
      const coreIndex = new Map(coreLayout0.stickers.map((cell, i) => [`${cell.x},${cell.y},${cell.z},${cell.dirKey}`, i]));
      coreMirrorTileKeys(3).forEach((key, i) => {
        const color = new THREE.Color().fromArray(mirrors.instanceColor.array, i * 3);
        expect(color.getHexString()).toBe(new THREE.Color().fromArray(plainCore.instanceColor.array, coreIndex.get(key) * 3).getHexString());
      });
      universe.uPalette.value.forEach((color, i) => expect(color.getHexString()).toBe(palette[i + 1].slice(1).toLowerCase()));
      for (const [i, cell] of [tunnel.entry, tunnel.exit].entries()) {
        const face = ANTIPODAL_COLOR[cubies[cell.x][cell.y][cell.z].stickers[cell.dirKey].curr];
        expect(scene.getObjectByName(`tunnel-interior-mouth-${i}`).material.uniforms.uColor.value.getHexString())
          .toBe(palette[face].slice(1).toLowerCase());
      }
      const styled = scene.getObjectByName('antipodal-core').getObjectsByProperty('isInstancedMesh', true)
        .filter(mesh => mesh.name.startsWith('antipodal-core-style-'));
      expect(styled.length).toBe(classic ? 0 : 6);
      expect(plainCore.visible).toBe(classic);
    };
    checkAppearance(false);
    const oldWall = walls.children[0];
    // Only the pickup changes: same cube, settings, layout, paused tunnel and visualMode.
    await set({ wormViewPower: 'view-classic' });
    checkAppearance(true);
    expect(walls.children).not.toContain(oldWall);
    // A pickup already active before entry must also be ready behind the mouth.
    worm.phase.current = 'tunnel';
    await frame();
    checkAppearance(true);
    const resident = [...walls.children];
    await frame();
    expect(walls.children).toEqual(resident); // no rebuild on every frame
    await set({ wormViewPower: null });
    checkAppearance(false);
    await set({ wormViewPower: 'view-classic' });
    checkAppearance(true);
    await set({ wormHealerMode: false });
    checkAppearance(false); // a saved Classic view outside WORM still wears its styles
    expect(useGameStore.getState().settings).toBe(settings);
    expect(useGameStore.getState().cubies).toBe(cubies);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); Object.assign(tunnelState, bridge);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
