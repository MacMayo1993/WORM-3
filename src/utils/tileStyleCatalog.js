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
  // Batch 2. compass / spiritLevel / snowGlobe are reactive: they read the tile's
  // live world orientation and the rotation energy, so the player's turns move
  // them rather than a clock.
  'compass', 'spiritLevel', 'snowGlobe', 'lichtenberg', 'rainGlass', 'pond',
  'sundial', 'crystalGrowth', 'cymatics', 'turing',
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

// The canonical pool for features that operate across the whole catalogue
// (notably every wizard's Random Mix). Derive it from the sections so adding a
// style to the picker automatically makes it eligible everywhere else too.
export const ALL_TILE_STYLE_KEYS = TILE_STYLE_SECTIONS.flatMap(section => section.keys);
