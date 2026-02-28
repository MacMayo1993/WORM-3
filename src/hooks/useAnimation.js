/**
 * useAnimation Hook
 *
 * Manages animation state and completion callbacks.
 * Includes support for Antipodal Mode (Mirror Quotient).
 */

import { useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
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
  const size = useGameStore((state) => state.size);
  const setRotatedCubies = useGameStore((state) => state.setRotatedCubies);
  const setMoves = useGameStore((state) => state.setMoves);
  const animState = useGameStore((state) => state.animState);
  const pendingMove = useGameStore((state) => state.pendingMove);
  const setAnimState = useGameStore((state) => state.setAnimState);
  const setPendingMove = useGameStore((state) => state.setPendingMove);
  const clearAnimation = useGameStore((state) => state.clearAnimation);
  const addToHistory = useGameStore((state) => state.addToHistory);

  // Antipodal Mode state
  const antipodalMode = useGameStore((state) => state.antipodalMode);
  const echoDelay = useGameStore((state) => state.echoDelay);
  const addPendingEchoRotation = useGameStore((state) => state.addPendingEchoRotation);
  const removePendingEchoRotation = useGameStore((state) => state.removePendingEchoRotation);

  const pendingMoveRef = useRef(null);
  const echoTimeoutsRef = useRef([]);
  const echoQueueRef = useRef([]);

  // Start a new animation
  const startAnimation = useCallback((axis, dir, sliceIndex, isEcho = false) => {
    setAnimState({ axis, dir, sliceIndex, t: 0, isEcho });
    const move = { axis, dir, sliceIndex, isEcho };
    setPendingMove(move);
    pendingMoveRef.current = move;
  }, [setAnimState, setPendingMove]);

  // Handle animation completion
  const handleAnimComplete = useCallback(() => {
    const pm = pendingMoveRef.current;
    if (pm) {
      const { axis, dir, sliceIndex, isEcho } = pm;

      // Batch all store updates into a single atomic setState (1 re-render instead of 3-4)
      if (!isEcho) {
        play('/sounds/rotate.mp3');
        useGameStore.setState((state) => ({
          cubies: rotateSliceCubies(state.cubies, size, axis, sliceIndex, dir),
          rotationEpoch: state.rotationEpoch + 1,
          moves: state.moves + 1,
          moveHistory: [...state.moveHistory, { type: 'rotation', axis, dir, sliceIndex, timestamp: Date.now() }].slice(-10),
        }));
      } else {
        // Echo rotation - quieter sound; only bump cubies + reversalCount
        play('/sounds/rotate.mp3', 0.7);
        useGameStore.setState((state) => ({
          cubies: rotateSliceCubies(state.cubies, size, axis, sliceIndex, dir),
          rotationEpoch: state.rotationEpoch + 1,
          reversalCount: state.reversalCount + 1,
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
    }
    clearAnimation();
    pendingMoveRef.current = null;
  }, [
    size,
    clearAnimation,
    antipodalMode,
    echoDelay,
    addPendingEchoRotation,
    removePendingEchoRotation,
    startAnimation,
    animState,
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
    handleAnimComplete,
    onMove,
    setAnimState,
    setPendingMove,
    clearAnimation,
  };
}
