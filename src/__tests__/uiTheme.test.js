// The theme is meant to be exactly two surfaces: Mobi's cream paper for reading
// and deciding, and the warm dark STEP COMPLETE treatment for panels layered
// over the live 3D scene. A cold navy "glass" family drifted in as a third and
// took a long time to remove — screens ended up half-migrated, most visibly
// SolveMode, whose header claimed to be paper-styled while its bottom third was
// still neon on navy. These tests keep that from happening again silently.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as theme from '../utils/uiTheme.js';

const readSource = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

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

  it('dresses the store in the shared notebook paper', () => {
    // The store is a panel that owns the screen, so it belongs to the paper
    // family — and specifically to the same graph-paper sheet the setup wizards
    // and level select are printed on. It used to paint its own flat cream fill,
    // which made it the only full-screen paper panel with no grid on it.
    const store = readSource('../components/screens/ParityStoreScreen.jsx');
    expect(store).toMatch(/wizardPaperBackground/);
  });

  it('keeps the worm character plate on the night surface', () => {
    // The character step shows a living worm rather than a setting, so its plate
    // is the one dark surface in the wizard. It has to be the warm NIGHT family:
    // it was built on the retired navy's near-blacks long after that family was
    // supposed to be gone.
    const wizard = readSource('../components/screens/WormModeSetupWizard.jsx');
    expect(wizard).toMatch(/NIGHT_BORDER/);
    expect(wizard).not.toMatch(/#0d0818|#060410/);
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
