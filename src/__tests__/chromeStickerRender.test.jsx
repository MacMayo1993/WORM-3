import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { PadProvider } from '../3d/PadSprings.jsx';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';
import { CHROME_TILE_FINISH } from '../3d/cubeViewStyles.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { storyAppearance } from '../worm/story/worlds.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
extend(THREE);

it.each([15, 34].flatMap(level => [false, true].flatMap(textured => [false, true].map(chaos => ({ level, textured, chaos })))))(
  'keeps level $level chrome reflective through turns and flips (loaded texture: $textured, chaos: $chaos)', async ({ level, textured, chaos }) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} }),
  });
  const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
  const settings = { ...before.settings, ...storyAppearance(level), flipPads: 'off', soundEnabled: false, hapticsEnabled: false };
  const texture = new THREE.Texture({ width: 2, height: 2, complete: true });
  const faceTextures = textured ? Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, texture])) : {};
  useGameStore.setState({ size: 3, wormHealerMode: !chaos, chaosLevel: chaos ? 1 : 0, faceTextures, settings });
  const colors = resolveColors(settings);
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 500, height: 500 } });
  let cubies = makeCubies(3), meta = cubies[1][1][2].stickers.PZ, store, time = 0;
  const draw = (mode = 'chrome', key = 'slot') => <PadProvider>
    <StickerPlane key={key} meta={meta} pos={[0, 0, .51]} mode={mode} faceSize={3} />
  </PadProvider>;
  const render = async (mode, key) => act(async () => { store = root.render(draw(mode, key)); });
  const front = () => store.getState().scene.getObjectByName('sticker-front');
  const back = () => store.getState().scene.getObjectByName('sticker-antipodal-back');
  const checkChrome = (mesh, color) => {
    expect(mesh.material.isMeshStandardMaterial).toBe(true);
    expect(mesh.material.metalness).toBe(CHROME_TILE_FINISH.metalness);
    expect(mesh.material.roughness).toBe(CHROME_TILE_FINISH.roughness);
    expect(mesh.material.envMapIntensity).toBe(CHROME_TILE_FINISH.envMapIntensity);
    expect(mesh.material.map).toBeNull();
    expect(mesh.material.color.getHexString()).toBe(new THREE.Color(color).getHexString());
  };
  try {
    if (textured) {
      await render('classic');
      expect(front().material.map).toBe(texture);
      expect(front().material.color.getHexString()).toBe('ffffff');
    }
    await render();
    const owned = front().material;
    checkChrome(front(), colors[meta.curr]);
    checkChrome(back(), colors[ANTIPODAL_COLOR[meta.curr]]);
    expect(front().geometry.type).toBe('ExtrudeGeometry');
    // The same grid slot receives different physical stickers during layer turns.
    for (const [axis, index] of [['col', 1], ['row', 1], ['col', 1], ['depth', 2], ['row', 1]]) {
      cubies = rotateSliceCubies(cubies, 3, axis, index, 1);
      meta = cubies[1][1][2].stickers.PZ;
      await render();
      expect(front().material).toBe(owned);
      checkChrome(front(), colors[meta.curr]);
      checkChrome(back(), colors[ANTIPODAL_COLOR[meta.curr]]);
    }
    const from = meta.curr;
    meta = { ...meta, curr: ANTIPODAL_COLOR[from], flips: 1 };
    await render();
    checkChrome(front(), colors[from]);
    const allowedTints = [from, meta.curr].map(id => new THREE.Color(colors[id]).getHexString());
    for (let frame = 0; frame < 100; frame++) {
      await act(async () => runActiveStickers({ clock: { elapsedTime: time += 1 / 60 } }, 1 / 60));
      expect(front().material).toBe(owned);
      expect(front().material.metalness).toBe(1);
      expect(front().material.map).toBeNull();
      // Includes the midpoint: neither half may pick up the texture's white tint.
      expect(allowedTints).toContain(front().material.color.getHexString());
    }
    checkChrome(front(), colors[meta.curr]);
    checkChrome(back(), colors[ANTIPODAL_COLOR[meta.curr]]);
    const dispose = vi.spyOn(owned, 'dispose');
    await render('chrome', 'turned-piece');
    expect(dispose).toHaveBeenCalled();
    checkChrome(front(), colors[meta.curr]);
    const glassBack = back().material, disposeBack = vi.spyOn(glassBack, 'dispose');
    await render('classic', 'turned-piece');
    expect(disposeBack).toHaveBeenCalledOnce();
    expect(front().material.metalness).not.toBe(1);
    expect(back().material.metalness).not.toBe(1);
    if (textured) {
      expect(front().material.map).toBe(texture);
      expect(front().material.color.getHexString()).toBe('ffffff');
    }
    await render('chrome', 'turned-piece');
    checkChrome(front(), colors[meta.curr]);
    checkChrome(back(), colors[ANTIPODAL_COLOR[meta.curr]]);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    texture.dispose();
    context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

it('batches whole chrome faces and restores the ordinary batch after switching view', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} }),
  });
  const { StickerInstanceProvider } = await import('../3d/StickerInstances.jsx');
  const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
  useGameStore.setState({ size: 3, wormHealerMode: true, chaosLevel: 0, faceTextures: {},
    settings: { ...before.settings, biomeMode: { enabled: false }, flipPads: 'off',
      manifoldStyles: Object.fromEntries([1,2,3,4,5,6].map(id => [id, 'solid'])) } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 500, height: 500 } });
  const faces = makeCubies(3).flat(2).flatMap(c => Object.values(c.stickers));
  let store, time = 0;
  const render = async mode => act(async () => {
    store = root.render(<StickerInstanceProvider>{faces.map((meta, i) =>
      <StickerPlane key={i} meta={meta} pos={[i % 9, Math.floor(i / 9), 0]} mode={mode} faceSize={3} />
    )}</StickerInstanceProvider>);
    store.getState().advance(time += 1 / 60);
  });
  const liveCount = mesh => {
    let count = 0; const matrix = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); if (matrix.determinant() !== 0) count++; }
    return count;
  };
  try {
    for (const mode of ['chrome', 'classic', 'chrome']) {
      await render(mode);
      await act(async () => store.getState().advance(time += 1 / 60));
      const scene = store.getState().scene;
      const chrome = scene.getObjectByName('ChromeStickerInstanceMesh'), plain = scene.getObjectByName('StickerInstanceMesh');
      expect(chrome.material.metalness).toBe(1);
      expect(chrome.material.roughness).toBe(0.06);
      expect(plain.material.metalness).toBeLessThan(1);
      expect(liveCount(chrome)).toBe(mode === 'chrome' ? 54 : 0);
      expect(liveCount(plain)).toBe(mode === 'classic' ? 54 : 0);
      expect(scene.getObjectByName('sticker-front')).toBeUndefined();
      if (mode === 'chrome') {
        const back = scene.getObjectByName('TileSurfaceBatch:sticker-antipodal-back');
        expect(back.material.metalness).toBe(1);
      }
    }
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
