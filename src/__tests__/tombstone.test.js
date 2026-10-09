import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  getTombstoneGeometry, getTombstoneMaterial, EPITAPH_INK, tombYaw, tombSeed, tombRiseScale, TOMB_REGION
} from '../3d/tombstone.js';
import { createSurfaceBatches } from '../3d/surfaceBatches.js';

describe('Chaos tombstone', () => {
  it('is one shared geometry carrying every part of the grave', () => {
    const geo = getTombstoneGeometry();
    expect(getTombstoneGeometry()).toBe(geo);
    const regions = new Set(geo.attributes.aRegion.array);
    expect([...regions].sort()).toEqual(Object.values(TOMB_REGION).sort());
    expect(geo.attributes.normal.count).toBe(geo.attributes.position.count);
    // Small enough that a hundred and fifty graves stay one cheap draw.
    expect(geo.attributes.position.count).toBeLessThan(6000);
    // Stands on its tile: nothing below the face, nothing wider than the tile.
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    expect(box.min.z).toBeGreaterThan(-0.01);
    expect(Math.max(-box.min.x, box.max.x, -box.min.y, box.max.y)).toBeLessThan(0.45);
  });

  it('is one opaque material, so the tile-surface batches can draw every grave together', () => {
    const mat = getTombstoneMaterial();
    expect(getTombstoneMaterial()).toBe(mat);
    expect(mat.transparent).toBe(false);
    expect(mat.customProgramCacheKey()).toBe('chaos-tombstone-v5');
    // The shader hooks it relies on are all present in three's standard material.
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    mat.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('attribute float aRegion');
    for (const chunk of ['#include <color_fragment>', '#include <emissivemap_fragment>']) expect(shader.fragmentShader).not.toContain(chunk);
    expect(shader.fragmentShader).toContain('roughnessFactor = 0.22');
    expect(shader.uniforms.uTime).toBeDefined();
    // The tile's colour reaches the fragment stage under USE_COLOR, the only colour
    // define three gives that stage; guarding on USE_INSTANCING_COLOR there left every
    // stone the grey fallback.
    expect(shader.fragmentShader).toMatch(/#ifdef USE_COLOR\s+vec3 tileCol = vColor;/);
    expect(shader.fragmentShader).not.toContain('#ifdef USE_INSTANCING_COLOR');
    // The phase comes from the grave's own seed, never from its moving transform:
    // a self-solve slice turn moves instanceMatrix every frame.
    expect(shader.vertexShader).toContain('attribute float aInstanceSeed');
    expect(shader.vertexShader).toContain('vPhase = aInstanceSeed * 6.2831853');
    expect(shader.vertexShader).not.toContain('instanceMatrix[3]');
  });

  it('engraves the epitaph in gold on the black plaque', () => {
    expect(EPITAPH_INK).toBe('#f2d27a');
  });

  it('turns each grave a little, the same way every time', () => {
    expect(tombYaw('M1-005')).toBe(tombYaw('M1-005'));
    expect(tombYaw('M1-005')).not.toBe(tombYaw('M2-005'));
    for (const id of ['M1-001', 'M3-017', 'M6-024', '']) expect(Math.abs(tombYaw(id))).toBeLessThanOrEqual(0.25);
  });

  it('rises out of the ground, overshoots and settles at full size', () => {
    const [xy0, z0] = tombRiseScale(0);
    expect(z0).toBeLessThan(0.01);
    expect(xy0).toBeCloseTo(0.55);
    const peak = Math.max(...Array.from({ length: 20 }, (_, i) => tombRiseScale(i / 19)[1]));
    expect(peak).toBeGreaterThan(1.02);
    expect(tombRiseScale(1)).toEqual([1, 1]);
  });

  it('gives each grave a stable seed in 0..1 from its grid id', () => {
    expect(tombSeed('M1-005')).toBe(tombSeed('M1-005'));
    expect(tombSeed('M1-005')).not.toBe(tombSeed('M2-005'));
    for (const id of ['M1-001', 'M3-017', 'M6-024', '']) {
      expect(tombSeed(id)).toBeGreaterThanOrEqual(0);
      expect(tombSeed(id)).toBeLessThan(1);
    }
  });

  it('keeps each grave\'s seed through a slice turn in the batches', () => {
    const scene = new THREE.Group(), layer = new THREE.Group();
    const pool = createSurfaceBatches(16);
    scene.add(layer, pool.group);
    const ids = ['M1-001', 'M1-002', 'M1-003'], anchors = ids.map((_, i) => {
      const anchor = new THREE.Group(); anchor.position.set(i, 0, 1.5); layer.add(anchor); return anchor;
    });
    anchors.forEach((anchor, i) => pool.register(anchor, getTombstoneGeometry(), getTombstoneMaterial(), { current: '#ff0000' }, { current: tombSeed(ids[i]) }));
    const seeds = () => {
      scene.updateMatrixWorld(true); pool.update();
      return [...pool.group.children[0].geometry.attributes.aInstanceSeed.array.slice(0, 3)];
    };
    const before = seeds();
    expect(before).toEqual(ids.map(id => Math.fround(tombSeed(id))));
    for (const angle of [0.1, 0.7, Math.PI / 2]) { layer.rotation.x = angle; expect(seeds()).toEqual(before); }
    // The batch reads the shared geometry's buffers and never writes into them.
    const mesh = pool.group.children[0];
    expect(mesh.geometry.attributes.position).toBe(getTombstoneGeometry().attributes.position);
    expect(getTombstoneGeometry().attributes.aInstanceSeed).toBeUndefined();
    pool.dispose();
    expect(getTombstoneGeometry().attributes.position).toBeDefined();
  });
});

describe('Chaos tombstone motion', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  async function freshTomb(osReduced) {
    // Like a browser, every matchMedia call is its own list, and a list nobody listens
    // to may still report the old value while the change event fires.
    const queries = [];
    const makeQuery = () => {
      const query = { matches: osReduced, listeners: [], addEventListener: (type, fn) => query.listeners.push(fn), removeEventListener() {} };
      queries.push(query);
      return query;
    };
    vi.stubGlobal('matchMedia', makeQuery);
    window.matchMedia = globalThis.matchMedia;
    vi.resetModules();
    const tomb = await import('../3d/tombstone.js');
    const { useGameStore } = await import('../hooks/useGameStore.js');
    const setReduced = (on) => useGameStore.setState(state => ({ settings: { ...state.settings, reducedMotion: on } }));
    const osChange = (on) => {
      for (const query of queries.filter(q => q.listeners.length)) { query.matches = on; query.listeners.forEach(fn => fn({ matches: on })); }
      for (const query of queries) query.matches = on;
    };
    return { tomb, setReduced, osChange };
  }

  it('stops when the in-app setting asks, even with the system preference off', async () => {
    const { tomb, setReduced } = await freshTomb(false);
    setReduced(true);
    const uniforms = tomb.getTombstoneMaterial().userData.tombUniforms;
    expect(uniforms.uMotion.value).toBe(0);
    setReduced(false);
    expect(uniforms.uMotion.value).toBe(1);
    setReduced(true);
    expect(uniforms.uMotion.value).toBe(0);
  });

  it('follows the system preference changing after the first grave', async () => {
    const { tomb, setReduced, osChange } = await freshTomb(false);
    setReduced(false);
    const uniforms = tomb.getTombstoneMaterial().userData.tombUniforms;
    expect(uniforms.uMotion.value).toBe(1);
    osChange(true);
    expect(uniforms.uMotion.value).toBe(0);
    osChange(false);
    expect(uniforms.uMotion.value).toBe(1);
  });
});
