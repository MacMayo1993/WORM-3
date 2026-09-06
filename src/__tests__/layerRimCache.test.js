// The worm's hazard asks for a slice rim every ten seconds for the length of a
// run, and building one walks size³ cubies × six faces — 20,250 face tests on a
// 15×15 — before uploading four fresh attribute arrays. Rebuilding a geometry
// identical to the one just disposed is a hitch you can feel on the frame the
// warning arms, so they are built once and kept.

import { describe, it, expect } from 'vitest';
import { getSliceRimGeometry, rimCacheSize, buildRimGeometry } from '../teach/layerGlow.js';

describe('slice rim cache', () => {
  it('hands back the same geometry for the same slice', () => {
    const a = getSliceRimGeometry(3, 'row', 1);
    const b = getSliceRimGeometry(3, 'row', 1);
    expect(b).toBe(a);
  });

  it('keys on size, axis and slice together', () => {
    const rows = rimCacheSize();
    const a = getSliceRimGeometry(4, 'row', 1);
    const b = getSliceRimGeometry(4, 'col', 1);
    const c = getSliceRimGeometry(4, 'row', 2);
    const d = getSliceRimGeometry(5, 'row', 1);
    expect(new Set([a, b, c, d]).size).toBe(4);
    expect(rimCacheSize()).toBe(rows + 4);
  });

  it('builds the same rim the uncached path does', () => {
    const cached = getSliceRimGeometry(3, 'depth', 0);
    const fresh = buildRimGeometry(3, {
      includeCubie: (x, y, z) => z === 0,
      phaseOf: ({ fx, fy }) => Math.atan2(fy, fx) / (Math.PI * 2) + 0.5
    });
    expect(cached.getAttribute('position').count).toBe(fresh.getAttribute('position').count);
    expect(cached.getIndex().count).toBe(fresh.getIndex().count);
    fresh.dispose();
  });

  it('covers a Mega layer without walking it twice', () => {
    const first = getSliceRimGeometry(15, 'col', 7);
    expect(first.getAttribute('aPhase').count).toBeGreaterThan(0);
    expect(getSliceRimGeometry(15, 'col', 7)).toBe(first);
  });
});
