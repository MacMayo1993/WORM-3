// Hook managing Kociemba two-phase solver: keeps a live solution for the cube's
// CURRENT position, propagates the next-move layer highlight to the 3D scene via
// Zustand, and drives animated solution playback using the same animation system
// as useTeachMode.
//
// Real-time model
// ---------------
// The solver must always reflect the cube's ACTIVE state. Two kinds of cube
// change can happen while the panel is open:
//
//   1. Solver-initiated moves (Play / Step) — the precomputed maneuver already
//      accounts for these, so we just walk the list and advance the pointer. No
//      recompute (that would wipe the list mid-step and desync the pointer — the
//      old "Step stops working" bug).
//   2. External moves (the user manually turning the cube, e.g. performing the
//      previewed move themselves) — the plan is now stale, so we re-solve from
//      the live position. This is what makes the panel + on-cube preview flow in
//      real time.
//
// We tell the two apart with `selfMovePendingRef`: set just before a solver move
// animates, and consumed by the auto-resolve effect when that move lands.

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { cubiesToKociembaString } from '../game/kociembaAdapter.js';
import { reorientToHome } from '../game/cubeReorient.js';
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
  // True while we're waiting for a cube change that WE caused (a solver move).
  // The auto-resolve effect consumes it and skips recomputing for that change.
  const selfMovePendingRef = useRef(false);
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
    const next = idx + 1;
    const isFinal = next >= list.length;
    // Mark intermediate moves as self-inflicted so the auto-resolve effect keeps
    // walking the precomputed maneuver rather than recomputing on every turn.
    // The FINAL move is intentionally left unmarked: letting its landing fall
    // through to a real re-solve snaps the panel to the cube's true live state
    // (solved → empty, or any residual the maneuver didn't clear).
    if (!isFinal) selfMovePendingRef.current = true;
    setAnimState({ axis: move.axis, dir: move.dir, sliceIndex: move.sliceIndex, t: 0, numTurns });
    setPendingMove({ axis: move.axis, dir: move.dir, sliceIndex: move.sliceIndex, numTurns });
    pendingNextRef.current = true;
    moveIndexRef.current = next;
    setMoveIndex(next);
    // Highlight the NEXT upcoming move (after this one)
    pushLayerHighlight(next, list);
    if (isFinal) {
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
    // Clear the refs synchronously too: a Step click mid-solve must not fire an
    // old move against the new cube state (state setters lag a render).
    movesRef.current = [];
    moveIndexRef.current = 0;
    isPlayingRef.current = false;
    pendingNextRef.current = false;
    selfMovePendingRef.current = false;
    setKociembaLayerHighlight(null);

    try {
      const { solve: kociembaSolve } = await import('kociemba-wasm');
      if (sid !== solveIdRef.current) return; // a newer solve started while WASM was loading
      // Kociemba is a fixed-centre solver — its face turns can never move a
      // centre. If the cube's centres have been rotated out of home (via slice
      // moves or antipodal echo), first reorient the whole cube so centres are
      // home, then solve. The reorientation slice moves are prepended to playback.
      const { moves: reorientMoves, cubies: cubiesHome } = reorientToHome(cubies, 3);
      // ignoreFlips: wormhole-flipped tiles (showing their antipode) are read by
      // their true identity, so a flipped cube still yields a solvable position.
      const cubeStr = cubiesToKociembaString(cubiesHome, { ignoreFlips: true });
      if (!cubeStr) throw new Error('Cannot solve: cube has non-flip sticker damage (manifold / chaos recolour). Reset to a clean state first.');
      const sol = await kociembaSolve(cubeStr);
      if (sid !== solveIdRef.current) return; // a newer solve started while kociemba was computing
      const trimmed = (sol || '').trim();
      // Filter identity moves (kociemba can return no-ops for solved cube)
      const kociembaMoves = trimmed ? parseAlgorithm(trimmed, 3) : [];
      const parsed = [...reorientMoves, ...kociembaMoves];
      setSolutionStr(trimmed);
      setMoves(parsed);
      movesRef.current = parsed;
      moveIndexRef.current = 0;
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

  // Keep the solution live. Re-solve whenever the cube changes from an EXTERNAL
  // move (a manual turn), but NOT when the change is a solver move we already
  // planned for — that would wipe the list mid-step. Debounced so a burst of
  // rapid turns settles before we compute.
  useEffect(() => {
    if (size !== 3) return;
    if (selfMovePendingRef.current) {
      // Our own Play/Step move just landed: consume the flag and keep walking the
      // precomputed maneuver — the remaining list is still valid.
      selfMovePendingRef.current = false;
      return;
    }
    if (isPlayingRef.current) return; // never fight active playback
    const timer = setTimeout(() => {
      if (!isPlayingRef.current && !selfMovePendingRef.current) solve();
    }, 160);
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
    selfMovePendingRef.current = false;
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
