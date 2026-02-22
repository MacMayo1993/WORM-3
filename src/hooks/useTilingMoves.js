// src/hooks/useTilingMoves.js
// React hook that exposes the tiling-graph move system as a parallel state
// representation alongside the existing cubies/Three.js state.
//
// Usage:
//   const { tilingState, applyTilingMove, graphParity, isSolved } = useTilingMoves();
//
// tilingState[v] = original vertex (solved-state index) of the sticker at
// position v.  Solved state = identity [0, 1, …, 53] for a 3×3 cube.
//
// Call applyTilingMove(axis, sliceIndex, dir) in sync with the existing
// rotateSliceCubies call to keep both representations consistent.

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildTilingGraph,
  applyTwist,
  cubiesToTilingState,
  computeGraphParity,
  isTilingStateSolved,
} from '../utils/tilingGraph.js';
import { useGameStore } from './useGameStore.js';

// Cache tiling graphs per cube size so they are built only once.
const graphCache = new Map();

function getGraph(size) {
  if (!graphCache.has(size)) {
    graphCache.set(size, buildTilingGraph(size));
  }
  return graphCache.get(size);
}

export function useTilingMoves() {
  const size = useGameStore((state) => state.size);
  const cubies = useGameStore((state) => state.cubies);

  // Build (or retrieve from cache) the tiling graph for the current cube size.
  const graph = useMemo(() => getGraph(size), [size]);

  // Derive the initial tiling state from the current cubies whenever the cube
  // size changes or the user resets the game.
  const [tilingState, setTilingState] = useState(() => cubiesToTilingState(cubies, size));

  // Keep a ref so callbacks never close over a stale tiling state.
  const tilingStateRef = useRef(tilingState);
  tilingStateRef.current = tilingState;

  // Synchronise tiling state when the Zustand cubies change due to an external
  // reset (e.g. new game, level load).  A full re-derive is cheap (54 lookups).
  const cubiesRef = useRef(cubies);
  if (cubiesRef.current !== cubies) {
    cubiesRef.current = cubies;
    const derived = cubiesToTilingState(cubies, size);
    if (JSON.stringify(derived) !== JSON.stringify(tilingStateRef.current)) {
      setTilingState(derived);
    }
  }

  // Apply a single slice rotation to the tiling state.
  // axis:       'row' | 'col' | 'depth'
  // sliceIndex: 0…size-1
  // dir:        1 (CW) | -1 (CCW)
  const applyTilingMove = useCallback(
    (axis, sliceIndex, dir) => {
      const key = `${axis}-${sliceIndex}-${dir}`;
      const moveCycles = graph.cycles[key];
      if (!moveCycles) return; // unknown move — ignore
      setTilingState((prev) => applyTwist(prev, moveCycles));
    },
    [graph]
  );

  // Apply a move by its standard notation key (e.g. 'U', "R'", 'M').
  const applyNamedMove = useCallback(
    (moveKey) => {
      const moveCycles = graph.cycles[moveKey];
      if (!moveCycles) return;
      setTilingState((prev) => applyTwist(prev, moveCycles));
    },
    [graph]
  );

  // Reset tiling state to match current cubies (useful after undo / scramble).
  const syncFromCubies = useCallback(() => {
    setTilingState(cubiesToTilingState(cubiesRef.current, size));
  }, [size]);

  // Derived values (computed lazily from current tiling state).
  const graphParity = useMemo(() => computeGraphParity(tilingState), [tilingState]);
  const isSolved = useMemo(() => isTilingStateSolved(tilingState), [tilingState]);

  // Return the adjacency list so components can render the graph overlay.
  const adj = graph.adj;

  return {
    tilingState,
    applyTilingMove,
    applyNamedMove,
    syncFromCubies,
    graphParity,
    isSolved,
    adj,
    graph,
  };
}
