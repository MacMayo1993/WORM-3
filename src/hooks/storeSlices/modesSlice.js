import { WORM_DEMO_LESSON_COUNT, newWormDemo, wormDemoActive } from '../../game/wormDemoState.js';
/**
 * modesSlice.js — Campaign state, solver/teach overlays, and the guided demo.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

import { persistedState } from './persistedState.js';
import { newSolverSession } from '../../teach/solverSession.js';

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
  ...newSolverSession(),

  setSolveModeActive: (solveModeActive) => set(solveModeActive
    ? { solveModeActive: true }
    : newSolverSession()),
  setSolveFocusedStep: (solveFocusedStep) => set({ solveFocusedStep }),
  setSolveHighlights: (solveHighlights) => set({ solveHighlights }),
  setKociembaLayerHighlight: (kociembaLayerHighlight) => set({ kociembaLayerHighlight }),

  // ========================================================================
  // TEACH MODE STATE
  // ========================================================================
  teachModeActive: false,

  setTeachModeActive: (teachModeActive) => set(state => ({ teachModeActive,
    ...(teachModeActive && !state.teachModeActive ? { xpActivityRuns: { ...state.xpActivityRuns, teach: null }, xpNotice: state.xpNotice?.mode === 'teach' ? null : state.xpNotice } : {}),
  })),

  // ========================================================================
  // DEMO MODE
  // ========================================================================
  ...newWormDemo(),
  demoMode: false,
  demoStep: null,
  wormPauseMenuOpen: false,
  demoExploring: false,
  demoExploreComplete: false,

  startDemo: () => set({
    ...newSolverSession(),
    xpActivityRuns: {},
    demoMode: true,
    demoStep: 'baby-cube',
    showMainMenu: false,
  }),
  setDemoStep: (demoStep) => set({ demoStep, ...(demoStep === 'worm-traversal' ? newWormDemo() : { demoWormTarget: null }) }),
  startWormDemoLesson: () => set(s => wormDemoActive(s) && s.demoWormPrepared && ['active', 'finalHealing'].includes(s.wormGamePhase) && !s.demoWormComplete && !s.demoWormFinished && s.wormAlive && !s.wormPauseMenuOpen ? { demoWormStarted: true, wormPaused: false } : {}),
  restartWormDemoLesson: () => set(s => !wormDemoActive(s) ? {} : ({ demoWormAttempt: s.demoWormAttempt + 1, demoWormComplete: false, demoWormProgress: '', demoWormHazardCleared: null, demoWormStarted: false, demoWormPrepared: false, wormAlive: true, wormPaused: true, showWormDeathMenu: false })),
  nextWormDemoLesson: () => set(s => !wormDemoActive(s) ? {} : s.demoWormLessonIndex + 1 >= WORM_DEMO_LESSON_COUNT
    ? { demoWormFinished: true, wormPaused: true, demoWormTarget: null }
    : { demoWormLessonIndex: s.demoWormLessonIndex + 1, demoWormComplete: false, demoWormProgress: '', demoWormHazardCleared: null, demoWormStarted: false, demoWormPrepared: false, wormAlive: true, wormPaused: true }),
  finishWormDemo: () => set(s => wormDemoActive(s) ? { demoWormFinished: true, wormPaused: true, demoWormTarget: null } : {}),
  exitDemo: () => set({
    ...newSolverSession(),
    ...newWormDemo(),
    demoMode: false,
    demoStep: null,
    showMainMenu: true,
  }),


});
