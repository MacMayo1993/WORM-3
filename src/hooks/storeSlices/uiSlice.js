/**
 * uiSlice.js — Screen and input chrome: which surfaces are open, the keyboard cursor, the
 * in-flight rotation animation, mobile face-rotation targets, dev console.
 *
 * The show* flags here are what src/hooks/uiSurfaces.js reads to decide which
 * surface owns the screen — register new full-screen modals there too.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

import { isMobile } from '../../utils/device.js';
import { persistedState } from './persistedState.js';

export const createUiSlice = (set, _get) => ({
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
  // DEV CONSOLE STATE (NEW)
  // ========================================================================
  showDevConsole: false,
  savedCubeState: null,

  setShowDevConsole: (showDevConsole) => set({ showDevConsole }),
  setSavedCubeState: (savedCubeState) => set({ savedCubeState }),
  toggleDevConsole: () => set((state) => ({ showDevConsole: !state.showDevConsole })),

  // ========================================================================
  // FACE ROTATION MODE (MOBILE)
  // ========================================================================
  faceRotationTarget: null,
  selectedTileForRotation: null,

  setFaceRotationTarget: (faceRotationTarget) => set({ faceRotationTarget }),
  setSelectedTileForRotation: (selectedTileForRotation) => set({ selectedTileForRotation }),
});
