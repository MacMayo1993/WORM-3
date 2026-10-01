// Each level uses one authored tile style on all six faces. Face colors keep
// their gameplay meaning, while previews, retries and play share a stable look.
// Alternate cube views and backgrounds still give each level its own setting.
const world = (name, palette, background, style, route, view = {}) => ({
  name, palette, background, route, view,
  styles: Object.fromEntries([1, 2, 3, 4, 5, 6].map(face => [face, style])),
});
// Plain opening levels keep movement, rotations and healing easy to read.
const classicWorld = (name, background, route) => world(name, 'standard', background, 'solid', route);

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
  11: world('Pocket Meadow', 'pastel', 'forest', 'grass', 'corners'),
  12: world('Grid Station', 'mondrian', 'cobblestone', 'hexGrid', 'gates', { visualMode: 'grid' }),
  13: world('Number Garden', 'saffron', 'lounge', 'dice', 'steps', { visualMode: 'sudokube' }),
  14: world('Glass Carousel', 'gemstone', 'stadium', 'holographic', 'diagonals', { visualMode: 'glass' }),
  15: world('Chrome Works', 'noire', 'shanghai', 'metallic', 'diamonds', { visualMode: 'chrome' }),
  16: world('Sea of Seven', 'reef', 'cave', 'coralPolyps', 'lanes'),
  17: world('Launch Pad', 'sunset', 'desert', 'solar', 'channels'),
  18: world('Blast Yard', 'halloween', 'fireplace', 'shockwave', 'branches'),
  19: world('Neon Arcade', 'neon', 'paris', 'neonSign', 'bastions', { visualMode: 'neon' }),
  20: world('Size Summit', 'artdeco', 'snow', 'snowGlobe', 'orbit'),

  // Chapter 3 · Strange Views
  21: world('Hollow Hills', 'forest', 'umbrella', 'wood', 'bastions', { hollowMode: true }),
  22: world('Ghost Frame', 'midnight', 'blackhole', 'circuit', 'gates', { visualMode: 'wireframe' }),
  23: world('Brick Town', 'standard', 'cobblestone', 'cafeWall', 'steps', { visualMode: 'lego' }),
  24: world('Biome Crossing', 'biome', 'desert', 'water', 'channels', { biome: true }),
  25: world('The Far Side', 'eclipse', 'nebula', 'rp2Geodesics', 'branches', { farSide: true }),
  26: world('Prism Hall', 'vaporwave', 'lounge', 'solid', 'lanes'),
  27: world('Neon Storm', 'aurora', 'shanghai', 'plasmaCells', 'orbit', { visualMode: 'neon' }),
  28: world('Shatterglass', 'arctic', 'snow', 'rainGlass', 'lanes', { visualMode: 'glass' }),
  29: world('Number Siege', 'terracotta', 'stadium', 'compass', 'bastions', { visualMode: 'sudokube' }),
  30: world('Kaleidoscope', 'sakura', 'fireplace', 'solid', 'orbit'),

  // Chapter 4 · Grand Crawl
  31: world('Nine Lives', 'tropical', 'forest', 'breathingScales', 'lanes'),
  32: world('Tenfold Tunnels', 'deepsea', 'paris', 'infinityTunnel', 'diamonds'),
  33: world('Knife Edge', 'lava', 'umbrella', 'impossibleTriangle', 'corners', { visualMode: 'gap' }),
  34: world('Chrome Gauntlet', 'cosmic', 'cave', 'liquidTank', 'orbit', { visualMode: 'chrome' }),
  35: world('Hollow Siege', 'bioluminescence', 'blackhole', 'eyeball', 'branches', { hollowMode: true }),
  36: world('Ghost Storm', 'inkwell', 'snow', 'skyCurtain', 'lanes', { visualMode: 'wireframe' }),
  37: world('Brick Blast', 'retro', 'desert', 'liquidCheckers', 'bastions', { visualMode: 'lego' }),
  38: world('Mirror Numbers', 'noire', 'nebula', 'mobiusBand', 'orbit', { visualMode: 'sudokube', farSide: true }),
  39: world('Mega Crawl', 'standard', 'fireplace', 'apollonian', 'lanes'),
  40: world('Eternal Crown', 'gemstone', 'shanghai', 'solid', 'orbit'),
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
    randomMode: false, showAntipodalPiP: !!view.farSide } : null;
}

// Short player-facing name of a world's view, for level cards.
export function storyViewLabel(id) {
  const view = STORY_WORLDS[id]?.view ?? {};
  const names = { grid: 'Grid view', sudokube: 'Numbers view', wireframe: 'Wireframe', glass: 'Glass', chrome: 'Chrome',
    neon: 'Neon', gap: 'Gap view', lego: 'Bricks' };
  return [names[view.visualMode], view.hollowMode && 'Hollow', view.biome && 'Biome palette',
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
