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
// All 20 ordered recipes have stable identities. Shipped rules and explicit
// fallbacks are separate, so planned names never silently select another rule.
//
// Pure, like elementalDefs.js: no React, no Three, no store.

import { ELEMENTAL_DEFS } from './elementalDefs.js';

// Recipe identity is ordered. `fallback` names the shipped effect used until a
// recipe's own rule lands; the HUD always explains the effect actually running.
const recipes = [
  ['water', 'fire', 'steam', 'Steam', 'Your steaming trail scalds and stuns enemies and puts out bombs.'],
  ['fire', 'water', 'quench', 'Quench', 'Your trail becomes obsidian for 8 seconds: it blocks blasts without speeding bomb fuses. Turns on obsidian keep water momentum.'],
  ['water', 'ice', 'slipstream', 'Slipstream', 'Turns keep water momentum; full momentum gives 40% extra speed.'],
  ['fire', 'grass', 'wildfire', 'Wildfire', 'Land a spring leap to ignite the surrounding 3×3 and defeat enemies there.'],
  ['grass', 'lightning', 'thunderpad', 'Thunderpad', 'Lightning charges spring pads for rocket-high leaps.'],
  ['water', 'grass', 'bloom', 'Bloom'],
  ['water', 'lightning', 'conductor', 'Conductor'],
  ['fire', 'ice', 'coldfire', 'Coldfire'],
  ['fire', 'lightning', 'plasma', 'Plasma'],
  ['grass', 'water', 'geyser', 'Geyser'],
  ['grass', 'fire', 'emberseed', 'Emberseed', null, 'wildfire'],
  ['grass', 'ice', 'ski-jump', 'Ski Jump'],
  ['ice', 'water', 'frozen-wake', 'Frozen Wake', null, 'slipstream'],
  ['ice', 'fire', 'meltdown', 'Meltdown'],
  ['ice', 'grass', 'frostbloom', 'Frostbloom'],
  ['ice', 'lightning', 'static', 'Static'],
  ['lightning', 'water', 'current', 'Current'],
  ['lightning', 'fire', 'firestorm', 'Firestorm'],
  ['lightning', 'ice', 'cryostorm', 'Cryostorm'],
  ['lightning', 'grass', 'grounded', 'Grounded', null, 'thunderpad'],
];
export const ORDERED_FUSIONS = Object.fromEntries(recipes.map(([base, catalyst, id, label, description, fallback = null]) => [
  `${base}>${catalyst}`, { base, catalyst, id, label, rule: !!description, fallback,
    description: description ?? (fallback
      ? `Currently uses ${recipes.find(r => r[2] === fallback)[3]}: ${recipes.find(r => r[2] === fallback)[4]}`
      : `${ELEMENTAL_DEFS[base].label} and ${ELEMENTAL_DEFS[catalyst].label} base effects together; no additional fusion effect yet.`) },
]));

/** Arguments are chronological: first pickup, then second pickup. */
export function fusionKey(base, catalyst) {
  if (!base || !catalyst || base === catalyst || !ELEMENTAL_DEFS[base] || !ELEMENTAL_DEFS[catalyst]) return null;
  return `${base}>${catalyst}`;
}
export const getFusion = (base, catalyst) => ORDERED_FUSIONS[fusionKey(base, catalyst)] ?? null;
export const fusionEffect = recipe => recipe?.rule ? recipe.id : recipe?.fallback ?? null;
export const fusionRecipeLabel = recipe => `${ELEMENTAL_DEFS[recipe.base].label} → ${ELEMENTAL_DEFS[recipe.catalyst].label}: ${recipe.label}`;

/** Whether `type` is one of the elements washing over the cube right now. */
export function hasElement(sim, type) {
  return !!sim && sim.elementalT > 0 && (sim.elementalType === type || sim.elementalPair === type);
}

/** The shipped effect ID, including fallbacks; null if no extra rule is active. */
export function activeFusion(sim) {
  if (!sim || !(sim.elementalT > 0)) return null;
  return fusionEffect(getFusion(sim.elementalPair, sim.elementalType));
}

/** Same question from the render side, which sees the two element ids and the clock. */
export function fusionOf(element, partner, remaining = 1) {
  return remaining > 0 ? fusionEffect(getFusion(partner, element)) : null;
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
  // Reclaiming the base changes the ordered recipe and earns fusion credit.
  if (claimed === pair) return { type: claimed, pair: active, fused: true };
  // A new element fuses with the newest one; a third replaces the older.
  return { type: claimed, pair: active, fused: true };
}
