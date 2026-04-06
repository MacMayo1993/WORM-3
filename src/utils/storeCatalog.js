// src/utils/storeCatalog.js
// Complete Parity Store catalog.
// price: 0 = free / default-owned.

import { SCHEME_LABELS, TILE_STYLES } from './colorSchemes.js';

// ── Worm Skins ────────────────────────────────────────────────────────────────
export const STORE_SKINS = [
  { id: 'skin_slime',  type: 'skin', category: 'skins', skinId: 'slime',  label: 'Slime',  price: 0,   body: '#00ff88', belly: '#00cc66', glow: '#00ff88' },
  { id: 'skin_royal',  type: 'skin', category: 'skins', skinId: 'royal',  label: 'Royal',  price: 150, body: '#a855f7', belly: '#7e22ce', glow: '#a855f7' },
  { id: 'skin_lava',   type: 'skin', category: 'skins', skinId: 'lava',   label: 'Lava',   price: 150, body: '#f97316', belly: '#ea580c', glow: '#f97316' },
  { id: 'skin_ocean',  type: 'skin', category: 'skins', skinId: 'ocean',  label: 'Ocean',  price: 150, body: '#06b6d4', belly: '#0891b2', glow: '#22d3ee' },
  { id: 'skin_cherry', type: 'skin', category: 'skins', skinId: 'cherry', label: 'Cherry', price: 150, body: '#ec4899', belly: '#db2777', glow: '#f472b6' },
  { id: 'skin_ice',    type: 'skin', category: 'skins', skinId: 'ice',    label: 'Ice',    price: 200, body: '#bae6fd', belly: '#7dd3fc', glow: '#38bdf8' },
  { id: 'skin_void',   type: 'skin', category: 'skins', skinId: 'void',   label: 'Void',   price: 200, body: '#6366f1', belly: '#4338ca', glow: '#818cf8' },
  { id: 'skin_gold',   type: 'skin', category: 'skins', skinId: 'gold',   label: 'Gold',   price: 300, body: '#f59e0b', belly: '#d97706', glow: '#fbbf24' },
];

// ── Hats ──────────────────────────────────────────────────────────────────────
export const STORE_HATS = [
  { id: 'hat_none',   type: 'hat', category: 'hats', hatId: 'none',   label: 'No Hat',  price: 0 },
  { id: 'hat_tophat', type: 'hat', category: 'hats', hatId: 'tophat', label: 'Top Hat', price: 100 },
  { id: 'hat_party',  type: 'hat', category: 'hats', hatId: 'party',  label: 'Party',   price: 100 },
  { id: 'hat_crown',  type: 'hat', category: 'hats', hatId: 'crown',  label: 'Crown',   price: 150 },
  { id: 'hat_halo',   type: 'hat', category: 'hats', hatId: 'halo',   label: 'Halo',    price: 200 },
];

// ── Color Schemes ─────────────────────────────────────────────────────────────
// standard and custom are always free.
const SCHEME_PRICES = {
  standard:   0,   custom:     0,
  pastel:     100, forest:     100, candy:      100, watercolor: 100,
  ghibli:     100, autumn:     100, tropical:   100, desert:     100,
  sakura:     100, sunset:     125,
  neon:       150, lava:       150, arctic:     150, cosmic:     150,
  aurora:     150, halloween:  150, retro:      150, gemstone:   150,
  sunrise:    150, mondrian:   150, artdeco:    150,
  deepsea:    200, cyberpunk:  200, midnight:   200,
  biome:      300,
  // New palettes
  noire:      150, vaporwave:  150, terracotta: 100,
  bioluminescence: 200, nordic: 100, saffron:  125,
  patina:     150, eclipse:    175, inkwell:   125, reef: 100,
};

export const STORE_SCHEMES = Object.keys(SCHEME_LABELS)
  .filter(k => k !== 'custom') // custom is always accessible (user-provided)
  .map(k => ({
    id: `scheme_${k}`,
    type: 'scheme',
    category: 'schemes',
    schemeKey: k,
    label: SCHEME_LABELS[k],
    price: SCHEME_PRICES[k] ?? 150,
  }));

// ── Tile Styles ───────────────────────────────────────────────────────────────
const TILE_PRICES = {
  // Classic — free baseline
  solid: 0,
  // Classic — basic
  glossy: 50, matte: 50, metallic: 50,
  // Classic — intermediate
  carbonFiber: 75, hexGrid: 75, comic: 75,
  // Classic — illusion patterns
  cafeWall: 100, hermanGrid: 100, opticSpin: 100, ouchi: 100,
  scintillatingGrid: 100, zoellner: 100, kanizsa: 100, fraserSpiral: 100,
  muellerLyer: 100, rotatingSnakes: 100, poggendorff: 100,
  // Op Art — simple
  polkaDots: 75, zigzag: 75, checkerboard: 75, diagStripes: 75,
  cornerAccent: 75, innerDisc: 75, crossPlus: 75, borderFrame: 75,
  thinHatch: 75, dotRing: 75,
  // Op Art — complex
  opConcentric: 125, opRadialSpokes: 125, opTiltMosaic: 125, opDiamondWave: 125,
  opBullseyeSteps: 125, opWarpGrid: 125, opChevronBands: 125,
  opInterferencePlaid: 125, opRibbonTwist: 125, opPinwheel: 125,
  // Living — basic 3D
  grass: 150, ice: 150, sand: 150, water: 150, wood: 150,
  // Living — animated
  moireRings: 175, moireLines: 175, infinityTunnel: 175, vortex: 175,
  shockwave: 175, solar: 175,
  // Living — complex 3D / shader
  circuit: 200, holographic: 200, pulse: 200, lava: 200, galaxy: 200, neural: 200,
  // New classic patterns
  stainedGlass: 100, fingerprint: 75, topographic: 75, mandelbrot: 125, penrose: 125,
  // New animated / antipodal
  oilSlick: 175, constellation: 175, waveform: 150, dnaHelix: 175, neonSign: 175,
  // Animated style pack (dev request)
  prismBloom: 175, magnetFlux: 175, liquidChrome: 200, auroraWeave: 175, plasmaCells: 175,
  quantumScanlines: 150, emberstorm: 175, fractalPulse: 175, bioLattice: 175, stellarLensing: 200,
};

export const STORE_TILES = Object.keys(TILE_STYLES).map(k => ({
  id: `tile_${k}`,
  type: 'tile',
  category: 'tiles',
  tileKey: k,
  label: TILE_STYLES[k].label,
  tileType: TILE_STYLES[k].type,
  price: TILE_PRICES[k] ?? 100,
}));

// ── Combined catalog ──────────────────────────────────────────────────────────
export const STORE_ITEMS = [
  ...STORE_SKINS,
  ...STORE_HATS,
  ...STORE_SCHEMES,
  ...STORE_TILES,
];

// Items owned from the start.
// In dev mode every item is unlocked so nothing blocks testing new styles/palettes.
export const DEFAULT_OWNED = import.meta.env.DEV
  ? STORE_ITEMS.map(i => i.id)
  : STORE_ITEMS.filter(i => i.price === 0).map(i => i.id);
// custom scheme is always accessible but not "purchasable"
if (!DEFAULT_OWNED.includes('scheme_custom')) DEFAULT_OWNED.push('scheme_custom');

export const getStoreItem = (id) => STORE_ITEMS.find(i => i.id === id) ?? null;

export const getSkins   = () => STORE_SKINS;
export const getHats    = () => STORE_HATS;
export const getSchemes = () => STORE_SCHEMES;
export const getTiles   = () => STORE_TILES;
