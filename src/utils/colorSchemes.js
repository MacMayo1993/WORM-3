import { LIVING_SURFACE_STYLES } from './livingSurfaceCatalog.js';
// Color scheme presets and settings utilities.
//
// Every preset is six named colours drawn from its theme: Lava is magma, crimson,
// white heat, basalt, molten gold and ash, not a rainbow wearing a volcanic name.
// Within that theme a preset stays playable (paletteQuality.test.js holds it):
//  - all 15 face pairs are clearly apart (OKLab distance ≥ 0.18);
//  - opposite faces 1↔4, 2↔5, 3↔6 are counterparts at ≥ 0.22, so a flipped
//    tile stands out against its face (Classic and City Biome keep the Rubik's
//    sibling pairs instead: red/orange, green/blue, white/yellow);
//  - no tile is dark enough to sink into the black plastic (OKLab L > 0.45);
//  - no two palettes read as the same set.

import { CITY_CONFIG, FACE_CITIES } from '../modes/CityBiomeMode.js';
import { FACE_COLORS } from './constants.js';

// Faces 1–3 on the first row, their opposite faces 4–6 beneath, so each column
// is an antipodal pair. Face 1 is the palette's signature colour (glows, world tints).
const PRESETS = {
  neon: [
    ['#FF2E93', 'Hot Pink'], ['#00E1FF', 'Electric Cyan'], ['#FFF264', 'Sign Yellow'],
    ['#28FF54', 'Tube Green'], ['#FF7F11', 'Neon Orange'], ['#A64DFF', 'Laser Violet']],
  pastel: [
    ['#FF6BAC', 'Bubblegum'], ['#67C4FF', 'Blue Raspberry'], ['#FFF999', 'Lemon Drop'],
    ['#51E59D', 'Spearmint'], ['#FFA760', 'Orange Sherbet'], ['#A87AFF', 'Grape']],
  sunset: [
    ['#FF8424', 'Tangerine'], ['#FC3D89', 'Flamingo'], ['#FFD862', 'Sun Gold'],
    ['#434DA7', 'Twilight'], ['#C9D3FF', 'Evening Sky'], ['#A75AE0', 'Dusk Violet']],
  deepsea: [
    ['#008EF7', 'Ocean Blue'], ['#009C84', 'Teal'], ['#8FE8F0', 'Sunlit Aqua'],
    ['#F2E85C', 'Lure Glow'], ['#F29AC8', 'Moon Jelly'], ['#3B50A6', 'Abyss']],
  lava: [
    ['#FF6C21', 'Magma'], ['#C5132B', 'Crimson'], ['#FFF6E3', 'White Heat'],
    ['#5B5563', 'Basalt'], ['#FFC218', 'Molten Gold'], ['#A09D9B', 'Ash']],
  arctic: [
    ['#0F64D5', 'Polar Blue'], ['#79D2FF', 'Sea Ice'], ['#F9FAFC', 'Snow'],
    ['#F2C95C', 'Midnight Sun'], ['#FF8DAB', 'Alpenglow'], ['#7F8794', 'Slate']],
  forest: [
    ['#48AC54', 'Fern'], ['#954400', 'Bark'], ['#F4ECD5', 'Birch'],
    ['#F72322', 'Toadstool'], ['#B5DD37', 'New Leaf'], ['#006A48', 'Pine']],
  cyberpunk: [
    ['#FF2A6D', 'Hot Magenta'], ['#7A30F0', 'Electric Violet'], ['#E4EAF6', 'Chrome'],
    ['#00D4E3', 'Cyan'], ['#F2F20C', 'Acid Yellow'], ['#0B7C91', 'Dark Teal']],
  cosmic: [
    ['#D93BAA', 'Magenta Nebula'], ['#25BFB3', 'Teal Nebula'], ['#EFF2FF', 'Starlight'],
    ['#F3B837', 'Stardust'], ['#F6A1C9', 'Rose Nebula'], ['#3553C7', 'Deep Space']],
  sakura: [
    ['#FFA2C0', 'Blossom'], ['#6BBF54', 'Spring Leaf'], ['#FFF4F7', 'Petal White'],
    ['#7B4559', 'Cherry Bark'], ['#7CC4FF', 'Spring Sky'], ['#DA477F', 'Fuchsia']],
  tropical: [
    ['#EF2D5E', 'Hibiscus'], ['#17C5CB', 'Lagoon'], ['#FFE351', 'Pineapple'],
    ['#189948', 'Palm'], ['#FE9000', 'Mango'], ['#1D63C9', 'Ocean']],
  aurora: [
    ['#1FEA78', 'Aurora Green'], ['#9152FC', 'Violet'], ['#E8F8AF', 'Pale Glow'],
    ['#F04A78', 'Crimson Crown'], ['#1FB8C4', 'Teal'], ['#3351A9', 'Night Sky']],
  halloween: [
    ['#FF7A1A', 'Pumpkin'], ['#7ED321', 'Slime'], ['#F4F1E6', 'Ghost'],
    ['#7B3FC4', 'Witch Purple'], ['#C0182F', 'Blood Red'], ['#7D7F87', 'Tombstone']],
  retro: [
    ['#D9622B', 'Burnt Orange'], ['#FDAD00', 'Harvest Gold'], ['#F7EDCE', 'Cream'],
    ['#008A94', 'Teal'], ['#7B4B31', 'Chocolate'], ['#899B00', 'Avocado']],
  midnight: [
    ['#3D83FF', 'Moonlit Blue'], ['#BDA8F1', 'Lavender'], ['#F5F2E6', 'Moon Pearl'],
    ['#E6BA4D', 'Moon Gold'], ['#21978F', 'Night Teal'], ['#484F9C', 'Midnight']],
  gemstone: [
    ['#D6124F', 'Ruby'], ['#0E53D7', 'Sapphire'], ['#E8F4FF', 'Diamond'],
    ['#16A661', 'Emerald'], ['#F5B81C', 'Citrine'], ['#A04DE6', 'Amethyst']],
  mondrian: [
    ['#D7261E', 'Red'], ['#FAD304', 'Yellow'], ['#F4F2EC', 'White'],
    ['#1F5CCC', 'Blue'], ['#A7A7A8', 'Gray'], ['#595858', 'Charcoal']],
  artdeco: [
    ['#DBB100', 'Gilt'], ['#1E9E72', 'Jade'], ['#F4ECD6', 'Ivory'],
    ['#1854C5', 'Lapis'], ['#FF6B5A', 'Coral'], ['#5D5756', 'Onyx']],
  noire: [
    ['#D01E3C', 'Lipstick'], ['#F2C342', 'Gold'], ['#F8F6ED', 'Pearl'],
    ['#00945E', 'Emerald'], ['#575762', 'Gunmetal'], ['#A6ABB6', 'Silver']],
  vaporwave: [
    ['#FF82CA', 'Hot Pink'], ['#01CDFE', 'Pool Cyan'], ['#FFFBAF', 'Pale Yellow'],
    ['#00FDA0', 'Mint'], ['#B25DFF', 'Lavender'], ['#543BBC', 'Indigo']],
  terracotta: [
    ['#D55824', 'Terracotta'], ['#2E5FB0', 'Cobalt'], ['#F7EFDD', 'Adobe'],
    ['#39AFA9', 'Turquoise'], ['#DEA3A4', 'Clay Rose'], ['#71503D', 'Umber']],
  bioluminescence: [
    ['#2DD9FF', 'Plankton Blue'], ['#D8FF6F', 'Firefly'], ['#11DA76', 'Foxfire'],
    ['#FF4FD2', 'Jellyfish'], ['#8B71FF', 'Glow Violet'], ['#0059BE', 'Abyss Blue']],
  saffron: [
    ['#F29C00', 'Saffron'], ['#C02E0B', 'Paprika'], ['#FFEA92', 'Turmeric'],
    ['#3D4EA9', 'Indigo'], ['#70B415', 'Cardamom'], ['#E77097', 'Rose Petal']],
  eclipse: [
    ['#F5B400', 'Ring of Fire'], ['#F2067E', 'Prominence'], ['#F4F6FF', 'Corona'],
    ['#454AAB', 'Umbra'], ['#2BA7B0', 'Twilight'], ['#A84C2F', 'Blood Moon']],
  // The printer's six: cyan, magenta and yellow inks and the red, green and blue
  // they overprint to, so every face sits opposite its complement.
  inkwell: [
    ['#CC007F', 'Magenta'], ['#009FE3', 'Cyan'], ['#FFED00', 'Yellow'],
    ['#00A651', 'Green'], ['#F94500', 'Red'], ['#3D4DB5', 'Blue']],
  reef: [
    ['#FF6F61', 'Coral'], ['#EFC900', 'Yellow Tang'], ['#FFF3E0', 'Sand'],
    ['#1FC2CF', 'Turquoise'], ['#9759E5', 'Sea Fan'], ['#0B5CB0', 'Deep Reef']],
};
const byFace = pick => Object.fromEntries(Object.entries(PRESETS).map(([key, list]) =>
  [key, Object.fromEntries(list.map((entry, i) => [i + 1, pick(entry)]))]));

