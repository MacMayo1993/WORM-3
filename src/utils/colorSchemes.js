// Color scheme presets and settings utilities
// Face antipodal pairs: 1↔4  |  2↔5  |  3↔6
// High contrast within each pair is essential — the manifold flip reveals the opposite face

import { CITY_CONFIG, FACE_CITIES } from '../modes/CityBiomeMode.js';

export const COLOR_SCHEMES = {

  // Pair logic: 1↔4  2↔5  3↔6 — each pair should be high contrast in hue or lightness

  standard:   { 1: '#ef4444', 2: '#22c55e', 3: '#ffffff', 4: '#f97316', 5: '#3b82f6', 6: '#eab308' },

  // Neon — red↔green / cyan↔magenta / white↔yellow
  neon:       { 1: '#FF1111', 2: '#00E5FF', 3: '#F0F0FF', 4: '#00FF55', 5: '#FF00CC', 6: '#FFE600' },

  // Pastel — blush↔mint / periwinkle↔peach / white↔lilac
  pastel:     { 1: '#F9B3B3', 2: '#B3C6FF', 3: '#FAFAF5', 4: '#A8EDD0', 5: '#FFDDB3', 6: '#E8B3F9' },

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

  // Candy — cherry↔lime / blueberry↔lemon / white↔grape
  candy:      { 1: '#FF2244', 2: '#4488FF', 3: '#FFFFFF', 4: '#22DD44', 5: '#FFCC00', 6: '#CC44FF' },

  // Cyberpunk — hot pink↔electric cyan / neon violet↔neon lime / chrome↔amber
  cyberpunk:  { 1: '#FF0066', 2: '#9900FF', 3: '#C8D4E8', 4: '#00FFDD', 5: '#88FF00', 6: '#FFB800' },

  // Cosmic — nebula crimson↔quasar orange / deep space↔star gold / starfield↔nebula purple
  cosmic:     { 1: '#CC1050', 2: '#0818C0', 3: '#F8F8FF', 4: '#FF7800', 5: '#E8D030', 6: '#8010D0' },

  // Sakura — cherry crimson↔spring green / sky blue↔warm gold / petal white↔wisteria
  sakura:     { 1: '#D82848', 2: '#4878C8', 3: '#FFF0F4', 4: '#70B848', 5: '#F0D880', 6: '#A860D0' },

  // Autumn — maple red↔forest green / burnt orange↔autumn sky / harvest cream↔golden yellow
  autumn:     { 1: '#C82010', 2: '#D06020', 3: '#F0E4C0', 4: '#2A6020', 5: '#6098C8', 6: '#E8B820' },

  // Tropical — hibiscus↔ocean blue / sunset orange↔palm green / sandy white↔sunshine
  tropical:   { 1: '#E02028', 2: '#FF6820', 3: '#FFF0D0', 4: '#1878C0', 5: '#28A040', 6: '#F8D020' },

  // Desert — canyon rust↔turquoise sky / sage↔dusk purple / bleached bone↔sand gold
  desert:     { 1: '#C04020', 2: '#60A068', 3: '#F4E8D0', 4: '#4888A8', 5: '#7048A0', 6: '#D8B060' },

  // Aurora — magenta↔electric green / deep violet↔electric cyan / polar sky↔aurora gold
  aurora:     { 1: '#D010A0', 2: '#5020C8', 3: '#E8F4FF', 4: '#00EE80', 5: '#30E8F0', 6: '#FFD020' },

  // Halloween — crimson↔forest green / pumpkin↔witch purple / bone white↔candle gold
  halloween:  { 1: '#C02010', 2: '#F07020', 3: '#F0EED0', 4: '#286820', 5: '#7020A0', 6: '#F0C030' },

  // Retro 70s — burnt sienna↔avocado / dusty mauve↔harvest gold / cream↔steel teal
  retro:      { 1: '#C84020', 2: '#805888', 3: '#F0E4C0', 4: '#789020', 5: '#D4B050', 6: '#385060' },

  // Midnight — deep royal blue↔star gold / violet↔pale silver / bright blue↔dark midnight
  midnight:   { 1: '#2020A8', 2: '#9030C0', 3: '#4888D8', 4: '#E8D040', 5: '#C0C8E8', 6: '#201848' },

  // Gemstone — ruby↔emerald / sapphire↔amethyst / diamond↔topaz
  gemstone:   { 1: '#CC1830', 2: '#1840A8', 3: '#F0F4FF', 4: '#1A8040', 5: '#8028B0', 6: '#E0A020' },

  // Sunrise — dawn rose↔deep sky / coral orange↔soft lavender / pale sky↔warm gold
  sunrise:    { 1: '#E84878', 2: '#FF7048', 3: '#E8F4FF', 4: '#2870C8', 5: '#B898D0', 6: '#F0C030' },

  // Watercolor — soft rose↔sage green / sky wash↔warm buff / washed white↔muted plum
  watercolor: { 1: '#E09898', 2: '#88B8E0', 3: '#F8F4EE', 4: '#90B878', 5: '#E8C898', 6: '#8A6898' },

  // Mondrian — primary red↔primary blue / cadmium yellow↔medium grey / off-white↔charcoal
  mondrian:   { 1: '#D01818', 2: '#F0C800', 3: '#F4F4F4', 4: '#1848C8', 5: '#A8A8A8', 6: '#303030' },

  // Art Deco — gold↔jade / ivory↔rich purple / platinum pearl↔dark midnight
  artdeco:    { 1: '#D4A020', 2: '#F0E0C0', 3: '#B8C8D8', 4: '#1A7060', 5: '#7038A0', 6: '#303050' },

  // Ghibli — warm rose↔forest green / sky blue↔golden wheat / soft white↔spirit lavender
  ghibli:     { 1: '#E88888', 2: '#58A0D0', 3: '#F4F0E8', 4: '#68AA58', 5: '#E8C870', 6: '#A898D4' },

  // Noire — film noir: blood red↔antique gold / near-black↔steel blue / warm cream↔deep plum
  noire:        { 1: '#8B0000', 2: '#121212', 3: '#F0EDE4', 4: '#C4943A', 5: '#4A7A9B', 6: '#5C2A6A' },

  // Vaporwave — 80s retro-future: hot pink↔neon cyan / electric purple↔yellow / soft pink↔deep purple
  vaporwave:    { 1: '#FF2D78', 2: '#9D00FF', 3: '#FFB3D9', 4: '#00FFCC', 5: '#FFE556', 6: '#3A0CA3' },

  // Terracotta — earth & pottery: burnt sienna↔sage / clay orange↔muted blue / sandy cream↔dark clay
  terracotta:   { 1: '#C4622D', 2: '#E8956D', 3: '#F2DFC8', 4: '#5C8A6B', 5: '#3D6B8A', 6: '#7B4B3A' },

  // Bioluminescence — deep-sea glow: phosphor cyan↔coral / deep navy↔neon green / electric teal↔deep violet
  bioluminescence: { 1: '#00FFC8', 2: '#0A0A2A', 3: '#4DEEEA', 4: '#FF2D6B', 5: '#39FF14', 6: '#7B2FBE' },

  // Nordic — Scandinavian winter: fjord blue↔birch amber / pine green↔nordic blue / snow↔bark brown
  nordic:       { 1: '#3B5998', 2: '#2D6A4F', 3: '#F0EFE8', 4: '#E8C98A', 5: '#7898B8', 6: '#6B5040' },

  // Saffron — Indian spice market: saffron orange↔deep indigo / deep red↔turmeric gold / golden yellow↔burgundy
  saffron:      { 1: '#FF6B35', 2: '#C8102E', 3: '#FF9F1C', 4: '#1A3C6E', 5: '#F5C518', 6: '#7B0D1E' },

  // Patina — aged metal oxidation: verdigris↔copper / bronze↔oxide blue / tarnished gold↔oxidized green
  patina:       { 1: '#2A9D8F', 2: '#8B5E3C', 3: '#E8D5A3', 4: '#C97B3A', 5: '#5B7FA6', 6: '#3D5A3E' },

  // Eclipse — solar corona at totality: deep space↔corona gold / eclipse red↔royal blue / solar white↔plasma violet
  eclipse:      { 1: '#1A1A2E', 2: '#E94560', 3: '#F8F9FA', 4: '#FFB627', 5: '#1060AA', 6: '#C77DFF' },

  // Inkwell — calligraphy & ink wash: ink black↔rice paper / ink blue↔vermillion / sienna↔malachite
  inkwell:      { 1: '#0D0D0D', 2: '#1B3A6B', 3: '#C2855F', 4: '#E8E0D5', 5: '#D64045', 6: '#3A5A3A' },

  // Reef — shallow tropical coral reef: coral pink↔ocean blue / turquoise↔sandy beach / sea-foam↔sea coral
  reef:         { 1: '#FF6B81', 2: '#00B4D8', 3: '#90E0EF', 4: '#0077B6', 5: '#F7C59F', 6: '#E76F51' },

  // Manuscript — illuminated books: carmine↔viridian / ultramarine↔gold leaf / parchment↔royal purple
  manuscript:   { 1: '#9B1B30', 2: '#1B4A8A', 3: '#F8F0DC', 4: '#2D7A3A', 5: '#D4A520', 6: '#6B1F78' },

  // Carnival — bright fairground: cherry red↔royal blue / carnival gold↔deep purple / white↔carnival green
  carnival:     { 1: '#E8192C', 2: '#F5A820', 3: '#F8F8F8', 4: '#1050CC', 5: '#8A00AB', 6: '#0AAF4A' },

  // Wabi-Sabi — Japanese aesthetics: clay red↔indigo / moss↔sand / rice paper↔wisteria
  wabisabi:     { 1: '#8B3A2A', 2: '#4A6840', 3: '#F0E8D8', 4: '#2A4A5A', 5: '#C8A878', 6: '#5A3A6A' },

  // Tidepool — coastal: starfish red↔sandy orange / ocean blue↔anemone teal / sea foam↔urchin purple
  tidepool:     { 1: '#C8183C', 2: '#0070B8', 3: '#F0F8E8', 4: '#E88020', 5: '#1A8878', 6: '#6838A8' },

  // Hammam — Turkish mosaic: ruby↔emerald / turquoise↔copper / ivory↔deep purple
  hammam:       { 1: '#B01830', 2: '#1A6898', 3: '#F4E8C0', 4: '#28784A', 5: '#C8701C', 6: '#5A2878' },

  // Savanna — African plains: red earth↔waterhole blue / savanna green↔golden grass / bleached bone↔dusk purple
  savanna:      { 1: '#C43C1C', 2: '#507830', 3: '#F8F0D8', 4: '#1A4060', 5: '#E8A830', 6: '#5A2060' },

  // Studio — artist's palette: cadmium red↔sap green / ultramarine↔yellow ochre / titanium white↔dioxazine purple
  studio:       { 1: '#C01830', 2: '#1A5490', 3: '#F2EDD8', 4: '#4A8828', 5: '#F0A020', 6: '#6A2888' },

  // Deepspace — cosmic: nebula crimson↔solar flare / deep space↔exoplanet teal / starlight↔nebula purple
  deepspace:    { 1: '#CC1040', 2: '#0D1B3A', 3: '#F8F8FF', 4: '#FF8C14', 5: '#00C8A0', 6: '#8C30C8' },

  // Stormfront — dramatic weather: storm red↔amber alert / navy↔storm green / pale cloud↔storm violet
  stormfront:   { 1: '#8C1A24', 2: '#2A4070', 3: '#E8F0F4', 4: '#D06820', 5: '#5AAA38', 6: '#5C2A8C' },

  // Ember — glowing fire: deep ember↔cold midnight / molten orange↔smoke teal / pale ash↔ember purple
  ember:        { 1: '#B81C1C', 2: '#E87720', 3: '#FCF0D8', 4: '#0E2B4A', 5: '#2A8A7A', 6: '#6B2D8B' },

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
  candy:      'Candy',
  cyberpunk:  'Cyberpunk',
  cosmic:     'Cosmic',
  sakura:     'Sakura',
  autumn:     'Autumn',
  tropical:   'Tropical',
  desert:     'Desert',
  aurora:     'Aurora',
  halloween:  'Halloween',
  retro:      'Retro',
  midnight:   'Midnight',
  gemstone:   'Gemstone',
  sunrise:    'Sunrise',
  watercolor: 'Watercolor',
  mondrian:   'Mondrian',
  artdeco:    'Art Deco',
  ghibli:     'Ghibli',
  manuscript: 'Manuscript',
  carnival:   'Carnival',
  wabisabi:   'Wabi-Sabi',
  tidepool:   'Tidepool',
  hammam:     'Hammam',
  savanna:    'Savanna',
  studio:     'Studio',
  deepspace:  'Deep Space',
  stormfront: 'Stormfront',
  ember:      'Ember',
  biome:      'City Biome',
  noire:      'Noire',
  vaporwave:  'Vaporwave',
  terracotta: 'Terracotta',
  bioluminescence: 'Bioluminescence',
  nordic:     'Nordic',
  saffron:    'Saffron',
  patina:     'Patina',
  eclipse:    'Eclipse',
  inkwell:    'Inkwell',
  reef:       'Reef',
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
  auroraWeave:  { label: 'Aurora Weave',  cost: 'med', type: 'animated' },
  plasmaCells:  { label: 'Plasma Cells',  cost: 'med', type: 'animated' },
  quantumScanlines: { label: 'Quantum Scanlines', cost: 'med', type: 'animated' },
  emberstorm:   { label: 'Emberstorm',    cost: 'med', type: 'animated' },
  fractalPulse: { label: 'Fractal Pulse', cost: 'med', type: 'animated' },
  bioLattice:   { label: 'Bio-Lattice',   cost: 'med', type: 'animated' },
  stellarLensing: { label: 'Stellar Lensing', cost: 'med', type: 'animated' },
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
