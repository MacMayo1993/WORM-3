// Hook managing Kociemba two-phase solver: auto-solves on every cube change,
// propagates the next-move layer highlight to the 3D scene via Zustand, and
// drives animated solution playback using the same animation system as useTeachMode.

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { cubiesToKociembaString } from '../game/kociembaAdapter.js';
import { parseAlgorithm } from './algorithms.js';

export function useKociembaSolver(cubies, size) {
  const animState = useGameStore((s) => s.animState);
  const setAnimState = useGameStore((s) => s.setAnimState);
  const setPendingMove = useGameStore((s) => s.setPendingMove);
  const setKociembaLayerHighlight = useGameStore((s) => s.setKociembaLayerHighlight);

  const [status, setStatus] = useState('idle'); // idle | solving | ready | playing | done | error
  const [solutionStr, setSolutionStr] = useState('');
  const [moves, setMoves] = useState([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [error, setError] = useState(null);

  const isPlayingRef = useRef(false);
  const pendingNextRef = useRef(false);
  const movesRef = useRef([]);
  const moveIndexRef = useRef(0);
  const solveIdRef = useRef(0);

  useEffect(() => { movesRef.current = moves; }, [moves]);
  useEffect(() => { moveIndexRef.current = moveIndex; }, [moveIndex]);

  // Push layer highlight for the upcoming move into the store (drives 3D highlight)
  const pushLayerHighlight = useCallback((idx, list) => {
    const move = list[idx];
    setKociembaLayerHighlight(move ? { axis: move.axis, sliceIndex: move.sliceIndex, dir: move.dir } : null);
  }, [setKociembaLayerHighlight]);

  // Execute the move at moveIndex and advance
  const executeCurrentMove = useCallback(() => {
    const idx = moveIndexRef.current;
    const list = movesRef.current;
    if (idx >= list.length) {
      isPlayingRef.current = false;
      setStatus('done');
      setKociembaLayerHighlight(null);
      return;
    }
    const move = list[idx];
    const numTurns = move.numTurns ?? 1;
    setAnimState({ axis: move.axis, dir: move.dir, sliceIndex: move.sliceIndex, t: 0, numTurns });
    setPendingMove({ axis: move.axis, dir: move.dir, sliceIndex: move.sliceIndex, numTurns });
    pendingNextRef.current = true;
    const next = idx + 1;
    moveIndexRef.current = next;
    setMoveIndex(next);
    // Highlight the NEXT upcoming move (after this one)
    pushLayerHighlight(next, list);
    if (next >= list.length) {
      isPlayingRef.current = false;
      setStatus('done');
    }
  }, [setAnimState, setPendingMove, setKociembaLayerHighlight, pushLayerHighlight]);

  // Auto-advance playback when animation completes
  useEffect(() => {
    if (!pendingNextRef.current || animState) return;
    pendingNextRef.current = false;
    if (!isPlayingRef.current) return;
    const timer = setTimeout(executeCurrentMove, 280);
    return () => clearTimeout(timer);
  }, [animState, executeCurrentMove]);

  const solve = useCallback(async () => {
    if (size !== 3) {
      setError('Kociemba solver only works on 3×3 cubes');
      setStatus('error');
      return;
    }
    const sid = ++solveIdRef.current;
    setStatus('solving');
    setError(null);
    setSolutionStr('');
    setMoves([]);
    setMoveIndex(0);
    moveIndexRef.current = 0;
    isPlayingRef.current = false;
    pendingNextRef.current = false;
    setKociembaLayerHighlight(null);

    try {
      const { solve: kociembaSolve } = await import('kociemba-wasm');
      if (sid !== solveIdRef.current) return; // a newer solve started while WASM was loading
      const cubeStr = cubiesToKociembaString(cubies);
      if (!cubeStr) throw new Error('Cannot solve: cube has modified stickers (chaos / flip / manifold mode). Reset to a clean state first.');
      const sol = await kociembaSolve(cubeStr);
      if (sid !== solveIdRef.current) return; // a newer solve started while kociemba was computing
      const trimmed = (sol || '').trim();
      // Filter identity moves (kociemba can return no-ops for solved cube)
      const parsed = trimmed ? parseAlgorithm(trimmed, 3) : [];
      setSolutionStr(trimmed);
      setMoves(parsed);
      movesRef.current = parsed;
      if (parsed.length === 0) {
        setStatus('done');
        setKociembaLayerHighlight(null);
      } else {
        setStatus('ready');
        pushLayerHighlight(0, parsed);
      }
    } catch (err) {
      if (sid !== solveIdRef.current) return; // stale error, discard
      setError(err.message || 'Solver failed');
      setStatus('error');
      setKociembaLayerHighlight(null);
    }
  }, [cubies, size, setKociembaLayerHighlight, pushLayerHighlight]);

  // Auto-re-solve whenever cubies changes (skips during playback so our own moves don't loop)
  useEffect(() => {
    if (size !== 3) return;
    const timer = setTimeout(() => {
      if (!isPlayingRef.current) solve();
    }, 180);
    return () => clearTimeout(timer);
  }, [cubies]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(() => {
    if (moveIndexRef.current >= movesRef.current.length) {
      setMoveIndex(0);
      moveIndexRef.current = 0;
      pushLayerHighlight(0, movesRef.current);
    }
    isPlayingRef.current = true;
    setStatus('playing');
    if (!animState) executeCurrentMove();
  }, [animState, executeCurrentMove, pushLayerHighlight]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    setStatus('ready');
    pushLayerHighlight(moveIndexRef.current, movesRef.current);
  }, [pushLayerHighlight]);

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
    movesRef.current = [];
    setError(null);
    setKociembaLayerHighlight(null);
    // Immediately re-solve so state stays fresh
    setTimeout(() => solve(), 0);
  }, [setKociembaLayerHighlight, solve]);

  // Cleanup layer highlight when unmounted
  useEffect(() => {
    return () => setKociembaLayerHighlight(null);
  }, [setKociembaLayerHighlight]);

  return { status, solutionStr, moves, moveIndex, error, solve, play, pause, stepForward, reset };
}
