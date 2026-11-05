import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { CubieBodyBatchProvider } from '../3d/CubieBodyBatches.jsx';
import { StickerInstanceProvider } from '../3d/StickerInstances.jsx';
import { inspectionSurfaces } from '../3d/inspectionBridge.js';
import { activateSticker, runActiveStickers } from '../3d/StickerAnimationManager.js';
import { pressTile, tickWormPress, resetWormPress } from '../worm/tilePressBridge.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { getManifoldGridId } from '../game/coordinates.js';

vi.mock('../3d/BiomeGroundTextures.js', () => ({ BIOME_GROUND_TEXTURES: {} }));
vi.mock('../3d/CityBuildings.jsx', () => ({ default: () => null }));
vi.mock('../3d/BiomeGLBCluster.jsx', () => ({ BiomeGLBCluster: () => null, isGLBActive: () => false, isGLBFullFace: () => false }));
extend(THREE);

// Use the real Cubie, sticker/body batches, and contact spring. A material-only
// assertion cannot catch the Classic chassis growing over a depressed sticker.
it.each([3, 10])('keeps all six pressed faces ahead of Classic pickup bodies on a %i cube through repeated swaps', async size => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, createRadialGradient: () => ({ addColorStop() {} })
  });
  const { default: Cubie } = await import('../3d/Cubie.jsx');
  const cubies = makeCubies(size), k = (size - 1) / 2;
  const corners = [cubies[0][0][0], cubies[size - 1][size - 1][size - 1]];
  const contacts = corners.flatMap(cubie => Object.entries(cubie.stickers).map(([dir, meta]) => ({
    key: `${cubie.x},${cubie.y},${cubie.z},${dir}`, id: getManifoldGridId(meta, size)
  })));
  const settings = { ...before.settings, flipPads: 'off', soundEnabled: false, hapticsEnabled: false,
    biomeMode: { enabled: false }, manifoldStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, 'carbonFiber'])) };
  useGameStore.setState({ size, cubies, settings, wormHealerMode: true, wormViewPower: null, wormPaused: true,
    wormAlive: true, wormPhase: 'crawling', visualMode: 'classic', chaosLevel: 0, explosionT: 0,
    hollowMode: false, mirrorMode: false, randomMode: false, perfReducedFX: true, showAntipodalPiP: true });
  resetWormPress();
  const canvas = document.createElement('canvas');
  const gl = { render() {}, setSize() {}, setPixelRatio() {}, domElement: canvas,
    xr: { addEventListener() {}, removeEventListener() {} }, shadowMap: {}, renderLists: { dispose() {} }, forceContextLoss() {} };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let store, time = 0;
  const frame = async (held = true) => act(async () => {
    if (held) for (const contact of contacts) pressTile(contact.key, 1);
    tickWormPress(1 / 60);
    for (const contact of contacts) activateSticker(contact.id);
    runActiveStickers({ clock: { elapsedTime: time } }, 1 / 60);
    store.getState().advance(time += 1 / 60);
  });
  const checkClearance = () => {
    const scene = store.getState().scene;
    scene.updateMatrixWorld(true);
    const bodies = [];
    for (const batch of scene.getObjectByName('CubieBodyBatches').children) {
      for (let i = 0; i < batch.count; i++) {
        const body = new THREE.Mesh(batch.geometry, batch.material);
        batch.getMatrixAt(i, body.matrixWorld);
        body.matrixWorld.premultiply(batch.matrixWorld);
        bodies.push(body);
      }
    }
    expect(bodies).toHaveLength(2);
    for (const contact of contacts) {
      const anchor = [...inspectionSurfaces].find(([, id]) => id === contact.id)?.[0];
      expect(anchor, contact.key).toBeDefined();
      anchor.updateWorldMatrix(true, false);
      const position = new THREE.Vector3().setFromMatrixPosition(anchor.matrixWorld);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(anchor.matrixWorld);
      const ray = new THREE.Raycaster(position.clone().addScaledVector(normal, 2), normal.clone().negate());
      const hit = ray.intersectObjects(bodies, false)[0];
      expect(hit, contact.key).toBeDefined();
      // The sticker's front is at distance 2, so the black shell must be farther.
      expect(hit.distance, `black chassis covers ${contact.key}`).toBeGreaterThan(2.005);
    }
  };
  try {
    await act(async () => { store = root.render(<CubieBodyBatchProvider enabled><StickerInstanceProvider>
      {corners.map(cubie => <Cubie key={cubie.x} cubie={cubie} size={size} wormMode
        position={[cubie.x - k, cubie.y - k, cubie.z - k]} />)}
    </StickerInstanceProvider></CubieBodyBatchProvider>); });
    for (let i = 0; i < 45; i++) await frame();
    checkClearance();
    for (const power of ['view-classic', null, 'view-classic', null]) {
      await act(async () => useGameStore.setState({ wormViewPower: power }));
      // The footprint is already held during pickup/expiry, including the first
      // rendered frame after styled surfaces become plain batched stickers.
      for (let i = 0; i < 25; i++) { await frame(); checkClearance(); }
    }
    await act(async () => useGameStore.setState({ wormViewPower: 'view-classic' }));
    for (let i = 0; i < 60; i++) { await frame(false); checkClearance(); }
    // Retry can clear contact without remounting the existing cubie/sticker slots.
    await act(async () => useGameStore.setState({ wormRunId: before.wormRunId + 1, wormViewPower: null }));
    resetWormPress();
    await frame(false); checkClearance();
    await act(async () => useGameStore.setState({ wormViewPower: 'view-classic' }));
    for (let i = 0; i < 45; i++) { await frame(); checkClearance(); }
    expect(useGameStore.getState().settings).toBe(settings);
    expect(useGameStore.getState().cubies).toBe(cubies);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true); resetWormPress(); context.mockRestore();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
