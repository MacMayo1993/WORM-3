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
import { DEFAULT_OWNED } from '../utils/storeCatalog.js';
import { MODES } from '../utils/constants.js';

const SETTINGS_STORAGE_KEY = 'worm3_settings';
const SETTINGS_VERSION_KEY = 'worm3_settings_version';
const CURRENT_SETTINGS_VERSION = 1;
const PARITY_POINTS_KEY = 'worm3_parity_points';
const OWNED_ITEMS_KEY = 'worm3_owned_items';
const WORM_CHARACTER_KEY = 'worm3_character';

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
    const wormCharacter = localStorage.getItem(WORM_CHARACTER_KEY) || 'classic';
    const wormShowTrail = localStorage.getItem('worm3_show_trail') !== 'false'; // default true
    const parityPoints = parseInt(localStorage.getItem(PARITY_POINTS_KEY) ?? '0', 10) || 0;
    const ownedItems = [...DEFAULT_OWNED]; // DEV: all items unlocked for store testing
    const safeParityPoints = Math.max(parityPoints, 10000); // DEV: floor wallet at 10 000 for store testing

    // Guard: reset cosmetics/settings to defaults if the saved value isn't owned
    const safeSkin = ownedItems.includes(`skin_${wormSkin}`) ? wormSkin : 'slime';
    const safeHat  = ownedItems.includes(`hat_${wormHat}`) ? wormHat : 'none';

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
      wormCharacter,
      wormShowTrail,
      parityPoints: safeParityPoints,
      ownedItems,
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
      wormCharacter: 'classic',
      wormShowTrail: true,
      parityPoints: 0,
      ownedItems: [...DEFAULT_OWNED],
    };
  }
};


const persistedState = loadPersistedState();
const MAX_UNDO_HISTORY = 10;

