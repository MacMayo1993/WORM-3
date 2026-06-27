// Whole-cube "view styles" shared by the game cube (Cubie) and the main-menu cube
// (MainMenu's ShuffleCubie). Pure helpers only — no React/Three imports — so importing
// them never drags heavy render modules into a consumer's bundle.

// The per-cubelet pool used by Random Mode and the main-menu cube. 'hollow' is excluded
// because it's a whole-cube structural mode that can't be mixed per cubelet.
export const PER_CUBELET_VIEW_STYLES = [
  'classic', 'grid', 'sudokube', 'wireframe', 'glass',
  'chrome', 'balloon', 'neon', 'gap', 'lego'
];

// Modes that draw glowing LED edges over the cubie body.
export const LED_EDGE_MODES = new Set(['wireframe', 'neon']);

// Deterministically map a cubelet (by its stable home position) + a cycle seed to one
// view style. Stable within a cycle so the look follows the physical piece through
// rotations; reshuffles when `tick` changes.
export function pickCubeletViewStyle(ox, oy, oz, tick, pool = PER_CUBELET_VIEW_STYLES) {
  let h = (ox * 73856093) ^ (oy * 19349663) ^ (oz * 83492791) ^ (tick * 2654435761);
  h = (h ^ (h >>> 13)) >>> 0;
  return pool[h % pool.length];
}

// Body material parameters per view style. The cubie "body" is the frame the stickers
// sit on; swapping its material is what gives chrome/neon/etc. their whole-cube identity.
// Callers layer any mode-specific transparency (e.g. wormMode) on top of these.
export function bodyMaterialProps(mode) {
  switch (mode) {
    case 'wireframe':
      return { color: '#000000', roughness: 0.9, metalness: 0, envMapIntensity: 0.4 };
    case 'glass':
      return { color: '#111111', roughness: 0.05, metalness: 0.3, envMapIntensity: 0.8, transparent: true, opacity: 0.12 };
    case 'chrome':
      return { color: '#d6d9dd', roughness: 0.06, metalness: 1.0, envMapIntensity: 1.25 };
    case 'neon':
      return { color: '#08080c', roughness: 0.3, metalness: 0.35, envMapIntensity: 0.5, emissive: '#0a0014', emissiveIntensity: 0.4 };
    case 'balloon': // shiny rubbery body behind the puffed dome tiles
      return { color: '#14141a', roughness: 0.12, metalness: 0.1, envMapIntensity: 0.9 };
    case 'lego': // glossy ABS plastic
      return { color: '#15151a', roughness: 0.35, metalness: 0.0, envMapIntensity: 0.6 };
    default: // classic, grid, sudokube, gap
      return { color: '#0a0a0a', roughness: 0.25, metalness: 0.15, envMapIntensity: 0.4 };
  }
}
