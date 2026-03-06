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

// Load persisted state from localStorage
const loadPersistedState = () => {
  try {
    const settings = localStorage.getItem('worm3_settings');
    const introSeen = localStorage.getItem('worm3_intro_seen') === '1';
    const tutorialDone = localStorage.getItem('worm3_tutorial_done') === '1';
    const firstFlipDone = localStorage.getItem('worm3_first_flip_done') === '1';
    const mobileHintShown = localStorage.getItem('worm3_mobile_hint_shown') === '1';

    return {
      settings: settings ? { ...DEFAULT_SETTINGS, ...JSON.parse(settings) } : { ...DEFAULT_SETTINGS },
      introSeen,
      tutorialDone,
      hasFlippedOnce: firstFlipDone,
      mobileHintShown,
    };
  } catch {
    return {
      settings: { ...DEFAULT_SETTINGS },
      introSeen: false,
      tutorialDone: false,
      hasFlippedOnce: false,
      mobileHintShown: false,
    };
  }
};

// Mobile detection
const isMobile = typeof window !== 'undefined' && (
  window.innerWidth <= 768 ||
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0
);

const persistedState = loadPersistedState();
const MAX_UNDO_HISTORY = 10;

export const useGameStore = create(
  subscribeWithSelector((set, get) => ({
    // ========================================================================
    // CUBE STATE
    // ========================================================================
    size: 3,
    cubies: makeCubies(3),
    rotationEpoch: 0,

    setSize: (size) => set((state) => ({ size, cubies: makeCubies(size), rotationEpoch: state.rotationEpoch + 1 })),
    setCubies: (cubies) => set(typeof cubies === 'function'
      ? (state) => ({ cubies: cubies(state.cubies) })
      : { cubies }),
    // Like setCubies but also increments rotationEpoch so manifoldMap rebuilds
    setRotatedCubies: (cubies) => set(typeof cubies === 'function'
      ? (state) => ({ cubies: cubies(state.cubies), rotationEpoch: state.rotationEpoch + 1 })
      : (state) => ({ cubies, rotationEpoch: state.rotationEpoch + 1 })),

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
    showTunnels: true,
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
    cycleVisualMode: () => set((state) => {
      const modes = ['classic', 'grid', 'sudokube', 'colors'];
      const idx = modes.indexOf(state.visualMode);
      return { visualMode: modes[(idx + 1) % modes.length] };
    }),

    // ========================================================================
    // CHAOS MODE STATE
    // ========================================================================
    chaosLevel: 0, // 0 = off, 1-4 = chaos levels
    autoRotateEnabled: false,
    cascades: [],
    upcomingRotation: null,
    rotationCountdown: 0,
    blackHolePulse: 0,
    flipWaveOrigins: [],

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
      for (const death of deaths) {
        byGrid[death.gridId] = death;
      }
      return {
        disparityDeaths: [...state.disparityDeaths, ...deaths],
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
    wormSpeed: 1.0,
    setWormSpeed: (v) => set({ wormSpeed: v }),
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
    clearDisparityGame: () => set({ disparityDeaths: [], disparityDeathByGridId: {}, disparityWinner: null, showDisparityWinner: false, disparityEliminatedFaces: [], cascades: [], wormHealerMode: false, holonomyMode: false, wormHealedCount: 0, wormPhase: 'crawling', wormOnFlippedTile: false, wormBodyTiles: 0, wormPowerups: [], wormholeCountdown: 0, wormAlive: true, showWormDeathMenu: false }),
    // Atomic init for Worm Mode — clears disparity state AND enables worm in one set()
    // so wormHealerMode:true can never be clobbered by the reset.
    initWormMode: (flipCap = 9999, chaosLevel = 1) => set({ disparityDeaths: [], disparityDeathByGridId: {}, disparityWinner: null, showDisparityWinner: false, disparityEliminatedFaces: [], cascades: [], holonomyMode: false, wormHealedCount: 0, wormPhase: 'crawling', wormOnFlippedTile: false, wormBodyTiles: 0, wormPowerups: [], wormholeCountdown: 0, wormAlive: true, showWormDeathMenu: false, wormHealerMode: true, disparityFlipCap: flipCap, chaosLevel }),

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

    setSolveModeActive: (solveModeActive) => set({ solveModeActive }),
    setSolveFocusedStep: (solveFocusedStep) => set({ solveFocusedStep }),
    setSolveHighlights: (solveHighlights) => set({ solveHighlights }),

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
    // HOLLOW VOID CUBE MODE
    // ========================================================================
    hollowMode: false,
    mirrorMode: false,
    parityCurrent: 0,      // 0-1, smoothly lerped
    parityTarget: 0,       // 0 or 1
    chaosCurrent: 0,       // 0-1, smoothly lerped
    chaosTarget: 0,        // 0-1 based on chaosLevel

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

// Subscribe to settings changes and persist to localStorage
useGameStore.subscribe(
  (state) => state.settings,
  (settings) => {
    try {
      localStorage.setItem('worm3_settings', JSON.stringify(settings));
    } catch { }
  }
);
