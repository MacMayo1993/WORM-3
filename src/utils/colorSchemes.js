// Color scheme presets and settings utilities
// Face antipodal pairs: 1↔4  |  2↔5  |  3↔6
// High contrast within each pair is essential — the manifold flip reveals the opposite face

import { CITY_CONFIG, FACE_CITIES } from '../modes/CityBiomeMode.js';

export const COLOR_SCHEMES = {

  // Six face IDs stay stable; opposite faces are 1/4, 2/5 and 3/6.
  standard: { 1: '#DC3154', 2: '#38C875', 3: '#FFFFFF', 4: '#E98D06', 5: '#3973E8', 6: '#FFE600' },
  neon: { 1: '#FF477E', 2: '#37DD69', 3: '#9B79FF', 4: '#3EDBFF', 5: '#FEF138', 6: '#FF9C43' },
  pastel: { 1: '#FC4467', 2: '#2DC15B', 3: '#3692FD', 4: '#F4C263', 5: '#64D6F1', 6: '#CF91DD' },
  sunset: { 1: '#E85B76', 2: '#D29D17', 3: '#DFA3FC', 4: '#4CB6B0', 5: '#697EE1', 6: '#F6DBB7' },
  deepsea: { 1: '#368CBE', 2: '#D3A217', 3: '#CE70AA', 4: '#1BD3E7', 5: '#8A54FF', 6: '#F5DEBE' },
  lava: { 1: '#E7485D', 2: '#F8A72B', 3: '#F19AD9', 4: '#4CC5B1', 5: '#DCEEC2', 6: '#7290ED' },
  arctic: { 1: '#EAF5FA', 2: '#78B7E2', 3: '#EC80A4', 4: '#0EC06A', 5: '#A36DFF', 6: '#E5BC50' },
  forest: { 1: '#DE3F25', 2: '#2CB36A', 3: '#ECE6B6', 4: '#37C0FE', 5: '#BC80BC', 6: '#DC9E36' },
  cyberpunk: { 1: '#F34C9C', 2: '#8E79F6', 3: '#B6FB3B', 4: '#48DCD0', 5: '#FFB342', 6: '#EDE6FF' },
  cosmic: { 1: '#C25486', 2: '#677FE3', 3: '#F6EBC5', 4: '#58C6B4', 5: '#E09BE7', 6: '#E8A340' },
  sakura: { 1: '#F26F82', 2: '#5DA3EC', 3: '#EBEFCB', 4: '#27C68C', 5: '#C25DEC', 6: '#E9AC24' },
  tropical: { 1: '#FF4F96', 2: '#28CE9D', 3: '#FEED59', 4: '#60A1E9', 5: '#AD56EE', 6: '#F49C59' },
  aurora: { 1: '#D86BBE', 2: '#6472E7', 3: '#E2EFB7', 4: '#3DD76A', 5: '#68C8EA', 6: '#EAA13A' },
  halloween: { 1: '#E57638', 2: '#A446F0', 3: '#EBDD91', 4: '#61AB67', 5: '#F477D3', 6: '#779DE0' },
  retro: { 1: '#CD534C', 2: '#A25BC9', 3: '#F1E8B5', 4: '#0FD88D', 5: '#6BA4C7', 6: '#D8A23A' },
  midnight: { 1: '#7285DA', 2: '#E566AE', 3: '#56D4F8', 4: '#EA9D1A', 5: '#FCDEC8', 6: '#2BB571' },
  gemstone: { 1: '#DA5480', 2: '#3BB57C', 3: '#EDE964', 4: '#6392DD', 5: '#C357FD', 6: '#E59B4C' },
  mondrian: { 1: '#DF4561', 2: '#E1B82F', 3: '#F3EBDD', 4: '#4F8ED2', 5: '#25B372', 6: '#D475EB' },
  artdeco: { 1: '#DEEB3A', 2: '#409547', 3: '#DACAE9', 4: '#B85996', 5: '#6B9FCB', 6: '#DE974D' },
  noire: { 1: '#CD6483', 2: '#61A6D1', 3: '#EFE8D4', 4: '#D3AA47', 5: '#F596FC', 6: '#638F3C' },
  vaporwave: { 1: '#F77AAF', 2: '#A153DF', 3: '#EBE215', 4: '#42E2BC', 5: '#6CA5E8', 6: '#CF962D' },
  terracotta: { 1: '#CF625F', 2: '#49953F', 3: '#F6EBC3', 4: '#75A9C7', 5: '#F18FEC', 6: '#D5AA37' },
  bioluminescence: { 1: '#6FE793', 2: '#816FE6', 3: '#EFA94C', 4: '#EB75AC', 5: '#609F26', 6: '#79BAE6' },
  saffron: { 1: '#E6A32B', 2: '#D56889', 3: '#E3ECBF', 4: '#0D8CCB', 5: '#38C595', 6: '#9953EC' },
  eclipse: { 1: '#0B7EF0', 2: '#F74779', 3: '#F1E6C9', 4: '#D9A62C', 5: '#2ABCA5', 6: '#B291D9' },
  inkwell: { 1: '#6C92C4', 2: '#DB6073', 3: '#F7E3C4', 4: '#15D894', 5: '#F093FF', 6: '#D5A537' },
  reef: { 1: '#FE5A7A', 2: '#69B9D6', 3: '#E2F3C9', 4: '#5AA849', 5: '#C379F2', 6: '#E5AB52' },

  // ── BIOME SCHEME ─────────────────────────────────────────────────────────────
  biome: {
    1: CITY_CONFIG[FACE_CITIES[1]].pulseColor,
    2: CITY_CONFIG[FACE_CITIES[2]].pulseColor,
    3: CITY_CONFIG[FACE_CITIES[3]].pulseColor,
    4: CITY_CONFIG[FACE_CITIES[4]].pulseColor,
    5: CITY_CONFIG[FACE_CITIES[5]].pulseColor,
    6: CITY_CONFIG[FACE_CITIES[6]].pulseColor,
  },
};

