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

  it('falls back to a sphere for an unknown type', () => {
    expect(getElementalOrbShape('nope').type).toBe('SphereGeometry');
  });

  it('has a drifting-matter kind for every element', () => {
    for (const type of ELEMENTAL_TYPES) expect(PARTICLE_KINDS, type).toHaveProperty(ELEMENTAL_DEFS[type].particle);
  });
});
