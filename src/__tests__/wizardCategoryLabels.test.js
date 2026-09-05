// The wizard rail writes each category's current value under its name, and the
// specimen plates put the same words under the cube. These helpers are the one
// place that decides those words — three steps used to compute their own.

import { describe, it, expect } from 'vitest';
import { sceneLabel, paletteLabel, styleLabel, sizeLabel, SIZE_TIERS } from '../components/screens/wizardSteps/shared.jsx';

describe('wizard category labels', () => {
  it('names the scene, and falls back when the id is unknown', () => {
    expect(sceneLabel({ backgroundTheme: 'blackhole' })).toBe('Black Hole');
    expect(sceneLabel({ backgroundTheme: 'not-a-scene' })).toBe('Scene');
  });

  it('calls an uploaded palette by what the player did, not by its key', () => {
    expect(paletteLabel({ colorScheme: 'custom', customColors: { 1: '#fff' } })).toBe('Your Photo');
    expect(paletteLabel({ colorScheme: 'standard' })).toBe('Standard');
  });

  it('reads six matching faces as that style, not as "Per Face"', () => {
    const uniform = { tileStyle: 'glossy', perFaceStyles: { 1: 'glossy', 2: 'glossy', 3: 'glossy', 4: 'glossy', 5: 'glossy', 6: 'glossy' } };
    expect(styleLabel(uniform)).toBe(styleLabel({ tileStyle: 'glossy', perFaceStyles: null }));

    // Faces left out of the map fall back to the global style, so one override
    // is what actually makes the cube mixed.
    expect(styleLabel({ tileStyle: 'glossy', perFaceStyles: { 2: 'solid' } })).toBe('Per Face');
  });

  it('distinguishes a random mix from a chosen style', () => {
    expect(styleLabel({ tileStyle: 'random', perFaceStyles: null })).toBe('Random Mix');
    expect(styleLabel({ tileStyle: 'solid', perFaceStyles: null })).toBe('Solid');
  });

  it('names the size off whichever tier table the mode plays on', () => {
    expect(sizeLabel(3)).toBe('3×3×3');
    const wormTiers = [...SIZE_TIERS, { n: 15, name: '15×15×15', tag: 'Mega', desc: '' }];
    expect(sizeLabel(15, wormTiers)).toBe('15×15×15');
    // An off-table size falls back to the classic cube rather than throwing.
    expect(sizeLabel(15)).toBe('3×3×3');
  });
});
