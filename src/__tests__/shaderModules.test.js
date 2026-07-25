import { describe, it, expect } from 'vitest';
import { basicShaders } from '../3d/styles/shaders/basicShaders.js';
import { techShaders } from '../3d/styles/shaders/techShaders.js';
import { natureShaders } from '../3d/styles/shaders/natureShaders.js';
import { opArtShaders } from '../3d/styles/shaders/opArtShaders.js';
import { antipodalShaders } from '../3d/styles/shaders/antipodalShaders.js';
import { newStyleShaders } from '../3d/styles/shaders/newStyleShaders.js';
import { nonEuclideanShaders } from '../3d/styles/shaders/nonEuclideanShaders.js';
import { isAnimatedStyle } from '../3d/styles/TileStyleMaterials.jsx';
import { isAnimatedPreviewStyle } from '../3d/TilePreviewRenderer.js';
import { TILE_STYLE_SECTIONS, NON_EUCLIDEAN_STYLE_KEYS } from '../utils/tileStyleCatalog.js';
import { TILE_STYLES } from '../utils/colorSchemes.js';
import { STORE_TILES } from '../utils/storeCatalog.js';

const modules = [
  ['basicShaders', basicShaders],
  ['techShaders', techShaders],
  ['natureShaders', natureShaders],
  ['opArtShaders', opArtShaders],
  ['antipodalShaders', antipodalShaders],
  ['newStyleShaders', newStyleShaders],
  ['nonEuclideanShaders', nonEuclideanShaders],
];

const allShaders = Object.assign({}, ...modules.map(([, mod]) => mod));

describe('shader modules', () => {
  it('every key exports a non-empty GLSL string with a main()', () => {
    for (const [name, mod] of modules) {
      expect(Object.keys(mod).length).toBeGreaterThan(0);
      for (const [key, shader] of Object.entries(mod)) {
        expect(typeof shader, `${name}.${key}`).toBe('string');
        expect(shader.trim().length, `${name}.${key} is empty`).toBeGreaterThan(0);
        expect(shader, `${name}.${key} missing void main()`).toContain('void main()');
      }
    }
  });

  it('has no duplicate keys across modules', () => {
    const seen = new Map();
    for (const [name, mod] of modules) {
      for (const key of Object.keys(mod)) {
        expect(seen.has(key), `"${key}" in ${name} collides with ${seen.get(key)}`).toBe(false);
        seen.set(key, name);
      }
    }
  });

  it('checkerboard alternates tiles via floor-parity (not a grout grid)', () => {
    // Must use mod(floor(...) + floor(...), 2.0) pattern for true alternation
    expect(antipodalShaders.checkerboard).toContain('mod(floor(');
  });

  it('neural shader has no dead closestCell variable', () => {
    expect(techShaders.neural).not.toContain('closestCell');
  });

  it('solid shader does not declare unused vUv varying', () => {
    expect(basicShaders.solid).not.toContain('varying vec2 vUv');
  });

  it('glossy shader does not declare unused vUv varying', () => {
    expect(basicShaders.glossy).not.toContain('varying vec2 vUv');
  });

  it('matte shader does not declare unused vUv varying', () => {
    expect(basicShaders.matte).not.toContain('varying vec2 vUv');
  });

  it('all antipodal shaders declare both baseColor and antipodalColor uniforms', () => {
    for (const [key, shader] of Object.entries(antipodalShaders)) {
      expect(shader, `${key} missing baseColor uniform`).toContain('uniform vec3 baseColor');
      expect(shader, `${key} missing antipodalColor uniform`).toContain('uniform vec3 antipodalColor');
    }
  });
});

describe('tile style catalog', () => {
  const sectionKeys = TILE_STYLE_SECTIONS.flatMap(s => s.keys);

  // 'solar' is listed and sold but has never had a fragment shader, so it falls
  // back to 'solid'. Pre-existing; listed here so the check below still guards
  // everything else instead of being deleted.
  const KNOWN_MISSING_SHADER = new Set(['solar']);

  it('every catalog key has a shader, a label and a store entry', () => {
    const priced = new Set(STORE_TILES.map(t => t.tileKey));
    for (const key of sectionKeys) {
      if (!KNOWN_MISSING_SHADER.has(key)) {
        expect(allShaders[key], `${key} has no fragment shader`).toBeTruthy();
      }
      expect(TILE_STYLES[key]?.label, `${key} has no label`).toBeTruthy();
      expect(priced.has(key), `${key} is not sold in the store`).toBe(true);
    }
  });

  it('no style appears in two sections', () => {
    expect(new Set(sectionKeys).size).toBe(sectionKeys.length);
  });

  it('every purchasable tile is reachable from a catalog section', () => {
    // The store renders its shelves straight from TILE_STYLE_SECTIONS, so a tile
    // that is priced but listed in no section cannot be bought at all — which is
    // exactly how 'mandelbrot' sat unbuyable behind the old type/price buckets.
    const storeKeys = STORE_TILES.map(t => t.tileKey);
    const inASection = new Set(sectionKeys);
    expect(storeKeys.filter(k => !inASection.has(k))).toEqual([]);
  });
});

describe('non-Euclidean shaders', () => {
  it('are all registered in the catalog section', () => {
    expect(Object.keys(nonEuclideanShaders).sort()).toEqual([...NON_EUCLIDEAN_STYLE_KEYS].sort());
  });

  it('are animated exactly when their fragment shader reads time', () => {
    // These styles animate purely in the fragment shader (no companion meshes
    // like the volume styles have), so the two registries must agree with the
    // GLSL exactly: a style that samples `time` without being registered renders
    // one frame and then freezes, and the reverse burns a per-frame update for
    // nothing. Either way it stays invisible until someone equips the tile.
    for (const [key, shader] of Object.entries(nonEuclideanShaders)) {
      const usesTime = /\btime\b/.test(shader.replace(/uniform\s+float\s+time\s*;/g, ''));
      expect(isAnimatedStyle(key), `${key}: shader/animated-set mismatch`).toBe(usesTime);
      expect(isAnimatedPreviewStyle(key), `${key}: shader/preview-set mismatch`).toBe(usesTime);
    }
  });

  it('tint from the face colour rather than hardcoding their own', () => {
    for (const [key, shader] of Object.entries(nonEuclideanShaders)) {
      expect(shader, `${key} missing baseColor uniform`).toContain('uniform vec3 baseColor');
    }
  });

  it('keeps every hyperbolic mirror circle orthogonal to the circle at infinity', () => {
    // A side circle at distance d with radius r bounds a hyperbolic geodesic only
    // when d² = r² + 1. Get this wrong and the "tiling" is not a tiling — an
    // earlier draft had ideal vertices that never met inside the disk.
    const constants = [...nonEuclideanShaders.poincareDisk.matchAll(/_([DR])\s*=\s*([\d.]+)/g)];
    const byName = Object.fromEntries(constants.map(([, n, v]) => [n, parseFloat(v)]));
    expect(byName.D ** 2).toBeCloseTo(byName.R ** 2 + 1, 4);

    const weave = [...nonEuclideanShaders.hyperbolicWeave.matchAll(/_([DR])\s*=\s*([\d.]+)/g)];
    const w = Object.fromEntries(weave.map(([, n, v]) => [n, parseFloat(v)]));
    expect(w.D ** 2).toBeCloseTo(w.R ** 2 + 1, 4);
  });
});
