import { describe, expect, it } from 'vitest';
import { buildNatureCellGeometry, NATURE_KIND, BLADE_ROWS, NATURE_BUDGET } from '../worm/healerWorm/natureMeadow.js';
import { getNatureMaterials } from '../worm/ElementalGrassSkin.jsx';
import { resolveElementalRenderer } from '../worm/healerWorm/elementalRenderers.js';
import { getElementalDef } from '../worm/healerWorm/elementalDefs.js';
import { ELEMENTAL_TIERS } from '../worm/healerWorm/elementalQuality.js';

const bladeVerts = (BLADE_ROWS + 1) * 3;
const bladeTris = BLADE_ROWS * 4;

describe('Nature terrarium geometry', () => {
  for (const tier of ELEMENTAL_TIERS) {
    const { blades, leaves, flowers } = NATURE_BUDGET[tier];
    it(`builds exactly the ${tier} budget: one moss bed, ${blades} blades, ${leaves} leaves, ${flowers} flowers`, () => {
      const geo = buildNatureCellGeometry(blades, leaves, flowers);
      const quads = 1 + leaves + flowers;
      expect(geo.attributes.position.count).toBe(quads * 4 + blades * bladeVerts);
      expect(geo.index.count / 3).toBe(quads * 2 + blades * bladeTris);
      for (const name of ['position', 'uv', 'aKind', 'aIndex']) {
        expect(Array.from(geo.attributes[name].array).every(Number.isFinite), name).toBe(true);
      }
      // Two draw groups: the moss bed alone, then every plant.
      expect(geo.groups).toEqual([
        { start: 0, count: 6, materialIndex: 0 },
        { start: 6, count: geo.index.count - 6, materialIndex: 1 }
      ]);
      const kinds = Array.from(geo.attributes.aKind.array);
      expect(kinds.filter((k) => k === NATURE_KIND.moss)).toHaveLength(4);
      expect(kinds.filter((k) => k === NATURE_KIND.blade)).toHaveLength(blades * bladeVerts);
      expect(kinds.filter((k) => k === NATURE_KIND.leaf)).toHaveLength(leaves * 4);
      expect(kinds.filter((k) => k === NATURE_KIND.flower)).toHaveLength(flowers * 4);
      geo.dispose();
    });
  }

  it('numbers each plant slot within its kind, so the shader can seed it', () => {
    const geo = buildNatureCellGeometry(6, 2, 2);
    const kinds = geo.attributes.aKind.array;
    const slots = geo.attributes.aIndex.array;
    const seen = { [NATURE_KIND.blade]: new Set(), [NATURE_KIND.leaf]: new Set(), [NATURE_KIND.flower]: new Set() };
    for (let i = 0; i < kinds.length; i++) if (seen[kinds[i]]) seen[kinds[i]].add(slots[i]);
    expect([...seen[NATURE_KIND.blade]].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect([...seen[NATURE_KIND.leaf]].sort()).toEqual([0, 1]);
    expect([...seen[NATURE_KIND.flower]].sort()).toEqual([0, 1]);
    geo.dispose();
  });

  it('keeps blade parameters in range: uv spans the blade root to tip', () => {
    const geo = buildNatureCellGeometry(3, 0, 0);
    const uv = geo.attributes.uv.array;
    const kinds = geo.attributes.aKind.array;
    for (let i = 0; i < kinds.length; i++) {
      if (kinds[i] !== NATURE_KIND.blade) continue;
      expect(uv[i * 2]).toBeGreaterThanOrEqual(0);
      expect(uv[i * 2]).toBeLessThanOrEqual(1);
      expect(uv[i * 2 + 1]).toBeGreaterThanOrEqual(0);
      expect(uv[i * 2 + 1]).toBeLessThanOrEqual(1);
    }
    geo.dispose();
  });

  it('shrinks with the quality tier and never scales with the board', () => {
    const size = (t) => {
      const b = NATURE_BUDGET[t];
      return b.blades * bladeVerts + (1 + b.leaves + b.flowers) * 4;
    };
    expect(size('minimal')).toBeLessThanOrEqual(size('low'));
    expect(size('low')).toBeLessThanOrEqual(size('medium'));
    expect(size('medium')).toBeLessThanOrEqual(size('high'));
  });
});

describe('Nature terrarium materials', () => {
  it('renders the whole terrarium in two batches and primes its instanced programs', () => {
    expect(resolveElementalRenderer('grass', getElementalDef).mode).toBe('instanced');
    const [moss, plants] = getNatureMaterials();
    expect(getNatureMaterials()[0]).toBe(moss);
    expect(getNatureMaterials()[1]).toBe(plants);
    for (const m of [moss, plants]) expect(m.userData.elementalInstanced).toBe(true);
    // One write per frame reaches both layers.
    expect(moss.uniforms.uEnv).toBe(plants.uniforms.uEnv);
    expect(plants.uniforms.uEnv.value.x).toBe(0);
    // Plants are solid and sort themselves; the moss lies over the tiles.
    expect(plants.depthTest).toBe(true);
    expect(plants.depthWrite).toBe(true);
    expect(moss.transparent).toBe(true);
    expect(moss.depthWrite).toBe(false);
  });
});
