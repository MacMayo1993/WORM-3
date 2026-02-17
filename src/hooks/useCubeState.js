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
import { getStickerWorldPos } from '../game/coordinates.js';
import { play } from '../utils/audio.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { isInRefractory, markFlipped, clearRefractory } from '../game/refractoryMap.js';

/**
 * Hook for cube state management
 */
export function useCubeState() {
  const size = useGameStore((state) => state.size);
  const cubies = useGameStore((state) => state.cubies);
  const setCubies = useGameStore((state) => state.setCubies);
  const setSize = useGameStore((state) => state.setSize);
  const settings = useGameStore((state) => state.settings);
  const explosionT = useGameStore((state) => state.explosionT);

  const setMoves = useGameStore((state) => state.setMoves);
  const setHasShuffled = useGameStore((state) => state.setHasShuffled);
  const resetGame = useGameStore((state) => state.resetGame);
  const addToHistory = useGameStore((state) => state.addToHistory);
  const clearHistory = useGameStore((state) => state.clearHistory);

  const setBlackHolePulse = useGameStore((state) => state.setBlackHolePulse);
  const setFlipWaveOrigins = useGameStore((state) => state.setFlipWaveOrigins);
  const hasFlippedOnce = useGameStore((state) => state.hasFlippedOnce);
  const setHasFlippedOnce = useGameStore((state) => state.setHasFlippedOnce);
  const setShowFirstFlipTutorial = useGameStore((state) => state.setShowFirstFlipTutorial);

  // Refs for accessing current state in callbacks
  const cubiesRef = useRef(cubies);
  cubiesRef.current = cubies;
  const explosionTRef = useRef(explosionT);
  explosionTRef.current = explosionT;

  const resolvedColors = useMemo(() => resolveColors(settings), [settings]);
  const resolvedColorsRef = useRef(resolvedColors);
  resolvedColorsRef.current = resolvedColors;

  // Build manifold map.
  // Kept in a ref so flipSticker can read the latest value without calling
  // buildManifoldGridMap a second time on the same cubies snapshot.
  const manifoldMap = useMemo(() => {
    if (cubies.length !== size) return new Map();
    return buildManifoldGridMap(cubies, size);
  }, [cubies, size]);
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

  // Apply rotation to cubies
  const rotateSlice = useCallback((axis, sliceIndex, dir) => {
    setCubies((prev) => rotateSliceCubies(prev, size, axis, sliceIndex, dir));
    setMoves((m) => m + 1);
    play('/sounds/rotate.mp3');
    addToHistory({ type: 'rotation', axis, dir, sliceIndex, timestamp: Date.now() });
  }, [size, setCubies, setMoves, addToHistory]);

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

    if (sticker) {
      const antipodalLoc = findAntipodalStickerByGrid(currentManifoldMap, sticker, currentSize);
      const origins = [];
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

      setFlipWaveOrigins(origins);
    }

    setCubies((prev) => {
      const freshManifoldMap = buildManifoldGridMap(prev, prev.length);
      return flipStickerPair(prev, prev.length, pos.x, pos.y, pos.z, dirKey, freshManifoldMap);
    });
    setMoves((m) => m + 1);
    addToHistory({ type: 'flip', pos: { ...pos }, dirKey, timestamp: Date.now() });
    setBlackHolePulse(Date.now());

    // First flip tutorial trigger
    if (!hasFlippedOnce) {
      setHasFlippedOnce(true);
      setTimeout(() => setShowFirstFlipTutorial(true), 600);
    }
  }, [setCubies, setMoves, addToHistory, getRotationForDir, setBlackHolePulse, setFlipWaveOrigins, hasFlippedOnce, setHasFlippedOnce, setShowFirstFlipTutorial]);

  // Shuffle the cube
  const shuffle = useCallback(() => {
    let state = makeCubies(size);
    for (let i = 0; i < 25; i++) {
      const ax = ['row', 'col', 'depth'][Math.floor(Math.random() * 3)];
      const slice = Math.floor(Math.random() * size);
      const dir = Math.random() > 0.5 ? 1 : -1;
      state = rotateSliceCubies(state, size, ax, slice, dir);
    }
    setCubies(state);
    resetGame();
    clearHistory();
    clearRefractory();
    setHasShuffled(true);
  }, [size, setCubies, resetGame, clearHistory, setHasShuffled]);

  // Reset to solved state
  const reset = useCallback(() => {
    setCubies(makeCubies(size));
    resetGame();
    clearHistory();
    clearRefractory();
    play('/sounds/rotate.mp3');
  }, [size, setCubies, resetGame, clearHistory]);

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
    changeSize,
    rotateSlice,
    flipSticker,
    shuffle,
    reset,
    getRotationForDir,
  };
}
