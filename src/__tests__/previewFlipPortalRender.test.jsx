import React, { act, createRef } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import IntroScene from '../components/intro/IntroScene.jsx';
import { TILES } from '../components/intro/introTopology.js';
import { MenuPortalScene } from '../components/menus/MenuPortalScene.jsx';
import MenuTileOverlay from '../components/menus/MenuTileOverlay.jsx';
import { setCarouselActive } from '../components/menus/menuCarouselState.js';
import { getFlipPortalGeometry, getFlipPortalMaterial } from '../3d/flipPortal.js';
import { useGameStore } from '../hooks/useGameStore.js';

extend(THREE);
async function harness() {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const canvas = document.createElement('canvas');
  const root = createRoot(canvas);
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  await root.configure({ gl, frameloop: 'never', size: { width: 430, height: 800 } });
  let store, clock = 0;
  return {
    async render(element) { await act(async () => { store = root.render(element); }); },
    frame() { store.getState().advance(clock += 1 / 60); },
    scene() { return store.getState().scene; },
    async close() { await act(async () => root.unmount()); delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
  };
}

it('opens all 54 intro faces in one draw, points them outward, and survives scrubbing and reduced motion', async () => {
  const h = await harness(), shared = getFlipPortalGeometry(), positions = shared.attributes.position;
  const gameplayTime = getFlipPortalMaterial().userData.portalUniforms.uTime.value;
  try {
    const sample = async (time, reducedMotion = false) => {
      await h.render(<IntroScene time={time} reducedMotion={reducedMotion} performanceMode />);
      h.frame();
      return h.scene().getObjectByName('IntroFlipPortals');
    };
    expect((await sample(0)).count).toBe(0);
    const wave = await sample(1.5);
    expect(wave.count).toBeGreaterThan(0); expect(wave.count).toBeLessThan(54);
    const mesh = await sample(2.2);
    expect(mesh.count).toBe(54);
    expect(mesh.geometry.attributes.position).toBe(positions);
    const seeds = Array.from(mesh.geometry.attributes.aInstanceSeed.array);
    const matrix = new THREE.Matrix4(), normal = new THREE.Vector3(), position = new THREE.Vector3();
    TILES.forEach((tile, i) => {
      mesh.getMatrixAt(i, matrix);
      normal.set(0, 0, 1).transformDirection(matrix);
      expect(normal.getComponent(tile.face.axis) * tile.face.sign).toBeCloseTo(1);
      position.setFromMatrixPosition(matrix);
      // Portal base clears the sticker dome (0.024 above the slab center).
      expect(position.getComponent(tile.face.axis) * tile.face.sign).toBeGreaterThan(1.512 + .024);
    });
    expect(mesh.material.userData.portalUniforms.uTime.value).toBe(2.2);
    expect(getFlipPortalMaterial().userData.portalUniforms.uTime.value).toBe(gameplayTime);
    expect((await sample(7.3)).count).toBe(0);
    expect((await sample(0)).count).toBe(0);
    expect((await sample(2.2)).geometry.attributes.aInstanceSeed.array).toEqual(new Float32Array(seeds));
    expect((await sample(3.5, true)).count).toBe(0);
    expect((await sample(3.5)).count).toBe(54);
  } finally { await h.close(); }
  expect(shared.attributes.position).toBe(positions);
  expect(shared.attributes.aRegion).toBeDefined();
});

it('batches menu faces, updates them imperatively, hides for the selector and keeps an independent calm clock', async () => {
  const h = await harness(), before = useGameStore.getState();
  const refs = Array.from({ length: 54 }, () => createRef());
  try {
    await h.render(<MenuPortalScene>{refs.map((ref, i) => <group key={i} position={[i % 3, 0, 0]}>
      <MenuTileOverlay ref={ref} colorHex="#ff0000" homeColorHex="#00ff00" />
    </group>)}</MenuPortalScene>);
    h.frame();
    const pool = h.scene().getObjectByName('TileSurfaceBatches');
    expect(pool.children).toHaveLength(1);
    const batch = pool.children[0];
    expect(batch.count).toBe(54);
    expect(batch.material.transparent).toBe(false);
    expect(batch.material).not.toBe(getFlipPortalMaterial());
    refs.forEach((ref, i) => ref.current.setFace('#0000ff', i < 6, 12));
    h.frame();
    expect(batch.count).toBe(6);
    expect(batch.geometry.attributes.aInstanceSeed.array[0]).toBe(12);
    const color = new THREE.Color(); batch.getColorAt(0, color); expect(color.getHex()).toBe(0x0000ff);
    // An approaching wave must not collapse a portal that is already open.
    refs[0].current.setFace('#0000ff', true, undefined); h.frame();
    expect(batch.geometry.attributes.aInstanceSeed.array[0]).toBe(12);
    setCarouselActive(true); h.frame(); expect(pool.visible).toBe(false);
    setCarouselActive(false); h.frame(); expect(pool.visible).toBe(true); expect(batch.count).toBe(6);
    useGameStore.setState({ settings: { ...before.settings, reducedMotion: true } }); h.frame();
    expect(batch.material.userData.portalUniforms.uMotion.value).toBe(0);
  } finally { setCarouselActive(false); useGameStore.setState(before, true); await h.close(); }
});
