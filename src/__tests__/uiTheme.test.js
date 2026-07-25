// The theme is meant to be exactly two surfaces: Mobi's cream paper for reading
// and deciding, and the warm dark STEP COMPLETE treatment for panels layered
// over the live 3D scene. A cold navy "glass" family drifted in as a third and
// took a long time to remove — screens ended up half-migrated, most visibly
// SolveMode, whose header claimed to be paper-styled while its bottom third was
// still neon on navy. These tests keep that from happening again silently.

import { describe, it, expect } from 'vitest';
import * as theme from '../utils/uiTheme.js';

describe('uiTheme surfaces', () => {
  it('exposes both sanctioned surfaces', () => {
    // Paper: the default, for panels that own the screen.
    expect(theme.PAPER_SHEET).toBeTruthy();
    expect(theme.PAPER_TEXT).toBeTruthy();
    // Night: for panels layered over something alive that must stay visible.
    expect(theme.NIGHT_BACKDROP).toBeTruthy();
    expect(theme.NIGHT_SHEET).toBeTruthy();
    expect(theme.NIGHT_TEXT).toBeTruthy();
  });

  it('no longer exports the retired glass family', () => {
    const retired = Object.keys(theme).filter((k) => k.startsWith('GLASS_'));
    expect(retired).toEqual([]);
  });

  it('keeps one shared affirmative action across both surfaces', () => {
    expect(theme.UI_MOSS).toBe('#5f7f4a');
  });

  it('keeps the night surface warm rather than cold-navy', () => {
    // The retired family was built on rgba(4,6,20)-ish blues. The night surface
    // is a charcoal-green: its green channel must exceed its blue channel, which
    // is what makes it read as the same world as the paper.
    const rgb = theme.NIGHT_SHEET.match(/[\d.]+/g).map(Number);
    const [r, g, b] = rgb;
    expect(g).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(r);
  });
});
