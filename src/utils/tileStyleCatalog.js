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

export const TILE_STYLE_SECTIONS = [
  { key: 'classic', label: 'Classic', keys: CLASSIC_STYLE_KEYS },
  { key: 'antipodal', label: 'Antipodal Op Art', keys: ANTIPODAL_STYLE_KEYS },
  { key: 'living', label: 'Living', keys: LIVING_STYLE_KEYS },
  { key: 'nonEuclidean', label: 'Non-Euclidean', keys: NON_EUCLIDEAN_STYLE_KEYS },
];
