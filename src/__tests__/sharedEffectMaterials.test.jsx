import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { bindEffectUniforms } from '../3d/sharedEffectMaterials.js';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
extend(THREE);

// The worm's footprint, the heal seal and the heal sparks wait on every tile. They
// used to own a ShaderMaterial per tile (~4,000 materials on a 15×15); one shared
// material per effect now draws every tile's values, bound just before its draw.
describe('shared tile effect materials', () => {
  it('copies a tile\'s own values into the shared material for its draw', () => {
    const shared = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color() }, uPress: { value: 0 } } });
    const mine = { uColor: { value: new THREE.Color('#ff0000') }, uPress: { value: 0.7 }, uExtra: { value: 3 } };
    const bind = bindEffectUniforms(mine);
    bind(null, null, null, null, shared);
    expect(shared.uniforms.uColor.value.getHex()).toBe(0xff0000);
    expect(shared.uniforms.uColor.value).not.toBe(mine.uColor.value);
    expect(shared.uniforms.uPress.value).toBe(0.7);
    expect(shared.uniforms.uExtra).toBeUndefined();
    expect(shared.uniformsNeedUpdate).toBe(true);
  });

  it('gives every WORM tile the same heal-seal and spark material, and one footprint decal', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const before = useGameStore.getState(), canvas = document.createElement('canvas');
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} })
    });
    const { default: StickerPlane } = await import('../3d/StickerPlane.jsx');
    const cubies = makeCubies(3);
    useGameStore.setState({ size: 3, cubies, wormHealerMode: true, chaosLevel: 0, settings: { ...before.settings, flipPads: 'off' } });
    const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
      xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
    const root = createRoot(canvas);
    root.configure({ gl, frameloop: 'never', size: { width: 500, height: 500 } });
    let store;
    try {
      await act(async () => {
        store = root.render(<StickerInstanceProvider>
          <StickerPlane meta={cubies[0][1][2].stickers.PZ} pos={[-1, 0, 1.51]} mode="classic" faceSize={3} />
          <StickerPlane meta={cubies[2][1][2].stickers.PZ} pos={[1, 0, 1.51]} mode="classic" faceSize={3} />
        </StickerInstanceProvider>);
      });
      const meshes = [];
      store.getState().scene.traverse(o => { if (o.isMesh && o.material?.uniforms) meshes.push(o); });
      const kinds = {
        seal: meshes.filter(m => 'uHealProgress' in m.material.uniforms),
        sparks: meshes.filter(m => m.isInstancedMesh && 'uOpacity' in m.material.uniforms)
      };
      for (const [kind, list] of Object.entries(kinds)) {
        expect(list, kind).toHaveLength(2);
        expect(list[0].material, kind).toBe(list[1].material);
        // Each tile still draws its own values.
        expect(list[0].onBeforeRender, kind).not.toBe(list[1].onBeforeRender);
      }
      // Under the tile-surface batches the footprint is no per-tile mesh at all: one
      // decal batch draws every lit square, its press per instance (tileFootprint.js).
      expect(meshes.filter(m => 'uPress' in m.material.uniforms)).toHaveLength(0);
      const decals = meshes.filter(m => m.name === 'TileSurfaceBatch:tile-footprint');
      expect(decals).toHaveLength(1);
      expect(decals[0].isInstancedMesh).toBe(true);
      expect(decals[0].geometry.attributes.aInstanceData).toBeDefined();
      // A seal draws in its own colour and progress, whatever drew last.
      const [a] = kinds.seal;
      a.material.uniforms.uColor.value.set('#123456');
      a.material.uniforms.uHealProgress.value = 0.9;
      a.material.uniformsNeedUpdate = false;
      a.onBeforeRender(null, null, null, a.geometry, a.material);
      expect(a.material.uniforms.uColor.value.getHex()).toBe(0xffffff);
      expect(a.material.uniforms.uHealProgress.value).toBe(0);
      expect(a.material.uniformsNeedUpdate).toBe(true);
    } finally {
      await act(async () => root.unmount()); useGameStore.setState(before, true);
      context.mockRestore(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    }
  });
});
