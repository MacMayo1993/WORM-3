/**
 * useCubeState Hook
 *
 * Manages cube state, rotations, flips, and related operations.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { flipStickerPair, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { getManifoldMap } from '../game/manifoldMapStore.js';
import { healSticker as healStickerState } from '../game/cubeState.js';
import { getStickerWorldPos, getManifoldGridId } from '../game/coordinates.js';
import { play } from '../utils/audio.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { isInRefractory, markFlipped, clearRefractory } from '../game/refractoryMap.js';
import { computeMergeRegions } from '../modes/merge/index.js';
import { pruneExpiredFx } from '../utils/transientFx.js';

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

  // Manifold map comes from the single shared owner (manifoldMapStore), keyed on
  // (size, rotationEpoch). It only rebuilds when cube geometry changes (rotations/size),
  // never on sticker flips, and returns a fresh Map reference whenever the epoch advances
  // so memoized prop consumers re-render — while staying reference-stable across flips.
  const manifoldMap = useMemo(() => {
    if (!cubies || cubies.length !== size) return new Map();
    return getManifoldMap(cubies, size, rotationEpoch);
  }, [cubies, size, rotationEpoch]);
  const manifoldMapRef = useRef(manifoldMap);
  manifoldMapRef.current = manifoldMap;

  // Calculate metrics. Only surface cubies carry stickers, so skip the fully-interior
  // cubies entirely instead of walking the whole n³ lattice — this memo recomputes on
  // every cubies change, including the high-frequency chaos/worm flip stream.
  const metrics = useMemo(() => {
    let flips = 0,
      wormholes = 0,
      off = 0,
      total = 0;
    const last = size - 1;
    for (let x = 0; x < size; x++) {
      const onXFace = x === 0 || x === last;
      for (let y = 0; y < size; y++) {
        const onYFace = y === 0 || y === last;
        for (let z = 0; z < size; z++) {
          if (!onXFace && !onYFace && z !== 0 && z !== last) continue; // interior: no stickers
          const stickers = cubies[x][y][z].stickers;
          for (const k in stickers) {
            const s = stickers[k];
            flips += s.flips || 0;
            total++;
            if (s.curr !== s.orig) off++;
            if (s.flips > 0 && s.curr !== s.orig) wormholes++;
          }
        }
      }
    }
    return { flips, wormholes, entropy: total ? Math.round((off / total) * 100) : 0 };
  }, [cubies, size]);

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

  // Apply rotation to cubies — single atomic setState (1 re-render instead of 3)
  const rotateSlice = useCallback((axis, sliceIndex, dir) => {
    play('/sounds/rotate.mp3');
    useGameStore.setState((state) => ({
      cubies: rotateSliceCubies(state.cubies, size, axis, sliceIndex, dir),
      rotationEpoch: state.rotationEpoch + 1,
      lastRotation: { axis, sliceIndex, dir },
      moves: state.moves + 1,
      moveHistory: [...state.moveHistory, { type: 'rotation', axis, dir, sliceIndex, timestamp: Date.now() }].slice(-10),
    }));
    updateMergeTiers();
  }, [size]);

  // Pending first-flip highlight timer — when the player's very first flip is
  // intercepted, the highlight rings + tether are shown for 800ms before the
  // actual flip executes, so they see both linked tiles light up first.
  const firstFlipTimerRef = useRef(null);
  useEffect(() => () => { if (firstFlipTimerRef.current) clearTimeout(firstFlipTimerRef.current); }, []);

  // Flip sticker pair
  const flipSticker = useCallback((pos, dirKey) => {
    // Block taps while the first-flip highlight is showing
    if (firstFlipTimerRef.current) return;

    // Refractory period — tile can't flip again within 7 seconds
    if (isInRefractory(pos.x, pos.y, pos.z, dirKey)) return;

    const currentCubies = cubiesRef.current;
    const currentSize = currentCubies.length;
    const currentExplosionT = explosionTRef.current;
    // Re-use the manifold map already computed by useMemo — sticker flips don't
    // change cube geometry so the cached map is always valid here.
    const currentManifoldMap = manifoldMapRef.current;
    const sticker = currentCubies[pos.x]?.[pos.y]?.[pos.z]?.stickers?.[dirKey];

    // ── First-flip interception ───────────────────────────────────────────
    // Before the very first flip, show the antipodal pair highlight for 800ms
    // so the player sees both linked tiles light up before the flip fires.
    if (!hasFlippedOnce && sticker) {
      const antipodalLoc = findAntipodalStickerByGrid(currentManifoldMap, sticker, currentSize);
      if (antipodalLoc) {
        const antSticker = currentCubies[antipodalLoc.x]?.[antipodalLoc.y]?.[antipodalLoc.z]?.stickers?.[antipodalLoc.dirKey];
        useGameStore.getState().setFirstFlipHighlightPair({
          source: { x: pos.x, y: pos.y, z: pos.z, dir: dirKey, faceId: sticker.curr },
          antipodal: {
            x: antipodalLoc.x, y: antipodalLoc.y, z: antipodalLoc.z,
            dir: antipodalLoc.dirKey,
            faceId: antSticker?.curr,
          },
        });
        play('/sounds/rotate.mp3');
        firstFlipTimerRef.current = setTimeout(() => {
          firstFlipTimerRef.current = null;
          flipSticker(pos, dirKey);
        }, 800);
        return;
      }
    }

    const origins = [];

    // Animation state vars — populated inside the if(sticker) block below
    const now = performance.now();
    const srcKey = `${pos.x},${pos.y},${pos.z}`;
    let antKey = null;
    let isFirstFlipOnPair = false;
    let pairId = null;

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

      // Compute animation keys
      antKey = antipodalLoc ? `${antipodalLoc.x},${antipodalLoc.y},${antipodalLoc.z}` : null;
      isFirstFlipOnPair = sticker.flips === 0;
      if (antipodalLoc) {
        const antipodalSticker = currentCubies[antipodalLoc.x]?.[antipodalLoc.y]?.[antipodalLoc.z]?.stickers?.[antipodalLoc.dirKey];
        if (antipodalSticker) {
          const srcGridId = getManifoldGridId(sticker, currentSize);
          const antGridId = getManifoldGridId(antipodalSticker, currentSize);
          pairId = [srcGridId, antGridId].sort().join('|');
        }
      }
    }

    // Batch all flip state changes into a single atomic setState (1 re-render instead of 5-6)
    const ts = Date.now();
    const isFirstFlip = !hasFlippedOnce;
    const popDuration = isFirstFlip ? 1200 : 600;
    const tunnelBirthDuration = isFirstFlip ? 1400 : 700;
    useGameStore.setState((state) => ({
      cubies: flipStickerPair(state.cubies, state.cubies.length, pos.x, pos.y, pos.z, dirKey, currentManifoldMap),
      moves: state.moves + 1,
      moveHistory: [...state.moveHistory, { type: 'flip', pos: { ...pos }, dirKey, timestamp: ts }].slice(-10),
      flipWaveOrigins: origins,
      blackHolePulse: ts,
      cubiePops: {
        ...pruneExpiredFx(state.cubiePops, now),
        [srcKey]: { startMs: now, durationMs: popDuration },
        ...(antKey ? { [antKey]: { startMs: now, durationMs: popDuration } } : {}),
      },
      tunnelBirths: (isFirstFlipOnPair && pairId) ? {
        ...pruneExpiredFx(state.tunnelBirths, now),
        [pairId]: { startMs: now, durationMs: tunnelBirthDuration },
      } : pruneExpiredFx(state.tunnelBirths, now),
      tunnelPulses: (!isFirstFlipOnPair && pairId) ? {
        ...pruneExpiredFx(state.tunnelPulses, now),
        [pairId]: { startMs: now, durationMs: 400 },
      } : pruneExpiredFx(state.tunnelPulses, now),
      ...(isFirstFlip ? { hasFlippedOnce: true, firstFlipHighlightPair: null } : {}),
    }));

    // The guided demo narrates flips itself — don't stack the first-flip
    // caption/tutorial on top of it (it lingers beneath the demo overlays).
    if (isFirstFlip && !useGameStore.getState().demoMode) {
      setTimeout(() => useGameStore.getState().setShowFirstFlipCaption(true), 400);
      setTimeout(() => {
        if (!useGameStore.getState().demoMode) setShowFirstFlipTutorial(true);
      }, 3000);
    }
  }, [getRotationForDir, hasFlippedOnce, setShowFirstFlipTutorial]);

  // Heal sticker (reset flips and colors)
  const healSticker = useCallback((pos, dirKey) => {
    useGameStore.setState((state) => ({
      cubies: healStickerState(state.cubies, state.cubies.length, pos.x, pos.y, pos.z, dirKey),
    }));
  }, []);

  // Shuffle the cube
  const shuffle = useCallback(() => {
    let state = makeCubies(size);
    for (let i = 0; i < 25; i++) {
      const ax = ['row', 'col', 'depth'][Math.floor(Math.random() * 3)];
      const slice = Math.floor(Math.random() * size);
      const dir = Math.random() > 0.5 ? 1 : -1;
      state = rotateSliceCubies(state, size, ax, slice, dir);
    }
    setRotatedCubies(state);
    resetGame();
    clearHistory();
    clearRefractory();
    setHasShuffled(true);
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