// ── LABELS ───────────────────────────────────────────────────────────────────

export const SCHEME_LABELS = {
  standard:   'Standard',
  neon:       'Neon',
  pastel:     'Pastel',
  sunset:     'Sunset',
  deepsea:    'Deep Sea',
  lava:       'Lava',
  arctic:     'Arctic',
  forest:     'Forest',
  cyberpunk:  'Cyberpunk',
  cosmic:     'Cosmic',
  sakura:     'Sakura',
  tropical:   'Tropical',
  aurora:     'Aurora',
  halloween:  'Halloween',
  retro:      'Retro',
  midnight:   'Moonlight',
  gemstone:   'Gemstone',
  mondrian:   'Mondrian',
  artdeco:    'Art Deco',
  noire:      'Silver Screen',
  vaporwave:  'Vaporwave',
  terracotta: 'Terracotta',
  bioluminescence: 'Bioluminescence',
  saffron:    'Saffron',
  eclipse:    'Eclipse',
  inkwell:    'Pigment',
  reef:       'Reef',
  biome:      'City Biome',
  custom:     'Custom Upload',
};

// Browsing groups preserve palette IDs used by saved games and purchases.
export const PALETTE_GROUPS = ['All', 'Essentials', 'Electric', 'Soft', 'Jewel', 'Studio'];
export const PALETTE_INFO = {
  standard: { group: 'Essentials', description: 'Clean primaries' },
  neon: { group: 'Electric', description: 'Arcade brights' },
  pastel: { group: 'Soft', description: 'Candy colors' },
  sunset: { group: 'Jewel', description: 'Golden hour' },
  deepsea: { group: 'Jewel', description: 'Ocean glass' },
  lava: { group: 'Electric', description: 'Molten spectrum' },
  arctic: { group: 'Soft', description: 'Glacier light' },
  forest: { group: 'Jewel', description: 'Botanical color' },
  cyberpunk: { group: 'Electric', description: 'Laser arcade' },
  cosmic: { group: 'Jewel', description: 'Nebula gems' },
  sakura: { group: 'Soft', description: 'Blossom garden' },
  tropical: { group: 'Electric', description: 'Island brights' },
  aurora: { group: 'Electric', description: 'Polar lights' },
  halloween: { group: 'Jewel', description: 'Harvest magic' },
  retro: { group: 'Studio', description: 'Seventies print' },
  midnight: { group: 'Jewel', description: 'Moonlit color' },
  gemstone: { group: 'Jewel', description: 'Polished gems' },
  mondrian: { group: 'Essentials', description: 'Gallery primaries' },
  artdeco: { group: 'Studio', description: 'Gilded geometry' },
  noire: { group: 'Studio', description: 'Silver screen color' },
  vaporwave: { group: 'Electric', description: 'Poolside neon' },
  terracotta: { group: 'Studio', description: 'Clay and mineral' },
  bioluminescence: { group: 'Electric', description: 'Living light' },
  saffron: { group: 'Jewel', description: 'Spice market' },
  eclipse: { group: 'Jewel', description: 'Solar spectrum' },
  inkwell: { group: 'Studio', description: 'Pigment collection' },
  reef: { group: 'Soft', description: 'Coral garden' },
};

