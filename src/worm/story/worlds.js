import { resolveBiomeManifoldStyles } from '../../modes/CityBiomeMode.js';
// Each chapter borrows a complete authored look; player cosmetics stay owned
// and equipped independently. Face/color IDs retain their gameplay meaning.
// `view` borrows the cube's other presentations for a level: a visual mode
// (grid, numbers, glass...), the hollow frame, Random's remix, Biome faces or
// the far-side window. None of it changes which face a tile belongs to.
// `biome` borrows Biome mode's palette and elemental tiles only. Its city
// renderer (biomeMode.enabled) raises buildings off every sticker, which would
// stand over the worm's crawl surface and stalls a 6×6 board, so it stays off.
const world = (name, palette, background, styles, route, view = {}) => ({
  name, palette, background, route, view,
  styles: Object.fromEntries((styles.length === 3 ? [...styles, ...styles] : styles).map((style, i) => [i + 1, style])),
});
const BIOME_STYLES = Object.values(resolveBiomeManifoldStyles(null));
// Keep the opening chapter visually consistent while players learn movement,
// jumps, rotations and healing. Later chapters introduce decorative surfaces.
const classicWorld = (name, background, route) => world(name, 'standard', background, ['solid', 'solid', 'solid'], route);

export const STORY_WORLDS = {
  1: classicWorld('Sunlit Garden', 'umbrella', 'corners'),
  2: classicWorld('Glasshouse', 'snow', 'gates'),
  3: classicWorld('Pop Playground', 'stadium', 'steps'),
  4: classicWorld('Shifting Dunes', 'desert', 'diagonals'),
  5: classicWorld('Prism Gallery', 'paris', 'diamonds'),
  6: classicWorld('Tidal Ruins', 'cave', 'channels'),
  7: classicWorld('Neon Speedway', 'shanghai', 'lanes'),
  8: classicWorld('Living Canopy', 'forest', 'branches'),
  9: classicWorld('Ember Foundry', 'fireplace', 'bastions'),
  10: classicWorld('Astral Crown', 'nebula', 'orbit'),

  // Chapter 2 · Every Size
  11: world('Pocket Meadow', 'pastel', 'forest', ['grass', 'polkaDots', 'matte'], 'corners'),
  12: world('Grid Station', 'mondrian', 'cobblestone', ['hexGrid', 'checkerboard', 'borderFrame'], 'gates', { visualMode: 'grid' }),
  13: world('Number Garden', 'saffron', 'lounge', ['dice', 'cornerAccent', 'innerDisc'], 'steps', { visualMode: 'sudokube' }),
  14: world('Glass Carousel', 'gemstone', 'stadium', ['holographic', 'stainedGlass', 'glossy'], 'diagonals', { visualMode: 'glass' }),
  15: world('Chrome Works', 'noire', 'shanghai', ['metallic', 'liquidChrome', 'carbonFiber'], 'diamonds', { visualMode: 'chrome' }),
  16: world('Sea of Seven', 'reef', 'cave', ['coralPolyps', 'water', 'ribbonEstuary'], 'lanes', { visualMode: 'gap' }),
  17: world('Launch Pad', 'sunset', 'desert', ['solar', 'sundial', 'sand'], 'channels'),
  18: world('Blast Yard', 'halloween', 'fireplace', ['shockwave', 'emberstorm', 'lava'], 'branches'),
  19: world('Neon Arcade', 'neon', 'paris', ['neonSign', 'pulse', 'quantumScanlines'], 'bastions', { visualMode: 'neon' }),
  20: world('Size Summit', 'artdeco', 'snow', ['snowGlobe', 'crystalGrowth', 'ice'], 'orbit'),

  // Chapter 3 · Strange Views
  21: world('Hollow Hills', 'forest', 'umbrella', ['wood', 'myceliumVeins', 'foldedHorizon'], 'bastions', { hollowMode: true }),
  22: world('Ghost Frame', 'midnight', 'blackhole', ['circuit', 'lichtenberg', 'neural'], 'gates', { visualMode: 'wireframe' }),
  23: world('Brick Town', 'standard', 'cobblestone', ['cafeWall', 'dominoDrift', 'crossPlus'], 'steps', { visualMode: 'lego' }),
  24: world('Biome Crossing', 'biome', 'desert', BIOME_STYLES, 'channels', { biome: true }),
  25: world('The Far Side', 'eclipse', 'nebula', ['rp2Geodesics', 'poincareDisk', 'hyperbolicWeave'], 'branches', { farSide: true }),
  26: world('Remix Hall', 'vaporwave', 'lounge', ['kaleidoBloom', 'prismaticFaults', 'dreamMarble'], 'lanes', { randomMode: true }),
  27: world('Neon Storm', 'aurora', 'shanghai', ['plasmaCells', 'auroraWeave', 'magnetFlux'], 'orbit', { visualMode: 'neon' }),
  28: world('Shatterglass', 'arctic', 'snow', ['rainGlass', 'oilSlick', 'irisTessellation'], 'lanes', { visualMode: 'glass' }),
  29: world('Number Siege', 'terracotta', 'stadium', ['compass', 'spiritLevel', 'sandChamber'], 'bastions', { visualMode: 'sudokube' }),
  30: world('Kaleidoscope', 'sakura', 'fireplace', ['opPinwheel', 'opRibbonTwist', 'moireRings'], 'orbit', { randomMode: true }),

  // Chapter 4 · Grand Crawl
  31: world('Nine Lives', 'tropical', 'forest', ['breathingScales', 'amoebaMosaic', 'chromaticCilia'], 'lanes'),
  32: world('Tenfold Tunnels', 'deepsea', 'paris', ['infinityTunnel', 'vortex', 'drosteSpiral'], 'diamonds'),
  33: world('Knife Edge', 'lava', 'umbrella', ['impossibleTriangle', 'endlessStairs', 'impossibleFork'], 'corners', { visualMode: 'gap' }),
  34: world('Chrome Gauntlet', 'cosmic', 'cave', ['liquidTank', 'lavaLamp', 'orbChamber'], 'orbit', { visualMode: 'chrome' }),
  35: world('Hollow Siege', 'bioluminescence', 'blackhole', ['eyeball', 'fingerprint', 'turing'], 'branches', { hollowMode: true }),
  36: world('Ghost Storm', 'inkwell', 'snow', ['skyCurtain', 'bowlerRain', 'dayOverNight'], 'lanes', { visualMode: 'wireframe' }),
  37: world('Brick Blast', 'retro', 'desert', ['liquidCheckers', 'velvetFolds', 'paradoxWeave'], 'bastions', { visualMode: 'lego' }),
  38: world('Mirror Numbers', 'noire', 'nebula', ['mobiusBand', 'neckerFlip', 'interlockingWings'], 'orbit', { visualMode: 'sudokube', farSide: true }),
  39: world('Mega Crawl', 'standard', 'fireplace', ['apollonian', 'circleInversion', 'hopfFibers'], 'lanes'),
  40: world('Eternal Remix', 'gemstone', 'shanghai', ['galaxy', 'gyroidSlice', 'lightCone'], 'orbit', { randomMode: true }),
};

