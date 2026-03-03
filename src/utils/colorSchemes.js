// Color scheme presets and settings utilities
// Face antipodal pairs: 1↔4  |  2↔5  |  3↔6
// High contrast within each pair is essential — the manifold flip reveals the opposite face

import { CITY_CONFIG, FACE_CITIES } from '../modes/CityBiomeMode.js';

export const COLOR_SCHEMES = {

  // ── ORIGINAL SCHEMES ────────────────────────────────────────────────────────

  standard:  { 1: '#ef4444', 2: '#22c55e', 3: '#ffffff', 4: '#f97316', 5: '#3b82f6', 6: '#eab308' },
  neon:      { 1: '#ff0066', 2: '#00ff99', 3: '#00ffff', 4: '#ff3300', 5: '#0099ff', 6: '#ffff00' },
  pastel:    { 1: '#f9a8b8', 2: '#a8f0c8', 3: '#f0f0f0', 4: '#ffc89a', 5: '#a8c8f0', 6: '#f0e8a0' },
  mono:      { 1: '#E8E8E8', 2: '#BBBBBB', 3: '#FFFFFF', 4: '#888888', 5: '#484848', 6: '#111111' },
  ocean:     { 1: '#0ea5e9', 2: '#14b8a6', 3: '#e0f2fe', 4: '#0284c7', 5: '#C2770A', 6: '#164e63' },
  // face 5 was #06b6d4 cyan — too similar to teal (face 2) and sky (face 1); amber-sunset replaces it
  forest:    { 1: '#a3b18a', 2: '#588157', 3: '#dad7cd', 4: '#6a994e', 5: '#386641', 6: '#bc6c25' },
  candy:     { 1: '#ff006e', 2: '#8338ec', 3: '#ffffff', 4: '#fb5607', 5: '#3a86ff', 6: '#ffbe0b' },
  retro:     { 1: '#d62828', 2: '#f77f00', 3: '#fcbf49', 4: '#bc4749', 5: '#003049', 6: '#eae2b7' },

  // ── SUPERHERO SCHEMES ────────────────────────────────────────────────────────
  // Each pair (1↔4, 2↔5, 3↔6) is the hero's signature color contrast

  // Spider-Man — red suit vs blue suit / black web vs white emblem / gold thread vs dark crimson
  spiderman: {
    1: '#D01010',  // deep red suit
    4: '#1565C0',  // royal blue              ← red ↔ blue
    2: '#111111',  // web black
    5: '#F5F5F5',  // white spider emblem     ← black ↔ white
    3: '#C8A800',  // gold web thread
    6: '#8B0000',  // dark crimson            ← gold ↔ crimson
  },

  // Batman — cape black vs bat-signal gold / steel blue vs parchment / brass vs purple void
  batman: {
    1: '#1C1C1E',  // cape black
    4: '#F5C518',  // bat-signal gold         ← black ↔ gold
    2: '#4E6B7A',  // blue-grey steel (was #3A3A3C dark slate — too close to cape black)
    5: '#E8E0C8',  // parchment bone          ← steel ↔ parchment
    3: '#7A6800',  // aged brass
    6: '#3D2A6E',  // dark purple void        ← brass ↔ void (lightened from #1E1435 to differ from face 1)
  },

  // Iron Man — armor red vs gold plating / HUD blue vs arc reactor white / titanium vs steel
  ironman: {
    1: '#C0392B',  // armor red
    4: '#F5A623',  // gold plating            ← red ↔ gold
    2: '#1A5276',  // HUD blue
    5: '#D6EAF8',  // arc reactor glow        ← blue ↔ ice
    3: '#7F8C8D',  // titanium
    6: '#2C3E50',  // dark steel              ← titanium ↔ steel
  },

  // Wonder Woman — Amazonian crimson vs tiara gold / Olympian blue vs parchment / royal purple vs forest
  wonderwoman: {
    1: '#C0001A',  // Amazonian crimson
    4: '#D4A500',  // golden tiara            ← crimson ↔ gold
    2: '#1A3A6B',  // Olympian blue
    5: '#E8D5A3',  // parchment cream         ← blue ↔ cream
    3: '#5C2E8A',  // royal amazon purple
    6: '#2C4A1E',  // amazon forest           ← purple ↔ forest
  },

  // The Joker — purple suit vs poison green / acid yellow vs blood red / clown white vs shadow black
  joker: {
    1: '#6A0DAD',  // purple suit
    4: '#39A845',  // poison green            ← purple ↔ green
    2: '#F5E642',  // acid yellow
    5: '#8B0000',  // blood red               ← yellow ↔ blood
    3: '#FFFFFF',  // clown white
    6: '#1A1A1A',  // shadow black            ← white ↔ black
  },

  // Black Panther — wakandan night vs vibranium purple / silver vs wakandan bronze / deep violet vs pale lilac
  blackpanther: {
    1: '#0D0D2B',  // wakandan night
    4: '#7B2FBE',  // vibranium purple        ← night ↔ energy
    2: '#B8B8CC',  // vibranium silver
    5: '#8B6A3A',  // wakandan bronze (was #2D2D2D matte black — too close to wakandan night face 1)
    3: '#4A0080',  // deep violet
    6: '#C8A8E8',  // pale lilac glow         ← violet ↔ pale
  },

  // Captain America — Old Glory red vs Union blue / star white vs dark crimson / shield steel vs brass
  cap: {
    1: '#BF0A30',  // Old Glory red
    4: '#002868',  // Union blue              ← red ↔ blue
    2: '#F5F5F5',  // star white
    5: '#8B0000',  // dark crimson            ← white ↔ crimson
    3: '#4682B4',  // shield steel blue
    6: '#D4AF37',  // brass rivets            ← steel ↔ brass
  },

  // Thor — storm grey vs lightning gold / bifrost cyan vs earth leather / silver chainmail vs midnight cape
  thor: {
    1: '#4A5568',  // storm grey
    4: '#FFD700',  // Mjolnir gold            ← storm ↔ lightning
    2: '#00BFFF',  // bifrost cyan
    5: '#8B4513',  // leather brown           ← cyan ↔ earth
    3: '#C0C0C0',  // silver chainmail
    6: '#1A237E',  // midnight cape           ← silver ↔ midnight
  },

  // Deadpool — merc red vs suit black / white sclera vs gunmetal / shadow purple vs steel-blue katana
  deadpool: {
    1: '#CC0000',  // merc red
    4: '#111111',  // suit black              ← red ↔ black
    2: '#F0F0F0',  // eye white
    5: '#6B6B6B',  // gunmetal (lightened from #555555 to widen gap from suit black)
    3: '#2B1F30',  // dark shadow purple
    6: '#7A9AAA',  // steel-blue katana (was #C8C8C8 — too close to eye white face 2)
  },

  // Doctor Strange — cloak maroon vs sling ring gold / astral indigo vs mirror aqua / dark dimension vs rune parchment
  strange: {
    1: '#722F37',  // cloak of levitation
    4: '#C9A84C',  // sling ring gold         ← maroon ↔ gold
    2: '#4B0082',  // astral indigo
    5: '#7FFFD4',  // mirror dimension aqua   ← indigo ↔ aqua
    3: '#2C003E',  // dark dimension
    6: '#E8D5B7',  // rune parchment          ← dark ↔ light
  },

  // ── THEMATIC SCHEMES ────────────────────────────────────────────────────────

  // Aurora Borealis — deep polar night vs electric green / magenta ribbons vs teal / tundra green vs lavender
  aurora: {
    1: '#0A0A2E',  // polar night
    4: '#00FF87',  // electric green aurora   ← night ↔ aurora
    2: '#FF006E',  // magenta ribbon
    5: '#00CED1',  // teal wave               ← magenta ↔ teal
    3: '#1A4A2A',  // tundra forest green (was #0D1B4B deep navy — too close to polar night face 1)
    6: '#C77DFF',  // lavender glow           ← tundra ↔ lavender
  },

  // Japanese Inkwash — sumi black vs washi cream / vermillion seal vs pine green / indigo vs gold leaf
  sumi: {
    1: '#1A1A1A',  // sumi ink black
    4: '#F5F0E8',  // washi paper cream       ← ink ↔ paper
    2: '#C0392B',  // vermillion hanko seal
    5: '#2D5A27',  // pine needle green       ← vermillion ↔ pine
    3: '#1B3A6B',  // deep indigo
    6: '#D4A843',  // gold leaf               ← indigo ↔ gold
  },

  // Deep Sea — abyssal black vs bioluminescent cyan / cobalt blue vs phosphor green / deep purple vs coral
  abyss: {
    1: '#080C14',  // abyssal black
    4: '#00FFEE',  // bioluminescent cyan     ← abyss ↔ glow
    2: '#1C3D6E',  // cobalt blue
    5: '#39FF14',  // phosphor green          ← cobalt ↔ phosphor
    3: '#3A1060',  // deep abyssal purple (was #0D3F4A dark teal — too close to cobalt face 2)
    6: '#FF6B6B',  // deep sea coral          ← deep purple ↔ coral
  },

  // Volcano — obsidian black vs molten lava / ash grey vs crimson core / basalt brown vs sulfur yellow
  volcano: {
    1: '#1A0A00',  // obsidian black
    4: '#FF4500',  // molten lava orange      ← obsidian ↔ lava
    2: '#696969',  // volcanic ash grey
    5: '#CC2200',  // deep crimson lava (was #FF8C00 — too close to lava orange face 4)
    3: '#7B4210',  // dark basalt brown (was #484040 dark slate — too close to obsidian face 1)
    6: '#FFD700',  // sulfur yellow           ← basalt ↔ sulfur
  },

  // Sakura — deep cherry bark vs petal pink / mossy stone vs sage blossom / charcoal vs warm cream
  sakura: {
    1: '#5C1A1A',  // dark cherry bark
    4: '#FFB7C5',  // petal pink              ← bark ↔ petal
    2: '#4A5240',  // mossy stone
    5: '#C8DCC0',  // pale sage blossom       ← stone ↔ sage
    3: '#2C2C2C',  // charcoal branch
    6: '#F5E8CC',  // warm parchment cream    ← charcoal ↔ cream
  },

  // Cosmic — black hole vs quasar white / nebula purple vs star yellow / deep indigo vs comet blue
  cosmic: {
    1: '#050508',  // black hole
    4: '#FFF8E7',  // quasar white            ← void ↔ light
    2: '#6B35A8',  // nebula purple
    5: '#FFD60A',  // star yellow             ← nebula ↔ star
    3: '#1C2266',  // deep indigo dark matter
    6: '#4FACFE',  // comet blue              ← indigo ↔ comet
  },

  // Candy Shop — bubblegum pink vs mint green / hot coral vs sky blue / lemon vs grape
  candyshop: {
    1: '#FF69B4',  // bubblegum pink
    4: '#98FF98',  // mint green              ← pink ↔ mint
    2: '#FF6B6B',  // hot coral
    5: '#87CEEB',  // sky blue                ← coral ↔ sky
    3: '#FFF44F',  // lemon yellow
    6: '#DA70D6',  // orchid grape            ← lemon ↔ grape
  },

  // Desert Dusk — dune sand vs canyon rust / sun bleached vs terracotta / mesquite vs turquoise sky
  desert: {
    1: '#C2956A',  // dune sand
    4: '#8B3A1A',  // canyon rust             ← sand ↔ rust
    2: '#E8D5B0',  // sun bleached bone
    5: '#C1440E',  // deep terracotta         ← bone ↔ terra
    3: '#3D1F0A',  // dark mesquite wood (was #D4A96A mesa tan — too close to dune sand face 1)
    6: '#4FA3A5',  // turquoise sky           ← mesquite ↔ turquoise
  },

  // Arctic — glacier white vs deep ice blue / ocean blue vs polar teal / frost grey vs arctic night
  arctic: {
    1: '#F0F8FF',  // glacier white
    4: '#1C4E7A',  // deep ice blue           ← glacier ↔ deep
    2: '#7BBCD6',  // ocean ice blue
    5: '#006B77',  // polar teal              ← ocean blue ↔ teal
    3: '#C8D4DC',  // frost grey
    6: '#0A1628',  // arctic night            ← frost ↔ night
  },

  // Ember & Ash — cold ash vs hot ember / cool steel vs firebrick / charcoal vs spark gold
  ember: {
    1: '#C8C8C0',  // cold ash
    4: '#FF4500',  // hot ember               ← ash ↔ ember
    2: '#4A7B8C',  // cooling steel blue (was #787878 smoke grey — too close to ash/charcoal)
    5: '#B22222',  // firebrick red (was #FF8C00 fire orange — too close to hot ember face 4)
    3: '#2C2C2C',  // charcoal
    6: '#FFD700',  // spark gold              ← charcoal ↔ spark
  },

  // ── BIOME SCHEME ─────────────────────────────────────────────────────────────
  // Default city biome palette — each face uses the pulse color of its assigned city.
  // Faces: 1=Frozen Citadel, 2=Deep Station, 3=Volcanic Foundry,
  //        4=Solar Arcology, 5=Bio-Dome, 6=Neural Hub
  biome: {
    1: CITY_CONFIG[FACE_CITIES[1]].pulseColor,  // frozenCitadel   → #B8E4FF
    2: CITY_CONFIG[FACE_CITIES[2]].pulseColor,  // deepStation     → #00CED1
    3: CITY_CONFIG[FACE_CITIES[3]].pulseColor,  // volcanicFoundry → #FF4500
    4: CITY_CONFIG[FACE_CITIES[4]].pulseColor,  // solarArcology   → #FFD700
    5: CITY_CONFIG[FACE_CITIES[5]].pulseColor,  // bioDome         → #39FF14
    6: CITY_CONFIG[FACE_CITIES[6]].pulseColor,  // neuralHub       → #8B00FF
  },
};

