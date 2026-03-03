/**
 * useUndo Hook
 *
 * Manages undo functionality for moves.
 */

import { useCallback } from 'react';
import { useGameStore } from './useGameStore.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';

/**
 * Hook for undo functionality.
 *
 * @param {Function} startAnimation - startAnimation from useAnimation.
 *   Required so that rotation undos go through the proper animation path,
 *   which sets pendingMoveRef.current in useAnimation.js — the ref that
 *   handleAnimComplete reads to know what move was committed.
 */
export function useUndo(startAnimation) {
  const setCubies = useGameStore((state) => state.setCubies);
  const setMoves = useGameStore((state) => state.setMoves);
  const animState = useGameStore((state) => state.animState);
  const moveHistory = useGameStore((state) => state.moveHistory);
  const popFromHistory = useGameStore((state) => state.popFromHistory);

  // Undo last move (rotation or flip)
  const undo = useCallback(() => {
    if (moveHistory.length === 0) return;
    if (animState) return; // Don't allow undo during animation

    const lastMove = moveHistory[moveHistory.length - 1];

    if (lastMove.type === 'rotation') {
      // Apply inverse rotation via startAnimation so that pendingMoveRef.current
      // in useAnimation.js is correctly set before handleAnimComplete fires.
      // The isUndo:true flag tells handleAnimComplete to skip moves/history tracking.
      const { axis, dir, sliceIndex } = lastMove;
      startAnimation(axis, -dir, sliceIndex, false, true);
    } else if (lastMove.type === 'flip') {
      // Flip is its own inverse - just flip again
      const { pos, dirKey } = lastMove;
      setCubies((prev) => {
        const freshManifoldMap = buildManifoldGridMap(prev, prev.length);
        return flipStickerPair(prev, prev.length, pos.x, pos.y, pos.z, dirKey, freshManifoldMap);
      });
    }

    // Remove from history and decrement move counter
    popFromHistory();
    setMoves((m) => Math.max(0, m - 1));
  }, [moveHistory, animState, startAnimation, setCubies, setMoves, popFromHistory]);

  // Check if undo is available
  const canUndo = moveHistory.length > 0 && !animState;

  return {
    // State
    moveHistory,
    canUndo,

    // Actions
    undo,
  };
}