// All runtime worm fields that must be reset on both session start (initWormMode)
// and session end (clearDisparityGame). Extracted here so both callers share the same
// key list and a forgotten field can't silently differ between the two resets.
const makeWormRuntimeDefaults = () => ({
  disparityDeaths: [],
  disparityDeathByGridId: {},
  disparityWinner: null,
  showDisparityWinner: false,
  disparityEliminatedFaces: [],
  disparityParityScore: 0,
  cascades: [],
  holonomyMode: false,
  wormHealedCount: 0,
  wormPhase: 'crawling',
  wormOnFlippedTile: false,
  wormBodyTiles: 0,
  wormPowerups: [],
  wormholeCountdown: 0,
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
      exploded: false,
      explosionT: 0,
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
    exploded: false,
    explosionT: 0,
    showNetPanel: false,
    showLeaderboard: false,

    setVisualMode: (visualMode) => set(typeof visualMode === 'function'
      ? (state) => ({ visualMode: visualMode(state.visualMode) })
      : { visualMode }),
    setFlipMode: (flipMode) => set(typeof flipMode === 'function'
      ? (state) => ({ flipMode: flipMode(state.flipMode) })
      : { flipMode }),
    setShowTunnels: (showTunnels) => set(typeof showTunnels === 'function'
      ? (state) => ({ showTunnels: showTunnels(state.showTunnels) })
      : { showTunnels }),
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

    toggleFlipMode: () => set((state) => ({ flipMode: !state.flipMode })),
    toggleTunnels: () => set((state) => ({ showTunnels: !state.showTunnels })),
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
    cycleVisualMode: () => set((state) => {
      const modes = ['classic', 'grid', 'sudokube', 'colors'];
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
    wormHealerMode: false,
    holonomyMode: false,

    // Configurable flip cap for Disparity Mode (overrides FLIP_CAP constant)
    disparityFlipCap: 25,
    setDisparityFlipCap: (v) => set({ disparityFlipCap: v }),

    // Running parity score for the current disparity game session.
    // Incremented by EARN_DISPARITY_TILE_RESTORE × healed-tile-count on each player heal.
    // Reset by makeWormRuntimeDefaults (called from clearDisparityGame + initWormMode).
    disparityParityScore: 0,
    addDisparityParityScore: (points) => set((state) => ({
      disparityParityScore: state.disparityParityScore + points,
    })),

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
    setWormHealerMode: (v) => set({ wormHealerMode: v }),
    setHolonomyMode: (v) => set({ holonomyMode: v }),
    wormRunId: 0,
    wormSpeed: 1.0,
    setWormSpeed: (v) => set({ wormSpeed: v }),
    wormOrbCount: 5,
    setWormOrbCount: (v) => set({ wormOrbCount: Math.max(1, Math.min(24, Math.round(v))) }),
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
    // activeBet: { type, pick, wager, odds, potentialWin, placedAt, streak }
    activeBet: null,
    setActiveBet: (bet) => set({ activeBet: bet }),
    clearActiveBet: () => set({ activeBet: null }),
    // lastBetResult: { won, payout, description, wager }
    lastBetResult: null,
    setLastBetResult: (result) => set({ lastBetResult: result }),
    clearLastBetResult: () => set({ lastBetResult: null }),
    // betStreak: consecutive wins (persisted in memory only, resets on page reload)
    betStreak: 0,
    setBetStreak: (v) => set({ betStreak: v }),

    wormControlMode: 'non-oriented', // 'non-oriented' (relative turns) | 'oriented' (camera-relative)
    setWormControlMode: (v) => set({ wormControlMode: v }),
    toggleWormControlMode: () => set((state) => ({
      wormControlMode: state.wormControlMode === 'non-oriented' ? 'oriented' : 'non-oriented'
    })),
    wormHealedCount: 0,
    setWormHealedCount: (v) => set({ wormHealedCount: v }),
    wormPhase: 'crawling',
    setWormPhase: (v) => set({ wormPhase: v }),
    wormOnFlippedTile: false,
    setWormOnFlippedTile: (v) => set({ wormOnFlippedTile: v }),
    wormBodyTiles: 0,
    setWormBodyTiles: (v) => set({ wormBodyTiles: v }),
    wormPowerups: [],
    setWormPowerups: (v) => set({ wormPowerups: v }),
    wormholeCountdown: 0,
    setWormholeCountdown: (v) => set({ wormholeCountdown: v }),
    wormAlive: true,
    setWormAlive: (v) => set({ wormAlive: v }),
    showWormDeathMenu: false,
    setShowWormDeathMenu: (v) => set({ showWormDeathMenu: v }),
    wormDeathDetails: null,
    setWormDeathDetails: (v) => set({ wormDeathDetails: v }),
    wormPaused: false,
    setWormPaused: (v) => set({ wormPaused: v }),
    wormTimeAlive: 0,
    setWormTimeAlive: (v) => set({ wormTimeAlive: v }),
    wormTunnelCount: 0,
    setWormTunnelCount: (v) => set({ wormTunnelCount: v }),
    wormOrbInventory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    setWormOrbInventory: (v) => set({ wormOrbInventory: v }),
    wormHealingProgress: {},
    setWormHealingProgress: (v) => set({ wormHealingProgress: v }),
    wormActiveTunnelColors: null,
    // ── Scramble-solve game phase ────────────────────────────────────────────
    wormGamePhase: 'scrambling',   // 'scrambling' | 'spawning' | 'countdown' | 'active' | 'finalHealing' | 'solved'
    setWormGamePhase: (v) => set({ wormGamePhase: v }),
    wormCountdownStep: null,       // null | 3 | 2 | 1 | 'go'
    setWormCountdownStep: (v) => set({ wormCountdownStep: v }),
    wormSessionOrbs: 0,            // orbs picked up this run (shown in HUD; NOT auto-banked)
    setWormSessionOrbs: (v) => set({ wormSessionOrbs: v }),
    clearDisparityGame: () => set({ ...makeWormRuntimeDefaults(), wormHealerMode: false }),
    // Atomic init for Worm Mode — clears disparity state AND enables worm in one set()
    // so wormHealerMode:true can never be clobbered by the reset.
    // wormPaused:true — the scramble animation runs first; gameplay starts after countdown.
    // speed/orbCount/interval/color: when provided, overwrite the stored wizard settings atomically
    // so callers never need separate setWormSpeed/setWormOrbCount/… calls before this one.
    initWormMode: (flipCap = 9999, _chaosLevel = 0, speed = null, orbCount = null, interval = null, color = null) => set((state) => ({
      ...makeWormRuntimeDefaults(),
      wormHealerMode: true,
      disparityFlipCap: flipCap,
      chaosLevel: 0, // worm mode drives its own tile chaos; chaos worker must not run
      wormRunId: (state.wormRunId ?? 0) + 1,
      wormPaused: true, // overrides makeWormRuntimeDefaults wormPaused:false — scramble plays first
      wormSpeed: speed !== null ? Math.max(0.5, Math.min(3.0, speed)) : state.wormSpeed,
      wormOrbCount: orbCount !== null ? Math.max(1, Math.min(24, Math.round(orbCount))) : state.wormOrbCount,
      wormholeInterval: interval !== null ? Math.max(2, Math.min(30, Number(interval))) : state.wormholeInterval,
      wormColor: color !== null ? (color || '#33ff66') : state.wormColor,
    })),

    // ========================================================================
    // ANIMATION STATE
    // ========================================================================
    animState: null, // { axis, dir, sliceIndex, t, isEcho? }
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
    showWelcome: true, // Always show intro on each visit
    showTutorial: false,
    showFirstFlipTutorial: false,
    showHelp: false,
    showSettings: false,
    showMainMenu: true,
    showLevelSelect: false,
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
    // ANTIPODAL INTEGRITY MODE
    // ========================================================================
    antipodalIntegrityMode: false,

    setAntipodalIntegrityMode: (antipodalIntegrityMode) => set({ antipodalIntegrityMode }),
    toggleAntipodalIntegrityMode: () => set((state) => ({
      antipodalIntegrityMode: !state.antipodalIntegrityMode
    })),

    // ========================================================================
    // ANTIPODAL MODE - "Mirror Quotient" (Enhanced RP² Dynamics)
    // ========================================================================
    antipodalMode: false,
    echoDelay: 0.2,              // Delay before antipodal rotation (seconds)
    reversalCount: 0,             // Total antipodal rotations triggered
    echoSync: 100,                // Echo synchronization percentage
    antipodalVizIntensity: 'medium', // 'low', 'medium', 'high'
    pendingEchoRotations: [],     // Queue of pending echo rotations

    setAntipodalMode: (antipodalMode) => set({ antipodalMode }),
    setEchoDelay: (echoDelay) => set({ echoDelay }),
    setReversalCount: (reversalCount) => set(typeof reversalCount === 'function'
      ? (state) => ({ reversalCount: reversalCount(state.reversalCount) })
      : { reversalCount }),
    setEchoSync: (echoSync) => set({ echoSync }),
    setAntipodalVizIntensity: (antipodalVizIntensity) => set({ antipodalVizIntensity }),
    setPendingEchoRotations: (pendingEchoRotations) => set({ pendingEchoRotations }),

    toggleAntipodalMode: () => set((state) => ({
      antipodalMode: !state.antipodalMode,
      reversalCount: !state.antipodalMode ? 0 : state.reversalCount,
    })),

    incrementReversalCount: () => set((state) => ({ reversalCount: state.reversalCount + 1 })),

    addPendingEchoRotation: (rotation) => set((state) => ({
      pendingEchoRotations: [...state.pendingEchoRotations, rotation]
    })),

    removePendingEchoRotation: (id) => set((state) => ({
      pendingEchoRotations: state.pendingEchoRotations.filter(r => r.id !== id)
    })),

    resetAntipodalStats: () => set({
      reversalCount: 0,
      echoSync: 100,
      pendingEchoRotations: [],
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
