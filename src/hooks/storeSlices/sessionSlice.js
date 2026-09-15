/**
 * sessionSlice.js — One playthrough: move count, clock, victory state, and the undo history.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

import { makeDisparityRuntimeDefaults, MAX_UNDO_HISTORY } from './sessionDefaults.js';

export const createSessionSlice = (set, get) => ({
  // ========================================================================
  // GAME SESSION STATE
  // ========================================================================
  moves: 0,
  gameTime: 0,
  gameStartTime: Date.now(),
  hasShuffled: false,
  // null | 'rubiks' | 'worm'. The Sudokube and Ultimate screens were removed;
  // achievedWins still carries their keys so old saved profiles deserialise.
  victory: null,
  achievedWins: { rubiks: false, sudokube: false, ultimate: false, worm: false },

  setMoves: (moves) => set(typeof moves === 'function'
    ? (state) => ({ moves: moves(state.moves) })
    : { moves }),
  setGameTime: (gameTime) => set({ gameTime }),
  setGameStartTime: (gameStartTime) => set({ gameStartTime }),
  setHasShuffled: (hasShuffled, scrambleMoves = 15) => {
    set({ hasShuffled });
    if (hasShuffled) get().beginPuzzleXp?.(scrambleMoves);
  },
  setVictory: (victory) => {
    set({ victory });
    if (victory) get().completePuzzleXp?.();
  },
  setAchievedWins: (achievedWins) => set(typeof achievedWins === 'function'
    ? (state) => ({ achievedWins: achievedWins(state.achievedWins) })
    : { achievedWins }),

  incrementMoves: () => set((state) => ({ moves: state.moves + 1 })),
  resetGame: () => set({
    xpRun: null,
    moves: 0,
    gameTime: 0,
    gameStartTime: Date.now(),
    victory: null,
    achievedWins: { rubiks: false, sudokube: false, ultimate: false, worm: false },
    hasShuffled: false,
    moveHistory: [],
    // Full wipe of Chaos & Disparity states to ensure a truly fresh cube
    chaosLevel: 0,
    ...makeDisparityRuntimeDefaults(),
    blackHolePulse: 0,
    flipWaveOrigins: [],
    flipPulse: null,
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
});
