/**
 * useUndo Hook
 *
 * Manages undo functionality for moves.
 */

import { useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';

/**
 * Hook for undo functionality
 */
export function useUndo() {
  const cubies = useGameStore((state) => state.cubies);
  const setCubies = useGameStore((state) => state.setCubies);
  const setMoves = useGameStore((state) => state.setMoves);
  const animState = useGameStore((state) => state.animState);
  const setAnimState = useGameStore((state) => state.setAnimState);
  const setPendingMove = useGameStore((state) => state.setPendingMove);
  const moveHistory = useGameStore((state) => state.moveHistory);
  const popFromHistory = useGameStore((state) => state.popFromHistory);

  const cubiesRef = useRef(cubies);
  cubiesRef.current = cubies;
  const pendingMoveRef = useRef(null);

  // Undo last move (rotation or flip)
  const undo = useCallback(() => {
    if (moveHistory.length === 0) return;
    if (animState) return; // Don't allow undo during animation

    const lastMove = moveHistory[moveHistory.length - 1];

    if (lastMove.type === 'rotation') {
      // Apply inverse rotation (negate direction)
      const { axis, dir, sliceIndex } = lastMove;
      setAnimState({ axis, dir: -dir, sliceIndex, t: 0 });
      const move = { axis, dir: -dir, sliceIndex };
      setPendingMove(move);
      pendingMoveRef.current = move;
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
  }, [moveHistory, animState, setCubies, setMoves, setAnimState, setPendingMove, popFromHistory]);

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
