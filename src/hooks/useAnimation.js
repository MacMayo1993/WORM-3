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
import { play } from '../utils/audio.js';
import gsap from 'gsap';
import {
  getAntipodalSliceIndex,
  getReverseDirection,
  shouldTriggerEcho,
  generateEchoId,
  getAntipodalFaceInfo,
} from '../game/antipodalMode.js';

/**
 * Hook for animation management
 */
export function useAnimation() {
  const {
    size,
    setRotatedCubies,
    setMoves,
    animState,
    pendingMove,
    setAnimState,
    setPendingMove,
    clearAnimation,
    addToHistory,
    antipodalMode,
    echoDelay,
    addPendingEchoRotation,
    removePendingEchoRotation,
  } = useGameStore(
    useShallow(s => ({
      size: s.size,
      setRotatedCubies: s.setRotatedCubies,
      setMoves: s.setMoves,
      animState: s.animState,
      pendingMove: s.pendingMove,
      setAnimState: s.setAnimState,
      setPendingMove: s.setPendingMove,
      clearAnimation: s.clearAnimation,
      addToHistory: s.addToHistory,
      antipodalMode: s.antipodalMode,
      echoDelay: s.echoDelay,
      addPendingEchoRotation: s.addPendingEchoRotation,
      removePendingEchoRotation: s.removePendingEchoRotation,
    }))
  );

  const pendingMoveRef = useRef(null);
  const echoTimeoutsRef = useRef([]);
  const echoQueueRef = useRef([]);

  // Shuffle animation queue
  const shuffleQueueRef = useRef([]);
  const shuffleDoneRef = useRef(null);
  const isShufflingRef = useRef(false);

  // Start a new animation (atomic: animState and pendingMove set in one render)
  const startAnimation = useCallback((axis, dir, sliceIndex, isEcho = false) => {
    const move = { axis, dir, sliceIndex, isEcho };
    pendingMoveRef.current = move;
    useGameStore.setState({
      animState: { axis, dir, sliceIndex, t: 0, isEcho },
      pendingMove: move,
    });
  }, []);

  // Start an animated shuffle: plays moves sequentially with fast per-move animations.
  // Each move is committed silently (no moves counter, no history).
  // onDone is called after all moves complete.
  const startAnimatedShuffle = useCallback((moves, onDone) => {
    if (!moves || !moves.length) { onDone?.(); return; }
    shuffleQueueRef.current = moves.slice(1);
    shuffleDoneRef.current = onDone || null;
    isShufflingRef.current = true;
    const first = { ...moves[0], isShuffle: true };
    pendingMoveRef.current = first;
    useGameStore.setState({ animState: first, pendingMove: first });
  }, []);

  // Handle animation completion
  const handleAnimComplete = useCallback(() => {
    // pendingMoveRef is set by startAnimation. Undo bypasses startAnimation and
    // writes directly to the store, so fall back to the store's pendingMove when
    // the ref is null — this is safe because getState() is always fresh.
    const pm = pendingMoveRef.current ?? useGameStore.getState().pendingMove;
    if (pm) {
      const { axis, dir, sliceIndex, isEcho, isShuffle, isUndo } = pm;

      if (isUndo) {
        // Undo rotation: apply the inverse move to cubies, clear animation.
        // Do NOT increment moves or add to history — useUndo already handled both.
        play('/sounds/rotate.mp3');
        useGameStore.setState((state) => ({
          cubies: rotateSliceCubies(state.cubies, size, axis, sliceIndex, dir),
          rotationEpoch: state.rotationEpoch + 1,
          animState: null,
          pendingMove: null,
        }));
        pendingMoveRef.current = null;
        return;
      }

      if (isShuffle) {
        // Shuffle move: commit silently — no moves counter, no undo history, no echo.
        play('/sounds/rotate.mp3', 0.6);
        useGameStore.setState((state) => ({
          cubies: rotateSliceCubies(state.cubies, size, axis, sliceIndex, dir),
          rotationEpoch: state.rotationEpoch + 1,
          animState: null,
          pendingMove: null,
        }));
        pendingMoveRef.current = null;

        if (shuffleQueueRef.current.length > 0) {
          const next = { ...shuffleQueueRef.current.shift(), isShuffle: true };
          setTimeout(() => {
            pendingMoveRef.current = next;
            useGameStore.setState({ animState: next, pendingMove: next });
          }, 50);
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
      if (!isEcho) {
        play('/sounds/rotate.mp3');
        useGameStore.setState((state) => ({
          cubies: rotateSliceCubies(state.cubies, size, axis, sliceIndex, dir),
          rotationEpoch: state.rotationEpoch + 1,
          moves: state.moves + 1,
          moveHistory: [...state.moveHistory, { type: 'rotation', axis, dir, sliceIndex, timestamp: Date.now() }].slice(-10),
          animState: null,
          pendingMove: null,
        }));
      } else {
        // Echo rotation - quieter sound; only bump cubies + reversalCount
        play('/sounds/rotate.mp3', 0.7);
        useGameStore.setState((state) => ({
          cubies: rotateSliceCubies(state.cubies, size, axis, sliceIndex, dir),
          rotationEpoch: state.rotationEpoch + 1,
          reversalCount: state.reversalCount + 1,
          animState: null,
          pendingMove: null,
        }));
      }

      // Trigger antipodal echo rotation if mode is enabled and this is NOT already an echo
      if (!isEcho && antipodalMode && shouldTriggerEcho(axis, sliceIndex, size)) {
        const antipodalSlice = getAntipodalSliceIndex(axis, sliceIndex, size);
        const reverseDir = getReverseDirection(dir);
        const echoId = generateEchoId();
        const faceInfo = getAntipodalFaceInfo(axis, sliceIndex, size);

        // Add to pending echo rotations (for visualization)
        addPendingEchoRotation({
          id: echoId,
          axis,
          dir: reverseDir,
          sliceIndex: antipodalSlice,
          originalSlice: sliceIndex,
          faceInfo,
          startTime: Date.now(),
        });

        // Schedule echo rotation ANIMATION with delay
        const timeoutId = gsap.delayedCall(echoDelay, () => {
          // Check CURRENT animation state (not closure-captured state)
          const currentAnimState = useGameStore.getState().animState;

          // If there's an active animation, queue this echo
          if (currentAnimState) {
            echoQueueRef.current.push({ axis, dir: reverseDir, sliceIndex: antipodalSlice, echoId });
          } else {
            // Start the echo animation
            startAnimation(axis, reverseDir, antipodalSlice, true);
            // Remove from pending after animation starts
            setTimeout(() => removePendingEchoRotation(echoId), 100);
          }

          // Remove from timeouts list
          echoTimeoutsRef.current = echoTimeoutsRef.current.filter(t => t !== timeoutId);
        });

        echoTimeoutsRef.current.push(timeoutId);
      }

      // Process queued echo if any
      if (echoQueueRef.current.length > 0 && !isEcho) {
        const nextEcho = echoQueueRef.current.shift();
        setTimeout(() => {
          startAnimation(nextEcho.axis, nextEcho.dir, nextEcho.sliceIndex, true);
          removePendingEchoRotation(nextEcho.echoId);
        }, 50);
      }
    } else {
      // No pending move — clear animation state as a safety net.
      clearAnimation();
    }
    pendingMoveRef.current = null;
  }, [
    size,
    clearAnimation,
    antipodalMode,
    echoDelay,
    addPendingEchoRotation,
    removePendingEchoRotation,
    startAnimation,
  ]);

  // Handle move initiation (from UI interactions).
  // numTurns > 1 is used by live-drag commits so multiple quarter-turns are
  // applied atomically without triggering N separate animState animations
  // (Zustand batches synchronous sets, so only the last would survive).
  const onMove = useCallback((axis, dir, sel, numTurns = 1) => {
    const sliceIndex = axis === 'col' ? sel.x : axis === 'row' ? sel.y : sel.z;
    if (numTurns <= 1) {
      startAnimation(axis, dir, sliceIndex);
    } else {
      // Apply all quarter-turns directly to cubies without an animation pass.
      setRotatedCubies((prev) => {
        let c = prev;
        for (let i = 0; i < numTurns; i++) c = rotateSliceCubies(c, size, axis, sliceIndex, dir);
        return c;
      });
      setMoves((m) => m + numTurns);
      play('/sounds/rotate.mp3');
      addToHistory({ type: 'rotation', axis, dir, sliceIndex, timestamp: Date.now() });
    }
  }, [startAnimation, setRotatedCubies, setMoves, addToHistory, size]);

  return {
    // State
    animState,
    pendingMove,

    // Refs
    pendingMoveRef,

    // Actions
    startAnimation,
    startAnimatedShuffle,
    handleAnimComplete,
    onMove,
    setAnimState,
    setPendingMove,
    clearAnimation,
  };
}
