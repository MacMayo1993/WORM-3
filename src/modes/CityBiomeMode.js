// Face color to city mapping — permanent, driven by base Rubik's palette
export const FACE_CITIES = {
  1: 'frozenCitadel',   // White
  2: 'deepStation',     // Blue
  3: 'volcanicFoundry', // Red
  4: 'solarArcology',   // Yellow
  5: 'bioDome',         // Green
  6: 'neuralHub',       // Orange
};

export const CITY_CONFIG = {
  frozenCitadel:   { label: 'Frozen Citadel',   tileStyle: 'ice',    pulseColor: '#B8E4FF', pulseHex: 0xB8E4FF },
  deepStation:     { label: 'Deep Station',      tileStyle: 'water',  pulseColor: '#00CED1', pulseHex: 0x00CED1 },
  volcanicFoundry: { label: 'Volcanic Foundry',  tileStyle: 'lava',   pulseColor: '#FF4500', pulseHex: 0xFF4500 },
  solarArcology:   { label: 'Solar Arcology',    tileStyle: 'pulse',  pulseColor: '#FFD700', pulseHex: 0xFFD700 },
  bioDome:         { label: 'Bio-Dome',          tileStyle: 'grass',  pulseColor: '#39FF14', pulseHex: 0x39FF14 },
  neuralHub:       { label: 'Neural Hub',        tileStyle: 'neural', pulseColor: '#8B00FF', pulseHex: 0x8B00FF },
};

// Antipodal face pairs
export const ANTIPODAL_FACES = { 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3 };

// Seam interaction table — key is sorted pair "A-B" where A < B (face IDs)
export const SEAM_INTERACTIONS = {
  '1-4': { type: 'antipodal-thermal-max',    frequency: 2.4, shape: 'hard-alternate'   },
  '2-5': { type: 'antipodal-cool-harmony',   frequency: 0.8, shape: 'soft-breathe'     },
  '3-6': { type: 'antipodal-warm-ambiguous', frequency: 3.2, shape: 'chaotic-flicker'  },
  '1-2': { type: 'cross-cool',               frequency: 1.0, shape: 'gentle-overlap'   },
  '1-5': { type: 'luminance-bridge',         frequency: 1.2, shape: 'lead-follow'      },
  '1-6': { type: 'cold-compute',             frequency: 2.0, shape: 'hard-alternate'   },
  '3-4': { type: 'thermal-clash',            frequency: 2.8, shape: 'hot-overlap'      },
  '4-6': { type: 'luminance-compute',        frequency: 2.2, shape: 'gold-violet'      },
  '2-4': { type: 'cross-temperature',        frequency: 1.8, shape: 'warm-cool-inter'  },
  '4-5': { type: 'warm-organic',             frequency: 1.0, shape: 'soft-breathe'     },
  '2-6': { type: 'cool-compute',             frequency: 1.4, shape: 'deep-interference'},
  '2-3': { type: 'cross-temperature',        frequency: 3.0, shape: 'third-color'      },
  '3-5': { type: 'thermal-organic',          frequency: 2.0, shape: 'gentle-overlap'   },
  '5-6': { type: 'organic-compute',          frequency: 1.6, shape: 'slow-build'       },
  '1-3': { type: 'cross-temperature',        frequency: 2.5, shape: 'warm-cool-inter'  },
};

export function getSeamInteraction(faceA, faceB) {
  const key = [faceA, faceB].sort((a, b) => a - b).join('-');
  return SEAM_INTERACTIONS[key] ?? { type: 'neutral', frequency: 1.0, shape: 'gentle-overlap' };
}

export function isAntipodalPair(faceA, faceB) {
  return ANTIPODAL_FACES[faceA] === faceB;
}

// Deterministic seeded PRNG — mulberry32
export function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Building count per tile based on grid dimension
export function getBuildingCount(gridDim) {
  return { 2: 4, 3: 6, 4: 8, 5: 11 }[gridDim] ?? 6;
}

// Resolve manifoldStyles for biome mode — city tile style per face
// Uses userFaceAssignment if provided (from wizard), else FACE_CITIES default
export function resolveBiomeManifoldStyles(userFaceAssignment = null) {
  const assignment = userFaceAssignment ?? FACE_CITIES;
  const styles = {};
  for (const [faceId, cityKey] of Object.entries(assignment)) {
    styles[faceId] = CITY_CONFIG[cityKey]?.tileStyle ?? 'solid';
  }
  return styles;
}
