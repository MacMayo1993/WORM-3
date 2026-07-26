import { describe, it, expect } from 'vitest';
import {
  DEMO_CONTROLLED_KEYS,
  applyDemoOverrides,
  looksLikeDemoSettings,
  mergeDemoSettings,
  demoLookChanged,
} from '../utils/demoSettings.js';

const playerSettings = () => ({
  colorScheme: 'standard',
  customColors: null,
  backgroundTheme: 'blackhole',
  manifoldStyles: { 1: 'solid', 2: 'solid', 3: 'solid', 4: 'solid', 5: 'solid', 6: 'solid' },
  sfx: false,
  haptics: true,
});

describe('demo settings overrides', () => {
  it('rewrites only the demo-controlled fields', () => {
    const before = playerSettings();
    const after = applyDemoOverrides(before);
    expect(after.colorScheme).toBe('neon');
    expect(after.backgroundTheme).toBe('desert');
    expect(Object.values(after.manifoldStyles)).toEqual(Array(6).fill('topographic'));
    // Untouched settings pass straight through.
    expect(after.sfx).toBe(false);
    expect(after.haptics).toBe(true);
    // Pure: the caller's object is not mutated.
    expect(before.colorScheme).toBe('standard');
  });

  it('hands back a fresh manifoldStyles object each call', () => {
    const a = applyDemoOverrides(playerSettings());
    const b = applyDemoOverrides(playerSettings());
    expect(a.manifoldStyles).not.toBe(b.manifoldStyles);
  });
});

describe('unclean-exit detection', () => {
  it('recognises settings the demo left behind', () => {
    expect(looksLikeDemoSettings(applyDemoOverrides(playerSettings()))).toBe(true);
  });

  it('recognises a crash during the worm step, which swaps in the Shanghai sky', () => {
    const tainted = { ...applyDemoOverrides(playerSettings()), backgroundTheme: 'shanghai' };
    expect(looksLikeDemoSettings(tainted)).toBe(true);
  });

  // Regression: the signature check used to hard-code 'pastel' while the demo
  // applied 'neon', so it silently matched nothing and tainted devices were
  // never healed. Both now come from the same module.
  it('does not match a player theme that only half-resembles the demo', () => {
    expect(looksLikeDemoSettings({ ...playerSettings(), colorScheme: 'neon' })).toBe(false);
    expect(looksLikeDemoSettings({ ...applyDemoOverrides(playerSettings()), colorScheme: 'pastel' })).toBe(false);
    expect(looksLikeDemoSettings({
      ...applyDemoOverrides(playerSettings()),
      manifoldStyles: { 1: 'topographic', 2: 'topographic', 3: 'topographic', 4: 'topographic', 5: 'topographic', 6: 'lava' },
    })).toBe(false);
    expect(looksLikeDemoSettings(null)).toBe(false);
  });
});

// The Settings step reads this to decide whether the player actually chose a
// look. Skipping the step must not count — otherwise the demo would treat
// whatever was on screen as the player's theme and stop staging its own.
describe('telling a choice from a skip', () => {
  it('reports no change when the step was skipped untouched', () => {
    const staged = applyDemoOverrides(playerSettings());
    expect(demoLookChanged(staged, { ...staged })).toBe(false);
    expect(demoLookChanged(staged, { ...staged, manifoldStyles: { ...staged.manifoldStyles } })).toBe(false);
  });

  it('reports a change for any demo-controlled field the player edited', () => {
    const staged = applyDemoOverrides(playerSettings());
    expect(demoLookChanged(staged, { ...staged, colorScheme: 'pastel' })).toBe(true);
    expect(demoLookChanged(staged, { ...staged, backgroundTheme: 'city' })).toBe(true);
    expect(demoLookChanged(staged, { ...staged, manifoldStyles: { ...staged.manifoldStyles, 2: 'ice' } })).toBe(true);
  });

  it('ignores settings the demo does not drive', () => {
    const staged = applyDemoOverrides(playerSettings());
    expect(demoLookChanged(staged, { ...staged, sfx: true, showStats: false })).toBe(false);
  });

  it('is safe with a missing snapshot', () => {
    expect(demoLookChanged(null, playerSettings())).toBe(false);
  });
});

describe('handing settings back when the demo ends', () => {
  it('rolls back every demo-controlled field the player never touched', () => {
    const pre = playerSettings();
    const applied = applyDemoOverrides(pre);
    const restored = mergeDemoSettings(pre, applied, applied);
    for (const key of DEMO_CONTROLLED_KEYS) {
      expect(restored[key]).toEqual(pre[key]);
    }
  });

  it('keeps the choices a player made in the Make It Yours step', () => {
    const pre = playerSettings();
    const applied = applyDemoOverrides(pre);
    // Player picked their own colours and background but left tiles alone.
    const current = { ...applied, colorScheme: 'pastel', backgroundTheme: 'city' };

    const restored = mergeDemoSettings(pre, current, applied);
    expect(restored.colorScheme).toBe('pastel');
    expect(restored.backgroundTheme).toBe('city');
    // Tiles are still exactly what the demo applied, so they roll back.
    expect(restored.manifoldStyles).toEqual(pre.manifoldStyles);
  });

  it('compares tile styles by value, not identity', () => {
    const pre = playerSettings();
    const applied = applyDemoOverrides(pre);
    // Same styles, different object — still "untouched".
    const current = { ...applied, manifoldStyles: { ...applied.manifoldStyles } };
    expect(mergeDemoSettings(pre, current, applied).manifoldStyles).toEqual(pre.manifoldStyles);

    const changed = { ...applied, manifoldStyles: { ...applied.manifoldStyles, 3: 'lava' } };
    expect(mergeDemoSettings(pre, changed, applied).manifoldStyles[3]).toBe('lava');
  });

  it('never drops non-demo settings changed mid-demo', () => {
    const pre = playerSettings();
    const applied = applyDemoOverrides(pre);
    const current = { ...applied, sfx: true, haptics: false };
    const restored = mergeDemoSettings(pre, current, applied);
    expect(restored.sfx).toBe(true);
    expect(restored.haptics).toBe(false);
  });

  it('leaves current settings alone when there is no snapshot to restore', () => {
    const current = applyDemoOverrides(playerSettings());
    expect(mergeDemoSettings(null, current, current)).toBe(current);
  });
});
