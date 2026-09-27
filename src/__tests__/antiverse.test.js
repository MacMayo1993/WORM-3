import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ANTIVERSE_PAIRS, antiverseHalfSize, createAntiverse, createAntiversePoints, antiverseVisibility } from '../3d/antiverse.js';

describe('the antiverse', () => {
  it('keeps every moving light paired with its point reflection and on the same clock', () => {
    const geometry = createAntiversePoints();
    const p = geometry.attributes.position, phase = geometry.attributes.aPhase;
    expect(p.count).toBe(ANTIVERSE_PAIRS * 2);
    for (let i = 0; i < p.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i);
      const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
      expect(a.clone().add(b).length()).toBe(0);
      expect(Math.max(...a.toArray().map(Math.abs))).toBe(1);
      expect(phase.getX(i)).toBe(phase.getX(i + 1));
      expect(phase.getX(i)).toBeGreaterThanOrEqual(0);
      expect(phase.getX(i)).toBeLessThan(1);
    }
    geometry.dispose();
  });

  it('fits inside the smallest board and uses three depth-tested draws without targets or lights', () => {
    for (const size of [2, 3, 5, 15]) expect(antiverseHalfSize(size)).toBeLessThan(size / 2);
    const field = createAntiverse(3);
    expect(field.group.children).toHaveLength(3);
    for (const child of field.group.children) {
      expect(child.isLight).toBeUndefined();
      expect(child.material.depthTest).toBe(true);
      expect(child.material.depthWrite).toBe(false);
      expect(child.material.uniforms.uTime).toBe(field.uniforms.uTime);
    }
    expect(field.group.children[0].material.side).toBe(THREE.BackSide);
    field.dispose();
  });

  it('does no atmosphere drawing while closed or riding through the core', () => {
    expect(antiverseVisibility({})).toBe(0);
    expect(antiverseVisibility({ explosionT: 0.2 })).toBeCloseTo(0.3);
    for (const view of [{ explosionT: 1 }, { hollowMode: true }, { visualMode: 'glass' }, { showCutawayLens: true }]) {
      expect(antiverseVisibility(view)).toBe(1);
      expect(antiverseVisibility(view, 1.35)).toBeCloseTo(0);
    }
    expect(antiverseVisibility({ showCutawayLens: true, wormHealerMode: true, wormPhase: 'tunnel' })).toBe(0);
  });

  it.each([
    ['exploded', { explosionT: 1 }],
    ['partially exploded', { explosionT: 0.2 }],
    ['glass', { visualMode: 'glass' }],
    ['hollow', { hollowMode: true }],
    ['cutaway', { showCutawayLens: true }]
  ])('preserves the %s antiverse in Capture Mode', (_name, view) => {
    const visible = antiverseVisibility(view);
    expect(visible).toBeGreaterThan(0);
    expect(antiverseVisibility({ ...view, captureMode: true })).toBe(visible);
  });
});
