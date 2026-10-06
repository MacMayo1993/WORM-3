// Which tile styles move on their own: play ticks their time uniform and the
// tile previews redraw them, from this one list. A style animates when its
// fragment shader reads `time` (shaderModules.test.js holds the two together)
// or, like grass, when meshes mounted over it move.
// No Three import, so the preview renderer can read it without the materials.

import { LIVING_SURFACE_KEYS } from '../../utils/livingSurfaceCatalog.js';
import { CRAFTED_ANIMATED_KEYS } from './shaders/craftedShaders.js';

// Module-level Set: O(1) lookup instead of allocating an array + O(N) includes
// every time isAnimatedStyle is called (which happens per sticker per render).
const ANIMATED_STYLES = new Set([
  ...LIVING_SURFACE_KEYS,
  ...CRAFTED_ANIMATED_KEYS,
  'liquidCheckers', 'velvetFolds', 'dreamMarble', 'paradoxWeave',
  'holographic', 'pulse', 'lava', 'galaxy', 'circuit', 'grass', 'ice', 'sand', 'water', 'neural', 'solar',
  'moireRings', 'moireLines', 'infinityTunnel', 'vortex', 'shockwave',
  'oilSlick', 'constellation', 'waveform', 'dnaHelix', 'neonSign',
  'prismBloom', 'magnetFlux', 'liquidChrome', 'auroraWeave', 'plasmaCells',
  'quantumScanlines', 'emberstorm', 'fractalPulse', 'bioLattice', 'stellarLensing',
  'compass', 'spiritLevel', 'snowGlobe', 'lichtenberg', 'rainGlass', 'pond',
  'sundial', 'crystalGrowth', 'cymatics', 'turing',
  'orbChamber', 'liquidTank', 'dice', 'sandChamber', 'lavaLamp', 'eyeball',
  // Non-Euclidean (poincareDisk and apollonian are static — they stay out)
  'hyperbolicWeave', 'circleInversion', 'rp2Geodesics', 'solFlow', 'nilTwist',
  'lightCone', 'metricBalls', 'gyroidSlice', 'hopfFibers', 'drosteSpiral',
  // Impossible (triangle, fork and interlockingWings are static — they stay out)
  'endlessStairs', 'neckerFlip', 'mobiusBand',
  // Surreal (all six carry their own weather)
  'bowlerRain', 'dayOverNight', 'skyCurtain', 'paintedWindow', 'falseReflection', 'skyBird',
]);

/** Whether a style needs time updates (animated). */
export function isAnimatedStyle(style) {
  return ANIMATED_STYLES.has(style);
}
