// Worm cosmetics are drawn in three places — the Parity Store, the character
// picker, and the game itself — and all three now build from one description of
// the hat geometry (wormHatParts). getHatParts returns [] for a hat it doesn't
// know, which fails silently as a hat that simply doesn't render: these tests
// make adding a hat to the data without parts a failing build instead.

import { describe, it, expect } from 'vitest';
import { getHatParts } from '../worm/wormHatParts.js';
import { WORM_HATS } from '../worm/wormCosmeticsData.js';

const GEOMETRIES = new Set(['cylinder', 'cone', 'sphere', 'torus', 'box', 'octahedron']);

describe('worm hat parts', () => {
  it('builds every hat in the catalog', () => {
    const missing = WORM_HATS
      .filter(hat => hat.id !== 'none' && getHatParts(hat.id).length === 0)
      .map(hat => hat.id);
    expect(missing).toEqual([]);
  });

  it('only asks for geometries both renderers can build', () => {
    // WormHat3D (R3F) and WormPreviewRenderer (imperative) each switch over this
    // set; a new geometry name has to be added to both or one silently breaks.
    for (const hat of WORM_HATS) {
      for (const part of getHatParts(hat.id)) {
        expect(GEOMETRIES.has(part.geo[0])).toBe(true);
        expect(Array.isArray(part.pos)).toBe(true);
        expect(part.mat.color).toBeTruthy();
      }
    }
  });

  it('scales with the head radius it is given', () => {
    const small = getHatParts('tophat', 0.07);
    const big = getHatParts('tophat', 0.14);
    expect(big[0].pos[1]).toBeCloseTo(small[0].pos[1] * 2, 6);
  });

  it('has no parts for the bare head', () => {
    expect(getHatParts('none')).toEqual([]);
    expect(getHatParts('sombrero')).toEqual([]);
  });
});
