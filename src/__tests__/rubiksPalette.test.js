import { describe, it, expect } from 'vitest';
import { RUBIKS_CLASSIC, RUBIKS_FACE_COLORS, DIR_TO_COLOR, readableInk } from '../utils/constants.js';

/**
 * The mode carousel derives each tile's colour from the cube face that mode
 * owns. Before that it carried six hand-picked hexes, which had drifted off the
 * cube: the STORE mode sits on PY — the WHITE face — but rendered teal.
 */
describe("classic Rubik's palette", () => {
  it('maps every face id to a distinct sticker colour', () => {
    const values = Object.values(RUBIKS_FACE_COLORS);
    expect(values).toHaveLength(6);
    expect(new Set(values.map((c) => c.toLowerCase())).size).toBe(6);
  });

  it('puts white on the top face and red on the front, per the face table', () => {
    expect(RUBIKS_FACE_COLORS[DIR_TO_COLOR.PY]).toBe(RUBIKS_CLASSIC.white);
    expect(RUBIKS_FACE_COLORS[DIR_TO_COLOR.PZ]).toBe(RUBIKS_CLASSIC.red);
    expect(RUBIKS_FACE_COLORS[DIR_TO_COLOR.NZ]).toBe(RUBIKS_CLASSIC.orange);
    expect(RUBIKS_FACE_COLORS[DIR_TO_COLOR.NY]).toBe(RUBIKS_CLASSIC.yellow);
  });

  it('keeps red and orange far enough apart in hue to read as different colours', () => {
    const hue = (hex) => {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255);
      const max = Math.max(r, g, b);
      const d = max - Math.min(r, g, b);
      if (d === 0) return 0;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    // The previous pair (#ef4444 / #f97316) sat ~25 degrees apart at the same
    // lightness and read as two reds. Orange must clear red by more than that.
    const separation = hue(RUBIKS_CLASSIC.orange) - hue(RUBIKS_CLASSIC.red) + 360;
    expect(separation % 360).toBeGreaterThan(35);
  });
});

describe('readableInk', () => {
  it('returns dark ink on the light faces', () => {
    for (const c of [RUBIKS_CLASSIC.white, RUBIKS_CLASSIC.yellow]) {
      expect(readableInk(c)).toBe('#1a1410');
    }
  });

  it('returns light ink on the dark faces', () => {
    for (const c of [RUBIKS_CLASSIC.red, RUBIKS_CLASSIC.blue, RUBIKS_CLASSIC.green]) {
      expect(readableInk(c)).toBe('#fffdf2');
    }
  });

  it('falls back to light ink for a malformed value rather than throwing', () => {
    expect(readableInk('nonsense')).toBe('#fffdf2');
    expect(readableInk(undefined)).toBe('#fffdf2');
  });
});
