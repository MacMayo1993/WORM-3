import { describe, it, expect } from 'vitest';
import { INTRO_PAPER_COLORS } from '../components/intro/introPaper.js';
import { PAPER_GRID as P, TINTED_INK, isMajorLine, tintedInkInto } from '../utils/paperGrid.js';

// WCAG relative luminance of a display-referred colour, and the contrast of two.
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const hexRgb = hex => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 });
const WHITE = { r: 1, g: 1, b: 1 };
const GREY = { r: P.line[0], g: P.line[1], b: P.line[2] };

describe('grid lines on the tinted sheets', () => {
  // The opening's paper is its face colour lightened 20–40% toward white (INTRO_PAPER_SHADER).
  const sheets = INTRO_PAPER_COLORS.flatMap(hex => [0.2, 0.4].map(light => ({ hex, paper: mix(hexRgb(hex), WHITE, light) })));

  it('reads on every colour, lightest to darkest, where the old grey line nearly vanished', () => {
    let worstOld = Infinity;
    for (const { hex, paper } of sheets) {
      const ink = tintedInkInto({}, paper);
      expect(contrast(paper, mix(paper, ink, TINTED_INK.minor)), hex).toBeGreaterThanOrEqual(1.55);
      expect(contrast(paper, mix(paper, ink, TINTED_INK.major)), hex).toBeGreaterThanOrEqual(1.9);
      worstOld = Math.min(worstOld, contrast(paper, mix(paper, GREY, P.lineMix)));
    }
    // What players reported: on the green sheet the grey line was all but gone.
    expect(worstOld).toBeLessThan(1.1);
  });

  it('keeps each line in its sheet’s own hue, a deeper shade of it', () => {
    for (const { paper } of sheets) {
      const ink = tintedInkInto({}, paper);
      for (const key of ['r', 'g', 'b']) expect(ink[key]).toBeCloseTo(paper[key] * TINTED_INK.shade, 9);
    }
  });

  it('rules every fifth line heavier, on both sides of zero', () => {
    expect([-10, -5, 0, 5, 10].every(isMajorLine)).toBe(true);
    expect([-4, -1, 1, 4, 6].some(isMajorLine)).toBe(false);
    expect(TINTED_INK.major).toBeGreaterThan(TINTED_INK.minor);
    expect(TINTED_INK.majorWidth).toBeGreaterThan(1);
  });
});
