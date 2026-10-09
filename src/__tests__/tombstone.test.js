import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  getTombstoneGeometry, getTombstoneMaterial, EPITAPH_INK, tombYaw, tombRiseScale, TOMB_REGION
} from '../3d/tombstone.js';

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
    expect(mat.customProgramCacheKey()).toBe('chaos-tombstone-v4');
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
});
