import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
vi.mock('react', async original => ({ ...await original(), useMemo: fn => fn(), useEffect: () => {} }));
import { ElementalSurfaceSkin, getElementalSurfaceMaterial, getReactionSurfaceMaterial } from '../worm/ElementalSurface.jsx';
import { adornmentSlots, adornedShellGeometry, getElementalAdornmentMaterial, ADORNMENT_MODE } from '../worm/healerWorm/elementalAdornments.js';
import { resolveElementalQuality, elementalBudget } from '../worm/healerWorm/elementalQuality.js';
import { buildElementalCells } from '../worm/healerWorm/elementalCells.js';
import { ELEMENTAL_DEFS } from '../worm/healerWorm/elementalDefs.js';
import { FUSION_LOOKS, reactionPatternOf } from '../worm/healerWorm/fusionLooks.js';
import { uFlashCap, publishFlashCap, FLASH_CAP_REDUCED } from '../worm/healerWorm/elementalUniforms.js';
import { elementalWarmupObjects } from '../worm/healerWorm/elementalWarmup.js';

// Water drips off the cube's lower edges and ice hangs icicles from them. They are a
// second geometry group of the shell's own instanced mesh, bounded by the device
// tier's adornment budget.
const TIERS = [
  { mobile: false, cubeSize: 3 }, { mobile: false, cubeSize: 9 },
  { mobile: true, cubeSize: 3 }, { mobile: true, cubeSize: 9 },
  { reducedMotion: true, cubeSize: 3 }
].map(o => resolveElementalQuality(o));

const cellDataFor = n => ({ cell: new Float32Array(n * 4), extent: new Float32Array(n * 4).fill(0.5),
  edges: new Float32Array(n * 4), sweep: new Float32Array(n) });

describe('elemental adornments', () => {
  it('fit the tier budget over the four lower edges, and only water and ice get them', () => {
    for (const quality of TIERS) {
      for (const element of Object.keys(ELEMENTAL_DEFS)) {
        const slots = adornmentSlots(element, quality);
        if (!(element in ADORNMENT_MODE)) expect(slots, element).toBe(0);
        // Every lower-edge cell carries `slots` quads: never more than the budget.
        expect(slots * 4 * quality.skinGrid, `${element} ${quality.tier}`).toBeLessThanOrEqual(quality.adornments);
      }
    }
    const high = resolveElementalQuality({ cubeSize: 3 });
    expect(high.tier).toBe('high');
    expect(adornmentSlots('water', high)).toBe(2);
    expect(adornmentSlots('ice', high)).toBe(2);
    expect(adornmentSlots('ice', resolveElementalQuality({ mobile: true, cubeSize: 3 }))).toBe(1);
    // Drips are motion: none under reduced motion (the floor tier has no budget either).
    expect(adornmentSlots('water', resolveElementalQuality({ reducedMotion: true }))).toBe(0);
    expect(adornmentSlots('water', { ...high, animate: false })).toBe(0);
    expect(elementalBudget('minimal').adornments).toBe(0);
  });

  it('append quads as a second group and leave the shell group exactly as it was', () => {
    const shell = new THREE.PlaneGeometry(1, 1, 3, 3);
    const geo = adornedShellGeometry(shell, 2);
    const shellVerts = shell.attributes.position.count;
    expect(geo.groups).toEqual([
      { start: 0, count: shell.index.count, materialIndex: 0 },
      { start: shell.index.count, count: 12, materialIndex: 1 }
    ]);
    expect(Array.from(geo.index.array.slice(0, shell.index.count))).toEqual(Array.from(shell.index.array));
    expect(Array.from(geo.attributes.position.array.slice(0, shellVerts * 3))).toEqual(Array.from(shell.attributes.position.array));
    expect(Array.from(geo.attributes.uv.array.slice(0, shellVerts * 2))).toEqual(Array.from(shell.attributes.uv.array));
    const slot = geo.attributes.aSlot.array;
    expect(Array.from(slot.slice(0, shellVerts)).every(v => v === 0)).toBe(true);
    expect(Array.from(slot.slice(shellVerts))).toEqual([0.25, 0.25, 0.25, 0.25, 0.75, 0.75, 0.75, 0.75]);
    geo.dispose(); shell.dispose();
  });

  it('draw from the shell mesh itself, with their own material, only when the tier allows', () => {
    const cells = buildElementalCells(3, 5);
    const skin = (element, quality) => {
      const def = ELEMENTAL_DEFS[element];
      return ElementalSurfaceSkin({ element, color: def.color, accent: def.accent, count: cells.length,
        cellData: cellDataFor(cells.length), quality, meshRef: { current: null } });
    };
    const high = resolveElementalQuality({ cubeSize: 3 });
    for (const element of ['water', 'ice']) {
      const mesh = skin(element, high);
      const [geometry, material] = mesh.props.args;
      const def = ELEMENTAL_DEFS[element];
      expect(material).toEqual([getElementalSurfaceMaterial(element, def.color, def.accent, true),
        getElementalAdornmentMaterial(element, def.color, def.accent)]);
      expect(geometry.groups).toHaveLength(2);
      expect(geometry.groups[1].count).toBe(adornmentSlots(element, high) * 6);
      geometry.dispose();
    }
    // Lightning has none, and the floor tier draws none.
    const plain = skin('lightning', high).props.args;
    expect(plain[1].isMaterial).toBe(true);
    expect(plain[0].groups).toHaveLength(0);
    const floor = skin('water', resolveElementalQuality({ reducedMotion: true })).props.args;
    expect(floor[1].isMaterial).toBe(true);
  });

  it('are warmed with the other elemental programs', () => {
    const materials = elementalWarmupObjects(new THREE.PlaneGeometry()).map(o => o.material);
    for (const element of Object.keys(ADORNMENT_MODE)) {
      const def = ELEMENTAL_DEFS[element];
      expect(materials).toContain(getElementalAdornmentMaterial(element, def.color, def.accent));
    }
    expect(getElementalAdornmentMaterial('lightning', '#fff', '#fff')).toBeNull();
  });
});

describe('reduced flashing on the elemental coats', () => {
  it('reaches the lightning shell and every reaction coat through one shared uniform', () => {
    const def = ELEMENTAL_DEFS.lightning;
    const coats = [getElementalSurfaceMaterial('lightning', def.color, def.accent, true),
      ...Object.entries(FUSION_LOOKS).map(([recipe, look]) => getReactionSurfaceMaterial(recipe, look, reactionPatternOf(recipe)))];
    for (const coat of coats) {
      expect(coat.uniforms.uFlashCap).toBe(uFlashCap);
      expect(coat.fragmentShader).toContain('uniform float uFlashCap;');
    }
    publishFlashCap(true);
    expect(uFlashCap.value).toBe(FLASH_CAP_REDUCED);
    expect(FLASH_CAP_REDUCED).toBeLessThan(0.5);
    publishFlashCap(false);
    expect(uFlashCap.value).toBe(1);
  });
});
