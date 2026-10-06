// styleCategory.jsx — the Style category of a setup wizard.
//
// The tile catalogue is ~150 styles across eight families plus the per-face
// override. The families were a pill row under the cube, which on a phone showed
// four of them and hid the rest behind a swipe. StyleStep now lays them out like
// the store: a sidebar of families beside the open family's grid.
//
// It lives here rather than in each wizard because Freeplay, Worm, and Disparity
// ask for tile styles in exactly the same words.

import React from 'react';
import { TILE_STYLE_SECTIONS } from '../../../utils/tileStyleCatalog.js';
import StyleStep from './StyleStep.jsx';
import { styleLabel, uniformStyle } from './shared.jsx';

export const PER_FACE_FAMILY = 'perFace';

/**
 * Which family the panel is showing: whatever the player last picked, else the
 * one holding the style they are already wearing. Shared by the plate and the
 * browser so the highlighted family and the visible grid cannot disagree.
 */
export function resolveStyleFamily(settings, styleFamily) {
  if (styleFamily) return styleFamily;
  const uniform = uniformStyle(settings);
  return TILE_STYLE_SECTIONS.find(sec => sec.keys.includes(uniform))?.key ?? 'classic';
}

/** The Style category descriptor, ready to drop into a wizard. */
export function styleCategory(cos) {
  const family = resolveStyleFamily(cos.settings, cos.styleFamily);
  return {
    key: 'style',
    icon: 'style',
    label: 'Style',
    title: 'Tile Style',
    subtitle: '',
    summary: styleLabel(cos.settings),
    hero: <StyleStep cos={cos} family={family} slot="hero" />,
    content: <StyleStep cos={cos} family={family} slot="body" />
  };
}

export default styleCategory;
