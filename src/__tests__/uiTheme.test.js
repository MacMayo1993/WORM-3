import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  Z,
  TEXT_MICRO, TEXT_XS, TEXT_SM, TEXT_MD, TEXT_LG, TEXT_XL, TEXT_2XL, TEXT_DISPLAY,
  TEXT_XL_FLUID, TEXT_2XL_FLUID, TEXT_DISPLAY_FLUID,
  UI_FONT, HEADING_FONT, DISPLAY_FONT, HAND_FONT, MONO_FONT, UI_CSS_VARS
} from '../utils/uiTheme.js';

// The layer scale exists so overlay stacking is decided in one place instead of
// by whoever most recently picked a bigger number. These tests pin the two
// properties that make it useful: the order is the order it claims to be, and
// two different layers never collide.
describe('Z layer scale', () => {
  // Written out rather than derived from Object.values, so that reordering the
  // object in uiTheme.js cannot quietly redefine what "correct" means here.
  const ASCENDING = [
    'SCENE_FX', 'HUD', 'HUD_RAISED', 'CONTROLS', 'PANEL', 'NAV',
    'MODAL', 'MODAL_RAISED', 'BRIEFING', 'CELEBRATION',
    'COUNTDOWN', 'CAPTION', 'FLASH', 'FULLSCREEN', 'MENU', 'MENU_DIALOG', 'INTRO', 'DEMO', 'TOAST', 'DEBUG'
  ];

  it('covers every declared layer with no extras', () => {
    expect(Object.keys(Z).sort()).toEqual([...ASCENDING].sort());
  });

  it('increases strictly from scene chrome to the dev console', () => {
    for (let i = 1; i < ASCENDING.length; i++) {
      const prev = ASCENDING[i - 1];
      const curr = ASCENDING[i];
      expect(Z[curr], `${curr} must sit above ${prev}`).toBeGreaterThan(Z[prev]);
    }
  });

  it('assigns a distinct value to every layer', () => {
    const values = Object.values(Z);
    expect(new Set(values).size).toBe(values.length);
  });

  it('uses integers, since fractional z-index is silently floored', () => {
    for (const [name, value] of Object.entries(Z)) {
      expect(Number.isInteger(value), `${name} must be an integer`).toBe(true);
    }
  });

  // The specific relationships that a regression would actually be felt as.
  it('keeps the beats that must never be buried on top', () => {
    expect(Z.DEBUG).toBe(Math.max(...Object.values(Z)));
    expect(Z.COUNTDOWN).toBeGreaterThan(Z.MODAL_RAISED); // 3-2-1-GO over any panel
    expect(Z.CELEBRATION).toBeGreaterThan(Z.BRIEFING); // victory over a briefing
    expect(Z.MODAL).toBeGreaterThan(Z.CONTROLS); // a dialog over the touch controls
    expect(Z.DEMO).toBeGreaterThan(Z.MENU); // the tour points at the menu it covers
    // Help is reachable from the mode carousel, which returns to the main menu
    // behind it. Below MENU the panel is opened but invisible.
    expect(Z.MENU_DIALOG).toBeGreaterThan(Z.MENU);
  });
});

describe('type scale', () => {
  const STEPS = [TEXT_MICRO, TEXT_XS, TEXT_SM, TEXT_MD, TEXT_LG, TEXT_XL, TEXT_2XL, TEXT_DISPLAY];

  it('increases strictly', () => {
    for (let i = 1; i < STEPS.length; i++) {
      expect(STEPS[i]).toBeGreaterThan(STEPS[i - 1]);
    }
  });

  it('exposes unitless numbers so callers can do arithmetic on a step', () => {
    for (const step of STEPS) {
      expect(typeof step).toBe('number');
    }
    // The wizard title is expressed as TEXT_XL - 3; that has to stay a number.
    expect(TEXT_XL - 3).toBe(21);
  });

  it('never drops below the 10px legibility floor', () => {
    expect(Math.min(...STEPS)).toBeGreaterThanOrEqual(10);
  });

  it('clamps the fluid variants around their fixed counterparts', () => {
    const bounds = (s) => s.match(/clamp\((\d+)px,[^,]+,\s*(\d+)px\)/).slice(1).map(Number);

    for (const [fluid, fixed] of [
      [TEXT_XL_FLUID, TEXT_XL],
      [TEXT_2XL_FLUID, TEXT_2XL],
      [TEXT_DISPLAY_FLUID, TEXT_DISPLAY]
    ]) {
      const [min, max] = bounds(fluid);
      expect(min).toBeLessThan(max);
      // The fixed step is the ceiling: fluid type may shrink on a phone, but it
      // must never render larger than the scale says that step is.
      expect(max).toBe(fixed);
    }
  });
});

