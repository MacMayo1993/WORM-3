/**
 * useAnimation Hook
 *
 * Manages animation state and completion callbacks.
 * Includes support for Antipodal Mode (Mirror Quotient).
 */

import { useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { play, vibrate } from '../utils/audio.js';

// Apply a move to the cube state. A move may turn one layer, or several parallel
// layers at once — each with its OWN direction (the worm hazard turns two
// non-adjacent planes in opposite directions). `sliceIndices`/`sliceDirs` are
// parallel arrays; when absent, fall back to the scalar `sliceIndex`/`dir`.
function applyMove(cubies, size, axis, sliceIndex, dir, sliceIndices, sliceDirs, numTurns = 1) {
  let c = cubies;
  const layers = sliceIndices?.length ? sliceIndices : [sliceIndex];
  const dirs = sliceDirs?.length ? sliceDirs : layers.map(() => dir);
  for (let li = 0; li < layers.length; li++) {
    for (let i = 0; i < numTurns; i++) c = rotateSliceCubies(c, size, axis, layers[li], dirs[li]);
  }
  return c;
}

/**
 * Hook for animation management
 */
export function useAnimation() {
  const {
    size,
    animState,
    pendingMove,
    setAnimState,
    setPendingMove,
    clearAnimation,
  } = useGameStore(
    useShallow(s => ({
      size: s.size,
      animState: s.animState,
      pendingMove: s.pendingMove,
      setAnimState: s.setAnimState,
      setPendingMove: s.setPendingMove,
      clearAnimation: s.clearAnimation,
    }))
  );

  const pendingMoveRef = useRef(null);

  // Shuffle animation queue
  const shuffleQueueRef = useRef([]);
  const shuffleDoneRef = useRef(null);
  const isShufflingRef = useRef(false);
  // Monotonically-increasing ID: bump it to invalidate any in-flight shuffle
  // setTimeout callbacks from a previous (cancelled) shuffle session.
  const shuffleIdRef = useRef(0);

  // Start a new animation (atomic: animState and pendingMove set in one render)
  const startAnimation = useCallback((axis, dir, sliceIndex, isUndo = false, sliceIndices = null, sliceDirs = null) => {
    const move = { axis, dir, sliceIndex, isUndo, sliceIndices, sliceDirs };
    pendingMoveRef.current = move;
    useGameStore.setState({
      animState: { axis, dir, sliceIndex, sliceIndices, sliceDirs, t: 0 },
      pendingMove: move,
    });
  }, []);

  // Start an animated shuffle: plays moves sequentially with fast per-move animations.
  // Each move is committed silently (no moves counter, no history).
  // onDone is called after all moves complete.
  const startAnimatedShuffle = useCallback((moves, onDone) => {
    if (!moves || !moves.length) { onDone?.(); return; }
    // Bump the shuffle ID to cancel any pending setTimeout from a prior shuffle.
    const sid = ++shuffleIdRef.current;
    shuffleQueueRef.current = moves.slice(1);
    shuffleDoneRef.current = onDone || null;
    isShufflingRef.current = true;
    const first = { ...moves[0], isShuffle: true, shuffleId: sid };
    pendingMoveRef.current = first;
    useGameStore.setState({ animState: first, pendingMove: first });
  }, []);

  // Cancel any in-flight animated shuffle. Safe to call at any time.
  const cancelShuffle = useCallback(() => {
    shuffleIdRef.current += 1; // Invalidate pending setTimeout callbacks
    isShufflingRef.current = false;
    shuffleQueueRef.current = [];
    shuffleDoneRef.current = null;
    useGameStore.getState().clearAnimation();
  }, []);

  // Handle animation completion
  const handleAnimComplete = useCallback(() => {
    // pendingMoveRef is set by startAnimation. Undo bypasses startAnimation and
    // writes directly to the store, so fall back to the store's pendingMove when
    // the ref is null — this is safe because getState() is always fresh.
    const pm = pendingMoveRef.current ?? useGameStore.getState().pendingMove;
    if (pm) {
      const { axis, dir, sliceIndex, sliceIndices, sliceDirs, isShuffle, isUndo } = pm;

      if (isUndo) {
        // Undo rotation: apply the inverse move to cubies, clear animation.
        // Do NOT increment moves or add to history — useUndo already handled both.
        play('/sounds/rotate.mp3');
        useGameStore.setState((state) => ({
          cubies: rotateSliceCubies(state.cubies, size, axis, sliceIndex, dir),
          rotationEpoch: state.rotationEpoch + 1,
          lastRotation: { axis, sliceIndex, dir },
          animState: null,
          pendingMove: null,
        }));
        pendingMoveRef.current = null;
        return;
      }

      if (isShuffle) {
        // Discard moves belonging to a cancelled shuffle session.
        const sid = pm.shuffleId;
        if (sid !== undefined && sid !== shuffleIdRef.current) {
          pendingMoveRef.current = null;
          return;
        }
        // Shuffle move: commit silently — no moves counter, no undo history.
        play('/sounds/rotate.mp3', 0.6);
        vibrate(12);
        useGameStore.setState((state) => ({
          cubies: applyMove(state.cubies, size, axis, sliceIndex, dir, sliceIndices, sliceDirs),
          rotationEpoch: state.rotationEpoch + 1,
          lastRotation: { axis, sliceIndex, sliceIndices, sliceDirs, dir },
          animState: null,
          pendingMove: null,
        }));
        pendingMoveRef.current = null;

        if (shuffleQueueRef.current.length > 0) {
          const next = { ...shuffleQueueRef.current.shift(), isShuffle: true, shuffleId: sid };
          setTimeout(() => {
            // Re-check: the shuffle may have been cancelled during the delay.
            if (shuffleIdRef.current !== sid) return;
            pendingMoveRef.current = next;
            useGameStore.setState({ animState: next, pendingMove: next });
          }, 20);
        } else {
          isShufflingRef.current = false;
          const done = shuffleDoneRef.current;
          shuffleDoneRef.current = null;
          done?.();
        }
        return;
      }

      // Batch all store updates into a single atomic setState (1 re-render instead of 3-4).
      // Crucially, animState and pendingMove are cleared in the SAME setState so that the
      // cubies update and the animation-end signal are atomic: no React render can fire
      // between them, preventing a frame where new sticker colours appear at old (rotated)
      // mesh positions (the "colour glitch after rotations").
      const numTurns = pm.numTurns ?? 1;
      play('/sounds/rotate.mp3');
      useGameStore.setState((state) => {
        const c = applyMove(state.cubies, size, axis, sliceIndex, dir, sliceIndices, sliceDirs, numTurns);
        return {
          cubies: c,
          rotationEpoch: state.rotationEpoch + 1,
          lastRotation: { axis, sliceIndex, sliceIndices, sliceDirs, dir, numTurns },
          moves: state.moves + numTurns,
          moveHistory: [...state.moveHistory, { type: 'rotation', axis, dir, sliceIndex, numTurns, timestamp: Date.now() }].slice(-10),
          animState: null,
          pendingMove: null,
        };
      });
    } else {
      // No pending move — clear animation state as a safety net.
      clearAnimation();
    }
    pendingMoveRef.current = null;
  }, [
    size,
    clearAnimation,
  ]);

  // Handle move initiation (from UI interactions).
  // numTurns > 1 is used by live-drag commits so multiple quarter-turns are
  // applied in one atomic setState — cubies, rotationEpoch, moves, and history
  // all land in the same render, preventing any intermediate state from
  // triggering win detection or a stale animation frame.
  const onMove = useCallback((axis, dir, sel, numTurns = 1) => {
    const sliceIndex = axis === 'col' ? sel.x : axis === 'row' ? sel.y : sel.z;
    if (numTurns <= 1) {
      startAnimation(axis, dir, sliceIndex);
    } else {
      // Apply all quarter-turns in a single atomic setState so no intermediate
      // render can fire between cubies, moves, and history updates.
      play('/sounds/rotate.mp3');
      useGameStore.setState((state) => {
        let c = state.cubies;
        for (let i = 0; i < numTurns; i++) c = rotateSliceCubies(c, state.size, axis, sliceIndex, dir);
        return {
          cubies: c,
          rotationEpoch: state.rotationEpoch + 1,
          lastRotation: { axis, sliceIndex, dir, numTurns },
          moves: state.moves + numTurns,
          moveHistory: [...state.moveHistory, { type: 'rotation', axis, dir, sliceIndex, numTurns, timestamp: Date.now() }].slice(-10),
        };
      });
    }
  }, [startAnimation]);

  return {
    // State
    animState,
    pendingMove,

    // Refs
    pendingMoveRef,

    // Actions
    startAnimation,
    startAnimatedShuffle,
    cancelShuffle,
    handleAnimComplete,
    onMove,
    setAnimState,
    setPendingMove,
    clearAnimation,
  };
}
