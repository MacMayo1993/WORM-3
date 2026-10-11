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

  // Chapter 5 · The Long Body
  41: world('Galley Deck', 'saffron', 'lounge', 'breathingScales', 'lanes'),
  42: world('Drill Yard', 'terracotta', 'stadium', 'elasticHoneycomb', 'steps'),
  43: world('Twin Hall', 'pastel', 'umbrella', 'pearlMembrane', 'gates'),
  44: world('Gearbox Gallery', 'retro', 'desert', 'livingContour', 'diagonals'),
  45: world('Mending Ward', 'sakura', 'paris', 'coralPolyps', 'diamonds', { visualMode: 'glass' }),
  46: world('Courier Run', 'sunset', 'shanghai', 'chromaticCilia', 'channels', { visualMode: 'neon' }),
  47: world('Core Antechamber', 'eclipse', 'nebula', 'myceliumVeins', 'orbit'),
  48: world('Spring Deck', 'tropical', 'forest', 'dnaHelix', 'branches'),
  49: world('Guard Post', 'forest', 'cobblestone', 'amoebaMosaic', 'bastions', { visualMode: 'grid' }),
  50: world('Listening Deck', 'aurora', 'snow', 'bioLattice', 'orbit'),

  // Chapter 6 · Pocket Worlds
  51: world('Sugar Cube', 'pastel', 'lounge', 'polkaDots', 'corners'),
  52: world('Closet Deck', 'retro', 'cobblestone', 'knit', 'corners', { visualMode: 'lego' }),
  53: world('Rope Locker', 'terracotta', 'desert', 'caneWebbing', 'steps'),
  54: world('Twin Locker', 'mondrian', 'paris', 'checkerboard', 'gates', { visualMode: 'grid' }),
  55: world('Tool Drawer', 'saffron', 'stadium', 'washi', 'diamonds'),
  56: world('Dice Deck', 'standard', 'umbrella', 'dice', 'corners', { visualMode: 'gap' }),
  57: world('Bottle Deck', 'deepsea', 'cave', 'pond', 'diagonals', { visualMode: 'glass' }),
  58: world('Snake Pit', 'halloween', 'fireplace', 'mosaic', 'corners'),
  59: world('Hangar Nook', 'artdeco', 'shanghai', 'quiltedSpace', 'channels', { visualMode: 'chrome' }),
  60: world('The Smallest Door', 'noire', 'blackhole', 'delftTile', 'corners'),

  // Chapter 7 · Weather of War
  61: world('Rain Deck', 'reef', 'umbrella', 'water', 'lanes'),
  62: world('Boiler Room', 'lava', 'fireplace', 'emberstorm', 'channels'),
  63: world('Burning Deck', 'halloween', 'desert', 'lavaLamp', 'diagonals'),
  64: world('Weather Vane', 'aurora', 'snow', 'auroraWeave', 'branches'),
  65: world('Conductor Deck', 'cyberpunk', 'shanghai', 'lichtenberg', 'gates', { visualMode: 'neon' }),
  66: world('Corps Laboratory', 'gemstone', 'lounge', 'cymatics', 'diamonds', { visualMode: 'glass' }),
  67: world('Storm Front', 'midnight', 'cave', 'plasmaCells', 'orbit'),
  68: world('Ice Deck', 'arctic', 'snow', 'ice', 'steps'),
  69: world('Lightning Rods', 'neon', 'nebula', 'magnetFlux', 'bastions'),
  70: world('Eye of the Storm', 'cosmic', 'blackhole', 'fractalPulse', 'orbit'),

  // Chapter 8 · The War Machine
  71: world('Grinding Deck', 'noire', 'cave', 'hammeredMetal', 'lanes', { visualMode: 'chrome' }),
  72: world('Blast Doors', 'lava', 'fireplace', 'shockwave', 'bastions'),
  73: world('Minefield', 'terracotta', 'desert', 'sand', 'branches'),
  74: world('Flight Deck', 'sunset', 'stadium', 'carbonFiber', 'lanes'),
  75: world('Crossfire Deck', 'cyberpunk', 'shanghai', 'circuit', 'diamonds', { visualMode: 'neon' }),
  76: world('The Fold', 'vaporwave', 'paris', 'foldedHorizon', 'steps'),
  77: world('Shrapnel Deck', 'retro', 'cobblestone', 'damascus', 'bastions'),
  78: world('Reactor Deck', 'bioluminescence', 'nebula', 'pulse', 'channels'),
  79: world('Repair Bay', 'noire', 'lounge', 'metallic', 'bastions', { visualMode: 'chrome' }),
  80: world('Engine Room', 'lava', 'blackhole', 'liquidChrome', 'orbit'),

  // Chapter 9 · Siege of the Core
  81: world('Rift Watch', 'midnight', 'blackhole', 'crystalGrowth', 'bastions'),
  82: world('Front Line', 'artdeco', 'stadium', 'kintsugi', 'lanes'),
  83: world('Ring of Fire', 'halloween', 'fireplace', 'emberstorm', 'orbit'),
  84: world('Long Wall', 'terracotta', 'cobblestone', 'cafeWall', 'lanes'),
  85: world('The Trenches', 'forest', 'cave', 'topographic', 'gates'),
  86: world('Breach Point', 'eclipse', 'nebula', 'stainedGlass', 'bastions'),
  87: world('Siege Works', 'retro', 'desert', 'cloisonne', 'channels'),
  88: world('Counter Deck', 'neon', 'shanghai', 'vortex', 'steps', { visualMode: 'neon' }),
  89: world('The Bastion', 'gemstone', 'stadium', 'penrose', 'bastions'),
  90: world('The First Door', 'cosmic', 'blackhole', 'eyeball', 'orbit'),

  // Chapter 10 · Mirror Decks
  91: world('Reflection Pool', 'deepsea', 'nebula', 'rp2Geodesics', 'gates', { farSide: true }),
  92: world('Glass Pantry', 'arctic', 'snow', 'falseReflection', 'diamonds', { visualMode: 'glass' }),
  93: world('Backwards Deck', 'inkwell', 'lounge', 'drosteSpiral', 'orbit', { visualMode: 'sudokube', farSide: true }),
  94: world('Ghost Deck', 'midnight', 'blackhole', 'neckerFlip', 'steps', { visualMode: 'wireframe' }),
  95: world('Hall of Mirrors', 'vaporwave', 'paris', 'rubinVase', 'bastions', { hollowMode: true }),
  96: world('Pocket Mirror', 'sakura', 'umbrella', 'dayOverNight', 'corners', { visualMode: 'gap' }),
  97: world('Inside-Out Deck', 'bioluminescence', 'cave', 'circleInversion', 'branches'),
  98: world('Echo Chamber', 'mondrian', 'stadium', 'opConcentric', 'diagonals', { visualMode: 'lego' }),
  99: world('Twin Strike', 'cyberpunk', 'shanghai', 'holographic', 'diamonds'),
  100: world('The Center Mirror', 'eclipse', 'nebula', 'mobiusBand', 'orbit', { farSide: true }),

  // Chapter 11 · The Mega Decks
  101: world('Cargo Hold', 'standard', 'stadium', 'galaxy', 'lanes'),
  102: world('Ring Corridor', 'deepsea', 'cave', 'hopfFibers', 'gates'),
  103: world('Big Wheel', 'artdeco', 'desert', 'sundial', 'diagonals'),
  104: world('Giant’s Pocket', 'saffron', 'umbrella', 'terrazzo', 'corners'),
  105: world('Freight Deck', 'tropical', 'shanghai', 'stellarLensing', 'channels'),
  106: world('Mega Storm', 'aurora', 'snow', 'constellation', 'branches'),
  107: world('Gun Deck', 'noire', 'fireplace', 'gyroidSlice', 'bastions'),
  108: world('Long Jump', 'sunset', 'paris', 'lightCone', 'steps'),
  109: world('Observation Deck', 'cosmic', 'nebula', 'sphericalTiling', 'bastions'),
  110: world('All Decks', 'gemstone', 'blackhole', 'poincareDisk', 'orbit'),

  // Chapter 12 · Through the Middle
  111: world('The Last Deck', 'eclipse', 'lounge', 'endlessStairs', 'lanes'),
  112: world('Pocket Gears', 'lava', 'cobblestone', 'impossibleTriangle', 'corners'),
  113: world('Corps Furnace', 'halloween', 'fireplace', 'emberstorm', 'channels'),
  114: world('Leaping Deck', 'tropical', 'forest', 'perpetualFall', 'steps'),
  115: world('Gear Gauntlet', 'retro', 'desert', 'hyperbolicWeave', 'diagonals', { visualMode: 'chrome' }),
  116: world('Ring Deck', 'gemstone', 'stadium', 'apollonian', 'bastions'),
  117: world('Swarm Deck', 'cyberpunk', 'shanghai', 'interlockingWings', 'branches', { visualMode: 'neon' }),
  118: world('Mirror Match', 'inkwell', 'nebula', 'horocycleFlow', 'diamonds', { farSide: true }),
  119: world('Eve of the End', 'midnight', 'blackhole', 'modularTiling', 'orbit'),
  120: world('The Core', 'standard', 'nebula', 'infinityTunnel', 'orbit'),
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