// Face-local paths on the authored 5x5 footprint. Larger stages keep these
// routes centered so resources stay reachable within the existing time limits.
export const STORY_ORB_ROUTES = {
  corners: [[1,1],[3,1],[1,3],[3,3]],
  gates: [[0,1],[0,3],[4,1],[4,3]],
  steps: [[1,1],[2,1],[2,3],[3,3]],
  diagonals: [[0,0],[1,1],[3,3],[4,4]],
  diamonds: [[2,1],[1,2],[3,2],[2,3]],
  channels: [[0,1],[1,1],[2,1],[2,3],[3,3],[4,3]],
  lanes: [[0,1],[1,1],[2,1],[3,1],[0,3],[1,3],[2,3],[3,3]],
  branches: [[2,1],[2,2],[2,3],[2,4],[1,2],[3,2],[1,3],[3,3]],
  bastions: [[0,0],[1,0],[4,0],[4,1],[4,4],[3,4],[0,4],[0,3]],
  orbit: [[1,1],[2,1],[3,1],[3,2],[3,3],[2,3],[1,3],[1,2]],
};

const VISUAL_KEYS = ['colorScheme', 'customColors', 'backgroundTheme', 'manifoldStyles', 'biomeMode'];
// Store-level view flags a world may borrow. They are not settings, so they are
// saved and restored separately from the player's persisted look.
const VIEW_KEYS = ['visualMode', 'hollowMode', 'randomMode', 'showAntipodalPiP'];

export function storyAppearance(id) {
  const look = STORY_WORLDS[id];
  return look ? {
    colorScheme: look.palette, customColors: null, backgroundTheme: look.background,
    manifoldStyles: { ...look.styles }, biomeMode: { enabled: false, faceAssignment: null },
  } : null;
}

export function storyView(id) {
  const view = STORY_WORLDS[id]?.view;
  return view ? { visualMode: view.visualMode ?? 'classic', hollowMode: !!view.hollowMode,
    randomMode: !!view.randomMode, showAntipodalPiP: !!view.farSide } : null;
}

// Short player-facing name of a world's view, for level cards.
export function storyViewLabel(id) {
  const view = STORY_WORLDS[id]?.view ?? {};
  const names = { grid: 'Grid view', sudokube: 'Numbers view', wireframe: 'Wireframe', glass: 'Glass', chrome: 'Chrome',
    neon: 'Neon', gap: 'Gap view', lego: 'Bricks' };
  return [names[view.visualMode], view.hollowMode && 'Hollow', view.biome && 'Biome faces', view.randomMode && 'Random mode',
    view.farSide && 'Far-side window'].filter(Boolean).join(' · ');
}

export function persistentStorySettings(state) {
  return state.wormStoryVisualBase ? { ...state.settings, ...state.wormStoryVisualBase } : state.settings;
}

export function storyVisualChanges(state, id) {
  const appearance = storyAppearance(id);
  if (!appearance) return state.wormStoryVisualBase
    ? { settings: persistentStorySettings(state), wormStoryVisualBase: null, ...(state.wormStoryViewBase ?? {}), wormStoryViewBase: null } : {};
  const base = state.wormStoryVisualBase ?? Object.fromEntries(VISUAL_KEYS.map(key => [key, state.settings[key]]));
  const viewBase = state.wormStoryViewBase ?? Object.fromEntries(VIEW_KEYS.map(key => [key, state[key]]));
  return { wormStoryVisualBase: base, settings: { ...state.settings, ...appearance }, wormStoryViewBase: viewBase, ...storyView(id) };
}
