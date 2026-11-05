import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { compactGlassGeometry, opaqueCubePasses, skipsOpaqueCubeEffects, updateCubeShadowCadence } from '../3d/glassViewQuality.js';
import { createPlayStickerGeometry } from '../3d/rubiksPiece.js';
import { cubieBodyGeometry } from '../3d/cubieBodyGeometry.js';

const triangles = geometry => (geometry.index?.count ?? geometry.attributes.position.count) / 3;

describe('glass view cost without changing gameplay surfaces', () => {
  it('keeps full detail on small desktop boards and scales down for dense/mobile/reduced-FX views', () => {
    for (const size of [2, 3, 5]) expect(compactGlassGeometry(size, false, false)).toBe(false);
    for (const size of [6, 7, 10, 15]) expect(compactGlassGeometry(size, false, false)).toBe(true);
    expect(compactGlassGeometry(3, true, false)).toBe(true);
    expect(compactGlassGeometry(3, false, true)).toBe(true);
    // Reduced motion does not remove static glass or change its geometry tier.
    expect(compactGlassGeometry(3, false, false)).toBe(false);
  });

  it('reduces bevel tessellation while keeping the same bounds, thickness and UV coordinates', () => {
    const full = createPlayStickerGeometry();
    const compact = createPlayStickerGeometry(.85, 0, { bevelSegments: 1, curveSegments: 2 });
    expect(triangles(full)).toBe(284);
    expect(triangles(compact)).toBe(92);
    for (const geometry of [full, compact]) geometry.computeBoundingBox();
    expect(compact.boundingBox.equals(full.boundingBox)).toBe(true);
    const p = compact.attributes.position, uv = compact.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      expect(uv.getX(i)).toBeCloseTo(p.getX(i) / .85 + .5, 6);
      expect(uv.getY(i)).toBeCloseTo(p.getY(i) / .85 + .5, 6);
    }
    expect([...compact.attributes.normal.array].every(Number.isFinite)).toBe(true);
    // Transparent tiles still sort independently, but one front pass plus its
    // two-triangle antipodal back replaces two front passes plus that same back.
    expect(6 * 7 * 7 * (triangles(full) * 2 + 2)).toBe(167580);
    expect(6 * 7 * 7 * (triangles(compact) + 2)).toBe(27636);
    full.dispose(); compact.dispose();
  });

  it('shares bounded compact body resources and keeps rounded chassis/hit bounds', () => {
    const full = cubieBodyGeometry(.92), compact = cubieBodyGeometry(.92, undefined, true);
    expect(compact).toBe(cubieBodyGeometry(.92, undefined, true));
    expect(cubieBodyGeometry(.92)).toBe(full);
    expect(triangles(full)).toBe(716);
    expect(triangles(compact)).toBe(236);
    full.computeBoundingBox(); compact.computeBoundingBox();
    expect(compact.boundingBox.equals(full.boundingBox)).toBe(true);
    expect([...compact.attributes.normal.array].every(Number.isFinite)).toBe(true);
    // Keep a real rounded box, including its back and side walls.
    const normal = compact.attributes.normal;
    expect(Array.from({ length: normal.count }, (_, i) => Math.abs(normal.getZ(i))).some(z => z > 0 && z < 1)).toBe(true);
    expect(compact.boundingBox.getSize(new THREE.Vector3()).z).toBeCloseTo(.92, 5);
  });

  it('stops shadow-map work through pickup/refresh/reduced FX and restores the existing cadence', () => {
    const shadow = { autoUpdate: true, needsUpdate: true };
    expect(skipsOpaqueCubeEffects('classic')).toBe(false);
    expect(skipsOpaqueCubeEffects('glass')).toBe(true);
    expect(skipsOpaqueCubeEffects('wireframe')).toBe(true);
    for (const slow of [false, true]) for (let frame = 0; frame < 12; frame++) {
      updateCubeShadowCadence(shadow, false, slow, frame);
      expect(shadow).toEqual({ autoUpdate: false, needsUpdate: false });
    }
    updateCubeShadowCadence(shadow, true, false, 12);
    expect(shadow.autoUpdate).toBe(true);
    for (let frame = 0; frame < 8; frame++) {
      updateCubeShadowCadence(shadow, true, true, frame);
      expect(shadow.autoUpdate).toBe(false);
      expect(shadow.needsUpdate).toBe(frame % 4 === 0);
    }
  });

  it('uses the pickup for pass activity without remounting programs, and ignores stale powers outside WORM', () => {
    const state = { visualMode: 'classic', wormHealerMode: true, wormViewPower: null };
    expect(opaqueCubePasses(state, false)).toEqual({ available: true, enabled: true });
    for (const power of ['view-glass', 'view-wireframe', 'view-glass']) {
      state.wormViewPower = power;
      expect(opaqueCubePasses(state, false)).toEqual({ available: true, enabled: false });
    }
    state.wormViewPower = null;
    expect(opaqueCubePasses(state, false)).toEqual({ available: true, enabled: true });
    state.wormViewPower = 'view-glass'; state.wormHealerMode = false;
    expect(opaqueCubePasses(state, false)).toEqual({ available: true, enabled: true });
    // A saved glass scene never mounts expensive opaque programs just because a
    // brief Classic pickup arrives; on expiry it remains the same glass scene.
    state.visualMode = 'glass'; state.wormHealerMode = true; state.wormViewPower = 'view-classic';
    expect(opaqueCubePasses(state, false)).toEqual({ available: false, enabled: false });
    state.wormViewPower = null;
    expect(opaqueCubePasses(state, false)).toEqual({ available: false, enabled: false });
    state.visualMode = 'classic';
    expect(opaqueCubePasses(state, true)).toEqual({ available: false, enabled: false });
  });
});
