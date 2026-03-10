/**
 * useCubeState Hook
 *
 * Manages cube state, rotations, flips, and related operations.
 */

import { useCallback, useMemo, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { healSticker as healStickerState } from '../game/cubeState.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { play } from '../utils/audio.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { isInRefractory, markFlipped, clearRefractory } from '../game/refractoryMap.js';
import { computeMergeRegions } from '../modes/merge/index.js';
import { collapseSlice, applyCollapse, createSuperposition, clearSuperposition } from '../game/quantumState.js';

// Recompute merge region tiers from the current store state and persist them.
// Called imperatively after every rotation/shuffle when merge mode is active.
function updateMergeTiers() {
  const { mergeMode, cubies, size, setMergeRegionTiers } = useGameStore.getState();
  if (!mergeMode) return;
  setMergeRegionTiers(computeMergeRegions(cubies, size));
}

/**
 * Hook for cube state management
 */
export function useCubeState() {
  const size = useGameStore((state) => state.size);
  const cubies = useGameStore((state) => state.cubies);
  const rotationEpoch = useGameStore((state) => state.rotationEpoch);
  const setCubies = useGameStore((state) => state.setCubies);
  const setRotatedCubies = useGameStore((state) => state.setRotatedCubies);
  const setSize = useGameStore((state) => state.setSize);
  const settings = useGameStore((state) => state.settings);
  const explosionT = useGameStore((state) => state.explosionT);

  const setHasShuffled = useGameStore((state) => state.setHasShuffled);
  const resetGame = useGameStore((state) => state.resetGame);
  const clearHistory = useGameStore((state) => state.clearHistory);

  const hasFlippedOnce = useGameStore((state) => state.hasFlippedOnce);
  const setShowFirstFlipTutorial = useGameStore((state) => state.setShowFirstFlipTutorial);

  // Refs for accessing current state in callbacks
  const cubiesRef = useRef(cubies);
  cubiesRef.current = cubies;
  const explosionTRef = useRef(explosionT);
  explosionTRef.current = explosionT;

  const resolvedColors = useMemo(() => resolveColors(settings, settings.biomeMode?.faceAssignment), [settings]);
  const resolvedColorsRef = useRef(resolvedColors);
  resolvedColorsRef.current = resolvedColors;

  // Build manifold map.
  // Only rebuilds when cube geometry changes (rotations/size changes), not on
  // sticker flips. rotationEpoch is bumped by setRotatedCubies/setSize.
  // We read from cubiesRef.current so we always get the post-rotation snapshot
  // even if React hasn't re-rendered yet.
  const manifoldMap = useMemo(() => {
    const c = cubiesRef.current;
    if (!c || c.length !== size) return new Map();
    return buildManifoldGridMap(c, size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotationEpoch, size]);
  const manifoldMapRef = useRef(manifoldMap);
  manifoldMapRef.current = manifoldMap;

  // Calculate metrics
  const metrics = useMemo(() => {
    let flips = 0,
      wormholes = 0,
      off = 0,
      total = 0;
    for (const L of cubies)
      for (const R of L)
        for (const c of R) {
          for (const k of Object.keys(c.stickers)) {
            const s = c.stickers[k];
            flips += s.flips || 0;
            total++;
            if (s.curr !== s.orig) off++;
            if (s.flips > 0 && s.curr !== s.orig) wormholes++;
          }
        }
    return { flips, wormholes, entropy: Math.round((off / total) * 100) };
  }, [cubies]);

  // Get rotation direction for sticker
  const getRotationForDir = useCallback((dir) => {
    switch (dir) {
      case 'PX': return [0, Math.PI / 2, 0];
      case 'NX': return [0, -Math.PI / 2, 0];
      case 'PY': return [-Math.PI / 2, 0, 0];
      case 'NY': return [Math.PI / 2, 0, 0];
      case 'PZ': return [0, 0, 0];
      case 'NZ': return [0, Math.PI, 0];
      default: return [0, 0, 0];
    }
  }, []);

  // Apply rotation to cubies — single atomic setState (1 re-render instead of 3).
  // When Quantum Mode is active, also collapses any superposed stickers in the
  // rotated slice (wave-function collapse: measurement forces a definite color).
  const rotateSlice = useCallback((axis, sliceIndex, dir) => {
    play('/sounds/rotate.mp3');
    useGameStore.setState((state) => {
      const rotatedCubies = rotateSliceCubies(state.cubies, size, axis, sliceIndex, dir);

      // Quantum collapse: stickers in the rotated slice pick a definite color
      let finalCubies = rotatedCubies;
      let newSuperposed = state.superposedStickers;
      if (state.quantumMode && state.superposedStickers && Object.keys(state.superposedStickers).length > 0) {
        const [collapsed, events] = collapseSlice(state.superposedStickers, size, axis, sliceIndex);
        newSuperposed = collapsed;
        finalCubies = applyCollapse(rotatedCubies, events);
      }

      return {
        cubies: finalCubies,
        rotationEpoch: state.rotationEpoch + 1,
        moves: state.moves + 1,
        moveHistory: [...state.moveHistory, { type: 'rotation', axis, dir, sliceIndex, timestamp: Date.now() }].slice(-10),
        superposedStickers: newSuperposed,
      };
    });
    updateMergeTiers();
  }, [size]);

  // Flip sticker pair
  const flipSticker = useCallback((pos, dirKey) => {
    // Refractory period — tile can't flip again within 7 seconds
    if (isInRefractory(pos.x, pos.y, pos.z, dirKey)) return;

    const currentCubies = cubiesRef.current;
    const currentSize = currentCubies.length;
    const currentExplosionT = explosionTRef.current;
    // Re-use the manifold map already computed by useMemo — sticker flips don't
    // change cube geometry so the cached map is always valid here.
    const currentManifoldMap = manifoldMapRef.current;
    const sticker = currentCubies[pos.x]?.[pos.y]?.[pos.z]?.stickers?.[dirKey];
    const origins = [];

    if (sticker) {
      const antipodalLoc = findAntipodalStickerByGrid(currentManifoldMap, sticker, currentSize);
      const antipodalColor = resolvedColorsRef.current[ANTIPODAL_COLOR[sticker.curr]];

      origins.push({
        position: getStickerWorldPos(pos.x, pos.y, pos.z, dirKey, currentSize, currentExplosionT),
        rotation: getRotationForDir(dirKey),
        color: antipodalColor,
        id: Date.now()
      });

      if (antipodalLoc) {
        const antipodalSticker = currentCubies[antipodalLoc.x]?.[antipodalLoc.y]?.[antipodalLoc.z]?.stickers?.[antipodalLoc.dirKey];
        const pairAntipodalColor = resolvedColorsRef.current[ANTIPODAL_COLOR[antipodalSticker?.curr || 1]];
        origins.push({
          position: getStickerWorldPos(antipodalLoc.x, antipodalLoc.y, antipodalLoc.z, antipodalLoc.dirKey, currentSize, currentExplosionT),
          rotation: getRotationForDir(antipodalLoc.dirKey),
          color: pairAntipodalColor,
          id: Date.now() + 1
        });
      }

      // Mark both tiles in the pair as in refractory period
      markFlipped(pos.x, pos.y, pos.z, dirKey);
      if (antipodalLoc) {
        markFlipped(antipodalLoc.x, antipodalLoc.y, antipodalLoc.z, antipodalLoc.dirKey);
      }

    }

    // Batch all flip state changes into a single atomic setState (1 re-render instead of 5-6)
    const ts = Date.now();
    const isFirstFlip = !hasFlippedOnce;
    useGameStore.setState((state) => ({
      cubies: flipStickerPair(state.cubies, state.cubies.length, pos.x, pos.y, pos.z, dirKey, currentManifoldMap),
      moves: state.moves + 1,
      moveHistory: [...state.moveHistory, { type: 'flip', pos: { ...pos }, dirKey, timestamp: ts }].slice(-10),
      flipWaveOrigins: origins,
      blackHolePulse: ts,
      ...(isFirstFlip ? { hasFlippedOnce: true } : {}),
    }));

    // First flip tutorial trigger (runs after state is set, uses timeout so it fires after render)
    if (isFirstFlip) {
      setTimeout(() => setShowFirstFlipTutorial(true), 600);
    }
  }, [getRotationForDir, hasFlippedOnce, setShowFirstFlipTutorial]);

  // Heal sticker (reset flips and colors)
  const healSticker = useCallback((pos, dirKey) => {
    useGameStore.setState((state) => ({
      cubies: healStickerState(state.cubies, state.cubies.length, pos.x, pos.y, pos.z, dirKey),
    }));
  }, []);

  // Shuffle the cube with optional Smoke Screen and Quantum Superposition effects.
  const shuffle = useCallback(() => {
    // Fire the smoke screen before scrambling — the smoke hides the individual moves
    useGameStore.setState({ smokePhase: 'building' });

    let scrambled = makeCubies(size);
    for (let i = 0; i < 25; i++) {
      const ax = ['row', 'col', 'depth'][Math.floor(Math.random() * 3)];
      const slice = Math.floor(Math.random() * size);
      const dir = Math.random() > 0.5 ? 1 : -1;
      scrambled = rotateSliceCubies(scrambled, size, ax, slice, dir);
    }

    // Quantum Mode: after scrambling, mark ~45% of stickers as superposed so
    // the player doesn't immediately know which color each sticker "really" is.
    const { quantumMode } = useGameStore.getState();
    const newSuperposed = quantumMode ? createSuperposition(scrambled, size, 0.45) : clearSuperposition();

    setRotatedCubies(scrambled);
    resetGame();
    clearHistory();
    clearRefractory();
    setHasShuffled(true);
    useGameStore.setState({ superposedStickers: newSuperposed });
    updateMergeTiers();
  }, [size, setRotatedCubies, resetGame, clearHistory, setHasShuffled]);

  // Reset to solved state
  const reset = useCallback(() => {
    setRotatedCubies(makeCubies(size));
    resetGame();
    clearHistory();
    clearRefractory();
    play('/sounds/rotate.mp3');
  }, [size, setRotatedCubies, resetGame, clearHistory]);

  // Change cube size
  const changeSize = useCallback((newSize) => {
    setSize(newSize);
    resetGame();
    clearHistory();
    clearRefractory();
  }, [setSize, resetGame, clearHistory]);

  return {
    // State
    size,
    cubies,
    manifoldMap,
    metrics,
    resolvedColors,

    // Refs
    cubiesRef,
    explosionTRef,
    resolvedColorsRef,

    // Actions
    setCubies,
    setRotatedCubies,
    changeSize,
    rotateSlice,
    flipSticker,
    healSticker,
    shuffle,
    reset,
    getRotationForDir,
  };
}
