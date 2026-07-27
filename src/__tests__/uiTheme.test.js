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

  it('keeps the specimen plate on the night surface', () => {
    // The plate shows a living thing rather than a setting — a worm in the worm
    // wizard, a cube in the cosmetic steps, whatever the store is selling — so
    // it is the one dark surface among the paper. It has to be the warm NIGHT
    // family: it was built on the retired navy's near-blacks long after that
    // family was supposed to be gone.
    const plate = readSource('../components/screens/wizardSteps/SpecimenPlate.jsx');
    expect(plate).toMatch(/NIGHT_BORDER/);
    expect(plate).not.toMatch(/#0d0818|#060410/);
  });

  it('draws every plate from the one shared shell', () => {
    // Three screens stand something on a plate. They share the furniture so the
    // warm dark surface stays one thing rather than three hand-copied versions
    // that drift apart — which is exactly how the wizards' step layouts drifted.
    for (const src of [
      '../components/screens/WormModeSetupWizard.jsx',
      '../components/screens/wizardSteps/CubePlate.jsx',
      '../components/screens/ParityStoreScreen.jsx'
    ]) {
      expect(readSource(src)).toMatch(/SpecimenPlate/);
    }
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
