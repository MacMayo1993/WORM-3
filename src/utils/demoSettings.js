// demoSettings.js — the look the demo borrows, and how it gives it back.
//
// The demo temporarily overwrites the player's persisted settings so every step
// is staged against the same neon/desert/topographic look. Two things make that
// safe, and both live here so they can never drift apart:
//
//   1. ONE definition of the borrowed look (DEMO_SETTINGS_OVERRIDES), used both
//      to apply it and to recognise it later. The recognition path is how an
//      unclean exit (refresh or tab close mid-demo) gets healed on next launch —
//      when it drifted from the apply path, the heal silently stopped working
//      and the demo's look stuck to the device forever.
//   2. A restore that respects the player. The demo now invites them into the
//      real Settings menu ("Make It Yours"), so a blanket "put everything back"
//      would throw away choices we just asked them to make. mergeDemoSettings
//      only rolls back the fields the demo itself is still holding.

// Fields the demo drives. Anything not listed here is never touched, so audio,
// haptics, stat toggles and biome config pass through the demo untouched.
export const DEMO_CONTROLLED_KEYS = ['colorScheme', 'customColors', 'backgroundTheme', 'manifoldStyles'];

const topographicFaces = () => {
  const styles = {};
  for (let i = 1; i <= 6; i++) styles[i] = 'topographic';
  return styles;
};

export const DEMO_SETTINGS_OVERRIDES = {
  colorScheme: 'neon',
  customColors: null,
  backgroundTheme: 'desert'
  // manifoldStyles is built per-call by topographicFaces() so callers can never
  // share (and mutate) one styles object.
};

// Backgrounds a demo run can legitimately leave behind: the demo-wide desert,
// plus the Shanghai skybox the worm step layers on top of it. Both count as
// "the demo did this", so a crash during the worm step still heals.
export const DEMO_BACKGROUND_THEMES = ['desert', 'shanghai'];

/** The demo's look applied over a settings object (pure — returns a new object). */
export function applyDemoOverrides(settings) {
  return {
    ...settings,
    colorScheme: DEMO_SETTINGS_OVERRIDES.colorScheme,
    customColors: DEMO_SETTINGS_OVERRIDES.customColors,
    backgroundTheme: DEMO_SETTINGS_OVERRIDES.backgroundTheme,
    manifoldStyles: topographicFaces()
  };
}

const allTopographic = (manifoldStyles) =>
  !!manifoldStyles && [1, 2, 3, 4, 5, 6].every((i) => manifoldStyles[i] === 'topographic');

/**
 * Does this settings object look like the demo left it behind? Used at launch to
 * heal devices tainted by an unclean exit that predates the snapshot mechanism.
 * Deliberately strict: every demo-controlled field has to match, so a player who
 * genuinely likes neon-on-desert keeps their choice unless the tile styles line
 * up too.
 */
export function looksLikeDemoSettings(settings) {
  if (!settings) return false;
  return settings.colorScheme === DEMO_SETTINGS_OVERRIDES.colorScheme
    && !settings.customColors
    && DEMO_BACKGROUND_THEMES.includes(settings.backgroundTheme)
    && allTopographic(settings.manifoldStyles);
}

const sameValue = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Did the look change between two snapshots, on the fields the demo drives?
 *
 * Used to tell a player who actually picked something in the Settings step from
 * one who skipped straight past it — skipping must not be read as "they chose
 * this", or the demo would stop staging its own look for the rest of the run.
 */
export function demoLookChanged(before, after) {
  if (!before || !after) return false;
  return DEMO_CONTROLLED_KEYS.some((key) => !sameValue(before[key], after[key]));
}

/**
 * Settings to hand back when the demo ends.
 *
 * For every demo-controlled field: if `current` still holds exactly what the
 * demo put there, the player never touched it — restore their pre-demo value.
 * If it differs, they changed it during the demo (the Settings step exists to
 * make that happen) and their value wins. Non-demo fields always come from
 * `current`, so anything else they toggled mid-demo survives too.
 *
 * @param {object} preDemo  settings snapshot taken when the demo started
 * @param {object} current  settings as they stand now
 * @param {object} applied  settings the demo last applied (its own look)
 */
export function mergeDemoSettings(preDemo, current, applied) {
  if (!preDemo) return current;
  const merged = { ...current };
  for (const key of DEMO_CONTROLLED_KEYS) {
    if (sameValue(current?.[key], applied?.[key])) merged[key] = preDemo[key];
  }
  return merged;
}