// ── TILE STYLES ───────────────────────────────────────────────────────────────

export const TILE_STYLES = {
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
  ouchi:              { label: 'Ouchi',              cost: 'low', type: 'pattern' },
  scintillatingGrid:  { label: 'Scintillating Grid', cost: 'low', type: 'pattern' },
  zoellner:           { label: 'Zöllner',            cost: 'low', type: 'pattern' },
  kanizsa:            { label: 'Kanizsa',            cost: 'low', type: 'pattern' },
  fraserSpiral:       { label: 'Fraser Spiral',      cost: 'low', type: 'pattern' },
  muellerLyer:        { label: 'Müller-Lyer',        cost: 'low', type: 'pattern' },
  rotatingSnakes:     { label: 'Rotating Snakes',    cost: 'low', type: 'pattern' },
  poggendorff:        { label: 'Poggendorff',        cost: 'low', type: 'pattern' },
  polkaDots:          { label: 'Polka Dots',         cost: 'low', type: 'pattern' },
  zigzag:             { label: 'Zigzag',             cost: 'low', type: 'pattern' },
  checkerboard:       { label: 'Tile Grout',         cost: 'low', type: 'pattern' },
  diagStripes:        { label: 'Diag Stripes',       cost: 'low', type: 'pattern' },
  cornerAccent:       { label: 'Corner Accent',      cost: 'low', type: 'pattern' },
  innerDisc:          { label: 'Inner Disc',         cost: 'low', type: 'pattern' },
  crossPlus:          { label: 'Cross',              cost: 'low', type: 'pattern' },
  borderFrame:        { label: 'Border Frame',       cost: 'low', type: 'pattern' },
  thinHatch:          { label: 'Crosshatch',         cost: 'low', type: 'pattern' },
  dotRing:            { label: 'Dot Ring',           cost: 'low', type: 'pattern' },
  opConcentric:       { label: 'Op Concentric',      cost: 'low', type: 'pattern' },
  opRadialSpokes:     { label: 'Op Radial Spokes',   cost: 'low', type: 'pattern' },
  opTiltMosaic:       { label: 'Op Tilt Mosaic',     cost: 'low', type: 'pattern' },
  opDiamondWave:      { label: 'Op Diamond Wave',    cost: 'low', type: 'pattern' },
  opBullseyeSteps:    { label: 'Op Bullseye Steps',  cost: 'low', type: 'pattern' },
  opWarpGrid:         { label: 'Op Warp Grid',       cost: 'low', type: 'pattern' },
  opChevronBands:     { label: 'Op Chevron Bands',   cost: 'low', type: 'pattern' },
  opInterferencePlaid:{ label: 'Op Interference',    cost: 'low', type: 'pattern' },
  opRibbonTwist:      { label: 'Op Ribbon Twist',    cost: 'low', type: 'pattern' },
  opPinwheel:         { label: 'Op Pinwheel',        cost: 'low', type: 'pattern' },
  moireRings:    { label: 'Moiré Rings',     cost: 'med', type: 'animated' },
  moireLines:    { label: 'Moiré Lines',     cost: 'med', type: 'animated' },
  infinityTunnel: { label: 'Infinity Tunnel', cost: 'med', type: 'animated' },
  vortex:        { label: 'Vortex',          cost: 'med', type: 'animated' },
  shockwave:     { label: 'Shockwave',       cost: 'med', type: 'animated' },
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
  solar:       { label: 'Solar',        cost: 'med', type: 'animated' },
  // New styles
  stainedGlass: { label: 'Stained Glass', cost: 'low', type: 'pattern' },
  fingerprint:  { label: 'Fingerprint',   cost: 'low', type: 'pattern' },
  topographic:  { label: 'Topographic',   cost: 'low', type: 'pattern' },
  mandelbrot:   { label: 'Mandelbrot',    cost: 'low', type: 'procedural' },
  penrose:      { label: 'Penrose',       cost: 'low', type: 'pattern' },
  oilSlick:     { label: 'Oil Slick',     cost: 'med', type: 'animated' },
  constellation: { label: 'Constellation', cost: 'med', type: 'animated' },
  waveform:     { label: 'Waveform',      cost: 'med', type: 'animated' },
  dnaHelix:     { label: 'DNA Helix',     cost: 'med', type: 'animated' },
  neonSign:     { label: 'Neon Sign',     cost: 'med', type: 'animated' },
  prismBloom:   { label: 'Prism Bloom',   cost: 'med', type: 'animated' },
  magnetFlux:   { label: 'Magnet Flux',   cost: 'med', type: 'animated' },
  compass:      { label: 'Compass',       cost: 'med', type: 'animated' },
  spiritLevel:  { label: 'Spirit Level',  cost: 'med', type: 'animated' },
  snowGlobe:    { label: 'Snow Globe',    cost: 'med', type: 'animated' },
  lichtenberg:  { label: 'Lichtenberg',   cost: 'med', type: 'animated' },
  rainGlass:    { label: 'Rain Glass',    cost: 'med', type: 'animated' },
  pond:         { label: 'Pond',          cost: 'low', type: 'animated' },
  sundial:      { label: 'Sundial',       cost: 'low', type: 'animated' },
  crystalGrowth: { label: 'Crystal Growth', cost: 'med', type: 'animated' },
  cymatics:     { label: 'Cymatics',      cost: 'med', type: 'animated' },
  liquidCheckers: { label: 'Liquid Checkers', cost: 'low', type: 'animated' },
  velvetFolds: { label: 'Velvet Folds', cost: 'low', type: 'animated' },
  dreamMarble: { label: 'Dream Marble', cost: 'low', type: 'animated' },
  paradoxWeave: { label: 'Paradox Weave', cost: 'low', type: 'animated' },
  turing:       { label: 'Turing',        cost: 'med', type: 'animated' },
  liquidChrome: { label: 'Liquid Chrome', cost: 'med', type: 'animated' },
  orbChamber:   { label: 'Orb Chamber',   cost: 'med', type: 'animated' },
  liquidTank:   { label: 'Liquid Tank',   cost: 'med', type: 'animated' },
  dice:         { label: 'Dice',          cost: 'med', type: 'animated' },
  sandChamber:  { label: 'Sand Chamber',  cost: 'med', type: 'animated' },
  lavaLamp:     { label: 'Lava Lamp',     cost: 'med', type: 'animated' },
  auroraWeave:  { label: 'Aurora Weave',  cost: 'med', type: 'animated' },
  plasmaCells:  { label: 'Plasma Cells',  cost: 'med', type: 'animated' },
  quantumScanlines: { label: 'Quantum Scanlines', cost: 'med', type: 'animated' },
  emberstorm:   { label: 'Emberstorm',    cost: 'med', type: 'animated' },
  fractalPulse: { label: 'Fractal Pulse', cost: 'med', type: 'animated' },
  bioLattice:   { label: 'Bio-Lattice',   cost: 'med', type: 'animated' },
  stellarLensing: { label: 'Stellar Lensing', cost: 'med', type: 'animated' },
  eyeball:        { label: 'Eyeball',         cost: 'med', type: 'animated' },
  // Non-Euclidean
  poincareDisk:    { label: 'Poincaré Disk',    cost: 'med', type: 'procedural' },
  hyperbolicWeave: { label: 'Hyperbolic Weave', cost: 'med', type: 'animated' },
  apollonian:      { label: 'Apollonian Gasket', cost: 'med', type: 'procedural' },
  circleInversion: { label: 'Circle Inversion', cost: 'low', type: 'animated' },
  rp2Geodesics:    { label: 'RP² Geodesics',    cost: 'med', type: 'animated' },
  solFlow:         { label: 'Sol Geometry',     cost: 'low', type: 'animated' },
  nilTwist:        { label: 'Nil Twist',        cost: 'low', type: 'animated' },
  lightCone:       { label: 'Light Cone',       cost: 'low', type: 'animated' },
  metricBalls:     { label: 'Metric Balls',     cost: 'low', type: 'animated' },
  gyroidSlice:     { label: 'Gyroid Slice',     cost: 'low', type: 'animated' },
  hopfFibers:      { label: 'Hopf Fibers',      cost: 'low', type: 'animated' },
  drosteSpiral:    { label: 'Droste Spiral',    cost: 'low', type: 'animated' },
  // Impossible objects
  impossibleTriangle: { label: 'Impossible Triangle', cost: 'med', type: 'procedural' },
  endlessStairs:      { label: 'Endless Stairs',      cost: 'med', type: 'animated' },
  impossibleFork:     { label: 'Impossible Fork',     cost: 'low', type: 'procedural' },
  neckerFlip:         { label: 'Necker Flip',         cost: 'low', type: 'animated' },
  mobiusBand:         { label: 'Möbius Band',         cost: 'med', type: 'animated' },
  interlockingWings:  { label: 'Interlocking Wings',  cost: 'low', type: 'procedural' },
  // Surreal
  bowlerRain:      { label: 'Bowler Rain',      cost: 'med', type: 'animated' },
  dayOverNight:    { label: 'Day Over Night',   cost: 'med', type: 'animated' },
  skyCurtain:      { label: 'Sky Curtain',      cost: 'med', type: 'animated' },
  paintedWindow:   { label: 'Painted Window',   cost: 'med', type: 'animated' },
  falseReflection: { label: 'False Reflection', cost: 'med', type: 'animated' },
  skyBird:         { label: 'Sky Bird',         cost: 'med', type: 'animated' },
};

