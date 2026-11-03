import { describe, expect, it } from 'vitest';
import { RUBIKS_CLASSIC } from '../utils/constants.js';
import { INTRO_FINISH } from '../components/intro/introTiming.js';
import { INTRO_PAPER_COLORS, INTRO_PAPER_STEP, INTRO_PAPER_HOLD, INTRO_PAPER_PERIOD, INTRO_PAPER_SHADER, introPaperTintInto } from '../components/intro/introPaper.js';
const rgb = hex => Object.fromEntries(['r', 'g', 'b'].map((key, i) => [key, parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255]));

describe('opening six-color cycle', () => {
  it('holds all six exact carousel sticker colors, including white, before the opening ends', () => {
    expect(INTRO_PAPER_COLORS).toEqual(['red', 'orange', 'yellow', 'green', 'blue', 'white'].map(name => RUBIKS_CLASSIC[name]));
    expect(INTRO_PAPER_PERIOD).toBeLessThan(INTRO_FINISH);
    INTRO_PAPER_COLORS.forEach((hex, i) => {
      for (const offset of [0, INTRO_PAPER_HOLD / 2, INTRO_PAPER_HOLD]) {
        expect(introPaperTintInto({}, i * INTRO_PAPER_STEP + offset)).toEqual(rgb(hex));
      }
    });
  });
  it('crossfades neighboring colors and loops continuously from white to red', () => {
    INTRO_PAPER_COLORS.forEach((hex, i) => {
      const a = rgb(hex), b = rgb(INTRO_PAPER_COLORS[(i + 1) % 6]);
      const mid = introPaperTintInto({}, i * INTRO_PAPER_STEP + (INTRO_PAPER_HOLD + INTRO_PAPER_STEP) / 2);
      for (const key of ['r', 'g', 'b']) expect(mid[key]).toBeCloseTo((a[key] + b[key]) / 2);
    });
    const end = introPaperTintInto({}, INTRO_PAPER_PERIOD - 0.0001);
    const start = introPaperTintInto({}, INTRO_PAPER_PERIOD);
    for (const key of ['r', 'g', 'b']) expect(end[key]).toBeCloseTo(start[key], 5);
  });
  it('rests on white at any time under reduced motion and resets deterministically for replay', () => {
    for (const time of [0, 3, 7, 11, 31]) expect(introPaperTintInto({}, time, true)).toEqual(rgb(RUBIKS_CLASSIC.white));
    for (const time of [0, -1, NaN, Infinity, INTRO_PAPER_PERIOD]) expect(introPaperTintInto({}, time)).toEqual(rgb(RUBIKS_CLASSIC.red));
    const out = {};
    expect(introPaperTintInto(out, 4)).toBe(out);
    expect(out).toEqual(rgb(RUBIKS_CLASSIC.yellow));
    expect(introPaperTintInto(out, 0)).toEqual(rgb(RUBIKS_CLASSIC.red));
  });
  it('uses one uniform hue across the sheet without extra texture sampling', () => {
    expect(INTRO_PAPER_SHADER).toContain('mix(uOpeningTint');
    expect(INTRO_PAPER_SHADER).not.toMatch(/texture|sin\(/);
  });
});
