// styleCategory.jsx — the Style entry in a wizard's rail, families and all.
//
// The tile catalogue is ~95 styles across six families plus the per-face
// override. Those seven used to be a horizontally scrolling pill row inside the
// panel, which on a phone showed four of them and hid the rest behind a swipe —
// you could not tell from looking that "Impossible" or "Surreal" existed. They
// are rail sub-rows now: all seven stacked and visible, the cube preview above
// the grid never moves, and picking one still only swaps the grid underneath it.
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
 * one holding the style they are already wearing. Shared by the rail and the
 * panel so the highlighted sub-row and the visible grid cannot disagree.
 */
export function resolveStyleFamily(settings, styleFamily) {
  if (styleFamily) return styleFamily;
  const uniform = uniformStyle(settings);
  return TILE_STYLE_SECTIONS.find(sec => sec.keys.includes(uniform))?.key ?? 'classic';
}

/** The Style category descriptor, ready to drop into a wizard's rail. */
export function styleCategory(cos) {
  const { settings, ownedItems, styleFamily, setStyleFamily, showPerFace = true } = cos;
  const family = resolveStyleFamily(settings, styleFamily);

  const children = TILE_STYLE_SECTIONS.map(sec => ({
    key: sec.key,
    label: sec.label,
    // What the pill row used its padlock for: this family has styles you have
    // not bought yet.
    locked: sec.keys.filter(key => !ownedItems.includes(`tile_${key}`)).length
  }));

  // Per-face is not a family, but it is the same kind of choice — "which set of
  // tiles am I looking at" — and it was previously folded away in an accordion
  // below the grid where nobody found it.
  if (showPerFace) children.push({ key: PER_FACE_FAMILY, label: 'Per Face', locked: 0 });

  return {
    key: 'style',
    icon: 'style',
    label: 'Style',
    title: 'Tile Style',
    subtitle: 'Choose how your tiles look and feel',
    summary: styleLabel(settings),
    children,
    activeChild: family,
    onSelectChild: setStyleFamily,
    content: <StyleStep cos={cos} family={family} />
  };
}

export default styleCategory;
