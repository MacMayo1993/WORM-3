import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { WormBody } from '../worm/healerWorm/WormBody.jsx';
import { makeWormSim, resetWormSim } from '../worm/healerWorm/wormSim.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { shPush, shReset } from '../worm/circularBuffers.js';
import { BASE_TAIL_LENGTH } from '../worm/healerWorm/constants.js';
import { getSkin } from '../worm/wormCosmeticsData.js';

vi.mock('../worm/wormGlowHalo.js', () => ({
  getWormHaloGeometry: () => new THREE.PlaneGeometry(1, 1),
  getWormHaloMaterial: () => new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color() } } }),
}));
extend(THREE);

const cases = ['classic', 'inch', 'glow', 'book', 'wiggle', 'prism', 'mobi'].flatMap(character => [
  [character, 'standard', [3, 3, 3]], [character, 'partial/bonus', [6, 1, 2]],
]);
it.each(cases)('%s displays %s pickup hues after its flash ends', async (character, layout, segments) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const before = useGameStore.getState();
  const sim = makeWormSim(5);
  resetWormSim(sim, 5, { orbCount: 0, wormholeInterval: 9999 });
  sim.orbPickupColors = ['#ff0000', '#0000ff', '#ffff00'];
  sim.orbPickupFaceIds = [1, 2, 3];
  sim.orbPickupSegments = segments;
  sim.tailLength = BASE_TAIL_LENGTH + 9;
  sim.headInterpPos.set(0, 0, 2.52);
  sim.currentNormal.set(0, 0, 1);
  sim.pos.dirKey = 'PZ'; sim.moveDir = 'up';
  shReset(sim.stepHistory);
  for (let d = 2; d >= 0; d -= .01) shPush(sim.stepHistory, new THREE.Vector3(0, -d, 2.52), sim.currentNormal, -1, -1, -1);
  const worm = Object.fromEntries(Object.keys(sim).map(key => [key, {
    get current() { return sim[key]; }, set current(value) { sim[key] = value; },
  }]));
  for (const key of ['orbPickupColors', 'orbPickupFaceIds', 'orbPickupSegments', 'colorEpoch']) worm[`${key}Ref`] = worm[key];
  useGameStore.setState({ wormAlive: true, wormPaused: false, wormCharacter: character, wormSkin: 'slime', wormAccessories: {},
    wormElementalTheme: null, wormOrbFlash: null, settings: { ...before.settings, colorScheme: 'custom', customColors: { 1: '#ff0000', 2: '#0000ff', 3: '#ffff00' } } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  try {
    let store;
    await act(async () => { store = root.render(<WormBody worm={worm} size={5} />); });
    store.getState().camera.position.set(20, 20, 20);
    store.getState().advance(1);
    const meshes = [];
    store.getState().scene.traverse(o => { if (o.isInstancedMesh && o.count > 0 && o.instanceColor) meshes.push(o); });
    const body = meshes.find(m => character === 'mobi' ? !!m.geometry.attributes.mobiRole : m.material.userData.wormContour || m.geometry.attributes.bookPart);
    expect(body).toBeTruthy();
    const colorAt = i => { const color = new THREE.Color(); body.getColorAt(i, color); return color; };
    if (character === 'mobi') {
      // Four capsules: two from a bonus pickup and both partial survivors.
      expect(body.count).toBe(layout === 'standard' ? 3 : 4);
      if (layout !== 'standard') expect(colorAt(0).equals(colorAt(1))).toBe(true);
      expect(colorAt(body.count - 3).equals(colorAt(body.count - 2))).toBe(false);
      expect(colorAt(body.count - 2).equals(colorAt(body.count - 1))).toBe(false);
    } else {
      const accents = layout === 'standard' ? [[1, '#ff0000'], [4, '#0000ff'], [7, '#ffff00']]
        : [[1, '#ff0000'], [4, '#ff0000'], [6, '#0000ff'], [8, '#ffff00']];
      for (const [offset, hex] of accents) {
        expect(colorAt(BASE_TAIL_LENGTH + offset).getHexString()).toBe(hex.slice(1));
      }
      if (character === 'glow') {
        expect(body.material.defines.WORM_CARRIED_ORBS).toBe('');
        expect(body.geometry.attributes.wormOrbAccent.getX(BASE_TAIL_LENGTH + 1)).toBe(1);
        expect(body.geometry.attributes.wormOrbAccent.getX(0)).toBe(0);
        expect(body.material.emissive.getHexString()).toBe(new THREE.Color(getSkin('slime').glow).getHexString());
      }
      // Elemental overlays may animate the skin, but cannot repaint inventory.
      await act(async () => useGameStore.setState({ wormElementalTheme: 'fire' }));
      sim.elementalT = 10; store.getState().advance(2);
      expect(colorAt(BASE_TAIL_LENGTH + (layout === 'standard' ? 4 : 6)).getHexString()).toBe('0000ff');
    }
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    vi.unstubAllGlobals(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
