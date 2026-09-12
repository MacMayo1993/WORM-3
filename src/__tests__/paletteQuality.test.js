import { describe, it, expect } from 'vitest';
import { COLOR_SCHEMES, PALETTE_INFO, PALETTE_GROUPS } from '../utils/colorSchemes.js';

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
describe('preset palette readability', () => {
  for (const [key, colors] of Object.entries(COLOR_SCHEMES).filter(([key]) => key !== 'biome')) {
    it(`${key} separates all 15 face pairs and avoids near-black tiles`, () => {
      expect(Object.keys(colors)).toHaveLength(6);
      const values = Object.values(colors).map(color => { expect(color).toMatch(/^#[0-9a-f]{6}$/i); return lab(color); });
      for (let a = 0; a < 6; a++) {
        expect(values[a][0]).toBeGreaterThan(0.58);
        for (let b = a + 1; b < 6; b++) {
          expect(Math.hypot(...values[a].map((v, i) => v - values[b][i]))).toBeGreaterThanOrEqual(0.18);
        }
      }
      expect(PALETTE_GROUPS).toContain(PALETTE_INFO[key].group);
    });
  }
});
