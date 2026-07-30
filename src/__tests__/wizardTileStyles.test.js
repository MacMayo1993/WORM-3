import { describe, expect, it } from 'vitest';
import { ALL_TILE_STYLE_KEYS, TILE_STYLE_SECTIONS } from '../utils/tileStyleCatalog.js';
import { resolveWizardTileStyles } from '../utils/wizardTileStyles.js';

describe('wizard Random Mix', () => {
  it('uses the complete tile-style catalog as its pool', () => {
    expect(ALL_TILE_STYLE_KEYS).toEqual(TILE_STYLE_SECTIONS.flatMap(section => section.keys));

    for (let index = 0; index < ALL_TILE_STYLE_KEYS.length; index++) {
      const random = () => (index + 0.5) / ALL_TILE_STYLE_KEYS.length;
      expect(resolveWizardTileStyles({ tileStyle: 'random' }, random)[1])
        .toBe(ALL_TILE_STYLE_KEYS[index]);
    }
  });

  it('preserves explicit global and per-face selections', () => {
    const styles = resolveWizardTileStyles({
      tileStyle: 'glossy',
      perFaceStyles: { 2: 'skyBird', 4: 'random' },
    }, () => 0);

    expect(styles).toEqual({
      1: 'glossy', 2: 'skyBird', 3: 'glossy',
      4: ALL_TILE_STYLE_KEYS[0], 5: 'glossy', 6: 'glossy',
    });
  });
});
