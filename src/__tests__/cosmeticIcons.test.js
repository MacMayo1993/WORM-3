// Worm cosmetics are drawn in two places — the Parity Store, where you buy them,
// and the Worm wizard's character step, where you equip them. They now share one
// artwork module, so a hat that has no drawing is invisible in both. HatIcon
// returns null for an id it doesn't know, which fails silently: these tests make
// adding a cosmetic to the data without artwork a failing build instead.

import { describe, it, expect } from 'vitest';
import { HatIcon, WormSkinIcon } from '../components/ui/CosmeticIcons.jsx';
import { WORM_HATS, WORM_SKINS } from '../worm/wormCosmeticsData.js';

describe('cosmetic artwork coverage', () => {
  it('draws every hat in the catalog', () => {
    const missing = WORM_HATS.filter(hat => HatIcon({ hatId: hat.id }) === null).map(hat => hat.id);
    expect(missing).toEqual([]);
  });

  it('draws every skin in the catalog', () => {
    WORM_SKINS.forEach(skin => {
      const art = WormSkinIcon({ skin });
      expect(art).toBeTruthy();
      expect(art.type).toBe('svg');
    });
  });

  it('has no drawing for an unknown hat id', () => {
    // The null return is what the coverage test above relies on.
    expect(HatIcon({ hatId: 'sombrero' })).toBe(null);
  });
});