// The typography is four self-hosted faces with one job each. Every property
// pinned here has already been broken once: a CDN <link> that fell back to a
// serif offline, a `cursive` generic that rendered Dancing Script on Android
// while the webfont downloaded, and a --ui-font in App.css that drifted away
// from UI_FONT because the two were maintained by hand.
describe('font tokens', () => {
  const FAMILIES = { UI_FONT, HEADING_FONT, DISPLAY_FONT, HAND_FONT, MONO_FONT };

  it('names a webfont first and always ends on a generic family', () => {
    for (const [name, stack] of Object.entries(FAMILIES)) {
      const faces = stack.split(',').map((f) => f.trim());
      expect(faces.length, `${name} needs fallbacks`).toBeGreaterThan(1);
      expect(
        ['sans-serif', 'serif', 'monospace', 'cursive', 'system-ui'],
        `${name} must end on a generic family`
      ).toContain(faces.at(-1));
    }
  });

  it('gives body, heading and display type three distinct faces', () => {
    const first = (stack) => stack.split(',')[0].trim();
    const primaries = [UI_FONT, HEADING_FONT, DISPLAY_FONT].map(first);
    expect(new Set(primaries).size, 'hierarchy collapses if two share a face').toBe(3);
    expect(first(UI_FONT)).toBe("'Nunito Variable'");
    expect(first(HEADING_FONT)).toBe("'Outfit Variable'");
    expect(first(DISPLAY_FONT)).toBe("'Bungee'");
  });

  // On Android the generic `cursive` is Dancing Script, so a stack that reaches
  // it mid-download flashes text in a wildly different face and metric.
  it('never falls back to the cursive generic outside Mobi\u2019s hand', () => {
    for (const [name, stack] of Object.entries(FAMILIES)) {
      if (name === 'HAND_FONT') continue;
      expect(stack, `${name} must not reach the cursive generic`).not.toContain('cursive');
    }
  });

  it('exposes body and heading faces to CSS-styled screens', () => {
    expect(UI_CSS_VARS['--ui-font']).toBe(UI_FONT);
    expect(UI_CSS_VARS['--heading-font']).toBe(HEADING_FONT);
    expect(UI_CSS_VARS['--display-font']).toBe(DISPLAY_FONT);
    expect(UI_CSS_VARS['--mono-font']).toBe(MONO_FONT);
  });

  // App.css declares the same two stacks as a pre-hydration fallback. They are
  // literals there, so nothing but a test keeps them honest.
  it('keeps App.css literals in step with the tokens', () => {
    const css = readFileSync('src/App.css', 'utf8');
    for (const [name, token] of [['--ui-font', UI_FONT], ['--heading-font', HEADING_FONT]]) {
      const declared = css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'));
      expect(declared, `App.css must declare ${name}`).not.toBeNull();
      expect(declared[1].trim()).toBe(token);
    }
  });

  it('loads every webfont from the bundle, never a CDN', () => {
    const main = readFileSync('src/main.jsx', 'utf8');
    expect(main).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    for (const pkg of ['@fontsource-variable/nunito', '@fontsource-variable/outfit', '@fontsource/bungee']) {
      expect(main, `${pkg} must be imported for self-hosting`).toContain(pkg);
    }
  });
});

// Every screen is supposed to take its type from the tokens above. Before this
// test, four stylesheets did not: three hardcoded a system stack and one asked
// for `var(--font-ui)`, a variable that has never existed — so those screens
// silently rendered in system-ui while everything around them did not, and
// nothing caught it because a CSS variable that resolves to nothing just falls
// back. This walks every stylesheet and insists each font declaration either
// goes through a token or is one of the few deliberate exceptions.
describe('stylesheets take their type from the tokens', () => {
  const cssFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    return e.isDirectory() ? cssFiles(path) : path.endsWith('.css') ? [path] : [];
  });

  // Bungee is the brand face and is named directly on purpose; the two mono
  // stacks are the reserved grid-ID/notation treatment; `Arial` is a single
  // arrow glyph picked for its shape, not a text face.
  const ALLOWED_LITERALS = /'Bungee'|'Courier New'|ui-monospace|font-family: Arial,/;
  // A declared token, or one of the locally-scoped aliases a screen sets from
  // DISPLAY_FONT/HEADING_FONT before using it (--story-display, --wl-*).
  const TOKEN = /var\(--(ui-font|heading-font|display-font|mono-font|story-display|wl-[a-z-]+)\b/;

  it('never hardcodes a system font stack', () => {
    const offenders = [];
    for (const file of cssFiles('src')) {
      // fonts.css is where the @font-face families are declared; it is the one
      // stylesheet that names them directly.
      if (file.endsWith('fonts.css')) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        // The lookbehind skips custom-property definitions: `--ui-font:` is
        // where the literal stack is supposed to live, not a violation of it.
        for (const decl of line.match(/(?<![-\w])font(-family)?:[^;}]*/g) ?? []) {
          if (!/sans-serif|monospace|system-ui|\bserif\b|cursive/.test(decl)) continue;
          if (TOKEN.test(decl) || ALLOWED_LITERALS.test(decl)) continue;
          offenders.push(`${file}:${i + 1}  ${decl.trim()}`);
        }
      });
    }
    expect(offenders, `use a font token from uiTheme.js:\n${offenders.join('\n')}`).toEqual([]);
  });

  // `var(--font-ui)` resolved to nothing for as long as it existed, because a
  // misspelled custom property is indistinguishable from an unset one at runtime.
  it('only references custom properties that are actually defined', () => {
    const defined = new Set(Object.keys(UI_CSS_VARS));
    for (const name of readFileSync('src/App.css', 'utf8').match(/^\s*(--[a-z0-9-]+):/gm) ?? []) {
      defined.add(name.trim().replace(':', ''));
    }
    const offenders = [];
    for (const file of cssFiles('src')) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        for (const ref of line.match(/var\(--(ui-font|heading-font|display-font|mono-font|font-[a-z-]+)\b/g) ?? []) {
          const name = ref.slice(4);
          if (!defined.has(name)) offenders.push(`${file}:${i + 1}  ${name} is never defined`);
        }
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
