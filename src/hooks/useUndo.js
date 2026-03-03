/**
 * useUndo Hook
 *
 * Manages undo functionality for moves.
 */

import { useCallback } from 'react';
import { useGameStore } from './useGameStore.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';

/**
 * Hook for undo functionality
 */
export function useUndo() {
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
      // Apply inverse rotation (negate direction).
      // Set animState and pendingMove atomically in one setState call so that
      // handleAnimComplete (in useAnimation.js) can read pendingMove from the
      // store when its own pendingMoveRef is null (undo bypasses startAnimation).
      const { axis, dir, sliceIndex } = lastMove;
      useGameStore.setState({
        animState: { axis, dir: -dir, sliceIndex, t: 0 },
        pendingMove: { axis, dir: -dir, sliceIndex, isUndo: true },
      });
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
  }, [moveHistory, animState, setCubies, setMoves, popFromHistory]);

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
