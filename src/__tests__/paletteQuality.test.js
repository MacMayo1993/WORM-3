import { describe, it, expect } from 'vitest';
import { COLOR_SCHEMES, PALETTE_FACE_NAMES, PALETTE_INFO, PALETTE_GROUPS } from '../utils/colorSchemes.js';
import { bettingPalette } from '../utils/disparityBetting.js';

// OKLab distance measures hue/chroma/lightness together. These are regression
// floors for ordinary color vision, not a color-blind accessibility guarantee.
function lab(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const faces = key => [1, 2, 3, 4, 5, 6].map(id => lab(COLOR_SCHEMES[key][id]));
// Classic and City Biome pair siblings the way the Rubik's cube does (red/orange, white/yellow).
const RUBIKS_PAIRING = ['standard', 'biome'];

describe('preset palette readability', () => {
  for (const key of Object.keys(COLOR_SCHEMES)) {
    it(`${key} separates all 15 face pairs and avoids near-black tiles`, () => {
      expect(Object.keys(COLOR_SCHEMES[key])).toHaveLength(6);
      Object.values(COLOR_SCHEMES[key]).forEach(color => expect(color).toMatch(/^#[0-9a-f]{6}$/i));
      const values = faces(key);
      // The standard (Classic) palette is the physical Rubik's cube, whose blue is
      // deeper than the presets'; its floor still stays well clear of the black plastic.
      const floor = key === 'standard' ? 0.42 : 0.45;
      for (let a = 0; a < 6; a++) {
        expect(values[a][0]).toBeGreaterThan(floor);
        for (let b = a + 1; b < 6; b++) expect(distance(values[a], values[b])).toBeGreaterThanOrEqual(0.18);
      }
    });
  }

  for (const key of Object.keys(COLOR_SCHEMES).filter(key => !RUBIKS_PAIRING.includes(key))) {
    it(`${key} gives each face a counterpart that a flip makes obvious`, () => {
      const values = faces(key);
      for (const [a, b] of [[0, 3], [1, 4], [2, 5]]) expect(distance(values[a], values[b])).toBeGreaterThanOrEqual(0.22);
    });
  }
});

describe('preset palette identity', () => {
  const presets = Object.keys(COLOR_SCHEMES).filter(key => key !== 'biome');

  it('names six distinct colours for every preset and files it in a browsing group', () => {
    for (const key of presets) {
      const names = Object.values(PALETTE_FACE_NAMES[key]);
      expect(names).toHaveLength(6);
      expect(new Set(names).size).toBe(6);
      expect(PALETTE_GROUPS).toContain(PALETTE_INFO[key].group);
      expect(PALETTE_INFO[key].description).toBeTruthy();
    }
  });

  it('keeps every palette distinct from every other', () => {
    // Mean colour distance under the best face-to-face matching: two palettes that
    // are the same six hues in another order score near zero.
    const permutations = items => items.length ? items.flatMap(x => permutations(items.filter(y => y !== x)).map(rest => [x, ...rest])) : [[]];
    const orders = permutations([0, 1, 2, 3, 4, 5]);
    const keys = Object.keys(COLOR_SCHEMES), labs = Object.fromEntries(keys.map(key => [key, faces(key)]));
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const [a, b] = [labs[keys[i]], labs[keys[j]]];
      const best = Math.min(...orders.map(order => order.reduce((sum, k, f) => sum + distance(a[f], b[k]), 0)));
      expect(best / 6, `${keys[i]} ~ ${keys[j]}`).toBeGreaterThanOrEqual(0.06);
    }
  });

  it('lets Chaos bets call a preset colour by its name', () => {
    expect(bettingPalette({ colorScheme: 'lava' }).pairs.map(pair => pair.label)).toEqual(['Magma – Basalt', 'Crimson – Molten Gold', 'White Heat – Ash']);
    expect(bettingPalette({ colorScheme: 'standard' }).faces[1].name).toBe('Red');
    expect(bettingPalette({ colorScheme: 'custom', customColors: { 1: '#FF0000' } }).faces[1].name).toBe('Red');
  });
});
