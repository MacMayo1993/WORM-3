/**
 * useAnimation Hook
 *
 * Manages rotation animation state and completion callbacks.
 *
 * Everything here now flows through a rotation WAVE — one to three parallel
 * same-axis planes committed together (see game/rotationWave.js). A plain
 * single-slice turn is just a one-plane wave, so the singular entry points
 * (startAnimation, onMove, startAnimatedShuffle) are thin wrappers and every
 * existing caller — drag commits, keyboard, undo, teach, the worm scramble —
 * keeps working unchanged.
 */

import { useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import {
  singlePlaneWave,
  applyWaveToCubies,
  waveToLastRotation,
  waveTurnCount,
  waveToMoves,
} from '../game/rotationWave.js';
import { play, vibrate } from '../utils/audio.js';

// Build the store patch that lands a committed wave. Kept in one place because
// the three commit paths below (undo, shuffle, normal) must agree exactly on
// which fields move together — the atomicity comment on the normal path applies
// to all of them.
function commitWavePatch(state, size, wave) {
  return {
    cubies: applyWaveToCubies(state.cubies, size, wave),
    rotationEpoch: state.rotationEpoch + 1,
    lastWave: { axis: wave.axis, rotations: wave.rotations },
    // Non-null only for a one-plane wave. A consumer that can only represent a
    // single turn (the chaos worker's ROTATE_SLICE replay, Teach's turn
    // classifier) then sees null for a multi-plane wave, which is already its
    // documented "resync from scratch" signal rather than a wrong single turn.
    lastRotation: waveToLastRotation(wave),
    animWave: null,
    animState: null,
    pendingMove: null,
  };
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
  // The wave currently animating. Held in a ref as well as the store so the
  // completion callback can't race a re-render.
  const pendingWaveRef = useRef(null);

  // Shuffle animation queue
  const shuffleQueueRef = useRef([]);
  const shuffleDoneRef = useRef(null);
  const isShufflingRef = useRef(false);
  // Monotonically-increasing ID: bump it to invalidate any in-flight shuffle
  // setTimeout callbacks from a previous (cancelled) shuffle session.
  const shuffleIdRef = useRef(0);

  /**
   * Start animating a rotation wave.
   *
   * `animState` is published alongside as the single-plane view, so components
   * that only understand one turn keep seeing exactly what they saw before for
   * ordinary rotations, and see null (i.e. "nothing I can represent") during a
   * multi-plane wave.
   */
  const startWave = useCallback((wave, meta = {}) => {
    const tagged = { ...wave, ...meta };
    pendingWaveRef.current = tagged;
    const single = waveToLastRotation(tagged);
    const move = single ? { ...single, ...meta } : null;
    pendingMoveRef.current = move;
    useGameStore.setState({
      animWave: tagged,
      animState: single ? { ...single, t: 0, ...meta } : null,
      pendingMove: move,
    });
  }, []);

  // Start a new single-slice animation (atomic: wave, animState and pendingMove
  // set in one render)
  const startAnimation = useCallback((axis, dir, sliceIndex, isUndo = false) => {
    startWave(singlePlaneWave(axis, sliceIndex, dir), { isUndo });
  }, [startWave]);

  // Start an animated shuffle: plays waves sequentially with fast per-wave
  // animations. Each wave is committed silently (no moves counter, no history).
  // Accepts either legacy `{axis, dir, sliceIndex}` moves or full waves, so the
  // teach/dev shuffle callers need no changes.
  const startAnimatedShuffle = useCallback((moves, onDone) => {
    if (!moves || !moves.length) { onDone?.(); return; }
    const waves = moves.map(m => (
      m.rotations ? m : singlePlaneWave(m.axis, m.sliceIndex, m.dir, m.numTurns ?? 1)
    ));
    // Bump the shuffle ID to cancel any pending setTimeout from a prior shuffle.
    const sid = ++shuffleIdRef.current;
    // Carry the caller's per-move flags (wormScramble drives the tween speed).
    const metaOf = (i) => ({ isShuffle: true, shuffleId: sid, wormScramble: !!moves[i].wormScramble });
    shuffleQueueRef.current = waves.slice(1).map((w, i) => ({ wave: w, meta: metaOf(i + 1) }));
    shuffleDoneRef.current = onDone || null;
    isShufflingRef.current = true;
    startWave(waves[0], metaOf(0));
  }, [startWave]);

  // Cancel any in-flight animated shuffle. Safe to call at any time.
  const cancelShuffle = useCallback(() => {
    shuffleIdRef.current += 1; // Invalidate pending setTimeout callbacks
    isShufflingRef.current = false;
    shuffleQueueRef.current = [];
    shuffleDoneRef.current = null;
    pendingWaveRef.current = null;
    useGameStore.getState().clearAnimation();
  }, []);

  // Handle animation completion
  const handleAnimComplete = useCallback(() => {
    // pendingWaveRef is set by startWave. Undo bypasses it and writes directly to
    // the store, so fall back to the store's animWave when the ref is null —
    // safe because getState() is always fresh.
    const wave = pendingWaveRef.current ?? useGameStore.getState().animWave;
    if (!wave) {
      // No pending wave — clear animation state as a safety net.
      clearAnimation();
      pendingMoveRef.current = null;
      return;
    }

    const { isShuffle, isUndo } = wave;

    if (isUndo) {
      // Undo rotation: apply the inverse move, clear animation.
      // Do NOT increment moves or add to history — useUndo already handled both.
      play('/sounds/rotate.mp3');
      useGameStore.setState((state) => commitWavePatch(state, size, wave));
      pendingWaveRef.current = null;
      pendingMoveRef.current = null;
      return;
    }

    if (isShuffle) {
      // Discard waves belonging to a cancelled shuffle session.
      const sid = wave.shuffleId;
      if (sid !== undefined && sid !== shuffleIdRef.current) {
        pendingWaveRef.current = null;
        pendingMoveRef.current = null;
        return;
      }
      // Shuffle wave: commit silently — no moves counter, no undo history.
      play('/sounds/rotate.mp3', 0.6);
      vibrate(12);
      useGameStore.setState((state) => commitWavePatch(state, size, wave));
      pendingWaveRef.current = null;
      pendingMoveRef.current = null;

      if (shuffleQueueRef.current.length > 0) {
        const next = shuffleQueueRef.current.shift();
        setTimeout(() => {
          // Re-check: the shuffle may have been cancelled during the 50ms delay.
          if (shuffleIdRef.current !== sid) return;
          startWave(next.wave, next.meta);
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
    // Crucially, animWave/animState and pendingMove are cleared in the SAME setState as
    // the cubies, so no React render can fire between them — otherwise there is a frame
    // where new sticker colours appear at old (rotated) mesh positions (the "colour
    // glitch after rotations").
    const turns = waveTurnCount(wave);
    play('/sounds/rotate.mp3');
    useGameStore.setState((state) => ({
      ...commitWavePatch(state, size, wave),
      moves: state.moves + turns,
      moveHistory: [
        ...state.moveHistory,
        { type: 'rotation', axis: wave.axis, moves: waveToMoves(wave), timestamp: Date.now() },
      ].slice(-10),
    }));
    pendingWaveRef.current = null;
    pendingMoveRef.current = null;
  }, [size, clearAnimation, startWave]);

  // Handle move initiation (from UI interactions).
  // numTurns > 1 is used by live-drag commits: the visual has already reached the
  // target, so the turns are applied in one atomic setState with no animation —
  // cubies, rotationEpoch, moves and history all land in the same render,
  // preventing any intermediate state from triggering win detection or a stale
  // animation frame.
  const onMove = useCallback((axis, dir, sel, numTurns = 1) => {
    const sliceIndex = axis === 'col' ? sel.x : axis === 'row' ? sel.y : sel.z;
    if (numTurns <= 1) {
      startAnimation(axis, dir, sliceIndex);
      return;
    }
    const wave = singlePlaneWave(axis, sliceIndex, dir, numTurns);
    play('/sounds/rotate.mp3');
    useGameStore.setState((state) => ({
      cubies: applyWaveToCubies(state.cubies, state.size, wave),
      rotationEpoch: state.rotationEpoch + 1,
      lastWave: { axis: wave.axis, rotations: wave.rotations },
      lastRotation: waveToLastRotation(wave),
      moves: state.moves + numTurns,
      moveHistory: [
        ...state.moveHistory,
        { type: 'rotation', axis, dir, sliceIndex, numTurns, timestamp: Date.now() },
      ].slice(-10),
    }));
  }, [startAnimation]);

  return {
    // State
    animState,
    pendingMove,

    // Refs
    pendingMoveRef,

    // Actions
    startWave,
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