// ── LABELS ───────────────────────────────────────────────────────────────────

export const SCHEME_LABELS = {
  // Originals
  standard:     'Standard',
  neon:         'Neon',
  pastel:       'Pastel',
  mono:         'Monochrome',
  ocean:        'Ocean',
  forest:       'Forest',
  candy:        'Candy',
  retro:        'Retro',
  // Superheroes
  spiderman:    'Spider-Man',
  batman:       'Batman',
  ironman:      'Iron Man',
  wonderwoman:  'Wonder Woman',
  joker:        'The Joker',
  blackpanther: 'Black Panther',
  cap:          'Captain America',
  thor:         'Thor',
  deadpool:     'Deadpool',
  strange:      'Doctor Strange',
  // Themes
  aurora:       'Aurora Borealis',
  sumi:         'Ink & Washi',
  abyss:        'Deep Sea',
  volcano:      'Volcano',
  sakura:       'Sakura',
  cosmic:       'Cosmic',
  candyshop:    'Candy Shop',
  desert:       'Desert Dusk',
  arctic:       'Arctic',
  ember:        'Ember & Ash',
  // Biome
  biome:        'City Biome',
  // Custom always last
  custom:       'Custom Upload',
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
};

export const DEFAULT_SETTINGS = {
  colorScheme: 'standard',
  customColors: null,
  backgroundTheme: 'blackhole',
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
    faceAssignment: null, // null = use FACE_CITIES default from CityBiomeMode.js
  },
};

// Returns a face→hex color map for biome mode, using each city's pulse color.
// Pass a custom userFaceAssignment (faceId→cityKey) to override the default FACE_CITIES mapping.
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
