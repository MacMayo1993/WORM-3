/**
 * useGameStore - Zustand State Management
 *
 * Central state store for WORM³, extracted from App.jsx.
 * Manages all game state including cube, UI, settings, and level system.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { makeCubies } from '../game/cubeState.js';
import { DEFAULT_SETTINGS } from '../utils/colorSchemes.js';
import { isMobile } from '../utils/device.js';
import { DEFAULT_OWNED, ALL_ITEMS_OWNED } from '../utils/storeCatalog.js';
import { UNLOCK_ALL } from '../utils/testUnlock.js';
import { STARTING_BANKROLL } from '../utils/economyConstants.js';
import { MODES } from '../utils/constants.js';

const SETTINGS_STORAGE_KEY = 'worm3_settings';
const SETTINGS_VERSION_KEY = 'worm3_settings_version';
const CURRENT_SETTINGS_VERSION = 1;
const PARITY_POINTS_KEY = 'worm3_parity_points';
const OWNED_ITEMS_KEY = 'worm3_owned_items';
const BET_STREAK_KEY = 'worm3_bet_streak';
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
      parityPoints: STARTING_BANKROLL, // storage unavailable — new-player experience
      ownedItems: [...DEFAULT_OWNED],
      betStreak: 0,
    };
  }
};


const persistedState = loadPersistedState();
const MAX_UNDO_HISTORY = 10;

// Disparity-specific runtime fields reset on session start/end.
const makeDisparityRuntimeDefaults = () => ({
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
});

// Worm session fields reset on each worm run.
const makeWormSessionDefaults = () => ({
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

// ========================================================================
// WORM MODE SLICE — all worm-related state, setters, and lifecycle actions
// ========================================================================
const createWormSlice = (set, _get) => ({
  // ── Mode flag ─────────────────────────────────────────────────────────────
  wormHealerMode: false,
  setWormHealerMode: (v) => set({ wormHealerMode: v }),

  // ── Config (persists across sessions or set by wizard) ────────────────────
  wormRunId: 0,
  wormSpeed: 1.0,
  setWormSpeed: (v) => set({ wormSpeed: v }),
  wormBoostState: 'ready',
  setWormBoostState: (v) => set({ wormBoostState: v }),
  wormOrbCount: 5,
  setWormOrbCount: (v) => set({ wormOrbCount: Math.max(1, Math.min(144, Math.round(v))) }),
  wormholeInterval: 10,
  setWormholeInterval: (v) => set({ wormholeInterval: Math.max(2, Math.min(30, Number(v))) }),
  wormColor: '#33ff66',
  setWormColor: (v) => set({ wormColor: v || '#33ff66' }),
  wormSkin: persistedState.wormSkin,
  setWormSkin: (id) => {
    try { localStorage.setItem('worm3_skin', id); } catch { }
    set({ wormSkin: id });
  },
  wormHat: persistedState.wormHat,
  setWormHat: (id) => {
    try { localStorage.setItem('worm3_hat', id); } catch { }
    set({ wormHat: id });
  },
  wormTrail: persistedState.wormTrail ?? 'classic',
  setWormTrail: (id) => {
    try { localStorage.setItem('worm3_trail', id); } catch { }
    set({ wormTrail: id });
  },
  wormCharacter: persistedState.wormCharacter ?? 'classic',
  setWormCharacter: (id) => {
    try { localStorage.setItem(WORM_CHARACTER_KEY, id); } catch { }
    set({ wormCharacter: id });
  },
  wormShowTrail: persistedState.wormShowTrail ?? true,
  setWormShowTrail: (v) => {
    try { localStorage.setItem('worm3_show_trail', String(v)); } catch { }
    set({ wormShowTrail: v });
  },

  // ── Controls ──────────────────────────────────────────────────────────────
  wormControlMode: 'non-oriented',
  setWormControlMode: (v) => set({ wormControlMode: v }),
  toggleWormControlMode: () => set((state) => ({
    wormControlMode: state.wormControlMode === 'non-oriented' ? 'oriented' : 'non-oriented'
  })),

  // ── Session state (reset by makeWormSessionDefaults) ──────────────────────
  ...makeWormSessionDefaults(),
  setWormHealedCount: (v) => set({ wormHealedCount: v }),
  setWormPhase: (v) => set({ wormPhase: v }),
  setWormOnFlippedTile: (v) => set({ wormOnFlippedTile: v }),
  setWormBodyTiles: (v) => set({ wormBodyTiles: v }),
  setWormPowerups: (v) => set({ wormPowerups: v }),
  setWormSpecials: (v) => set({ wormSpecials: v }),
  setWormAlive: (v) => set({ wormAlive: v }),
  setShowWormDeathMenu: (v) => set({ showWormDeathMenu: v }),
  setWormDeathDetails: (v) => set({ wormDeathDetails: v }),
  setWormPaused: (v) => set({ wormPaused: v }),
  setWormTimeAlive: (v) => set({ wormTimeAlive: v }),
  setWormTunnelCount: (v) => set({ wormTunnelCount: v }),
  setWormOrbInventory: (v) => set({ wormOrbInventory: v }),
  setWormHealingProgress: (v) => set({ wormHealingProgress: v }),
  setWormGamePhase: (v) => set({ wormGamePhase: v }),
  setWormCountdownStep: (v) => set({ wormCountdownStep: v }),
  setWormSessionOrbs: (v) => set({ wormSessionOrbs: v }),

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  clearDisparityGame: () => set({
    ...makeDisparityRuntimeDefaults(),
    ...makeWormSessionDefaults(),
    wormHealerMode: false,
  }),
  initWormMode: (flipCap = 9999, _chaosLevel = 0, speed = null, orbCount = null, interval = null, color = null) => set((state) => ({
    ...makeDisparityRuntimeDefaults(),
    ...makeWormSessionDefaults(),
    wormHealerMode: true,
    disparityFlipCap: flipCap,
    chaosLevel: 0,
    wormRunId: (state.wormRunId ?? 0) + 1,
    wormPaused: true,
    wormSpeed: speed !== null ? Math.max(0.5, Math.min(3.0, speed)) : state.wormSpeed,
    wormOrbCount: orbCount !== null ? Math.max(1, Math.min(144, Math.round(orbCount))) : state.wormOrbCount,
    wormholeInterval: interval !== null ? Math.max(2, Math.min(30, Number(interval))) : state.wormholeInterval,
    wormColor: color !== null ? (color || '#33ff66') : state.wormColor,
  })),
});

export const useGameStore = create(
  subscribeWithSelector((set, get) => ({
    // ========================================================================
    // CUBE STATE
    // ========================================================================
    size: 3,
    cubies: makeCubies(3),
    rotationEpoch: 0,
    // Describes the single slice rotation that produced the latest rotationEpoch
    // bump: { axis, sliceIndex, dir, numTurns }. Null means the cubies array was
    // replaced wholesale (size change, shuffle, loaded state) rather than rotated,
    // so consumers (e.g. the chaos worker sync) must fall back to a full resync
    // instead of replaying a single-slice move.
    lastRotation: null,

    setSize: (size) => set((state) => ({ size, cubies: makeCubies(size), rotationEpoch: state.rotationEpoch + 1, lastRotation: null })),
    setCubies: (cubies) => set(typeof cubies === 'function'
      ? (state) => ({ cubies: cubies(state.cubies) })
      : { cubies }),
    // Like setCubies but also increments rotationEpoch so manifoldMap rebuilds
    setRotatedCubies: (cubies) => set(typeof cubies === 'function'
      ? (state) => ({ cubies: cubies(state.cubies), rotationEpoch: state.rotationEpoch + 1, lastRotation: null })
      : (state) => ({ cubies, rotationEpoch: state.rotationEpoch + 1, lastRotation: null })),

    // ========================================================================
    // ADAPTIVE QUALITY
    // ========================================================================
    // Set by PerformanceMonitor (App.jsx) when the measured frame rate sustains a
    // decline/incline over a rolling window. Consumers that already gate expensive
    // per-sticker effects on cube size (e.g. StickerPlane's suppressVolumeFX) read
    // this to also drop to the cheaper tier on underpowered devices regardless of size.
    perfReducedFX: false,
    setPerfReducedFX: (perfReducedFX) => set({ perfReducedFX }),

    // ========================================================================
    // GAME SESSION STATE
    // ========================================================================
    moves: 0,
    gameTime: 0,
    gameStartTime: Date.now(),
    hasShuffled: false,
    victory: null, // null, 'rubiks', 'sudokube', 'ultimate', or 'worm'
    achievedWins: { rubiks: false, sudokube: false, ultimate: false, worm: false },

    setMoves: (moves) => set(typeof moves === 'function'
      ? (state) => ({ moves: moves(state.moves) })
      : { moves }),
    setGameTime: (gameTime) => set({ gameTime }),
    setGameStartTime: (gameStartTime) => set({ gameStartTime }),
    setHasShuffled: (hasShuffled) => set({ hasShuffled }),
    setVictory: (victory) => set({ victory }),
    setAchievedWins: (achievedWins) => set(typeof achievedWins === 'function'
      ? (state) => ({ achievedWins: achievedWins(state.achievedWins) })
      : { achievedWins }),

    incrementMoves: () => set((state) => ({ moves: state.moves + 1 })),
    resetGame: () => set({
      moves: 0,
      gameTime: 0,
      gameStartTime: Date.now(),
      victory: null,
      achievedWins: { rubiks: false, sudokube: false, ultimate: false, worm: false },
      hasShuffled: false,
      moveHistory: [],
      // Full wipe of Chaos & Disparity states to ensure a truly fresh cube
      chaosLevel: 0,
      disparityDeaths: [],
      disparityDeathByGridId: {},
      disparityWinner: null,
      showDisparityWinner: false,
      disparityEliminatedFaces: [],
      cascades: [],
      blackHolePulse: 0,
      flipWaveOrigins: [],
      flipPulse: null,
      exploded: false,
      explosionT: 0,
      cubiePops: {},
      tunnelBirths: {},
      tunnelPulses: {},
      tunnelDeaths: {},
    }),

    // ========================================================================
    // UNDO SYSTEM (NEW)
    // ========================================================================
    moveHistory: [],

    addToHistory: (move) => set((state) => ({
      moveHistory: [...state.moveHistory, move].slice(-MAX_UNDO_HISTORY)
    })),
    popFromHistory: () => set((state) => ({
      moveHistory: state.moveHistory.slice(0, -1)
    })),
    clearHistory: () => set({ moveHistory: [] }),

    // ========================================================================
    // VISUAL MODES
    // ========================================================================
    visualMode: 'classic', // 'classic', 'grid', 'sudokube', 'colors'
    flipMode: false,
    showTunnels: false,
    // Tunnel density tier, applied only while showTunnels is true.
    //   'hints' — every active pair is a thin merged cord; full Möbius detail is
    //             reserved for the tunnel the worm is actually traversing.
    //   'full'  — same cords, plus full ribbon detail on the most recent flip
    //             events (capped, see FOCUS_BUDGET in WormholeNetwork).
    // Together with showTunnels this makes the UI toggle three-state:
    // Off → Hints → Full. 'hints' is the default because the old always-on
    // full-detail render was unreadable past a handful of active pairs.
    tunnelDetail: 'hints',
    exploded: false,
    explosionT: 0,
    showNetPanel: false,
    showLeaderboard: false,
    // Picture-in-picture camera parked at the antipodal point of the main one —
    // the "far side" window. Lives in the store (rather than App-local state)
    // so scripted sequences like the demo's view showcase can drive it with the
    // same setters they use for every other view toggle.
    showAntipodalPiP: false,

    setVisualMode: (visualMode) => set(typeof visualMode === 'function'
      ? (state) => ({ visualMode: visualMode(state.visualMode) })
      : { visualMode }),
    setFlipMode: (flipMode) => set(typeof flipMode === 'function'
      ? (state) => ({ flipMode: flipMode(state.flipMode) })
      : { flipMode }),
    setShowTunnels: (showTunnels) => set(typeof showTunnels === 'function'
      ? (state) => ({ showTunnels: showTunnels(state.showTunnels) })
      : { showTunnels }),
    setTunnelDetail: (tunnelDetail) => set({ tunnelDetail }),
    setExploded: (exploded) => set(typeof exploded === 'function'
      ? (state) => ({ exploded: exploded(state.exploded) })
      : { exploded }),
    setExplosionT: (explosionT) => set(typeof explosionT === 'function'
      ? (state) => ({ explosionT: explosionT(state.explosionT) })
      : { explosionT }),
    setShowNetPanel: (showNetPanel) => set(typeof showNetPanel === 'function'
      ? (state) => ({ showNetPanel: showNetPanel(state.showNetPanel) })
      : { showNetPanel }),

    setShowLeaderboard: (showLeaderboard) => set(typeof showLeaderboard === 'function'
      ? (state) => ({ showLeaderboard: showLeaderboard(state.showLeaderboard) })
      : { showLeaderboard }),
    toggleLeaderboard: () => set((state) => ({ showLeaderboard: !state.showLeaderboard })),

    setShowAntipodalPiP: (showAntipodalPiP) => set(typeof showAntipodalPiP === 'function'
      ? (state) => ({ showAntipodalPiP: showAntipodalPiP(state.showAntipodalPiP) })
      : { showAntipodalPiP }),
    toggleAntipodalPiP: () => set((state) => ({ showAntipodalPiP: !state.showAntipodalPiP })),

    toggleFlipMode: () => set((state) => ({ flipMode: !state.flipMode })),
    toggleTunnels: () => set((state) => ({ showTunnels: !state.showTunnels })),
    // Three-state cycle for the Tunnels button: Off → Hints → Full → Off.
    cycleTunnelDetail: () => set((state) => {
      if (!state.showTunnels) return { showTunnels: true, tunnelDetail: 'hints' };
      if (state.tunnelDetail === 'hints') return { tunnelDetail: 'full' };
      return { showTunnels: false, tunnelDetail: 'hints' };
    }),
    toggleExploded: () => set((state) => ({ exploded: !state.exploded })),
    toggleNetPanel: () => set((state) => ({ showNetPanel: !state.showNetPanel })),

    // ========================================================================
    // FLIP TRAVEL FX STATE
    // ========================================================================
    // Per-cubie pop animations: { "x,y,z": { startMs, durationMs } }
    cubiePops: {},
    // Per-tunnel birth (first flip) animations: { pairId: { startMs, durationMs } }
    tunnelBirths: {},
    // Per-tunnel pulse (subsequent flip) animations: { pairId: { startMs, durationMs } }
    tunnelPulses: {},
    // Per-tunnel death animations, fired when a pair reaches FLIP_CAP and is severed.
    // Carries its own endpoint anchors (mesh indices, dirKeys, colours) because by
    // the time this renders the pair is already gone from the tunnel network.
    // { pairId: { startMs, durationMs, meshIdx1, meshIdx2, dirKey1, dirKey2, color1, color2 } }
    tunnelDeaths: {},
    cycleVisualMode: () => set((state) => {
      const modes = ['classic', 'grid', 'sudokube', 'wireframe', 'glass', 'chrome', 'neon', 'gap', 'lego'];
      const idx = modes.indexOf(state.visualMode);
      return { visualMode: modes[(idx + 1) % modes.length] };
    }),

    // ========================================================================
    // CHAOS MODE STATE
    // ========================================================================
    chaosLevel: 0, // 0 = off, 1-5 = chaos levels
    autoRotateEnabled: false,
    cascades: [],
    upcomingRotation: null,
    rotationCountdown: 0,
    blackHolePulse: 0,
    flipWaveOrigins: [],
    // Screen-space flip echo: { at, color, danger }. Null until the first flip.
    flipPulse: null,
    cameraOrbitRequest: 0,  // epoch — increments each time the user requests a camera orbit
    cameraOrbitDir: null,   // 'cw' | 'ccw'

    triggerCameraOrbit: (dir) => set(state => ({ cameraOrbitDir: dir, cameraOrbitRequest: state.cameraOrbitRequest + 1 })),
    setChaosLevel: (chaosLevel) => set(typeof chaosLevel === 'function'
      ? (state) => ({ chaosLevel: chaosLevel(state.chaosLevel) })
      : { chaosLevel }),
    setAutoRotateEnabled: (autoRotateEnabled) => set({ autoRotateEnabled }),
    setCascades: (cascades) => set(typeof cascades === 'function'
      ? (state) => ({ cascades: cascades(state.cascades) })
      : { cascades }),
    setUpcomingRotation: (upcomingRotation) => set({ upcomingRotation }),
    setRotationCountdown: (rotationCountdown) => set(typeof rotationCountdown === 'function'
      ? (state) => ({ rotationCountdown: rotationCountdown(state.rotationCountdown) })
      : { rotationCountdown }),
    setBlackHolePulse: (blackHolePulse) => set({ blackHolePulse }),
    setFlipWaveOrigins: (flipWaveOrigins) => set({ flipWaveOrigins }),

    toggleChaos: () => set((state) => ({
      chaosLevel: state.chaosLevel === 0 ? 1 : 0
    })),

    // ========================================================================
    // DISPARITY GAME STATE
    // ========================================================================
    // Each entry: { id, gridId, rank, timestamp }
    disparityDeaths: [],
    // O(1) lookup table keyed by gridId for fast per-sticker dead-rank reads
    disparityDeathByGridId: {},
    // Set when a single tile survives: { gridId }
    disparityWinner: null,
    // Controls whether the cinematic winner celebration screen is visible
    showDisparityWinner: false,
    // Face elimination events: array of faceNum (1-6) values in order they were eliminated
    disparityEliminatedFaces: [],
    holonomyMode: false,

    // Configurable flip cap for Disparity Mode (overrides FLIP_CAP constant).
    // Default matches the setup wizard's "Standard / Balanced carnage" tier — 13
    // is the "Endurance / Slow attrition" tier and made tiles feel unkillable when
    // chaos was started without going through the wizard.
    disparityFlipCap: 8,
    setDisparityFlipCap: (v) => set({ disparityFlipCap: v }),

    // Running parity score for the current disparity game session.
    // Incremented by EARN_DISPARITY_TILE_RESTORE × healed-tile-count on each player heal.
    // Reset by makeWormRuntimeDefaults (called from clearDisparityGame + initWormMode).
    disparityParityScore: 0,
    addDisparityParityScore: (points) => set((state) => ({
      disparityParityScore: state.disparityParityScore + points,
    })),
    // Convert the session's parity score into wallet PP and zero it. Called at
    // round end (winner shown) and on round abandonment (chaos STOP) — the
    // zeroing makes it idempotent, so both call sites firing is safe. Without
    // this the score was HUD-only and healed-tile earnings evaporated.
    cashOutParityScore: () => set((state) => {
      const score = Math.round(state.disparityParityScore || 0);
      if (score <= 0) return state;
      const next = Math.max(0, (state.parityPoints || 0) + score);
      try { localStorage.setItem(PARITY_POINTS_KEY, String(next)); } catch { }
      return { parityPoints: next, disparityParityScore: 0 };
    }),

    // Chosen game length for the current disparity session ('short' | 'medium' | 'long').
    // Persists between sessions so the wizard remembers the last pick.
    disparityGameLength: 'medium',
    setDisparityGameLength: (v) => set({ disparityGameLength: v }),

    // Live chaos metrics pushed from the chaos worker on each productive tick.
    // Read by TopMenuBar instead of re-scanning every sticker on an interval.
    chaosStats: null,
    setChaosStats: (v) => set({ chaosStats: v }),

    addDisparityDeath: (death) => set((state) => ({
      disparityDeaths: [...state.disparityDeaths, death],
      disparityDeathByGridId: {
        ...state.disparityDeathByGridId,
        [death.gridId]: death,
      },
    })),
    addDisparityDeathsBulk: (deaths) => set((state) => {
      if (!deaths?.length) return state;
      const byGrid = { ...state.disparityDeathByGridId };
      const uniqueNew = [];
      for (const death of deaths) {
        if (!death?.gridId || byGrid[death.gridId]) continue;
        byGrid[death.gridId] = death;
        uniqueNew.push(death);
      }
      if (!uniqueNew.length) return state;
      return {
        disparityDeaths: [...state.disparityDeaths, ...uniqueNew],
        disparityDeathByGridId: byGrid,
      };
    }),
    setDisparityWinner: (winner) => set({ disparityWinner: winner }),
    setShowDisparityWinner: (v) => set({ showDisparityWinner: v }),
    addDisparityEliminatedFace: (faceNum) => set((state) => ({
      disparityEliminatedFaces: [...state.disparityEliminatedFaces, faceNum],
    })),
    addDisparityEliminatedFacesBulk: (faces) => set((state) => {
      if (!faces?.length) return state;
      return { disparityEliminatedFaces: [...state.disparityEliminatedFaces, ...faces] };
    }),
    setHolonomyMode: (v) => set({ holonomyMode: v }),

    // ── Economy ──────────────────────────────────────────────────────────────
    parityPoints: persistedState.parityPoints,
    earnCoins: (amount) => set((state) => {
      const next = Math.max(0, (state.parityPoints || 0) + Math.round(amount));
      try { localStorage.setItem(PARITY_POINTS_KEY, String(next)); } catch { }
      return { parityPoints: next };
    }),
    spendCoins: (amount) => {
      const state = get();
      const current = state.parityPoints || 0;
      if (current < amount) return false;
      const next = current - Math.round(amount);
      try { localStorage.setItem(PARITY_POINTS_KEY, String(next)); } catch { }
      set({ parityPoints: next });
      return true;
    },

    // ── Store ownership ───────────────────────────────────────────────────────
    ownedItems: persistedState.ownedItems,
    buyItem: (itemId, price) => {
      const state = get();
      if (state.ownedItems.includes(itemId)) return true; // already owned
      const current = state.parityPoints || 0;
      if (current < price) return false;
      const next = current - Math.round(price);
      const nextOwned = [...state.ownedItems, itemId];
      try {
        localStorage.setItem(PARITY_POINTS_KEY, String(next));
        localStorage.setItem(OWNED_ITEMS_KEY, JSON.stringify(nextOwned));
      } catch { }
      set({ parityPoints: next, ownedItems: nextOwned });
      return true;
    },

    // ── Disparity betting ─────────────────────────────────────────────────────
    // activeBet: { type, pick, wager, odds, potentialWin, placedAt, streak, roundId }
    activeBet: null,
    setActiveBet: (bet) => set({ activeBet: bet }),
    clearActiveBet: () => set({ activeBet: null }),
    // Monotonic round counter. beginDisparityRound stamps the pending bet with
    // the new round's id so a bet can only ever resolve against the round it
    // was placed for — a bet orphaned by an abandoned round is refunded
    // (refundActiveBet) instead of silently riding the next chaos winner.
    disparityRoundId: 0,
    beginDisparityRound: () => set((state) => {
      const nextId = state.disparityRoundId + 1;
      const bet = state.activeBet;
      if (bet && bet.roundId != null) {
        // Already-stamped bet from an earlier round reached a new round start —
        // its round never resolved, so refund it rather than adopting it.
        const pts = Math.max(0, (state.parityPoints || 0) + Math.round(bet.wager || 0));
        try { localStorage.setItem(PARITY_POINTS_KEY, String(pts)); } catch { }
        return { disparityRoundId: nextId, activeBet: null, parityPoints: pts };
      }
      return {
        disparityRoundId: nextId,
        activeBet: bet ? { ...bet, roundId: nextId } : null,
      };
    }),
    refundActiveBet: () => set((state) => {
      if (!state.activeBet) return state;
      const next = Math.max(0, (state.parityPoints || 0) + Math.round(state.activeBet.wager || 0));
      try { localStorage.setItem(PARITY_POINTS_KEY, String(next)); } catch { }
      return { parityPoints: next, activeBet: null };
    }),
    // lastBetResult: { won, payout, description, wager }
    lastBetResult: null,
    setLastBetResult: (result) => set({ lastBetResult: result }),
    clearLastBetResult: () => set({ lastBetResult: null }),
    // betStreak: consecutive wins. Persisted like the wallet — the streak is
    // part of the wallet's earning power (up to +50% payout), so losing it to
    // a page reload read as a bug.
    betStreak: persistedState.betStreak,
    setBetStreak: (v) => {
      try { localStorage.setItem(BET_STREAK_KEY, String(v)); } catch { }
      set({ betStreak: v });
    },

    // ========================================================================
    // WORM MODE (all worm state via slice)
    // ========================================================================
    ...createWormSlice(set, get),

    // ========================================================================
    // ANIMATION STATE
    // ========================================================================
    animState: null, // { axis, dir, sliceIndex, t }
    pendingMove: null,

    setAnimState: (animState) => set({ animState }),
    setPendingMove: (pendingMove) => set({ pendingMove }),
    clearAnimation: () => set({ animState: null, pendingMove: null }),

    // ========================================================================
    // CURSOR STATE
    // ========================================================================
    cursor: { face: 'PZ', row: 1, col: 1 },
    showCursor: false,

    setCursor: (cursor) => set(typeof cursor === 'function'
      ? (state) => ({ cursor: cursor(state.cursor) })
      : { cursor }),
    setShowCursor: (showCursor) => set({ showCursor }),

    // ========================================================================
    // UI STATE
    // ========================================================================
    // The intro cinematic plays on every visit (it is the game's opening
    // statement). Returning players get the ENTER button immediately instead
    // of waiting 10 s — see WelcomeScreen — so a replay costs one tap.
    showWelcome: true,
    showTutorial: false,
    showFirstFlipTutorial: false,
    showHelp: false,
    showSettings: false,
    showMainMenu: true,
    showLevelSelect: false,
    // Campaign chooser, and which pack the chapter map is currently showing.
    showPackSelect: false,
    activePackId: 'story-campaign',
    showCutscene: false,
    showLevelTutorial: false,
    showMobileTouchHint: isMobile && !persistedState.mobileHintShown,

    setShowWelcome: (showWelcome) => set({ showWelcome }),
    setShowTutorial: (showTutorial) => set({ showTutorial }),
    setShowFirstFlipTutorial: (showFirstFlipTutorial) => set({ showFirstFlipTutorial }),
    setShowHelp: (showHelp) => set(typeof showHelp === 'function'
      ? (state) => ({ showHelp: showHelp(state.showHelp) })
      : { showHelp }),
    setShowSettings: (showSettings) => set({ showSettings }),
    setShowMainMenu: (showMainMenu) => set({ showMainMenu }),
    setShowLevelSelect: (showLevelSelect) => set({ showLevelSelect }),
    setShowPackSelect: (showPackSelect) => set({ showPackSelect }),
    setActivePackId: (activePackId) => set({ activePackId }),
    setShowCutscene: (showCutscene) => set({ showCutscene }),
    setShowLevelTutorial: (showLevelTutorial) => set({ showLevelTutorial }),
    setShowMobileTouchHint: (showMobileTouchHint) => set({ showMobileTouchHint }),

    toggleHelp: () => set((state) => ({ showHelp: !state.showHelp })),

    // ========================================================================
    // LEVEL SYSTEM STATE
    // ========================================================================
    currentLevel: null,
    currentLevelData: null,
    completedLevels: [],

    setCurrentLevel: (currentLevel) => set({ currentLevel }),
    setCurrentLevelData: (currentLevelData) => set({ currentLevelData }),
    setCompletedLevels: (completedLevels) => set({ completedLevels }),
    completeCurrentLevel: () => set((state) => {
      if (!state.currentLevel) return {};
      if (state.completedLevels.includes(state.currentLevel)) return {};
      return { completedLevels: [...state.completedLevels, state.currentLevel] };
    }),
    clearLevel: () => set({
      currentLevel: null,
      currentLevelData: null,
    }),

    // ========================================================================
    // HANDS MODE STATE (NEW)
    // ========================================================================
    handsMode: false,
    handsMoveHistory: [], // Named moves for HUD (e.g. "R", "U'")
    handsMoveQueue: [],   // Queue for double moves
    handsTps: 0,          // Turns per second

    setHandsMode: (handsMode) => set({ handsMode }),
    setHandsMoveHistory: (handsMoveHistory) => set(typeof handsMoveHistory === 'function'
      ? (state) => ({ handsMoveHistory: handsMoveHistory(state.handsMoveHistory) })
      : { handsMoveHistory }),
    setHandsMoveQueue: (handsMoveQueue) => set(typeof handsMoveQueue === 'function'
      ? (state) => ({ handsMoveQueue: handsMoveQueue(state.handsMoveQueue) })
      : { handsMoveQueue }),
    setHandsTps: (handsTps) => set({ handsTps }),

    toggleHandsMode: () => set((state) => ({
      handsMode: !state.handsMode,
      handsMoveHistory: !state.handsMode ? [] : state.handsMoveHistory,
      handsMoveQueue: !state.handsMode ? [] : state.handsMoveQueue,
      handsTps: 0,
    })),

    // ========================================================================
    // DEV CONSOLE STATE (NEW)
    // ========================================================================
    showDevConsole: false,
    savedCubeState: null,

    setShowDevConsole: (showDevConsole) => set({ showDevConsole }),
    setSavedCubeState: (savedCubeState) => set({ savedCubeState }),
    toggleDevConsole: () => set((state) => ({ showDevConsole: !state.showDevConsole })),

    // ========================================================================
    // SOLVE MODE STATE
    // ========================================================================
    solveModeActive: false,
    solveFocusedStep: null,
    solveHighlights: [],
    kociembaLayerHighlight: null,

    setSolveModeActive: (solveModeActive) => set({ solveModeActive }),
    setSolveFocusedStep: (solveFocusedStep) => set({ solveFocusedStep }),
    setSolveHighlights: (solveHighlights) => set({ solveHighlights }),
    setKociembaLayerHighlight: (kociembaLayerHighlight) => set({ kociembaLayerHighlight }),

    // ========================================================================
    // TEACH MODE STATE
    // ========================================================================
    teachModeActive: false,

    setTeachModeActive: (teachModeActive) => set({ teachModeActive }),

    // ========================================================================
    // DEMO MODE
    // ========================================================================
    demoMode: false,
    demoStep: null,

    startDemo: () => set({
      demoMode: true,
      demoStep: 'baby-cube',
      showMainMenu: false,
    }),
    setDemoStep: (demoStep) => set({ demoStep }),
    exitDemo: () => set({
      demoMode: false,
      demoStep: null,
      showMainMenu: true,
    }),

    // ========================================================================
    // MERGE MODE
    // ========================================================================
    mergeMode: false,
    mergeTheme: 'pokemon',
    // Computed after each rotation: homeKey → tier (1|2|3)
    // homeKey = `${origPos.x}-${origPos.y}-${origPos.z}-${origDir}`
    mergeRegionTiers: {},

    setMergeMode: (mergeMode) => set({ mergeMode }),
    setMergeTheme: (mergeTheme) => set({ mergeTheme }),
    setMergeRegionTiers: (mergeRegionTiers) => set({ mergeRegionTiers }),

    // ========================================================================
    // HOLLOW VOID CUBE MODE
    // ========================================================================
    hollowMode: false,
    mirrorMode: false,
    parityCurrent: 0,      // 0-1, smoothly lerped
    parityTarget: 0,       // 0 or 1
    chaosCurrent: 0,       // 0-1, smoothly lerped
    chaosTarget: 0,        // 0-1 based on chaosLevel

    randomMode: false,
    setRandomMode: (randomMode) => set({ randomMode }),
    randomStyleTick: 0,
    bumpRandomTick: () => set(s => ({ randomStyleTick: s.randomStyleTick + 1 })),

    setHollowMode: (hollowMode) => set({ hollowMode }),
    toggleHollowMode: () => set((state) => ({ hollowMode: !state.hollowMode })),

    setMirrorMode: (mirrorMode) => set({ mirrorMode }),
    toggleMirrorMode: () => set((state) => ({ mirrorMode: !state.mirrorMode })),

    setParityTarget: (parityTarget) => set({ parityTarget }),
    setChaosTarget: (chaosTarget) => set({ chaosTarget }),
    setParityCurrent: (parityCurrent) => set({ parityCurrent }),
    setChaosCurrent: (chaosCurrent) => set({ chaosCurrent }),

    // Smooth lerp for shader uniforms (called from effects)
    lerpShaderValues: () => {
      const state = get();
      const pLerp = state.parityCurrent + (state.parityTarget - state.parityCurrent) * 0.1;
      const cLerp = state.chaosCurrent + (state.chaosTarget - state.chaosCurrent) * 0.1;
      set({ parityCurrent: pLerp, chaosCurrent: cLerp });
    },

    // ========================================================================
    // FACE ROTATION MODE (MOBILE)
    // ========================================================================
    faceRotationTarget: null,
    selectedTileForRotation: null,

    setFaceRotationTarget: (faceRotationTarget) => set({ faceRotationTarget }),
    setSelectedTileForRotation: (selectedTileForRotation) => set({ selectedTileForRotation }),

    // ========================================================================
    // FLIP STATE
    // ========================================================================
    hasFlippedOnce: persistedState.hasFlippedOnce,
    firstFlipHighlightPair: null,
    showFirstFlipCaption: false,

    setFirstFlipHighlightPair: (pair) => set({ firstFlipHighlightPair: pair }),
    setShowFirstFlipCaption: (v) => set({ showFirstFlipCaption: v }),

    setHasFlippedOnce: (hasFlippedOnce) => {
      try {
        localStorage.setItem('worm3_first_flip_done', hasFlippedOnce ? '1' : '0');
      } catch { }
      set({ hasFlippedOnce });
    },

    // ========================================================================
    // SETTINGS (PERSISTED)
    // ========================================================================
    settings: persistedState.settings,
    faceImages: {},
    faceTextures: {},

    // Persistence is handled by the subscription below — no inline write needed.
    setSettings: (settings) => set(typeof settings === 'function'
      ? (state) => ({ settings: settings(state.settings) })
      : { settings }),
    setFaceImages: (faceImages) => set(typeof faceImages === 'function'
      ? (state) => ({ faceImages: faceImages(state.faceImages) })
      : { faceImages }),
    setFaceTextures: (faceTextures) => set({ faceTextures }),

    // ========================================================================
    // PERSISTENCE HELPERS
    // ========================================================================
    markIntroSeen: () => {
      try {
        localStorage.setItem('worm3_intro_seen', '1');
      } catch { }
    },
    markTutorialDone: () => {
      try {
        localStorage.setItem('worm3_tutorial_done', '1');
      } catch { }
    },
    markMobileHintShown: () => {
      try {
        localStorage.setItem('worm3_mobile_hint_shown', '1');
      } catch { }
      set({ showMobileTouchHint: false });
    },
  }))
);

/**
 * Derived selector: returns the single active game mode identifier.
 * Priority order matches the original design: worm-healer overrides teach,
 * teach overrides holonomy, etc.  Use with `useGameStore(getActiveMode)`.
 *
 * @param {object} state - Zustand store state
 * @returns {string} One of the MODES values
 */
export const getActiveMode = (state) => {
  if (state.wormHealerMode)         return MODES.WORM_HEALER;
  if (state.teachModeActive)        return MODES.TEACH;
  if (state.holonomyMode)           return MODES.HOLONOMY;
  if (state.mergeMode)              return MODES.MERGE;
  if (state.hollowMode)             return MODES.HOLLOW;
  if (state.mirrorMode)             return MODES.MIRROR;
  if (state.chaosLevel > 0)         return MODES.CHAOS;
  if (state.flipMode)               return MODES.FLIP;
  return MODES.FREEPLAY;
};

// Subscribe to settings changes and persist to localStorage
useGameStore.subscribe(
  (state) => state.settings,
  (settings) => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      localStorage.setItem(SETTINGS_VERSION_KEY, String(CURRENT_SETTINGS_VERSION));
    } catch { }
  }
);
