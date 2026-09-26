import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { PadProvider } from '../3d/PadSprings.jsx';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';
import { getGlassMaterial } from '../3d/styles/TileStyleMaterials.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { storyAppearance } from '../worm/story/worlds.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
extend(THREE);

it.each([14, 28])('keeps level %i glass on first paint, turns, remounts and both halves of a flip', async level => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} }),
  });
  const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
  const settings = { ...before.settings, ...storyAppearance(level), flipPads: 'off', soundEnabled: false, hapticsEnabled: false };
  useGameStore.setState({ size: 3, wormHealerMode: true, chaosLevel: 0, faceTextures: {}, settings });
  const colors = resolveColors(settings);
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 500, height: 500 } });
  let cubies = makeCubies(3), meta = cubies[1][1][2].stickers.PZ, store, time = 0;
  const draw = (mode = 'glass', key = 'slot') => <PadProvider>
    <StickerPlane key={key} meta={meta} pos={[0, 0, .51]} mode={mode} faceSize={3} />
  </PadProvider>;
  const render = async (mode, key) => act(async () => { store = root.render(draw(mode, key)); });
  const front = () => store.getState().scene.getObjectByName('sticker-front');
  const back = () => store.getState().scene.getObjectByName('sticker-antipodal-back');
  const checkGlass = (mesh, color) => {
    expect(mesh.material.fragmentShader).toBe(getGlassMaterial('#888888').fragmentShader);
    expect(mesh.material.transparent).toBe(true);
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.material.uniforms.baseColor.value.getHexString()).toBe(new THREE.Color(color).getHexString());
  };
  try {
    await render();
    const owned = front().material;
    checkGlass(front(), colors[meta.curr]);
    checkGlass(back(), colors[ANTIPODAL_COLOR[meta.curr]]);
    expect(owned).not.toBe(getGlassMaterial('#888888'));
    // The same grid slot receives different physical stickers during layer turns.
    for (const [axis, index] of [['col', 1], ['row', 1], ['col', 1], ['depth', 2], ['row', 1]]) {
      cubies = rotateSliceCubies(cubies, 3, axis, index, 1);
      meta = cubies[1][1][2].stickers.PZ;
      await render();
      expect(front().material).toBe(owned);
      checkGlass(front(), colors[meta.curr]);
      checkGlass(back(), colors[ANTIPODAL_COLOR[meta.curr]]);
    }
    const from = meta.curr;
    meta = { ...meta, curr: ANTIPODAL_COLOR[from], flips: 1 };
    await render();
    checkGlass(front(), colors[from]);
    for (let frame = 0; frame < 100; frame++) {
      await act(async () => runActiveStickers({ clock: { elapsedTime: time += 1 / 60 } }, 1 / 60));
      expect(front().material).toBe(owned);
      expect(front().material.transparent).toBe(true);
    }
    checkGlass(front(), colors[meta.curr]);
    checkGlass(back(), colors[ANTIPODAL_COLOR[meta.curr]]);
    const dispose = vi.spyOn(owned, 'dispose');
    await render('glass', 'turned-piece');
    expect(dispose).toHaveBeenCalled();
    checkGlass(front(), colors[meta.curr]);
    const glassBack = back().material, disposeBack = vi.spyOn(glassBack, 'dispose');
    await render('classic', 'turned-piece');
    expect(disposeBack).toHaveBeenCalledOnce();
    expect(front().material.fragmentShader).not.toBe(getGlassMaterial('#888888').fragmentShader);
    expect(back().material.fragmentShader).not.toBe(glassBack.fragmentShader);
    await render('glass', 'turned-piece');
    checkGlass(front(), colors[meta.curr]);
    checkGlass(back(), colors[ANTIPODAL_COLOR[meta.curr]]);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
