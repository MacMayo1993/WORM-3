/**
 * sessionDefaults.js — the field sets a session resets.
 *
 * These factories are the single source of truth for "what does a finished
 * Disparity round / worm run leave behind". resetGame and initWormMode spread
 * them rather than re-listing the fields; two hand-maintained copies had
 * already drifted apart once (see the note on the disparity factory).
 */

// Exported so the hooks that push history inline (useCubeState's rotate/flip
// batches) trim to the same depth the store's own addToHistory does — three
// hand-copied `.slice(-10)`s had to agree by convention before this.
export const MAX_UNDO_HISTORY = 10;

// Disparity-specific runtime fields reset on session start/end.
//
// This is the ONE list of what a Disparity session leaves behind. resetGame used
// to re-enumerate most of it by hand and the two copies had drifted apart: the
// inline list forgot disparityParityScore (so a new game inherited the previous
// session's un-cashed winnings) and holonomyMode, while the factory forgot
// tunnelDeaths. Both spread this now — add new session fields here only.
export const makeDisparityRuntimeDefaults = () => ({
  disparityDeaths: [],
  disparityDeathByGridId: {},
  disparityWinner: null,
  showDisparityWinner: false,
  disparityEliminatedFaces: [],
  disparityParityScore: 0,
  cascades: [],
  holonomyMode: false,
  // Transient FX maps — animations from a previous session are irrelevant.
  cubiePops: {},
  tunnelBirths: {},
  tunnelPulses: {},
  tunnelDeaths: {},
});

// Worm session fields reset on each worm run.
export const makeWormSessionDefaults = () => ({
  wormHealedCount: 0,
  wormPhase: 'crawling',
  wormOnFlippedTile: false,
  wormBodyTiles: 0,
  wormPowerups: [],
  // Hovering rocket/magnet orbs currently on the board, plus the buffs they grant.
  // wormMagnetBuff is { startedAt, duration } while active (null otherwise) so the
  // HUD can time its own countdown without the sim writing state every frame.
  wormSpecials: [],
  // Buff TRANSITIONS only — enough to mount/unmount the HUD strip. Remaining time
  // lives on the wormBuffs bridge (mirrored from the sim each tick), so a paused or
  // mid-tunnel countdown freezes with the simulation instead of a wall clock.
  wormRocketActive: false,
  wormMagnetActive: false,
  wormMagnetSeq: 0,
  // { kind: 'spawn'|'expire', type, seq } — drives the HUD's special notice toast.
  wormSpecialNotice: null,
  // { color, combo, seq } for the most recent orb pickup — drives the HUD's
  // screen-edge confirmation flash.
  wormOrbFlash: null,
  wormAlive: true,
  showWormDeathMenu: false,
  wormDeathDetails: null,
  wormPaused: false,
  wormTimeAlive: 0,
  wormTunnelCount: 0,
  wormOrbInventory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  wormHealingProgress: {},
  wormGamePhase: 'scrambling',
  wormCountdownStep: null,
  wormSessionOrbs: 0,
  wormActiveTunnelColors: null,
});
