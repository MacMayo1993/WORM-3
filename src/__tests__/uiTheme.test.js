import { describe, it, expect } from 'vitest';
import {
  Z,
  TEXT_MICRO, TEXT_XS, TEXT_SM, TEXT_MD, TEXT_LG, TEXT_XL, TEXT_2XL, TEXT_DISPLAY,
  TEXT_XL_FLUID, TEXT_2XL_FLUID, TEXT_DISPLAY_FLUID
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
