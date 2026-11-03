import { describe, expect, it } from 'vitest';
import { RUBIKS_CLASSIC } from '../utils/constants.js';
import { INTRO_PAPER_WASHES, INTRO_PAPER_SHADER } from '../components/intro/introPaper.js';

describe('opening paper palette', () => {
  it('uses all five chromatic sticker colours from the carousel cube', () => {
    expect(INTRO_PAPER_WASHES.map(wash => wash.color).sort()).toEqual(
      Object.entries(RUBIKS_CLASSIC).filter(([name]) => name !== 'white').map(([, hex]) => hex).sort()
    );
  });

  it('keeps the centre pale and the washes within a readable strength', () => {
    for (const { at, radius, strength } of INTRO_PAPER_WASHES) {
      expect(radius).toBeGreaterThan(0);
      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(0.3);
      const centreWeight = strength * Math.exp(-((Math.hypot(at[0] - 0.5, at[1] - 0.5) / radius) ** 2));
      expect(centreWeight).toBeLessThan(0.1);
    }
  });

  it('compiles a static display-RGB wash without motion or texture work', () => {
    expect(INTRO_PAPER_SHADER.match(/paper = mix/g)).toHaveLength(5);
    expect(INTRO_PAPER_SHADER).not.toMatch(/time|texture|NaN|undefined/);
    // Blue is #0051A2, not its darker linear-light decoded material value.
    expect(INTRO_PAPER_SHADER).toContain('vec3(0.0, 0.3176470588235294, 0.6352941176470588)');
  });
});
