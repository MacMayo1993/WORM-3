/**
 * modesSlice.js — Campaign state, solver/teach overlays, and the guided demo.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

import { persistedState } from './persistedState.js';

export const createModesSlice = (set, _get) => ({
  // ========================================================================
  // PER-MODE PLAY RECORD
  // ========================================================================
  // { [modeId]: { plays, lastPlayed } }. The mode carousel's stat row reads it;
  // ModeCarousel's PLAY handler is the only writer. Nothing else in the game
  // records anything per mode, so this is what lets a mode other than STORY say
  // something true about the player's history with it.
  modePlays: persistedState.modePlays ?? {},

  recordModePlay: (modeId) => set((state) => {
    if (!modeId) return {};
    const prev = state.modePlays[modeId];
    return {
      modePlays: {
        ...state.modePlays,
        [modeId]: { plays: (prev?.plays ?? 0) + 1, lastPlayed: Date.now() },
      },
    };
  }),

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
  wormPauseMenuOpen: false,
  demoExploring: false,
  demoExploreComplete: false,

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


});
