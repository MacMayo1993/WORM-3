import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { stormLayout, TUNNEL_RINGS } from '../components/screens/loadingDepths.js';

const css = fs.readFileSync(path.resolve('src/components/screens/LoadingScene.css'), 'utf8');

describe('loading cover depth layers', () => {
  it('lays the sticker storm out the same every time, at three depths', () => {
    const layers = stormLayout();
    expect(stormLayout()).toEqual(layers);
    expect(layers.map((l) => l.depth)).toEqual(['far', 'mid', 'near']);
    // Farther is smaller and slower.
    expect(layers[0].size).toBeLessThan(layers[1].size);
    expect(layers[1].size).toBeLessThan(layers[2].size);
    expect(layers[0].seconds).toBeGreaterThan(layers[2].seconds);
    for (const layer of layers) {
      for (const chip of layer.chips) {
        expect(chip.x).toBeGreaterThanOrEqual(0);
        expect(chip.x).toBeLessThanOrEqual(100);
        expect(chip.delay).toBeLessThanOrEqual(0); // already under way on the first paint
        expect(chip.y).toBeGreaterThan(0);
        expect(chip.y).toBeLessThan(100);
      }
    }
  });

  it('keeps the near stickers, which pass in front of the scene, off the shaft', () => {
    const near = stormLayout().find((l) => l.depth === 'near');
    for (const chip of near.chips) expect(chip.x < 20 || chip.x > 80).toBe(true);
  });

  it('animates only transform and opacity, so the depths run on the compositor', () => {
    for (const name of ['wl-ring', 'wl-rise', 'wl-depths-in']) {
      const body = css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`))[1];
      const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      expect(props.length).toBeGreaterThan(0);
      for (const prop of props) expect(['transform', 'opacity']).toContain(prop);
    }
    expect(TUNNEL_RINGS).toBeGreaterThan(3);
  });

  it('holds still for reduced motion and dives into the next screen on the way out', () => {
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.wl-chip\s*\{\s*animation: none;|\.wl-chip \{\s*animation: none/);
    expect(reduced).toMatch(/\.wl-root\.wl-leaving \{\s*scale: none;/);
    expect(css).toMatch(/\.wl-root\.wl-leaving \{[^}]*scale: 1\.45;/);
  });
});
