// src/worm/healerWorm/elementalDefs.js
//
// Elemental power-up orbs for worm mode.
//
// Each elemental orb reuses the identity of one of the "Living" tile styles
// (water / lava / grass / ice — see src/utils/tileStyleCatalog.js; fire borrows
// lava's) and, when claimed, bathes the entire cube in that element for a while:
// a coloured atmosphere, drifting element particles and a soft envelope glow. The
// base tile styles keep rendering underneath, so every sticker stays readable —
// the element is a wash over the world, not a repaint of it.
//
// This module is deliberately dependency-free (no React, no Three.js, no store),
// exactly like specialDefs.js, so the simulation and its headless tests can
// import the canonical element list without pulling in a renderer. Colours and
// silhouettes live here; numeric tuning (how long the wash lasts) stays in
// constants.js.
//
// `iconPath` is SVG path data in a 24×24 viewBox so the HUD can draw the same
// silhouette the 3D orb carries, rather than a per-platform emoji.

export const ELEMENTAL_DEFS = {
  water: {
    label: "Water",
    element: true,
    // The living tile style whose identity this orb borrows.
    tileStyle: 'water',
    // Which cube-skin renderer draws it — see elementalRenderers.js.
    renderer: 'surface',
    color: '#38bdf8',
    accent: '#e0f7ff',
    // The colour the scene's fog/tint drifts toward while this element is active.
    fogColor: '#0a2f4a',
    // Which drifting particle behaviour ElementalAtmosphere plays: bubbles rise,
    // embers rise and flicker, motes drift down, flakes fall and sway.
    particle: 'bubbles',
    // A teardrop.
    iconPath: 'M12 2.2c3.6 4.7 6.2 8.3 6.2 11.6a6.2 6.2 0 0 1-12.4 0c0-3.3 2.6-6.9 6.2-11.6z',
    iconAccent: 'M9.2 12.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    description: 'Start at full momentum: +25% speed and sweep growth orbs from both adjacent lanes. Turns retain 65% momentum. Riptide pulls dropped orbs back from 3 tiles and holds their clock; tunnels you ride are not worn and you exit at full momentum.',
  },
  fire: {
    label: "Fire",
    element: true,
    // Borrows the "lava" Living tile style's identity; the cube skin itself is
    // the bomb's flame sprites (see ElementalFireSkin), not a molten surface —
    // molten runoff on flat stickers never read as anything but orange squiggles.
    tileStyle: 'lava',
    renderer: 'flames',
    color: '#ff6a2e',
    accent: '#ffe08a',
    fogColor: '#3a0d05',
    particle: 'embers',
    // A flame.
    iconPath: 'M13.5 1.8c.6 3-1.2 4.6-2.8 6.4-1.6 1.8-3.2 3.7-3.2 6.6a6.5 6.5 0 0 0 13 0c0-2-.9-3.6-2-5 .1 1.6-.6 2.6-1.6 3-.1-2.6-1.4-4.6-3.4-6.4 1-1.6 1.2-3 0-4.6z',
    iconAccent: 'M12 12.4c1.4 1 2.1 2.2 2.1 3.5a2.1 2.1 0 0 1-4.2 0c0-1.3.7-2.5 2.1-3.5z',
    description: 'Boost unleashes a flame dash. Six distinct tiles recharge it; ignite nearby growth orbs for double growth. Smelter: each tunnel ride pays 1 heal segment for you (2 mid-dash), up to 3 per pickup.',
  },
  grass: {
    // Keep the legacy grass key so saved runs and authored objectives remain compatible.
    label: "Earth",
    element: true,
    tileStyle: 'grass',
    renderer: 'blades',
    color: '#4ade80',
    accent: '#dcfce7',
    fogColor: '#0b2e14',
    particle: 'spores',
    // Mountain ridges over fertile ground.
    iconPath: 'M2 19 9 5l4 7 3-5 6 12H2zM5 22h14M7 10l2 2 2-2',
    iconAccent: '',
    description: 'Start with a spring and garden. Land to grow more buds; harvest them when gold. Regrowth: a cut tail grows straight back. Overgrowth: pads and buds count as body when you surround a tunnel.',
  },
  ice: {
    label: "Ice",
    element: true,
    tileStyle: 'ice',
    renderer: 'surface',
    color: '#7dd3fc',
    accent: '#ffffff',
    fogColor: '#0d2438',
    particle: 'flakes',
    // A six-point snowflake.
    iconPath: 'M12 1.5v21M3.2 6.6l17.6 10.2M20.8 6.6L3.2 16.8M12 5.2l2.6-2.6M12 5.2 9.4 2.6M12 18.8l2.6 2.6M12 18.8l-2.6 2.6',
    iconAccent: '',
    description: 'Finish a slide with a turn for a speed burst. An ice shell saves one body collision; jump to steer immediately. Cold Snap: the slice-turn clock runs at half speed.',
  },
  air: {
    label: "Air", element: true, tileStyle: "holographic", renderer: "surface",
    color: "#b9f5ed", accent: "#ffffff", fogColor: "#143a40", particle: "wind",
    iconPath: "M2 8h13c5 0 5-6 1-6-2 0-3 1-3 2M2 12h17c4 0 4 6 0 6-2 0-3-1-3-2M2 16h7c4 0 4 6 0 6",
    iconAccent: "",
    description: "Hold Jump to fly while Air lasts; release to land. Steer freely and gather nearby growth orbs in flight. Gale: landing after half a second of flight sweeps every orb within 2 tiles.",
  },
  lightning: {
    label: "Lightning",
    element: true,
    // There is no dedicated "lightning" Living style, and inventing a catalogue key
    // that nothing renders would only satisfy the definition test while leaving the
    // tile itself broken. `circuit` is the deliberate, supported fallback: it is the
    // one Living style already built out of conductive traces, so an electrified
    // tile reads as the same material family as the wash over it.
    tileStyle: 'circuit',
    renderer: 'surface',
    color: '#a78bfa',
    accent: '#f0f9ff',
    // Storm-dark, not merely violet-tinted: the strikes only read as bright if the
    // fill they land against is genuinely low-key.
    fogColor: '#170b33',
    particle: 'ions',
    // A bolt.
    iconPath: 'M13.6 1.8 4.2 13.4h5.4l-1.2 8.8 9.4-11.6h-5.4z',
    iconAccent: '',
    description: 'Every four seconds, chain-collect up to three growth orbs and discharge into nearby enemies and bombs. Overcharge: each discharge charges the nearest tunnel within 3 tiles, which then pays 2 heal segments.',
  },
};

/** Canonical list of elemental orb types. */
export const ELEMENTAL_TYPES = ['water', 'fire', 'grass', 'ice', 'lightning', 'air'];

/** True when `type` names an elemental orb rather than a rocket/magnet special. */
export const isElementalType = (type) => Object.prototype.hasOwnProperty.call(ELEMENTAL_DEFS, type);

/** Look up an element's presentation data, or null when `type` is not an element. */
export const getElementalDef = (type) => ELEMENTAL_DEFS[type] ?? null;
