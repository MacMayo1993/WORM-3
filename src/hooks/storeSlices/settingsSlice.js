/**
 * settingsSlice.js — Player settings, face imagery, the first-flip milestone, and the one-shot
 * "seen it" markers. Settings themselves persist via subscription in
 * useGameStore.js — these actions only write the boolean markers.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

import { persistedState } from './persistedState.js';

export const createSettingsSlice = (set, _get) => ({
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
});
