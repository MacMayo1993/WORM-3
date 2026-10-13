// src/worm/healerWorm/fusionLooks.js
//
// What a fusion LOOKS like. Two elements fused are a reaction, not two skins laid on
// top of each other: Fire → Water is a cube boiling off clouds of steam, Water → Fire
// is lava quenched to cracked obsidian, Lightning → Ice is a blizzard. While a pair is
// up, ElementalAtmosphere draws the recipe's look INSTEAD of either element's own:
//
//   • a reaction coat over the whole cube (the shell of ElementalSurface.jsx, mode
//     `reaction`), in one of a handful of patterns with the recipe's own palette;
//   • a reaction particle field (FusionParticles.jsx) that boils off the cube's faces
//     and off the worm itself, so the reaction follows the player;
//   • the fill light in the reaction's colour.
//
// Pure data: no React, no Three. Every ordered recipe has its own entry.

/** Coat patterns: each one compiled shader program (REACTION_PATTERN define). */
export const REACTION_PATTERNS = Object.freeze({
  mist: 0,    // billowing fog banks rolling over the faces and pouring off the rims
  crust: 1,   // a cooled crust in plates, light bleeding through its cracks
  flame: 2,   // flame tongues licking up every face in the reaction's colours
  plasma: 3,  // swirling plasma cells threaded with hot filaments
  bloom: 4,   // growth: speckled bloom in the seams, dew and petals glinting
  storm: 5,   // storm clouds churning over the faces, lit from inside by flashes
  flow: 6,    // fast streaming currents racing across the faces and round the edges
});

/**
 * Particle kinds FusionParticles can emit. `size` is world units at spawn, `grow`
 * how much it swells over its life, `life` seconds, `out` speed off the surface,
 * `buoy` world-up acceleration (negative falls), `drag` per second, `blend` additive
 * or normal, `worm` the share emitted from the worm's own body rather than the cube.
 */
export const REACTION_PARTICLES = Object.freeze({
  steam:  { id: 0, size: 0.42, grow: 2.6, life: 2.4, out: 0.4,  buoy: 0.6,  drag: 0.6, additive: false, worm: 0.45, opacity: 0.8 },
  smoke:  { id: 1, size: 0.3,  grow: 2.0, life: 2.6, out: 0.25, buoy: 0.35, drag: 0.5, additive: false, worm: 0.3,  opacity: 0.5 },
  sparks: { id: 2, size: 0.07, grow: 0.0, life: 0.9, out: 1.6,  buoy: -2.2, drag: 0.4, additive: true,  worm: 0.35, opacity: 1.0 },
  petals: { id: 3, size: 0.12, grow: 0.2, life: 3.0, out: 0.55, buoy: -0.18, drag: 1.2, additive: false, worm: 0.3, opacity: 0.95 },
  snow:   { id: 4, size: 0.09, grow: 0.0, life: 3.2, out: 0.5,  buoy: -0.35, drag: 1.0, additive: false, worm: 0.2,  opacity: 0.9 },
  plasma: { id: 5, size: 0.16, grow: 0.6, life: 1.6, out: 0.7,  buoy: 0.25, drag: 0.9, additive: true,  worm: 0.4,  opacity: 0.9 },
  embers: { id: 6, size: 0.08, grow: 0.0, life: 1.8, out: 0.6,  buoy: 0.9,  drag: 0.5, additive: true,  worm: 0.35, opacity: 1.0 },
  spray:  { id: 7, size: 0.08, grow: 0.2, life: 1.3, out: 2.2,  buoy: -3.0, drag: 0.2, additive: false, worm: 0.35, opacity: 0.85 },
  frost:  { id: 8, size: 0.1,  grow: 0.3, life: 2.2, out: 0.3,  buoy: 0.08, drag: 0.8, additive: true,  worm: 0.3,  opacity: 0.9 },
  spores: { id: 9, size: 0.09, grow: 0.3, life: 2.8, out: 0.45, buoy: 0.2,  drag: 1.0, additive: true,  worm: 0.3,  opacity: 0.85 },
});

const look = (pattern, color, accent, glow, particle, tint, tint2, depth = 0.05) =>
  Object.freeze({ pattern, color, accent, glow, particle, tint, tint2, depth });

/**
 * Every recipe's reaction. `color`/`accent` paint the coat, `glow` is the fill light,
 * `particle` the kind emitted in `tint`→`tint2` (start → end of life), `depth` the
 * coat's height above the stickers.
 */
