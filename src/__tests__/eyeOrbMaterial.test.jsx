import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import ParityOrbs from '../worm/ParityOrb.jsx';
import { PARITY_ORB_GEOMETRIES } from '../worm/parityOrbGeometries.js';
import { getTileStyleMaterial, clearMaterialCache } from '../3d/styles/TileStyleMaterials.jsx';
import { createMobiOrbPalette } from '../worm/mobiOrbAppearance.js';
import { baseVertexShader } from '../3d/styles/shaders/shaderBase.js';

extend(THREE);
afterEach(clearMaterialCache);

// The eye's depth is ray-traced in its fragment shader on a flat surface, so it
// needs no relief geometry of its own: tiles, orb bands and carried eyes all
// share one material and one compiled program, and no authored mesh is bent.
it('draws the eye on the flat sticker, like every other style', () => {
  const eye = getTileStyleMaterial('eyeball', '#3377cc', false, null, '#ee9933');
  expect(eye.vertexShader).toBe(baseVertexShader);
  expect(eye.userData.styleFragmentShader).toContain('sphereHit');
  expect(getTileStyleMaterial('eyeball', '#3377cc', false, null, '#ee9933')).toBe(eye);
});

it('builds its ray frame from the visible facet, not from vertex normals', () => {
  // Back faces of DoubleSide walls carry normals facing away, and any carrier
  // can arrive with bad normals; the frame must still face the viewer.
  const src = getTileStyleMaterial('eyeball', '#3377cc').userData.styleFragmentShader;
  expect(src).toContain('vec3 Ng = cross(dpdx, dpdy);');
  expect(src).toMatch(/vec3 N = agree > 0\.5 \? normalize\(vWorldNormal\) : agree < -0\.5 \? -normalize\(vWorldNormal\) : Ng;/);
  // A carrier that repeats the tile gets one eye per cell.
  expect(src).toContain('fract(vUv)');
});

it('keeps carried eyes on the same material as world pickups', () => {
  const palette = createMobiOrbPalette({ manifoldStyles: { 3: 'eyeball' } });
  const { bandColor, gemColor, bandMaterial } = palette[6];
  expect(bandMaterial).toBe(getTileStyleMaterial('eyeball', bandColor, false, null, gemColor));
  expect(bandMaterial.vertexShader).toBe(baseVertexShader);
});

it.each([[3, false], [3, true], [5, false]])('keeps the actual %s board eye orb band on its authored geometry (target: %s)', async (size, target) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 500, height: 500 } });
  const geometry = PARITY_ORB_GEOMETRIES[target ? 'target' : 'normal'].core;
  const positions = geometry.attributes.position.array.slice();
  const orb = { x: 1, y: size - 1, z: 1, dirKey: 'PY', styleKey: 'eyeball',
    color: '#3377cc', antipodalColor: '#ee9933', tunnelId: 'target', spawnId: 'eye-orb' };
  try {
    let store;
    await act(async () => {
      store = root.render(<ParityOrbs wormMode size={size} orbs={[orb]}
        mode={target ? 'tunnel' : 'surface'} targetTunnelId={target ? 'target' : null} />).getState();
    });
    const bands = [];
    store.scene.traverse(o => { if (o.isMesh && o.geometry === geometry) bands.push(o); });
    expect(bands).toHaveLength(1);
    expect(bands[0].material.vertexShader).toBe(baseVertexShader);
    expect(bands[0].material.fragmentShader).toContain('eyeNoise');
    expect(geometry.attributes.position.array).toEqual(positions);
  } finally {
    await act(async () => root.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
