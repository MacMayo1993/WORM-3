import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  getFlipPortalGeometry, getFlipPortalMaterial, flipPortalData, flipPortalStart, resetFlipPortalOpenings,
  PORTAL_OUTER, PORTAL_TOP, PORTAL_OPEN_DELAY, PORTAL_REGION
} from '../3d/flipPortal.js';
import { W as BAR_W, H as BAR_H } from '../3d/disparityHealthBarMaterial.js';
import { createSurfaceBatches } from '../3d/surfaceBatches.js';

describe('flip portal geometry', () => {
  const geometry = getFlipPortalGeometry();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;

  it('stays on its sticker, above its face, and clear of the health bar', () => {
    // The play sticker is 0.85 across with its face at z = 0.
    expect(box.max.x).toBeLessThan(0.425);
    expect(box.min.y).toBeGreaterThan(-0.41 + BAR_H / 2);
    expect(box.min.z).toBeGreaterThan(0);
    expect(box.max.z).toBeLessThanOrEqual(PORTAL_TOP + 1e-6);
    expect(BAR_W / 2).toBeLessThan(0.425);
    expect(PORTAL_OUTER).toBeLessThan(0.4);
  });

  it('is one geometry with a frame and a glass floor, built once', () => {
    expect(getFlipPortalGeometry()).toBe(geometry);
    const regions = new Set(geometry.attributes.aRegion.array);
    expect(regions).toEqual(new Set([PORTAL_REGION.frame, PORTAL_REGION.floor]));
    expect(geometry.attributes.normal).toBeDefined();
  });

  it('shares one opaque material, so every portal batches into a single draw', () => {
    const material = getFlipPortalMaterial();
    expect(getFlipPortalMaterial()).toBe(material);
    expect(material.transparent).toBe(false);
    const scene = new THREE.Group(), pool = createSurfaceBatches();
    scene.add(pool.group);
    for (let i = 0; i < 225; i++) {
      const anchor = new THREE.Group(); anchor.position.set(i % 15, Math.floor(i / 15), 0); scene.add(anchor);
      pool.register(anchor, geometry, material, { current: '#ff0000' }, { current: i }, { current: flipPortalData('#00ff00', 1, 3) });
    }
    pool.update();
    expect(pool.group.children).toHaveLength(1);
    expect(pool.group.children[0].count).toBe(225);
    pool.dispose();
  });

  it('compiles the program it is drawn with: lit, instanced, animated off the shared clock', () => {
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    getFlipPortalMaterial().onBeforeCompile(shader);
    expect(shader.uniforms.uTime).toBeDefined();
    expect(shader.vertexShader).toContain('aInstanceData');
    expect(shader.vertexShader).toContain('transformed.xy *=');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance = pE');
    expect(shader.fragmentShader).not.toContain('#include <emissivemap_fragment>');
    expect(shader.fragmentShader).not.toContain('#include <color_fragment>');
  });
});

describe('flipPortalData', () => {
  it('carries the home colour in linear light and the flip pressure', () => {
    const [r, g, b, w] = flipPortalData('#ff8000', 1, 4);
    const home = new THREE.Color('#ff8000');
    expect([r, g, b]).toEqual([home.r, home.g, home.b]);
    expect(w).toBeCloseTo(0.25);
  });

  it('marks the last flip by adding 2, which the shader splits off again', () => {
    expect(flipPortalData('#fff', 2, 3)[3]).toBeCloseTo(2 + 2 / 3);
    expect(flipPortalData('#fff', 1, 3)[3]).toBeCloseTo(1 / 3);
    expect(flipPortalData('#fff', 5, 0)[3]).toBe(0);
  });
});

describe('flipPortalStart', () => {
  beforeEach(() => resetFlipPortalOpenings());

  it('opens after the flip crossing, and keeps the time through remounts on the same flip', () => {
    const start = flipPortalStart('M1-001', 1, 10);
    expect(start).toBe(10 + PORTAL_OPEN_DELAY);
    // A slice turn or view change remounts the sticker: the portal stays open.
    expect(flipPortalStart('M1-001', 1, 25)).toBe(start);
    // Another flip opens it afresh.
    expect(flipPortalStart('M1-001', 3, 25)).toBe(25 + PORTAL_OPEN_DELAY);
    expect(flipPortalStart('M4-001', 1, 30)).toBe(30 + PORTAL_OPEN_DELAY);
  });
});
