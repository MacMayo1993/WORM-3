/**
 * cubeSlice.js — The cube itself: geometry, the rotation epoch consumers key their caches on,
 * and the adaptive-quality flag PerformanceMonitor drives.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

import { makeCubies } from '../../game/cubeState.js';

export const createCubeSlice = (set, _get) => ({
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
});