export const FUSION_LOOKS = Object.freeze({
  'water-air': look('flow', '#58e4d1', '#ffffff', '#a0fff0', 'spray', '#e8fff9', '#5ec9e8', 0.04),
  'air-water': look('mist', '#759dbb', '#c4f3ff', '#9cdae8', 'spray', '#c8edff', '#709ac7', 0.06),
  'fire-air': look('flow', '#ffb64c', '#fff2ab', '#ffd479', 'embers', '#fff0a6', '#ff863e', 0.05),
  'air-fire': look('flame', '#ed4934', '#ffc578', '#ff7e54', 'smoke', '#f7a16b', '#884336', 0.05),
  'grass-air': look('storm', '#ac895e', '#e3d49e', '#caba84', 'spores', '#cfb781', '#8cba6e', 0.05),
  'air-grass': look('crust', '#4e725c', '#d0ed96', '#a0ce83', 'petals', '#d6dc98', '#72ae83', 0.06),
  'ice-air': look('mist', '#adcfe8', '#ffffff', '#deefff', 'snow', '#f2fbff', '#9fbde0', 0.08),
  'air-ice': look('flow', '#65b8cf', '#e8ffff', '#9be8ff', 'frost', '#dbffff', '#7dc7ed', 0.04),
  'lightning-air': look('storm', '#8e91c7', '#ffffff', '#c1c8ff', 'steam', '#c4d5f9', '#9ba7db', 0.07),
  'air-lightning': look('plasma', '#ced76e', '#ffffff', '#ecf7ab', 'sparks', '#f8ffbd', '#b9c3ff', 0.04),
  // Water first
  steam:         look('mist',   '#eef6ff', '#9fd4ff', '#d8ecff', 'steam',  '#ffffff', '#cfe6f5', 0.11),
  slipstream:    look('flow',   '#4fd6ff', '#e8fbff', '#7fe3ff', 'spray',  '#e8fbff', '#7fd8ff', 0.06),
  bloom:         look('bloom',  '#ff5fae', '#5fd06e', '#ffb3d9', 'petals', '#ff7fc0', '#ffd6eb', 0.04),
  conductor:     look('storm',  '#5a7dff', '#ffffff', '#93a8ff', 'spray',  '#cfe0ff', '#7a95ff', 0.08),
  // Fire first
  quench:        look('crust',  '#1b1426', '#ff6a2e', '#a48cff', 'smoke',  '#c9c2d6', '#6c6478', 0.05),
  coldfire:      look('flame',  '#3f7bff', '#e6f6ff', '#6aa2ff', 'embers', '#cfeeff', '#4f8cff', 0.05),
  wildfire:      look('flame',  '#ff5a1f', '#9be15d', '#ff8a3c', 'embers', '#ffd36b', '#ff5a1f', 0.05),
  plasma:        look('plasma', '#ff3dd2', '#8a5cff', '#ff7ae0', 'plasma', '#ffd0f4', '#b26bff', 0.05),
  // Nature first
  geyser:        look('flow',   '#2ec4a6', '#d9fff2', '#6ff0cf', 'spray',  '#e6fff8', '#5fe0c0', 0.07),
  emberseed:     look('crust',  '#241510', '#ff9a2e', '#ff8c4a', 'embers', '#ffe08a', '#ff6a1f', 0.05),
  'ski-jump':    look('bloom',  '#f4fbff', '#3f9f6a', '#e6f6ff', 'snow',   '#ffffff', '#d6ecff', 0.06),
  thunderpad:    look('plasma', '#78e05c', '#c8a6ff', '#a6ff8c', 'spores', '#d6ffc4', '#b18cff', 0.04),
  // Ice first
  'frozen-wake': look('mist',   '#cfe9ff', '#6fb8ff', '#a9d8ff', 'frost',  '#ffffff', '#9fd2ff', 0.1),
  meltdown:      look('crust',  '#7fc8ff', '#ff6a2e', '#ffb07a', 'steam',  '#fff4ec', '#ffd2b0', 0.06),
  frostbloom:    look('bloom',  '#bfefff', '#ffffff', '#d9f6ff', 'frost',  '#ffffff', '#bfeaff', 0.05),
  static:        look('plasma', '#bff4ff', '#ffffff', '#d4f7ff', 'sparks', '#ffffff', '#9fe9ff', 0.03),
  // Lightning first
  current:       look('flow',   '#3d6bff', '#e2f0ff', '#7aa2ff', 'sparks', '#e8f4ff', '#6f9bff', 0.06),
  firestorm:     look('storm',  '#ff4a1a', '#ffd36b', '#ff7a3c', 'embers', '#ffe08a', '#ff3d12', 0.09),
  cryostorm:     look('storm',  '#e6f4ff', '#8fd0ff', '#cfeaff', 'snow',   '#ffffff', '#cfe8ff', 0.1),
  grounded:      look('bloom',  '#3fae4f', '#ffe34a', '#8cf07a', 'spores', '#fff6a6', '#7cff6a', 0.04),
});

/** The look for a recipe id, or null. */
export const fusionLookOf = id => FUSION_LOOKS[id] ?? null;

/** A recipe's coat pattern as its shader define value. */
export const reactionPatternOf = id => REACTION_PATTERNS[FUSION_LOOKS[id]?.pattern] ?? 0;
