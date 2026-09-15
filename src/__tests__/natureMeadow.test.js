import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildMeadowGeometry, meadowBlade, MEADOW_SEGMENTS } from '../worm/healerWorm/natureMeadow.js';
import { getMeadowMaterial } from '../worm/ElementalGrassSkin.jsx';
import { resolveElementalRenderer } from '../worm/healerWorm/elementalRenderers.js';
import { getElementalDef } from '../worm/healerWorm/elementalDefs.js';

describe('Nature meadow geometry', () => {
  for (const count of [56, 88]) {
    it(`anchors ${count} folded blades, tapers tips, and stays within the geometry budget`, () => {
      const geo = buildMeadowGeometry(count);
      const p = geo.attributes.position, n = geo.attributes.normal;
      const stride = (MEADOW_SEGMENTS + 1) * 3;
      expect(p.count).toBe(count * stride);
      expect(geo.index.count / 3).toBe(count * MEADOW_SEGMENTS * 4);
      expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(n.array).every(Number.isFinite)).toBe(true);
      for (let i = 0; i < count; i++) {
        const blade = meadowBlade(i, count);
        const root = new Vector3().fromBufferAttribute(p, i * stride + 1);
        expect(root.x).toBeCloseTo(blade.x);
        expect(root.y).toBeCloseTo(blade.y);
        expect(root.z).toBeCloseTo(0.004);
        const tip = i * stride + MEADOW_SEGMENTS * 3;
        const a = new Vector3().fromBufferAttribute(p, tip);
        const b = new Vector3().fromBufferAttribute(p, tip + 2);
        expect(a.distanceTo(b)).toBeLessThan(0.00001);
        expect(a.z).toBeGreaterThan(root.z);
        expect(a.z).toBeLessThan(0.33);
      }
      geo.dispose();
    });
    it(`fills the centre and rim without identical heights at the ${count}-blade tier`, () => {
      const blades = Array.from({ length: count }, (_, i) => meadowBlade(i, count));
      expect(blades.some(b => Math.hypot(b.x, b.y) < 0.14)).toBe(true);
      expect(blades.some(b => Math.hypot(b.x, b.y) > 0.32)).toBe(true);
      expect(blades.every(b => Math.abs(b.x) < 0.43 && Math.abs(b.y) < 0.43)).toBe(true);
      expect(new Set(blades.map(b => b.height.toFixed(3))).size).toBeGreaterThan(20);
      expect(blades.some(b => b.broad)).toBe(true);
      expect(meadowBlade(5, count)).toEqual(meadowBlade(5, count));
    });
  }
  it('renders the whole meadow as one batch and primes its instanced program', () => {
    expect(resolveElementalRenderer('grass', getElementalDef).mode).toBe('instanced');
    const mat = getMeadowMaterial();
    expect(mat).toBe(getMeadowMaterial());
    expect(mat.userData.elementalInstanced).toBe(true);
    expect(mat.uniforms.uEnv.value.x).toBe(0);
    expect(mat.depthTest).toBe(true);
    expect(mat.depthWrite).toBe(true);
  });
});