export const COLOR_SCHEMES = {
  // 'standard' is the saved key; players see it as Classic, the Rubik's cube's own colours.
  standard: { ...FACE_COLORS },
  ...byFace(([hex]) => hex),

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

/** What each preset calls its faces, for anywhere the game names a colour (Chaos bets). */
export const PALETTE_FACE_NAMES = {
  standard: { 1: 'Red', 2: 'Green', 3: 'White', 4: 'Orange', 5: 'Blue', 6: 'Yellow' },
  ...byFace(([, name]) => name),
};

// ── LABELS ───────────────────────────────────────────────────────────────────

export const SCHEME_LABELS = {
  standard:   'Classic',
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

// Browsing groups by theme; they only sort the picker, saved games and purchases keep palette IDs.
export const PALETTE_GROUPS = ['All', 'Essentials', 'Nature', 'Sky', 'Electric', 'Culture'];
export const PALETTE_INFO = {
  standard: { group: 'Essentials', description: "The Rubik's cube" },
  neon: { group: 'Electric', description: 'Sign-tube brights' },
  pastel: { group: 'Essentials', description: 'Candy shop' },
  sunset: { group: 'Sky', description: 'Golden hour into dusk' },
  deepsea: { group: 'Nature', description: 'Sunlit shallows to the abyss' },
  lava: { group: 'Nature', description: 'Magma and basalt' },
  arctic: { group: 'Nature', description: 'Ice under the midnight sun' },
  forest: { group: 'Nature', description: 'Woodland floor' },
  cyberpunk: { group: 'Electric', description: 'Night city chrome' },
  cosmic: { group: 'Sky', description: 'Nebula and stardust' },
  sakura: { group: 'Nature', description: 'Cherry blossom spring' },
  tropical: { group: 'Nature', description: 'Island fruit and lagoon' },
  aurora: { group: 'Sky', description: 'Northern lights' },
  halloween: { group: 'Culture', description: 'Trick or treat' },
  retro: { group: 'Culture', description: 'Seventies print' },
  midnight: { group: 'Sky', description: 'Moonlit night' },
  gemstone: { group: 'Essentials', description: 'Cut jewels' },
  mondrian: { group: 'Culture', description: 'De Stijl primaries' },
  artdeco: { group: 'Culture', description: 'Black, gold and jade' },
  noire: { group: 'Culture', description: 'Old Hollywood glamour' },
  vaporwave: { group: 'Electric', description: 'Poolside neon' },
  terracotta: { group: 'Culture', description: 'Clay and turquoise' },
  bioluminescence: { group: 'Electric', description: 'Living light' },
  saffron: { group: 'Culture', description: 'Spice market' },
  eclipse: { group: 'Sky', description: 'Totality' },
  inkwell: { group: 'Essentials', description: "Printer's inks" },
  reef: { group: 'Nature', description: 'Coral garden' },
};

// ── TILE STYLES ───────────────────────────────────────────────────────────────

export const TILE_STYLES = {
  ...LIVING_SURFACE_STYLES,
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
  stainedGlass: { label: 'Stained Glass', cost: 'med', type: 'pattern' },
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
  // Crafted
  marble:        { label: 'Marble',          cost: 'low', type: 'procedural' },
  terrazzo:      { label: 'Terrazzo',        cost: 'low', type: 'procedural' },
  kintsugi:      { label: 'Kintsugi',        cost: 'med', type: 'animated' },
  cloisonne:     { label: 'Cloisonné',       cost: 'low', type: 'pattern' },
  marquetry:     { label: 'Marquetry',       cost: 'low', type: 'pattern' },
  washi:         { label: 'Washi Paper',     cost: 'low', type: 'procedural' },
  denim:         { label: 'Denim',           cost: 'low', type: 'pattern' },
  knit:          { label: 'Knit',            cost: 'low', type: 'pattern' },
  motherOfPearl: { label: 'Mother of Pearl', cost: 'low', type: 'procedural' },
  damascus:      { label: 'Damascus Steel',  cost: 'low', type: 'procedural' },
  mosaic:        { label: 'Mosaic',          cost: 'low', type: 'pattern' },
  leather:       { label: 'Tooled Leather',  cost: 'low', type: 'procedural' },
};

export const DEFAULT_SETTINGS = {
  livePortalViews: false,
  flipPads: 'full',
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
