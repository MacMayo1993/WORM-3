import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { runActiveStickers } from '../3d/StickerAnimationManager.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
extend(THREE);

// A styled WORM tile at rest is one instance of its style's batch; a flip hands it
// back to its own mesh (whose material the flip animation swaps), and it returns to
// the batch once it is home again. Never both, never neither.
it('batches a styled WORM tile at rest and hands it to its own mesh for a flip', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), canvas = document.createElement('canvas');
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} })
  });
  const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
  const cubies = makeCubies(10);
  const settings = { ...before.settings, flipPads: 'off', soundEnabled: false, hapticsEnabled: false,
    manifoldStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, id % 2 ? 'eyeball' : 'marble'])) };
  useGameStore.setState({ size: 10, cubies, wormHealerMode: true, chaosLevel: 0, settings });
  const colors = resolveColors(settings);
  const home = cubies[4][4][9].stickers.PZ;
  let meta = home, store, time = 0;
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 1280, height: 800 } });
  const render = async () => act(async () => {
    store = root.render(<StickerInstanceProvider>
      <StickerPlane meta={meta} pos={[0, 0, .51]} mode="classic" faceSize={10} />
    </StickerInstanceProvider>);
  });
  const frame = async () => act(async () => { runActiveStickers({ clock: { elapsedTime: time } }, 1 / 60); store.getState().advance(time += 1 / 60); });
  const scene = () => store.getState().scene;
  const frontMesh = () => { let found = null; scene().traverse(o => { if (o.isMesh && o.name === 'sticker-front') found = o; }); return found; };
  const frontBatches = () => scene().getObjectsByProperty('name', 'TileSurfaceBatch:sticker-front');
  const drawnInBatch = () => frontBatches().reduce((n, mesh) => n + (mesh.visible ? mesh.count : 0), 0);
  const expectBatched = (face) => {
    expect(frontMesh()).toBeNull();
    expect(drawnInBatch()).toBe(1);
    const batch = frontBatches().find(mesh => mesh.visible && mesh.count);
    expect(batch.material.uniforms.baseColor.value.getHex()).toBe(new THREE.Color(colors[face]).getHex());
    const identity = batch.geometry.attributes.aInstanceData;
    expect([identity.getX(0), identity.getY(0), identity.getZ(0), identity.getW(0)]).toEqual([4, 4, 9, home.orig]);
    // Drawn exactly where the tile's inner group is.
    scene().updateMatrixWorld(true);
    const anchor = scene().getObjectByName('sticker-front');
    const drawn = new THREE.Matrix4(); batch.getMatrixAt(0, drawn); drawn.premultiply(batch.matrixWorld);
    drawn.elements.forEach((value, i) => expect(value).toBeCloseTo(anchor.matrixWorld.elements[i], 6));
  };
  try {
    await render(); await frame();
    expectBatched(home.curr);

    // The flip: its own mesh, wearing a style material, and out of the batch.
    meta = { ...home, curr: ANTIPODAL_COLOR[home.curr], flips: 1 };
    await render(); await frame();
    expect(frontMesh()?.material.isShaderMaterial).toBe(true);
    expect(drawnInBatch()).toBe(0);
    for (let i = 0; i < 90; i++) await frame();
    expect(frontMesh().material.uniforms.baseColor.value.getHex()).toBe(new THREE.Color(colors[meta.curr]).getHex());
    expect(drawnInBatch()).toBe(0);

    // Healed home: the mesh plays the flip back, then the tile rejoins the batch.
    meta = { ...home, flips: 0 };
    await render(); await frame();
    expect(frontMesh()).not.toBeNull();
    expect(drawnInBatch()).toBe(0);
    for (let i = 0; i < 90; i++) await frame();
    await render(); await frame();
    expectBatched(home.curr);
    // The batched front uses the same shared style material as an unbatched tile would.
    const batch = frontBatches().find(mesh => mesh.visible && mesh.count);
    const shared = getTileStyleMaterial(settings.manifoldStyles[home.curr], colors[home.curr], false, null, colors[ANTIPODAL_COLOR[home.curr]]);
    expect(batch.material.uniforms.baseColor).toBe(shared.uniforms.baseColor);
  } finally {
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
