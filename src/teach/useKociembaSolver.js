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
//   2. External moves (the user manually turning the cube) — split in two:
//        a. The turn IS the move we were previewing. The player is following the
//           solution by hand, so the remaining plan is still exactly right: we
//           advance the pointer and move the highlight on, keeping the list.
//           Re-solving here would be actively wrong — Kociemba's search is not
//           canonical, so the "same" position yields an unrelated maneuver, the
//           chips the player already completed reset to move 0, and the panel
//           reads as if it ignored them.
//        b. Any other turn. The plan is stale, so we re-solve from the live
//           position. This is what keeps the panel honest in free play.
//
// We tell solver moves from external ones with `selfMovePendingRef`: set just
// before a solver move animates, and consumed by the auto-resolve effect when
// that move lands. External turns are matched against the expected move using
// the store's `lastRotation` + `rotationEpoch` pair.

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { cubiesToKociembaString } from '../game/kociembaAdapter.js';
import { reorientToHome } from '../game/cubeReorient.js';
import { parseAlgorithm } from './algorithms.js';

/**
 * Classify a turn the player just made against the move the solver is previewing.
 *
 * Pure so the follow-along rules can be tested without a cube or a React tree.
 *
 * @param {?{axis,sliceIndex,dir,numTurns}} lastRotation the turn that just landed
 * @param {?{axis,sliceIndex,dir,numTurns}} expected     the move being previewed
 * @param {number} turnsLeft quarter turns still owed on `expected`
 * @returns {{verdict: 'done'|'partial'|'other', turnsLeft: number}}
 */
export function classifyTurn(lastRotation, expected, turnsLeft) {
  if (!lastRotation || !expected) return { verdict: 'other', turnsLeft };
  const sameLayer =
    lastRotation.axis === expected.axis &&
    lastRotation.sliceIndex === expected.sliceIndex &&
    lastRotation.dir === expected.dir;
  if (!sameLayer) return { verdict: 'other', turnsLeft };
  const left = turnsLeft - (lastRotation.numTurns ?? 1);
  // A double turn part-completed by a single drag holds position; turning past
  // what the move asked for is not that move at all, so the plan is stale.
  if (left > 0) return { verdict: 'partial', turnsLeft: left };
  if (left === 0) return { verdict: 'done', turnsLeft: 0 };
  return { verdict: 'other', turnsLeft: left };
}

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
  // Last rotationEpoch this hook has already accounted for. Guards the
  // follow-along match below: `lastRotation` lingers after its turn, so without
  // an epoch check a later non-rotation cube change (a sticker flip) would
  // re-match the same turn and advance the plan a second time.
  const seenRotationEpochRef = useRef(useGameStore.getState().rotationEpoch);
  // Quarter turns still owed on the currently previewed move; see pushLayerHighlight.
  const expectedTurnsLeftRef = useRef(0);

  useEffect(() => { movesRef.current = moves; }, [moves]);
  useEffect(() => { moveIndexRef.current = moveIndex; }, [moveIndex]);

  // Push layer highlight for the upcoming move into the store (drives 3D highlight).
  // Also arms the follow-along turn budget: a double turn (F2, U2) is one entry in
  // the plan but two drags by hand, so the first drag part-completes it rather
  // than counting as a wrong move.
  const pushLayerHighlight = useCallback((idx, list) => {
    const move = list[idx];
    expectedTurnsLeftRef.current = move ? (move.numTurns ?? 1) : 0;
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

  // Advance the plan one step. Shared by "solver move landed" and "player
  // performed the previewed move by hand" — both leave the remaining list valid.
  const advanceToNext = useCallback(() => {
    const list = movesRef.current;
    const next = moveIndexRef.current + 1;
    moveIndexRef.current = next;
    setMoveIndex(next);
    setStatus(next >= list.length ? 'done' : 'ready');
    // Past the end this clears the highlight and zeroes the turn budget.
    pushLayerHighlight(next, list);
  }, [pushLayerHighlight]);

  // Classify the turn that just landed against the move the panel is previewing.
  // Only a genuine new rotation counts (epoch advanced), so a sticker flip — which
  // changes cubies but leaves lastRotation untouched — can never be mistaken for one.
  //   'done'    — the previewed move is now fully performed; advance the plan
  //   'partial' — a double turn is half done; hold position and keep the highlight
  //   'other'   — an unrelated turn; the plan is stale and must be recomputed
  const classifyExternalTurn = useCallback(() => {
    const { rotationEpoch, lastRotation } = useGameStore.getState();
    if (rotationEpoch === seenRotationEpochRef.current) return 'other';
    seenRotationEpochRef.current = rotationEpoch;
    const expected = movesRef.current[moveIndexRef.current];
    const { verdict, turnsLeft } = classifyTurn(lastRotation, expected, expectedTurnsLeftRef.current);
    expectedTurnsLeftRef.current = turnsLeft;
    return verdict;
  }, []);

  // Keep the solution live. Re-solve whenever the cube changes from an EXTERNAL
  // move (a manual turn), but NOT when the change is a solver move we already
  // planned for, and NOT when the player simply performed the move we were
  // previewing — either would wipe the list mid-step. Debounced so a burst of
  // rapid turns settles before we compute.
  useEffect(() => {
    if (size !== 3) return;
    if (selfMovePendingRef.current) {
      // Our own Play/Step move just landed: consume the flag and keep walking the
      // precomputed maneuver — the remaining list is still valid.
      selfMovePendingRef.current = false;
      seenRotationEpochRef.current = useGameStore.getState().rotationEpoch;
      return;
    }
    if (isPlayingRef.current) return; // never fight active playback
    // The player is hand-solving along with the panel — keep their place.
    const verdict = classifyExternalTurn();
    if (verdict === 'done') { advanceToNext(); return; }
    if (verdict === 'partial') return;
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
