import { describe, it, expect } from 'vitest';
import { COLORS, FACE_COLORS } from '../utils/constants.js';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';

/**
 * The standard face palette used to be restated by hand in four places, and had
 * already drifted: face 3 was #ffffff in constants.js and the standard scheme,
 * #f8fafc in SimpleCubeRenderer, and #fafafa in LoadingScreen — three whites for
 * one face. Those call sites now import from constants.js, and these tests keep
 * the two remaining definitions honest about each other.
 */
describe('face colour sources', () => {
  it('FACE_COLORS is built from COLORS', () => {
    expect(FACE_COLORS).toEqual({
      1: COLORS.red,
      2: COLORS.green,
      3: COLORS.white,
      4: COLORS.orange,
      5: COLORS.blue,
      6: COLORS.yellow
    });
  });

  it('the standard scheme agrees with FACE_COLORS face for face', () => {
    const standard = COLOR_SCHEMES.standard;
    for (const face of [1, 2, 3, 4, 5, 6]) {
      expect(standard[face].toLowerCase()).toBe(FACE_COLORS[face].toLowerCase());
    }
  });

  it('gives all six faces a distinct colour', () => {
    const seen = new Set(Object.values(FACE_COLORS).map((c) => c.toLowerCase()));
    expect(seen.size).toBe(6);
  });
});
