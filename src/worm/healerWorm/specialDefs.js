// src/worm/healerWorm/specialDefs.js
//
// Presentation metadata for the special power-ups, in one place.
//
// This module is deliberately dependency-free — no React, no Three.js, no store —
// so the simulation and its tests can import the canonical type list without
// dragging a renderer into a headless test run. Numeric gameplay tuning stays in
// constants.js; only identity and appearance live here.
//
// `iconPath` is SVG path data in a 24×24 viewBox, so the HUD can draw the same
// silhouette the 3D orb uses instead of an emoji (which renders differently on
// every platform and carries no accessible name).
//
// The elemental orbs (water / fire / grass / ice) are folded in from
// elementalDefs.js so the shared spawn, lifetime, claim, HUD-notice and icon
// pipeline treats them exactly like the rocket and magnet — only their claimed
// effect differs (they wash the cube in their element instead of buffing the
// worm). Keeping them in one map is why nothing in the spawn/HUD path needs a
// special case for elements.

import { ELEMENTAL_DEFS, ELEMENTAL_TYPES, isElementalType } from './elementalDefs.js';

const BASE_SPECIAL_DEFS = {
  rocket: {
    label: 'ROCKET',
    color: '#ff9d2e',
    accent: '#fff1cf',
    icon: 'rocket',
    // Nose cone over a body, with two swept fins.
    iconPath: 'M12 1.5c2.9 2.6 4.4 6.2 4.4 9.7v4.3l2.1 3.2h-4.3L12 22l-2.2-3.3H5.5l2.1-3.2v-4.3c0-3.5 1.5-7.1 4.4-9.7z',
    // Cockpit dot, drawn in the accent colour.
    iconAccent: 'M12 8.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    description: 'Blasts ahead for three seconds; fire marks immunity to collisions and wormholes.',
  },
  magnet: {
    label: 'MAGNET',
    color: '#38e0ff',
    accent: '#ff5a6e',
    icon: 'magnet',
    // Horseshoe: a thick inverted U.
    iconPath: 'M4.5 3h4.6v9.2a2.9 2.9 0 0 0 5.8 0V3h4.6v9.2a7.5 7.5 0 0 1-15 0V3z',
    // The two pole tips.
    iconAccent: 'M4.5 3h4.6v3.1H4.5V3zm10.4 0h4.6v3.1h-4.6V3z',
    description: 'Widens orb pickup to two manifold steps for eight seconds, reaching around face edges.',
  },
};

/**
 * All claimable orb types — the two worm buffs plus every elemental wash.
 * Elements are appended after rocket/magnet so the shuffle bag (specialSpawn.js)
 * spreads them evenly alongside the buffs.
 */
export const SPECIAL_DEFS = { ...BASE_SPECIAL_DEFS, ...ELEMENTAL_DEFS };

/** Canonical list of supported special types (buffs + elements). */
export const SPECIAL_TYPES = Object.keys(SPECIAL_DEFS);

/** Just the worm buffs (rocket / magnet) — the always-present half of each bag. */
export const BUFF_TYPES = Object.keys(BASE_SPECIAL_DEFS);

/** Just the elemental orb types, in catalogue order. */
export { ELEMENTAL_TYPES, isElementalType };

/** Look up a special's presentation data, falling back to the first defined type. */
export const getSpecialDef = (type) => SPECIAL_DEFS[type] ?? SPECIAL_DEFS[SPECIAL_TYPES[0]];
