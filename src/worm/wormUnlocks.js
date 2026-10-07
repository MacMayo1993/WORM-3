// src/worm/wormUnlocks.js
// Worm characters are earned by playing WORM's levels: Classic is everyone's
// first crawler, and every ten levels cleared (one chapter's worth) unlocks the
// next worm in a fixed order. Levels are the only way to earn a worm; they are
// not sold in the Store or offered by cubie chests.
//
// Ownership still lives in `ownedItems` as `character_<id>` so every reader
// (profile picker, equip guard, saves) keeps one check. This module decides
// which of those ids a save is entitled to. Pure: no React, no store.
import { WORM_CHARACTERS } from './wormCharacterData.js';

export const WORM_LEVELS_PER_UNLOCK = 10;
// Unlock order. Classic is free; MOBI, the guide himself, is the last reward.
export const WORM_UNLOCK_ORDER = ['classic', 'inch', 'glow', 'wiggle', 'book', 'prism', 'mobi'];

const CHARACTER_PREFIX = 'character_';

/** Levels a character needs cleared (0 for Classic), or null for an unknown id. */
export function characterUnlockLevels(id) {
  const index = WORM_UNLOCK_ORDER.indexOf(id);
  return index < 0 ? null : index * WORM_LEVELS_PER_UNLOCK;
}

/** WORM story levels cleared (any stars) in a saved progress record. */
export function wormLevelsCompleted(progress) {
  return Object.values(progress?.wormStory?.stars ?? {}).filter(stars => Number(stars) > 0).length;
}

export function isCharacterUnlocked(progress, id) {
  const need = characterUnlockLevels(id);
  return need != null && wormLevelsCompleted(progress) >= need;
}

/** Store ids (`character_<id>`) of every worm the progress has earned. */
export function earnedCharacterItems(progress) {
  const done = wormLevelsCompleted(progress);
  return WORM_UNLOCK_ORDER.filter((_, i) => i * WORM_LEVELS_PER_UNLOCK <= done).map(id => CHARACTER_PREFIX + id);
}

/** The next worm to earn and how many more levels it needs, or null when all are earned. */
export function nextCharacterUnlock(progress) {
  const done = wormLevelsCompleted(progress);
  const index = WORM_UNLOCK_ORDER.findIndex((_, i) => i * WORM_LEVELS_PER_UNLOCK > done);
  if (index < 0) return null;
  const character = WORM_CHARACTERS.find(c => c.id === WORM_UNLOCK_ORDER[index]);
  const levels = index * WORM_LEVELS_PER_UNLOCK;
  return { character, levels, remaining: levels - done };
}

/**
 * Rebuild a save's worm ownership from its progress: drops every character it
 * holds and grants exactly the earned ones. Used when a save loads, so worms
 * bought, rolled or granted under the old rules are re-locked to progress.
 */
export function syncCharacterUnlocks(ownedItems, progress) {
  return [...ownedItems.filter(id => !id.startsWith(CHARACTER_PREFIX)), ...earnedCharacterItems(progress)];
}

/** Add any newly earned worms without taking anything away (after a level is cleared). */
export function grantCharacterUnlocks(ownedItems, progress) {
  const missing = earnedCharacterItems(progress).filter(id => !ownedItems.includes(id));
  return missing.length ? [...ownedItems, ...missing] : ownedItems;
}
