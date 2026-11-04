import { describe, it, expect } from 'vitest';
import { ELEMENTAL_DEFS, ELEMENTAL_TYPES } from '../worm/healerWorm/elementalDefs.js';
import { getElementalOrbShape, ORB_SHAPE_TYPES } from '../worm/healerWorm/elementalOrbShapes.js';
import { PARTICLE_KINDS } from '../worm/healerWorm/elementalOrbMaterials.js';

describe('elemental orb shapes', () => {
  it('gives every element a silhouette of its own', () => {
    for (const type of ELEMENTAL_TYPES) expect(ORB_SHAPE_TYPES).toContain(type);
    const geos = ELEMENTAL_TYPES.map(getElementalOrbShape);
    expect(new Set(geos).size).toBe(ELEMENTAL_TYPES.length);
  });

  it('shares one geometry per element', () => {
    for (const type of ELEMENTAL_TYPES) expect(getElementalOrbShape(type)).toBe(getElementalOrbShape(type));
  });

  it('keeps every shape clear of the crest floated above it, with finite normals', () => {
    for (const type of ELEMENTAL_TYPES) {
      const geo = getElementalOrbShape(type);
      const pos = geo.attributes.position;
      const nrm = geo.attributes.normal;
      expect(pos.count).toBeGreaterThan(0);
      expect(nrm.count).toBe(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
        expect(r, `${type} vertex ${i}`).toBeLessThan(0.7);
        expect(Number.isFinite(nrm.getX(i) + nrm.getY(i) + nrm.getZ(i))).toBe(true);
      }
    }
  });

  it('carries the piece id and the outline direction the relic shader reads', () => {
    for (const type of [...ELEMENTAL_TYPES, 'nope']) {
      const geo = getElementalOrbShape(type);
      const count = geo.attributes.position.count;
      expect(geo.attributes.aPart?.count, type).toBe(count);
      expect(geo.attributes.aSmooth?.count, type).toBe(count);
      const s = geo.attributes.aSmooth;
      for (let i = 0; i < count; i++) {
        expect(Math.hypot(s.getX(i), s.getY(i), s.getZ(i)), `${type} aSmooth ${i}`).toBeCloseTo(1, 3);
      }
    }
  });

  it('paints the island and the crystal cluster in several pieces', () => {
    const pieces = (type) => new Set(getElementalOrbShape(type).attributes.aPart.array).size;
    expect(pieces('grass')).toBe(4); // rock, grass, trunk, leaves
    expect(pieces('ice')).toBe(2); // the main crystal and the shorter ones
  });

  it('falls back to a sphere for an unknown type', () => {
    const geo = getElementalOrbShape('nope');
    expect(geo.boundingSphere.radius).toBeCloseTo(0.42, 2);
    expect(getElementalOrbShape('nope')).toBe(geo);
  });

  it('has a drifting-matter kind for every element', () => {
    for (const type of ELEMENTAL_TYPES) expect(PARTICLE_KINDS, type).toHaveProperty(ELEMENTAL_DEFS[type].particle);
  });
});
