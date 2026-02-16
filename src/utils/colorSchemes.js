// Color scheme presets and settings utilities

export const COLOR_SCHEMES = {
  standard:  { 1: '#ef4444', 2: '#22c55e', 3: '#ffffff', 4: '#f97316', 5: '#3b82f6', 6: '#eab308' },
  neon:      { 1: '#ff0066', 2: '#00ff99', 3: '#00ffff', 4: '#ff3300', 5: '#0099ff', 6: '#ffff00' },
  pastel:    { 1: '#f9a8b8', 2: '#a8f0c8', 3: '#f0f0f0', 4: '#ffc89a', 5: '#a8c8f0', 6: '#f0e8a0' },
  mono:      { 1: '#e0e0e0', 2: '#a0a0a0', 3: '#ffffff', 4: '#808080', 5: '#606060', 6: '#404040' },
  spiderman: { 1: '#e3001b', 2: '#0d47a1', 3: '#ffffff', 4: '#8b0000', 5: '#1565c0', 6: '#212121' },
  ocean:     { 1: '#0ea5e9', 2: '#14b8a6', 3: '#e0f2fe', 4: '#0284c7', 5: '#06b6d4', 6: '#164e63' },
  sunset:    { 1: '#ff6b6b', 2: '#ffa07a', 3: '#ffd89b', 4: '#ff8c42', 5: '#ff6348', 6: '#c44569' },
  forest:    { 1: '#a3b18a', 2: '#588157', 3: '#dad7cd', 4: '#6a994e', 5: '#386641', 6: '#bc6c25' },
  candy:     { 1: '#ff006e', 2: '#8338ec', 3: '#ffffff', 4: '#fb5607', 5: '#3a86ff', 6: '#ffbe0b' },
  retro:     { 1: '#d62828', 2: '#f77f00', 3: '#fcbf49', 4: '#bc4749', 5: '#003049', 6: '#eae2b7' },
};

// Available tile styles per manifold
export const TILE_STYLES = {
  // Classic (2D) — static, pattern, or procedural
  solid:       { label: 'Solid',        cost: 'low', type: 'static' },
  glossy:      { label: 'Glossy',       cost: 'low', type: 'static' },
  matte:       { label: 'Matte',        cost: 'low', type: 'static' },
  metallic:    { label: 'Metallic',     cost: 'low', type: 'static' },
  carbonFiber: { label: 'Carbon Fiber', cost: 'low', type: 'pattern' },
  hexGrid:     { label: 'Hex Grid',     cost: 'low', type: 'procedural' },
  comic:       { label: 'Comic Book',   cost: 'low', type: 'pattern' },
  cafeWall:    { label: 'Café Wall',    cost: 'low', type: 'pattern' },
  hermanGrid:  { label: 'Herman Grid',  cost: 'low', type: 'pattern' },
  opticSpin:   { label: 'Optic Spin',   cost: 'low', type: 'pattern' },
  ouchi:       { label: 'Ouchi',        cost: 'low', type: 'pattern' },
  // Living (3D / animated) — natural, elemental, or organic
  circuit:     { label: 'Circuit',      cost: 'med', type: '3d' },
  holographic: { label: 'Holographic',  cost: 'med', type: 'animated' },
  pulse:       { label: 'Pulse',        cost: 'med', type: 'animated' },
  lava:        { label: 'Lava',         cost: 'med', type: '3d' },
  galaxy:      { label: 'Galaxy',       cost: 'med', type: '3d' },
  grass:       { label: 'Grass',        cost: 'med', type: '3d' },
  ice:         { label: 'Ice',          cost: 'med', type: '3d' },
  sand:        { label: 'Sand',         cost: 'med', type: '3d' },
  water:       { label: 'Water',        cost: 'med', type: '3d' },
  wood:        { label: 'Wood',         cost: 'med', type: '3d' },
  neural:      { label: 'Neural',       cost: 'med', type: '3d' },
};

export const DEFAULT_SETTINGS = {
  colorScheme: 'standard',
  customColors: null,
  backgroundTheme: 'blackhole',
  showStats: true,
  showManifoldFooter: true,
  showFaceProgress: true,
  // Per-manifold tile styles
  manifoldStyles: {
    1: 'solid', // Front (Red)
    2: 'solid', // Left (Green)
    3: 'solid', // Top (White)
    4: 'solid', // Back (Orange)
    5: 'solid', // Right (Blue)
    6: 'solid', // Bottom (Yellow)
  },
};

export function resolveColors(settings) {
  if (settings.colorScheme === 'custom' && settings.customColors) {
    return { ...COLOR_SCHEMES.standard, ...settings.customColors };
  }
  return COLOR_SCHEMES[settings.colorScheme] || COLOR_SCHEMES.standard;
}
