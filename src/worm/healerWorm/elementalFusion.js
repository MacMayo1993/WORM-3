// src/worm/healerWorm/elementalFusion.js
//
// Two elements at once.
//
// Claim an element while another's wash is still up and the two FUSE: both stay on
// for a fresh ELEMENTAL_DURATION, both elements' own effects run together, and the
// pair's combo kicks in. The sim keeps the newest claim in `elementalType` and the
// one it fused with in `elementalPair`; claiming a third replaces the older of the
// two. Every element check reads `hasElement`, never `elementalType` alone, or the
// partner's half of a fusion silently switches off.
//
// Every pair has a name and a look (both cube skins at once). Four pairs carry a rule
// of their own (`rule: true`); the rest are both elements at full strength until
// their twist lands.
//
// Pure, like elementalDefs.js: no React, no Three, no store.

import { ELEMENTAL_DEFS } from './elementalDefs.js';

/** The fusion of a pair, keyed by the two element ids in alphabetical order. */
export const FUSION_DEFS = {
  'fire+water': {
    id: 'steam', label: 'Steam', rule: true,
    description: 'Your fire trail turns to steam: enemies that step on it are scalded and stunned, and a bomb sitting on it is put out.',
  },
  'ice+water': {
    id: 'slipstream', label: 'Slipstream', rule: true,
    description: 'Turning no longer sheds water momentum, and a full head of steam is worth 40% extra speed instead of 25%.',
  },
  'fire+grass': {
    id: 'wildfire', label: 'Wildfire', rule: true,
    description: 'Land a spring leap and the ground around you bursts into flame, killing enemies in the 3x3 and leaving it burning.',
  },
  'grass+lightning': {
    id: 'thunderpad', label: 'Thunderpad', rule: true,
    description: 'The storm aims for your spring pads. A struck pad is charged, and a leap from it launches rocket-high.',
  },
  'lightning+water': { id: 'conductor', label: 'Conductor', rule: false, description: 'Water and lightning at full strength together.' },
  'grass+water': { id: 'bloom', label: 'Bloom', rule: false, description: 'Water and nature at full strength together.' },
  'fire+ice': { id: 'frostfire', label: 'Frostfire', rule: false, description: 'Fire and ice at full strength together.' },
  'fire+lightning': { id: 'plasma', label: 'Plasma', rule: false, description: 'Fire and lightning at full strength together.' },
  'grass+ice': { id: 'frostbloom', label: 'Frostbloom', rule: false, description: 'Ice and nature at full strength together.' },
  'ice+lightning': { id: 'static', label: 'Static', rule: false, description: 'Ice and lightning at full strength together.' },
};

/** The order-free key of a pair, or null when it is not two different elements. */
export function fusionKey(a, b) {
  if (!a || !b || a === b || !ELEMENTAL_DEFS[a] || !ELEMENTAL_DEFS[b]) return null;
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

/** The fusion two elements make, or null. */
export const getFusion = (a, b) => FUSION_DEFS[fusionKey(a, b)] ?? null;

/** Whether `type` is one of the elements washing over the cube right now. */
export function hasElement(sim, type) {
  return !!sim && sim.elementalT > 0 && (sim.elementalType === type || sim.elementalPair === type);
}

/** The active fusion's id ('steam', 'slipstream', …), or null when one element (or none) is up. */
export function activeFusion(sim) {
  if (!sim || !(sim.elementalT > 0)) return null;
  return getFusion(sim.elementalType, sim.elementalPair)?.id ?? null;
}

/** Same question from the render side, which sees the two element ids and the clock. */
export function fusionOf(element, partner, remaining = 1) {
  return remaining > 0 ? getFusion(element, partner)?.id ?? null : null;
}

/**
 * The elements a claim leaves washing over the cube.
 *
 * @param {string|null} active  the newest element whose wash is up, or null
 * @param {string|null} pair    the element it is fused with, or null
 * @param {string} claimed
 * @returns {{ type: string, pair: string|null, fused: boolean }}
 *   fused is true when this claim made a new pair (not a refresh of one already up)
 */
export function claimElement(active, pair, claimed) {
  if (!active) return { type: claimed, pair: null, fused: false };
  // The same element again only refreshes the wash; the pair it is in stays.
  if (claimed === active) return { type: claimed, pair, fused: false };
  // The partner reclaimed: same two elements, now newest-first the other way round.
  if (claimed === pair) return { type: claimed, pair: active, fused: false };
  // A new element fuses with the newest one; a third replaces the older.
  return { type: claimed, pair: active, fused: true };
}
