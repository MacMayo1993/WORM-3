import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { PadProvider } from '../3d/PadSprings.jsx';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { ANTIPODAL_COLOR, RUBIKS_FACE_COLORS } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
vi.mock('../3d/CityBuildings.jsx', () => ({ default: () => null }));
vi.mock('../3d/BiomeGLBCluster.jsx', () => ({ BiomeGLBCluster: () => null, isGLBActive: () => false, isGLBFullFace: () => false }));
extend(THREE);

it.each(['pattern', 'texture', 'biome'])('Classic pickup replaces %s art with glossy Rubik\'s stickers and restores it on expiry', async art => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} })
  });
  const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
  const ids = [1, 2, 3, 4, 5, 6];
  const settings = { ...before.settings, flipPads: 'off', soundEnabled: false, hapticsEnabled: false,
    colorScheme: 'custom', customColors: Object.fromEntries(ids.map(id => [id, '#bb33dd'])),
    biomeMode: { ...before.settings.biomeMode, enabled: art === 'biome' },
    manifoldStyles: Object.fromEntries(ids.map(id => [id, 'carbonFiber'])) };
  const texture = new THREE.Texture({ width: 2, height: 2, complete: true });
  const faceTextures = art === 'texture' ? Object.fromEntries(ids.map(id => [id, texture])) : {};
  useGameStore.setState({ size: 3, wormHealerMode: true, wormViewPower: null, chaosLevel: 0, faceTextures, settings });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 500, height: 500 } });
  let cubies = makeCubies(3), meta = cubies[1][1][2].stickers.PZ, store, time = 0;
  const render = async () => act(async () => {
    store = root.render(<PadProvider><StickerPlane meta={meta} pos={[0, 0, .51]} mode="classic" faceSize={3} /></PadProvider>);
  });
  const scene = () => store.getState().scene;
  const front = () => scene().getObjectByName('sticker-front');
  const back = () => scene().getObjectByName('sticker-antipodal-back');
  const hex = color => new THREE.Color(color).getHexString();
  const classic = () => {
    expect(front().geometry.type).toBe('ExtrudeGeometry');
    expect(front().material.isMeshStandardMaterial).toBe(true);
    expect(front().material.roughness).toBe(0.24);
    expect(front().material.metalness).toBe(0);
    expect(front().material.map).toBeNull();
    expect(front().material.color.getHexString()).toBe(hex(RUBIKS_FACE_COLORS[meta.curr]));
    expect(back().material.isMeshStandardMaterial).toBe(true);
    expect(back().material.color.getHexString()).toBe(hex(RUBIKS_FACE_COLORS[ANTIPODAL_COLOR[meta.curr]]));
  };
  try {
    await render();
    if (art === 'texture') expect(front().material.map).toBe(texture);
    if (art === 'pattern') expect(front().material.isShaderMaterial).toBe(true);
    await act(async () => useGameStore.setState({ wormViewPower: 'view-classic' }));
    classic();
    for (const [axis, index] of [['col', 1], ['row', 1], ['depth', 2]]) {
      cubies = rotateSliceCubies(cubies, 3, axis, index, 1);
      meta = cubies[1][1][2].stickers.PZ;
      await render();
      classic();
    }
    // Flipping must retain the plain finish and never reapply a saved texture.
    meta = { ...meta, curr: ANTIPODAL_COLOR[meta.curr], flips: 1 };
    await render();
    for (let frame = 0; frame < 100; frame++) {
      await act(async () => runActiveStickers({ clock: { elapsedTime: time += 1 / 60 } }, 1 / 60));
      expect(front().material.isMeshStandardMaterial).toBe(true);
      expect(front().material.map).toBeNull();
    }
    classic();
    expect(useGameStore.getState().settings).toBe(settings);
    expect(useGameStore.getState().faceTextures).toBe(faceTextures);
    await act(async () => useGameStore.setState({ wormViewPower: null }));
    if (art === 'texture') expect(front().material.map).toBe(texture);
    if (art === 'pattern') {
      expect(front().material.isShaderMaterial).toBe(true);
      expect(front().material.uniforms.baseColor.value.getHexString()).toBe(hex(resolveColors(settings)[meta.curr]));
    }
    // The saved ordinary Classic view retains its tile art outside WORM.
    await act(async () => useGameStore.setState({ wormViewPower: 'view-classic', wormHealerMode: false }));
    if (art === 'texture') expect(front().material.map).toBe(texture);
    if (art === 'pattern') expect(front().material.isShaderMaterial).toBe(true);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    texture.dispose(); context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
