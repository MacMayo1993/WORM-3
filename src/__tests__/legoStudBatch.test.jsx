import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
vi.mock('../3d/StickerPlane.jsx', () => ({ default: () => null }));
extend(THREE);

// The LEGO look puts a stud on every visible face. Each stud used to be three
// meshes with their own geometry and material, built on every swap to LEGO and
// freed on its restore: ~4,000 of each on a 15×15, drawn one by one. Now every
// stud on the cube is one instance of three shared batches, tinted per face.
it('draws every LEGO stud through three shared batches in its face colour', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), canvas = document.createElement('canvas');
  const { default: Cubie } = await import('../3d/Cubie.jsx');
  const size = 3, cubies = makeCubies(size), settings = { ...before.settings, flipPads: 'off' };
  useGameStore.setState({ size, cubies, wormHealerMode: true, wormViewPower: 'view-lego', chaosLevel: 0, perfReducedFX: false,
    explosionT: 0, visualMode: 'classic', settings });
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 }, camera: { position: [4, 4, 6] } });
  const corner = cubies[2][2][2], k = (size - 1) / 2;
  let store, time = 0;
  const render = async () => act(async () => {
    store = root.render(<StickerInstanceProvider>
      <Cubie cubie={corner} position={[k, k, k]} size={size} wormMode />
    </StickerInstanceProvider>);
  });
  const frame = async () => act(async () => { store.getState().advance(time += 1 / 60); });
  const studBatches = () => store.getState().scene.getObjectsByProperty('name', 'TileSurfaceBatch:lego-stud');
  try {
    await render(); await frame();
    const batches = studBatches();
    expect(batches).toHaveLength(3);
    const colors = resolveColors(settings);
    const expected = ['PX', 'PY', 'PZ'].map(dir => new THREE.Color(colors[corner.stickers[dir].curr]).getHex()).sort();
    for (const batch of batches) {
      expect(batch.count).toBe(3);
      expect(batch.castShadow).toBe(true);
      const tints = [0, 1, 2].map(i => { const c = new THREE.Color(); batch.getColorAt(i, c); return c.getHex(); }).sort();
      expect(tints).toEqual(expected);
    }
    // No stud draws by itself.
    let ownStudMeshes = 0;
    store.getState().scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry?.type === 'TorusGeometry') ownStudMeshes++; });
    expect(ownStudMeshes).toBe(0);
    // Leaving the look and coming back reuses the same shared materials.
    const materials = batches.map(batch => batch.material);
    await act(async () => useGameStore.setState({ wormViewPower: null })); await frame();
    expect(studBatches().every(batch => batch.count === 0)).toBe(true);
    await act(async () => useGameStore.setState({ wormViewPower: 'view-lego' })); await frame();
    expect(studBatches().map(batch => batch.material)).toEqual(materials);
    expect(studBatches().every(batch => batch.count === 3)).toBe(true);
  } finally {
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