export const DEFAULT_SETTINGS = {
  colorScheme: 'standard',
  customColors: null,
  backgroundTheme: 'blackhole',
  sfx: true,
  haptics: true,
  showStats: true,
  showManifoldFooter: true,
  showFaceProgress: true,
  manifoldStyles: {
    1: 'solid',
    2: 'solid',
    3: 'solid',
    4: 'solid',
    5: 'solid',
    6: 'solid',
  },
  biomeMode: {
    enabled: false,
    faceAssignment: null,
  },
};

export function resolveBiomeColors(userFaceAssignment = null) {
  const assignment = userFaceAssignment ?? FACE_CITIES;
  const colors = {};
  for (const [faceId, cityKey] of Object.entries(assignment)) {
    colors[Number(faceId)] = CITY_CONFIG[cityKey]?.pulseColor ?? '#ffffff';
  }
  return colors;
}

export function resolveColors(settings, biomeAssignment = null) {
  if (settings.colorScheme === 'custom' && settings.customColors) {
    return { ...COLOR_SCHEMES.standard, ...settings.customColors };
  }
  if (settings.colorScheme === 'biome') {
    return resolveBiomeColors(biomeAssignment);
  }
  return COLOR_SCHEMES[settings.colorScheme] || COLOR_SCHEMES.standard;
}
