export const CLASSIC_STYLE_KEYS = [
  'solid', 'glossy', 'matte', 'metallic', 'carbonFiber', 'hexGrid', 'comic',
  'cafeWall', 'hermanGrid', 'opticSpin', 'ouchi', 'scintillatingGrid',
  'zoellner', 'kanizsa', 'fraserSpiral', 'muellerLyer', 'rotatingSnakes', 'poggendorff',
  'stainedGlass', 'fingerprint', 'topographic', 'mandelbrot', 'penrose',
];

export const ANTIPODAL_STYLE_KEYS = [
  'polkaDots', 'zigzag', 'checkerboard', 'diagStripes',
  'cornerAccent', 'innerDisc', 'crossPlus', 'borderFrame', 'thinHatch', 'dotRing',
  'opConcentric', 'opRadialSpokes', 'opTiltMosaic', 'opDiamondWave', 'opBullseyeSteps',
  'opWarpGrid', 'opChevronBands', 'opInterferencePlaid', 'opRibbonTwist', 'opPinwheel',
  'waveform', 'dnaHelix',
];

export const LIVING_STYLE_KEYS = [
  'grass', 'ice', 'sand', 'water', 'wood', 'circuit', 'holographic', 'pulse',
  'lava', 'galaxy', 'neural', 'moireRings', 'moireLines', 'infinityTunnel',
  'vortex', 'shockwave', 'solar',
  'oilSlick', 'constellation', 'neonSign',
  'prismBloom', 'magnetFlux', 'liquidChrome', 'orbChamber', 'liquidTank', 'dice', 'sandChamber', 'lavaLamp', 'eyeball', 'auroraWeave', 'plasmaCells',
  'quantumScanlines', 'emberstorm', 'fractalPulse', 'bioLattice', 'stellarLensing',
];

// Tiles drawn in geometries that are not the flat plane — hyperbolic, elliptic,
// inversive, Minkowski, and the Thurston geometries. See nonEuclideanShaders.js.
export const NON_EUCLIDEAN_STYLE_KEYS = [
  'poincareDisk', 'hyperbolicWeave', 'apollonian', 'circleInversion',
  'rp2Geodesics', 'solFlow', 'nilTwist', 'lightCone',
  'metricBalls', 'gyroidSlice', 'hopfFibers', 'drosteSpiral',
];

// Impossible objects — figures a flat drawing accepts and a solid world refuses.
// The tribar and endless staircase are real solids ray-cast from the one angle
// that makes them lie; the rest are line-art illusions. See impossibleShaders.js.
export const IMPOSSIBLE_STYLE_KEYS = [
  'impossibleTriangle', 'endlessStairs', 'impossibleFork',
  'neckerFlip', 'mobiusBand', 'interlockingWings',
];

// Surreal — ordinary scenes with exactly one rule of the world withdrawn, each
// picture going on as though it hadn't. The Magritte side of the same argument
// the impossible figures make. See surrealShaders.js.
export const SURREAL_STYLE_KEYS = [
  'bowlerRain', 'dayOverNight', 'skyCurtain',
  'paintedWindow', 'falseReflection', 'skyBird',
];

export const TILE_STYLE_SECTIONS = [
  { key: 'classic', label: 'Classic', keys: CLASSIC_STYLE_KEYS },
  { key: 'antipodal', label: 'Antipodal Op Art', keys: ANTIPODAL_STYLE_KEYS },
  { key: 'living', label: 'Living', keys: LIVING_STYLE_KEYS },
  { key: 'nonEuclidean', label: 'Non-Euclidean', keys: NON_EUCLIDEAN_STYLE_KEYS },
  { key: 'impossible', label: 'Impossible', keys: IMPOSSIBLE_STYLE_KEYS },
  { key: 'surreal', label: 'Surreal', keys: SURREAL_STYLE_KEYS },
];
