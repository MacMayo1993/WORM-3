// Color scheme presets and settings utilities
// Face antipodal pairs: 1↔4  |  2↔5  |  3↔6
// High contrast within each pair is essential — the manifold flip reveals the opposite face

import { CITY_CONFIG, FACE_CITIES } from '../modes/CityBiomeMode.js';

export const COLOR_SCHEMES = {

  // Pair logic: 1↔4  2↔5  3↔6 — each antipodal pair is high contrast in hue or lightness
  // (the manifold flip reveals the opposite face), AND all six faces of a single cube
  // are mutually distinguishable. Every palette below is also visually distinct from
  // every other — near-duplicate themes were removed rather than left to confuse.

  standard:   { 1: '#ef4444', 2: '#22c55e', 3: '#ffffff', 4: '#f97316', 5: '#3b82f6', 6: '#FFD500' },

  // Neon — red↔green / cyan↔magenta / white↔yellow
  neon:       { 1: '#FF1111', 2: '#00E5FF', 3: '#F0F0FF', 4: '#00FF55', 5: '#FF00CC', 6: '#FFE600' },

  // Pastel — blush↔mint / periwinkle↔peach / white↔lilac
  pastel:     { 1: '#F9B3B3', 2: '#A6C2FF', 3: '#FAFAF5', 4: '#A8EDD0', 5: '#FFC98F', 6: '#EFA6E8' },

  // Sunset — crimson↔deep violet / coral↔soft lavender / pale gold sky↔warm amber
  sunset:     { 1: '#C82848', 2: '#FF7040', 3: '#FFF0B8', 4: '#5C1A88', 5: '#C0A8E0', 6: '#F0B840' },

  // Deep Sea — dark abyss↔hot coral / bioluminescent cyan↔phosphor green / seafoam↔gold
  deepsea:    { 1: '#081828', 2: '#00C8E0', 3: '#D8F8F0', 4: '#FF4878', 5: '#00FF88', 6: '#E8D048' },

  // Lava — deep lava↔volcanic night / molten orange↔ash grey / pale ash↔sulfur yellow
  lava:       { 1: '#AA1200', 2: '#FF6800', 3: '#E8D8B0', 4: '#182858', 5: '#909090', 6: '#FFD800' },

  // Arctic — ice white↔polar midnight / glacier blue↔aurora coral / aurora mint↔deep teal
  arctic:     { 1: '#F0F8FF', 2: '#80C8F0', 3: '#90E8C0', 4: '#0A2040', 5: '#FF7060', 6: '#0A6870' },

  // Forest — autumn red↔bright leaf / deep forest↔mist blue / birch cream↔bark gold
  forest:     { 1: '#C03020', 2: '#1A5830', 3: '#EEE8D8', 4: '#5AAA38', 5: '#8898D0', 6: '#C49040' },

  // Cyberpunk — hot pink↔electric cyan / neon violet↔neon lime / chrome↔amber
  cyberpunk:  { 1: '#FF0066', 2: '#9900FF', 3: '#C8D4E8', 4: '#00FFDD', 5: '#88FF00', 6: '#FFB800' },

  // Cosmic — nebula crimson↔quasar orange / azure↔star gold / starfield↔magenta nebula
  cosmic:     { 1: '#CC1050', 2: '#1840E8', 3: '#F8F8FF', 4: '#FF7800', 5: '#E8D030', 6: '#B01CC8' },

  // Sakura — cherry crimson↔spring green / sky blue↔warm gold / petal white↔wisteria
  sakura:     { 1: '#D82848', 2: '#4878C8', 3: '#FFF0F4', 4: '#70B848', 5: '#F0D880', 6: '#A860D0' },

  // Tropical — hibiscus↔ocean blue / turquoise↔palm green / sandy white↔sunshine
  tropical:   { 1: '#E51E4B', 2: '#00B8A0', 3: '#FFF3D8', 4: '#0E7CC0', 5: '#4CB020', 6: '#F8CE1C' },

  // Aurora — magenta↔electric green / deep violet↔electric cyan / polar sky↔aurora gold
  aurora:     { 1: '#D010A0', 2: '#5020C8', 3: '#E8F4FF', 4: '#00EE80', 5: '#30E8F0', 6: '#FFD020' },

  // Halloween — deep crimson↔forest green / pumpkin↔witch purple / bone white↔candle gold
  halloween:  { 1: '#A81808', 2: '#F58020', 3: '#F0EED0', 4: '#286820', 5: '#7020A0', 6: '#F0C030' },

  // Retro 70s — burnt sienna↔avocado / dusty mauve↔harvest gold / cream↔steel teal
  retro:      { 1: '#C84020', 2: '#805888', 3: '#F0E4C0', 4: '#789020', 5: '#D4B050', 6: '#385060' },

  // Midnight — deep royal blue↔star gold / violet↔pale silver / bright blue↔dark midnight
  midnight:   { 1: '#1C1CA8', 2: '#A030D0', 3: '#4C90E0', 4: '#E8D040', 5: '#C0C8E8', 6: '#201848' },

  // Gemstone — ruby↔emerald / sapphire↔amethyst / diamond↔topaz
  gemstone:   { 1: '#CC1830', 2: '#0E48D4', 3: '#F0F4FF', 4: '#1A8040', 5: '#A81CBE', 6: '#E0A020' },

  // Mondrian — primary red↔primary blue / cadmium yellow↔slate grey / off-white↔charcoal
  mondrian:   { 1: '#D01818', 2: '#F0C800', 3: '#F4F4F4', 4: '#1848C8', 5: '#7A7A7A', 6: '#303030' },

  // Art Deco — gold↔jade / warm ivory↔rich purple / cool silver↔dark midnight
  artdeco:    { 1: '#D4A020', 2: '#EFD69C', 3: '#A8BCD0', 4: '#1A7060', 5: '#7038A0', 6: '#303050' },

  // Noire — film noir: blood red↔antique gold / near-black↔steel blue / warm cream↔deep plum
  noire:        { 1: '#8B0000', 2: '#121212', 3: '#F0EDE4', 4: '#C4943A', 5: '#4A7A9B', 6: '#5C2A6A' },

  // Vaporwave — 80s retro-future: hot pink↔neon cyan / electric purple↔yellow / soft pink↔deep purple
  vaporwave:    { 1: '#FF2D78', 2: '#9D00FF', 3: '#FFB3D9', 4: '#00FFCC', 5: '#FFE556', 6: '#3A0CA3' },

  // Terracotta — earth & pottery: dark sienna↔sage / clay orange↔muted blue / sandy cream↔dark clay
  terracotta:   { 1: '#A84A18', 2: '#EC9868', 3: '#F6E8D2', 4: '#5C8A6B', 5: '#3D6B8A', 6: '#7B4B3A' },

  // Bioluminescence — deep-sea glow: phosphor cyan↔coral / deep navy↔neon green / electric teal↔deep violet
  bioluminescence: { 1: '#00FFC8', 2: '#0A0A2A', 3: '#4DEEEA', 4: '#FF2D6B', 5: '#39FF14', 6: '#7B2FBE' },

  // Saffron — Indian spice market: saffron orange↔deep indigo / deep red↔marigold / pale saffron↔burgundy
  saffron:      { 1: '#FF6B35', 2: '#C8102E', 3: '#FFE3A0', 4: '#1A3C6E', 5: '#F2B01A', 6: '#7B0D1E' },

  // Eclipse — solar corona at totality: deep space↔corona gold / eclipse red↔royal blue / solar white↔plasma violet
  eclipse:      { 1: '#1A1A2E', 2: '#E94560', 3: '#F8F9FA', 4: '#FFB627', 5: '#1060AA', 6: '#C77DFF' },

  // Inkwell — calligraphy & ink wash: ink black↔rice paper / ink blue↔vermillion / sienna↔malachite
  inkwell:      { 1: '#0D0D0D', 2: '#1B3A6B', 3: '#C2855F', 4: '#E8E0D5', 5: '#D64045', 6: '#3A5A3A' },

  // Reef — shallow tropical coral reef: coral pink↔deep reef blue / lagoon blue↔sandy beach / seafoam↔sea coral
  reef:         { 1: '#FF6B81', 2: '#00A8DC', 3: '#E6F7EC', 4: '#004A78', 5: '#F7C59F', 6: '#E9673F' },

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
  midnight:   'Midnight',
  gemstone:   'Gemstone',
  mondrian:   'Mondrian',
  artdeco:    'Art Deco',
  noire:      'Noire',
  vaporwave:  'Vaporwave',
  terracotta: 'Terracotta',
  bioluminescence: 'Bioluminescence',
  saffron:    'Saffron',
  eclipse:    'Eclipse',
  inkwell:    'Inkwell',
  reef:       'Reef',
  biome:      'City Biome',
  custom:     'Custom Upload',
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
