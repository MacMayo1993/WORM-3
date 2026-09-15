/**
 * useHandsMode Hook
 *
 * Manages Hands Mode - speedcuber-style fixed-camera rotation controls.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { expandMove, namedMoveToRotation } from '../game/handsInput.js';

/**
 * Hook for Hands Mode management
 */
export function useHandsMode() {
  const size = useGameStore((state) => state.size);
  const animState = useGameStore((state) => state.animState);
  const setAnimState = useGameStore((state) => state.setAnimState);
  const setPendingMove = useGameStore((state) => state.setPendingMove);

  const handsMode = useGameStore((state) => state.handsMode);
  const setHandsMode = useGameStore((state) => state.setHandsMode);
  const toggleHandsMode = useGameStore((state) => state.toggleHandsMode);
  const handsMoveHistory = useGameStore((state) => state.handsMoveHistory);
  const setHandsMoveHistory = useGameStore((state) => state.setHandsMoveHistory);
  const handsMoveQueue = useGameStore((state) => state.handsMoveQueue);
  const setHandsMoveQueue = useGameStore((state) => state.setHandsMoveQueue);
  const handsTps = useGameStore((state) => state.handsTps);
  const setHandsTps = useGameStore((state) => state.setHandsTps);

  const handsMoveTimestamps = useRef([]);
  const pendingMoveRef = useRef(null);

  // Execute a named move (e.g. "R", "U'", "M2")
  const executeHandsMove = useCallback((moveName) => {
    if (animState) {
      // Queue the move if an animation is running
      setHandsMoveQueue((prev) => [...prev, moveName]);
      return;
    }

    const rotations = expandMove(moveName, size);
    if (rotations.length === 0) return;

    // For double moves, queue the second rotation
    if (rotations.length === 2) {
      const { axis, dir, sliceIndex } = rotations[0];
      setAnimState({ axis, dir, sliceIndex, t: 0 });
      const move = { axis, dir, sliceIndex };
      setPendingMove(move);
      pendingMoveRef.current = move;
      setHandsMoveQueue((prev) => [...prev, moveName.replace('2', '')]); // Queue second half
    } else {
      const { axis, dir, sliceIndex } = rotations[0];
      setAnimState({ axis, dir, sliceIndex, t: 0 });
      const move = { axis, dir, sliceIndex };
      setPendingMove(move);
      pendingMoveRef.current = move;
    }

    // Track the named move for HUD display
    setHandsMoveHistory((prev) => [...prev.slice(-30), moveName]);

    // TPS tracking
    const now = Date.now();
    handsMoveTimestamps.current = [...handsMoveTimestamps.current.filter((t) => now - t < 5000), now];
    const elapsed = (now - handsMoveTimestamps.current[0]) / 1000;
    if (elapsed > 0 && handsMoveTimestamps.current.length > 1) {
      setHandsTps(handsMoveTimestamps.current.length / elapsed);
    }
  }, [animState, size, setAnimState, setPendingMove, setHandsMoveHistory, setHandsMoveQueue, setHandsTps]);

  // Process queued hands moves when animation completes
  useEffect(() => {
    if (!handsMode || animState || handsMoveQueue.length === 0) return;
    const [nextMove, ...rest] = handsMoveQueue;
    setHandsMoveQueue(rest);
    // Execute via a microtask so state is settled
    const timer = setTimeout(() => {
      const rot = namedMoveToRotation(nextMove, size);
      if (rot) {
        setAnimState({ axis: rot.axis, dir: rot.dir, sliceIndex: rot.sliceIndex, t: 0 });
        const move = { axis: rot.axis, dir: rot.dir, sliceIndex: rot.sliceIndex };
        setPendingMove(move);
        pendingMoveRef.current = move;
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [handsMode, animState, handsMoveQueue, size, setAnimState, setPendingMove, setHandsMoveQueue]);

  // Clear TPS when not moving
  useEffect(() => {
    if (!handsMode) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const recentMoves = handsMoveTimestamps.current.filter((t) => now - t < 5000);
      handsMoveTimestamps.current = recentMoves;
      if (recentMoves.length <= 1) {
        setHandsTps(0);
      } else {
        const elapsed = (now - recentMoves[0]) / 1000;
        setHandsTps(recentMoves.length / elapsed);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [handsMode, setHandsTps]);

  return {
    // State
    handsMode,
    handsMoveHistory,
    handsMoveQueue,
    handsTps,

    // Refs
    pendingMoveRef,

    // Actions
    setHandsMode,
    toggleHandsMode,
    executeHandsMove,
    setHandsMoveHistory,
    setHandsMoveQueue,
    setHandsTps,
  };
}
