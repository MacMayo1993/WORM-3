import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Only the baked canvas alpha mask is stubbed; the real sticker, shader
// materials, animation scheduler and Three scene graph run below.
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => ({
    fillRect() {}, beginPath() {}, arc() {}, fill() {},
    createRadialGradient: () => ({ addColorStop() {} })
  });
});
vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
vi.mock('@react-three/drei', () => ({ Text: () => null, Line: () => null, Billboard: ({ children }) => <group>{children}</group> }));
vi.mock('../utils/feel.js', () => ({ feel: vi.fn() }));
import StickerPlane from '../3d/StickerPlane.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';
import { resolveColors } from '../utils/colorSchemes.js';

extend(THREE);
let root, store, before, time;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  useGameStore.setState({ size: 5, chaosLevel: 3, disparityFlipCap: 8, wormHealerMode: false,
    perfReducedFX: true, faceTextures: {}, settings: { ...before.settings, colorScheme: 'standard', biomeMode: { enabled: false } } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  time = 0;
});
afterEach(async () => {
  await act(async () => root.unmount());
  useGameStore.setState(before, true);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
async function advance(frames) {
  await act(async () => {
    for (let i = 0; i < frames; i++) {
      time += 1 / 60;
      runActiveStickers({ ...store.getState(), clock: { elapsedTime: time } }, 1 / 60);
      store.getState().advance(time);
    }
  });
}

it.each([['circuit', 'galaxy'], ['solid', 'circuit'], ['circuit', 'solid']])(
  'keeps %s visible until the crossing, then reveals the actual %s tile style', async (fromStyle, toStyle) => {
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, manifoldStyles: { 1: fromStyle, 4: toStyle } } });
    const meta = makeCubies(5)[2][2][4].stickers.PZ;
    const draw = flips => <StickerPlane meta={{ ...meta, flips, curr: flips % 2 ? 4 : 1 }} pos={[0, 0, 0.51]} faceSize={5} mode="classic" />;
    await act(async () => { store = root.render(draw(0)); });
    await act(async () => root.render(draw(1)));
    const colors = resolveColors(useGameStore.getState().settings);
    const from = getTileStyleMaterial(fromStyle, colors[1], false, null, colors[4]);
    const to = getTileStyleMaterial(toStyle, colors[4], false, null, colors[1]);
    const meshes = () => { const result = []; store.getState().scene.traverse(o => { if (o.isMesh) result.push(o); }); return result; };
    // The styled underside can share the FROM material during a flip; follow
    // the outward surface whose animation switches to the destination style.
    const face = meshes().find(o => o.material === from && o.name !== 'sticker-antipodal-back');
    expect(face).toBeTruthy();
    expect(face.material.transparent).toBe(false);
    await advance(10);
    expect(face.material).toBe(from);
    // Chaos's overlay only accents the rim; the pattern remains the surface.
    const lid = meshes().find(o => o.material.uniforms?.uClean);
    expect(lid.material.uniforms.uClean.value).toBe(1);
    expect(meshes().some(o => o.position.z === -1.01)).toBe(false);
    await advance(10);
    expect(face.material).toBe(to);
    await advance(45);
    expect(face.material).toBe(to);
    expect(face.visible).toBe(true);
    expect(face.material.transparent).toBe(false);
  }
);
