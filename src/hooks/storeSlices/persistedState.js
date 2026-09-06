/**
 * persistedState.js — the one read of localStorage at module load.
 *
 * Slices import `persistedState` for their initial values; WRITING is handled
 * centrally by subscriptions in useGameStore.js, never inline in an action.
 * Storage keys are exported so those subscriptions and this loader agree.
 */

import { DEFAULT_SETTINGS } from '../../utils/colorSchemes.js';
import { DEFAULT_OWNED, ALL_ITEMS_OWNED } from '../../utils/storeCatalog.js';
import { UNLOCK_ALL } from '../../utils/testUnlock.js';
import { STARTING_BANKROLL } from '../../utils/economyConstants.js';

export const SETTINGS_STORAGE_KEY = 'worm3_settings';
export const SETTINGS_VERSION_KEY = 'worm3_settings_version';
export const CURRENT_SETTINGS_VERSION = 1;
export const PARITY_POINTS_KEY = 'worm3_parity_points';
export const OWNED_ITEMS_KEY = 'worm3_owned_items';
export const BET_STREAK_KEY = 'worm3_bet_streak';
const WORM_CHARACTER_KEY = 'worm3_character';

// Dev/preview builds get a padded wallet and a fully unlocked store so the
// economy can be exercised without grinding. Production builds load the real
// persisted wallet and purchases — unless this browser has opted in with
// ?unlockall=1, which is how a deployed build gets tested on a real device.
const DEV_FREE_ECONOMY = !!import.meta.env?.DEV || UNLOCK_ALL;

const migrateSettings = (rawSettings, version) => {
  if (!rawSettings || typeof rawSettings !== 'object') return { ...DEFAULT_SETTINGS };

  // v0 → v1: normalise into DEFAULT_SETTINGS shape (first schema version).
  // Add new `if (version < N)` blocks above this line for future migrations.
  if (version < CURRENT_SETTINGS_VERSION) {
    return { ...DEFAULT_SETTINGS, ...rawSettings };
  }

  // Current version — merge in case new keys were added to DEFAULT_SETTINGS.
  return { ...DEFAULT_SETTINGS, ...rawSettings };
};

// Load persisted state from localStorage
const loadPersistedState = () => {
  try {
    const settings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settingsVersionRaw = localStorage.getItem(SETTINGS_VERSION_KEY);
    const settingsVersion = Number.parseInt(settingsVersionRaw ?? '0', 10) || 0;
    const introSeen = localStorage.getItem('worm3_intro_seen') === '1';
    const tutorialDone = localStorage.getItem('worm3_tutorial_done') === '1';
    const firstFlipDone = localStorage.getItem('worm3_first_flip_done') === '1';
    const mobileHintShown = localStorage.getItem('worm3_mobile_hint_shown') === '1';
    const parsedSettings = settings ? JSON.parse(settings) : null;
    const wormSkin = localStorage.getItem('worm3_skin') || 'slime';
    const wormHat = localStorage.getItem('worm3_hat') || 'none';
    const wormTrail = localStorage.getItem('worm3_trail') || 'classic';
    const wormCharacter = localStorage.getItem(WORM_CHARACTER_KEY) || 'classic';
    const wormShowTrail = localStorage.getItem('worm3_show_trail') !== 'false'; // default true
    // 'face' rolls the horizon with the face the worm is on; 'level' keeps it
    // world-up. A feel call, so it is a setting rather than a constant.
    const wormCameraHorizon = localStorage.getItem('worm3_camera_horizon') === 'level' ? 'level' : 'face';
    // A missing key means a brand-new player: seed the starting bankroll so the
    // betting feature is reachable on day one. (An existing "0" stays 0 — the
    // player spent it; the grant is one-time by construction since every
    // earn/spend persists the key.)
    const rawParityPoints = localStorage.getItem(PARITY_POINTS_KEY);
    const parityPoints = rawParityPoints == null ? STARTING_BANKROLL : (parseInt(rawParityPoints, 10) || 0);
    let storedOwned = [];
    try {
      const rawOwned = JSON.parse(localStorage.getItem(OWNED_ITEMS_KEY) ?? '[]');
      if (Array.isArray(rawOwned)) storedOwned = rawOwned;
    } catch { /* corrupted owned-items entry — fall back to defaults */ }
    const ownedItems = DEV_FREE_ECONOMY
      ? [...ALL_ITEMS_OWNED]
      : [...new Set([...DEFAULT_OWNED, ...storedOwned])];
    const safeParityPoints = DEV_FREE_ECONOMY ? Math.max(parityPoints, 10000) : parityPoints;
    const betStreak = Math.max(0, parseInt(localStorage.getItem(BET_STREAK_KEY) ?? '0', 10) || 0);

    // Guard: reset cosmetics/settings to defaults if the saved value isn't owned
    const safeSkin  = ownedItems.includes(`skin_${wormSkin}`) ? wormSkin : 'slime';
    const safeHat   = ownedItems.includes(`hat_${wormHat}`) ? wormHat : 'none';
    const safeTrail = ownedItems.includes(`trail_${wormTrail}`) ? wormTrail : 'classic';

    // Guard: reset color scheme if not owned
    const migratedSettings = migrateSettings(parsedSettings, settingsVersion);
    const cs = migratedSettings.colorScheme || 'standard';
    if (cs !== 'custom' && !ownedItems.includes(`scheme_${cs}`)) {
      migratedSettings.colorScheme = 'standard';
    }
    // Guard: reset each face's tile style if not owned
    if (migratedSettings.manifoldStyles) {
      const safeStyles = {};
      for (const [faceId, styleKey] of Object.entries(migratedSettings.manifoldStyles)) {
        safeStyles[faceId] = ownedItems.includes(`tile_${styleKey}`) ? styleKey : 'solid';
      }
      migratedSettings.manifoldStyles = safeStyles;
    }

    return {
      settings: migratedSettings,
      introSeen,
      tutorialDone,
      hasFlippedOnce: firstFlipDone,
      mobileHintShown,
      wormSkin: safeSkin,
      wormHat: safeHat,
      wormTrail: safeTrail,
      wormCharacter,
      wormShowTrail,
      wormCameraHorizon,
      parityPoints: safeParityPoints,
      ownedItems,
      betStreak,
    };
  } catch {
    return {
      settings: { ...DEFAULT_SETTINGS },
      introSeen: false,
      tutorialDone: false,
      hasFlippedOnce: false,
      mobileHintShown: false,
      wormSkin: 'slime',
      wormHat: 'none',
      wormTrail: 'classic',
      wormCharacter: 'classic',
      wormShowTrail: true,
      wormCameraHorizon: 'face',
      parityPoints: STARTING_BANKROLL, // storage unavailable — new-player experience
      ownedItems: [...DEFAULT_OWNED],
      betStreak: 0,
    };
  }
};


export const persistedState = loadPersistedState();
