// Hook managing Kociemba two-phase solver state and move playback.
// Mirrors the step-execution pattern from useTeachMode.js (setAnimState + setPendingMove).
// Only supports 3x3 cubes.

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { cubiesToKociembaString } from '../game/kociembaAdapter.js';
import { parseAlgorithm } from './algorithms.js';

export function useKociembaSolver(cubies, size) {
  const animState = useGameStore((s) => s.animState);
  const setAnimState = useGameStore((s) => s.setAnimState);
  const setPendingMove = useGameStore((s) => s.setPendingMove);

  const [status, setStatus] = useState('idle'); // idle | solving | ready | playing | done | error
  const [solutionStr, setSolutionStr] = useState('');
  const [moves, setMoves] = useState([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [error, setError] = useState(null);

  const isPlayingRef = useRef(false);
  const pendingNextRef = useRef(false);
  const movesRef = useRef([]);
  const moveIndexRef = useRef(0);

  useEffect(() => { movesRef.current = moves; }, [moves]);
  useEffect(() => { moveIndexRef.current = moveIndex; }, [moveIndex]);

  // Execute the move at the current index
  const executeCurrentMove = useCallback(() => {
    const idx = moveIndexRef.current;
    const list = movesRef.current;
    if (idx >= list.length) {
      isPlayingRef.current = false;
      setStatus('done');
      return;
    }
    const move = list[idx];
    setAnimState({ axis: move.axis, dir: move.dir, sliceIndex: move.sliceIndex, t: 0 });
    setPendingMove({ axis: move.axis, dir: move.dir, sliceIndex: move.sliceIndex });
    pendingNextRef.current = true;
    const next = idx + 1;
    moveIndexRef.current = next;
    setMoveIndex(next);
    if (next >= list.length) {
      isPlayingRef.current = false;
      setStatus('done');
    }
  }, [setAnimState, setPendingMove]);

  // Auto-advance when animation finishes during playback
  useEffect(() => {
    if (!pendingNextRef.current || animState) return;
    pendingNextRef.current = false;
    if (!isPlayingRef.current) return;
    const timer = setTimeout(executeCurrentMove, 300);
    return () => clearTimeout(timer);
  }, [animState, executeCurrentMove]);

  const solve = useCallback(async () => {
    if (size !== 3) {
      setError('Kociemba solver only works on 3×3 cubes');
      setStatus('error');
      return;
    }
    setStatus('solving');
    setError(null);
    setSolutionStr('');
    setMoves([]);
    setMoveIndex(0);
    moveIndexRef.current = 0;
    isPlayingRef.current = false;
    pendingNextRef.current = false;

    try {
      const { solve: kociembaSolve } = await import('kociemba-wasm');
      const cubeStr = cubiesToKociembaString(cubies);
      if (!cubeStr) throw new Error('Invalid cube state');
      const sol = await kociembaSolve(cubeStr);
      const trimmed = (sol || '').trim();
      const parsed = trimmed ? parseAlgorithm(trimmed, 3) : [];
      setSolutionStr(trimmed);
      setMoves(parsed);
      movesRef.current = parsed;
      setStatus(parsed.length === 0 ? 'done' : 'ready');
    } catch (err) {
      setError(err.message || 'Solver failed');
      setStatus('error');
    }
  }, [cubies, size]);

  const play = useCallback(() => {
    if (moveIndexRef.current >= movesRef.current.length) {
      // Restart from beginning
      setMoveIndex(0);
      moveIndexRef.current = 0;
    }
    isPlayingRef.current = true;
    setStatus('playing');
    if (!animState) {
      executeCurrentMove();
    }
  }, [animState, executeCurrentMove]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    setStatus('ready');
  }, []);

  const stepForward = useCallback(() => {
    if (animState || moveIndexRef.current >= movesRef.current.length) return;
    executeCurrentMove();
  }, [animState, executeCurrentMove]);

  const reset = useCallback(() => {
    isPlayingRef.current = false;
    pendingNextRef.current = false;
    setStatus('idle');
    setSolutionStr('');
    setMoves([]);
    setMoveIndex(0);
    moveIndexRef.current = 0;
    setError(null);
  }, []);

  return { status, solutionStr, moves, moveIndex, error, solve, play, pause, stepForward, reset };
}
