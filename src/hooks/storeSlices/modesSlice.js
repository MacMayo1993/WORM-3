/**
 * modesSlice.js — The secondary modes layered on top of ordinary play: campaign levels, hands
 * (speedcuber) input, the solver/teach overlays, the guided demo, and merge.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

export const createModesSlice = (set, _get) => ({
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
});
