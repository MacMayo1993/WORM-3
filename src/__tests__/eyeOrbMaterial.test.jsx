import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import ParityOrbs from '../worm/ParityOrb.jsx';
import { PARITY_ORB_GEOMETRIES } from '../worm/parityOrbGeometries.js';
import { getTileStyleMaterial, clearMaterialCache, sharedUniforms, warmUpDefaultStyles, warmUpAllStyles } from '../3d/styles/TileStyleMaterials.jsx';
import { createMobiOrbPalette } from '../worm/mobiOrbAppearance.js';
import { baseVertexShader, eyeballBulgeVertexShader } from '../3d/styles/shaders/shaderBase.js';

extend(THREE);
afterEach(clearMaterialCache);

it.each([true, false])('isolates eye relief from curved surfaces regardless of cache order (surface first: %s)', surfaceFirst => {
  const get = surfaceOnly => getTileStyleMaterial('eyeball', '#3377cc', false, null, '#ee9933', { surfaceOnly });
  const first = get(surfaceFirst);
  const second = get(!surfaceFirst);
  const tile = get(false), band = get(true);
  expect(first).not.toBe(second);
  expect(tile.vertexShader).toBe(eyeballBulgeVertexShader);
  expect(band.vertexShader).toBe(baseVertexShader);
  expect(band.fragmentShader).toBe(tile.fragmentShader);
  expect(band.uniforms.baseColor.value.equals(tile.uniforms.baseColor.value)).toBe(true);
  expect(band.uniforms.antipodalColor.value.equals(tile.uniforms.antipodalColor.value)).toBe(true);
  expect(band.uniforms.time).toBe(sharedUniforms.time);
  expect(get(true)).toBe(band);
  expect(get(false)).toBe(tile);
  const dispose = vi.spyOn(band, 'dispose');
  clearMaterialCache();
  expect(dispose).toHaveBeenCalledOnce();
});

it('continues sharing materials and GPU programs for styles without relief', () => {
  for (const style of ['carbonFiber', 'glass', 'opConcentric']) {
    const tile = getTileStyleMaterial(style, '#3377cc', false, null, '#ee9933');
    const band = getTileStyleMaterial(style, '#3377cc', false, null, '#ee9933', { surfaceOnly: true });
    expect(band).toBe(tile);
  }
});

it('keeps carried eyes on the same safe material as world pickups', () => {
  const palette = createMobiOrbPalette({ manifoldStyles: { 3: 'eyeball' } });
  const { bandColor, gemColor, bandMaterial } = palette[6];
  expect(bandMaterial).toBe(getTileStyleMaterial('eyeball', bandColor, false, null, gemColor, { surfaceOnly: true }));
  expect(bandMaterial.vertexShader).toBe(baseVertexShader);
});

it.each([warmUpDefaultStyles, warmUpAllStyles])('precompiles the curved eye program as well as raised tiles', warm => {
  const renderer = { compile: vi.fn(scene => {
    const eyes = scene.children.filter(o => o.material.fragmentShader?.includes('eyeNoise'));
    expect(eyes.some(o => o.material.vertexShader === baseVertexShader)).toBe(true);
    expect(eyes.some(o => o.material.vertexShader === eyeballBulgeVertexShader)).toBe(true);
  }) };
  warm(renderer, new THREE.PerspectiveCamera(), ['#3377cc'], ['eyeball']);
  expect(renderer.compile).toHaveBeenCalledOnce();
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
    expect(getTileStyleMaterial('eyeball', orb.color, false, null, orb.antipodalColor).vertexShader)
      .toBe(eyeballBulgeVertexShader);
  } finally {
    await act(async () => root.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
