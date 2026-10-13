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
// All 30 ordered recipes have dedicated reaction rules. Reversing pickup order
// changes the mechanic as well as the presentation.
//
// Pure, like elementalDefs.js: no React, no Three, no store.

import { ELEMENTAL_DEFS } from './elementalDefs.js';

// Recipe identity is ordered: the first pickup is the base, the second the catalyst.
// Every recipe retains both base effects alongside its ordered reaction rule.
const recipes = [
  ['fire', 'water', 'steam', 'Steam', 'Your steaming trail scalds and stuns enemies and puts out bombs.'],
  ['water', 'ice', 'slipstream', 'Slipstream', 'Turns keep water momentum; full momentum gives 40% extra speed.'],
  ['water', 'grass', 'bloom', 'Bloom', 'Rain grows a spring pad behind every 4th tile you crawl, and pads last 12 seconds.'],
  ['water', 'lightning', 'conductor', 'Conductor', 'Wet and grounded: marks never aim at your body, and every strike forks to a second tile.'],
  ['water', 'fire', 'quench', 'Quench', 'Your trail becomes obsidian for 8 seconds: it blocks blasts without speeding bomb fuses. Turns on obsidian keep water momentum.'],
  ['fire', 'ice', 'coldfire', 'Coldfire', 'Your trail burns blue for 5 seconds: it blocks blasts, never speeds fuses, and freezes enemies that touch it.'],
  ['fire', 'grass', 'wildfire', 'Wildfire', 'Land a spring leap to ignite the surrounding 3×3 and defeat enemies there.'],
  ['fire', 'lightning', 'plasma', 'Plasma', 'Twice the marks, and they never land on your fire trail. Every strike leaves its tile burning for 8 seconds.'],
  ['grass', 'water', 'geyser', 'Geyser', 'Spring pads erupt: a launch refills water momentum, and at full momentum the leap goes a tile further and higher.'],
  ['grass', 'fire', 'emberseed', 'Emberseed', 'Pads last 4 seconds; one you leave behind bursts into a 3×3 of flame that defeats enemies.'],
  ['grass', 'ice', 'ski-jump', 'Ski Jump', 'Every jump from the ground is a full spring leap, no pad needed, and the landing grows a pad.'],
  ['grass', 'lightning', 'thunderpad', 'Thunderpad', 'Lightning charges spring pads for rocket-high leaps.'],
  ['ice', 'water', 'frozen-wake', 'Frozen Wake', 'Tiles you leave freeze for 5 seconds: bombs on them stop ticking and enemies that step on them freeze.'],
  ['ice', 'fire', 'meltdown', 'Meltdown', 'Every slide ends in a 30% dash; the tile you turn on melts, and a bomb on it is put out.'],
  ['ice', 'grass', 'frostbloom', 'Frostbloom', 'A spring landing freezes its 3×3: enemies freeze, bombs stop ticking, and the pad lasts 12 seconds.'],
  ['ice', 'lightning', 'static', 'Static', 'Strikes near your head discharge into you: no harm, no flip, a 35% speed burst instead.'],
  ['lightning', 'water', 'current', 'Current', 'At high water momentum a strike on you is absorbed and arcs on: it defeats the nearest enemy and defuses the nearest bomb.'],
  ['lightning', 'fire', 'firestorm', 'Firestorm', 'Every strike ignites a cross of fire two tiles each way; enemies inside it burn.'],
  ['lightning', 'ice', 'cryostorm', 'Cryostorm', 'Marks charge twice as long and strike as frost: no harm to you, no flips; enemies nearby freeze and bombs stop ticking.'],
  ['lightning', 'grass', 'grounded', 'Grounded', 'Strikes grow charged spring pads instead of flipping tiles, and a strike on your body grows a pad instead of cutting.'],
];
// Each Air order has a dedicated rule; keep IDs stable for recorded fusion goals.
recipes.push(
  ['water', 'air', 'water-air', 'Sea Breeze', 'Build and keep water momentum in flight; airborne turns preserve it and full momentum gives 40% extra speed while airborne.'],
  ['air', 'water', 'air-water', 'Rainwind', 'Land to refill water momentum, stun nearby enemies and put out bombs in the surrounding 3×3.'],
  ['fire', 'air', 'fire-air', 'Updraft', 'Jump from a hot trail tile for an extra tile of travel and 1.2 extra lift on top of Air’s boost.'],
  ['air', 'fire', 'air-fire', 'Bellows', 'Rain fire onto every tile you fly over during a jump; those firebreaks burn for 6 seconds and speed bomb fuses.'],
  ['grass', 'air', 'grass-air', 'Dust Devil', 'Launching from a spring pad sends a gust two surface steps outward, stunning enemies around the launch.'],
  ['air', 'grass', 'air-grass', 'Highlands', 'Every landing grows a charged spring pad lasting 12 seconds; jump from it for a rocket-high leap amplified by Air.'],
  ['ice', 'air', 'ice-air', 'Snowdrift', 'Jumping leaves a 7-second frost trail beneath you: enemies freeze and bombs on those tiles stop ticking.'],
  ['air', 'ice', 'air-ice', 'Polar Wind', 'Steer freely on the ground. Each ground takeoff freezes a cross reaching two tiles in every direction for 3 seconds.'],
  ['lightning', 'air', 'lightning-air', 'Thunderhead', 'Marked strikes become harmless gusts: they stun nearby enemies and grant a 35% speed burst instead of cutting, killing or flipping tiles.'],
  ['air', 'lightning', 'air-lightning', 'Stormwind', 'Every landing discharges a cross reaching two tiles in every direction, defeating enemies there. Normal lightning strikes remain dangerous.'],
);
export const ORDERED_FUSIONS = Object.fromEntries(recipes.map(([base, catalyst, id, label, description, fallback = null]) => [
  `${base}>${catalyst}`, { base, catalyst, id, label, rule: !!description, fallback,
    description: description ?? (fallback
      ? `Currently uses ${recipes.find(r => r[2] === fallback)[3]}: ${recipes.find(r => r[2] === fallback)[4]}`
      : `${ELEMENTAL_DEFS[base].label} and ${ELEMENTAL_DEFS[catalyst].label} effects together.`) },
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
