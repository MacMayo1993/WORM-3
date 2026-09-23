// Each chapter borrows a complete authored look; player cosmetics stay owned
// and equipped independently. Face/color IDs retain their gameplay meaning.
const world = (name, palette, background, styles, route) => ({
  name, palette, background, route,
  styles: Object.fromEntries(styles.map((style, i) => [i + 1, style])),
});

export const STORY_WORLDS = {
  1: world('Sunlit Garden', 'sakura', 'umbrella', ['wood', 'grass', 'matte', 'wood', 'grass', 'matte'], 'corners'),
  2: world('Glasshouse', 'arctic', 'snow', ['stainedGlass', 'rainGlass', 'glossy', 'stainedGlass', 'rainGlass', 'glossy'], 'gates'),
  3: world('Pop Playground', 'retro', 'stadium', ['comic', 'zigzag', 'polkaDots', 'comic', 'zigzag', 'polkaDots'], 'steps'),
  4: world('Shifting Dunes', 'terracotta', 'desert', ['topographic', 'sand', 'hexGrid', 'topographic', 'sand', 'hexGrid'], 'diagonals'),
  5: world('Prism Gallery', 'tropical', 'paris', ['prismBloom', 'opDiamondWave', 'stainedGlass', 'prismBloom', 'opDiamondWave', 'stainedGlass'], 'diamonds'),
  6: world('Tidal Ruins', 'deepsea', 'cave', ['water', 'waveform', 'pond', 'water', 'waveform', 'pond'], 'channels'),
  7: world('Neon Speedway', 'cyberpunk', 'shanghai', ['circuit', 'neonSign', 'hexGrid', 'circuit', 'neonSign', 'hexGrid'], 'lanes'),
  8: world('Living Canopy', 'bioluminescence', 'forest', ['bioLattice', 'wood', 'grass', 'bioLattice', 'wood', 'grass'], 'branches'),
  9: world('Ember Foundry', 'lava', 'fireplace', ['carbonFiber', 'metallic', 'lava', 'carbonFiber', 'metallic', 'lava'], 'bastions'),
  10: world('Astral Crown', 'cosmic', 'nebula', ['galaxy', 'constellation', 'stellarLensing', 'galaxy', 'constellation', 'stellarLensing'], 'orbit'),
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

export function storyAppearance(id) {
  const look = STORY_WORLDS[id];
  return look ? {
    colorScheme: look.palette, customColors: null, backgroundTheme: look.background,
    manifoldStyles: { ...look.styles }, biomeMode: { enabled: false, faceAssignment: null },
  } : null;
}

export function persistentStorySettings(state) {
  return state.wormStoryVisualBase ? { ...state.settings, ...state.wormStoryVisualBase } : state.settings;
}

export function storyVisualChanges(state, id) {
  const appearance = storyAppearance(id);
  if (!appearance) return state.wormStoryVisualBase
    ? { settings: persistentStorySettings(state), wormStoryVisualBase: null } : {};
  const base = state.wormStoryVisualBase ?? Object.fromEntries(VISUAL_KEYS.map(key => [key, state.settings[key]]));
  return { wormStoryVisualBase: base, settings: { ...state.settings, ...appearance } };
}
