// useAntipodalEngine.js — Three.js-side driver for the antipodal-pairs engine.
//
// Plays a central-quotient fibre plan (src/game/antipodalEngine.js) against the
// live cube one operation at a time, committing each heal / paired flip through
// the store. Because a flip only mutates `curr`/`flips` in place, every step
// re-renders just the two affected StickerPlanes, whose flip/heal particle
// systems fire automatically — the 3D scene animates the whole repair with no
// extra choreography here.
//
// Fibre operations commute with face turns (monograph Theorem 6), so the repair
// can run before, after, or without the Kociemba positional phase. A rotation
// mid-playback would invalidate the plan's (x,y,z) addresses though, so playback
// aborts if rotationEpoch advances underneath it.

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from './useGameStore.js';
import { planQuotientCompletion, fibreCosts } from '../game/antipodalEngine.js';
import { healSticker } from '../game/cubeState.js';
import { flipStickerPair } from '../game/manifoldLogic.js';
import { getManifoldMap } from '../game/manifoldMapStore.js';

const STEP_MS = 320; // matches the flip-particle burst so ops read as discrete beats

export function useAntipodalEngine(cubies, size) {
  const setCubies = useGameStore((s) => s.setCubies);
  const rotationEpoch = useGameStore((s) => s.rotationEpoch);

  const [status, setStatus] = useState('idle'); // idle | ready | playing | done
  const [plan, setPlan] = useState(null);
  const [costs, setCosts] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);

  const stepsRef = useRef([]); // flattened [{op:'heal'|'flip', x,y,z,dir}]
  const stepIndexRef = useRef(0);
  const timerRef = useRef(null);
  const playingRef = useRef(false);
  const planEpochRef = useRef(-1);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Re-plan whenever the cube changes while not playing; the playing flag
  // suppresses replans triggered by our own committed steps mid-playback.
  useEffect(() => {
    if (playingRef.current) return;
    const p = planQuotientCompletion(cubies, size);
    const c = fibreCosts(cubies, size);
    setPlan(p);
    setCosts(c);
    stepsRef.current = [
      ...p.heals.map((h) => ({ op: 'heal', ...h })),
      ...p.flips.map((f) => ({ op: 'flip', ...f })),
    ];
    stepIndexRef.current = 0;
    setStepIndex(0);
    planEpochRef.current = rotationEpoch;
    setStatus(p.totalCost === 0 ? 'done' : 'ready');
  }, [cubies, size, rotationEpoch]);

  const applyStep = useCallback(
    (step) => {
      setCubies((prev) => {
        if (step.op === 'heal') return healSticker(prev, size, step.x, step.y, step.z, step.dir);
        const map = getManifoldMap(prev, size, planEpochRef.current);
        return flipStickerPair(prev, size, step.x, step.y, step.z, step.dir, map);
      });
    },
    [setCubies, size]
  );

  const advance = useCallback(() => {
    // A rotation re-addressed the cube out from under the plan — bail out.
    if (useGameStore.getState().rotationEpoch !== planEpochRef.current) {
      stopPlayback();
      setStatus('idle');
      return;
    }
    const idx = stepIndexRef.current;
    const steps = stepsRef.current;
    if (idx >= steps.length) {
      stopPlayback();
      setStatus('done');
      return;
    }
    applyStep(steps[idx]);
    stepIndexRef.current = idx + 1;
    setStepIndex(idx + 1);
    if (idx + 1 >= steps.length) {
      stopPlayback();
      setStatus('done');
    } else if (playingRef.current) {
      timerRef.current = setTimeout(advance, STEP_MS);
    }
  }, [applyStep, stopPlayback]);

  const play = useCallback(() => {
    if (playingRef.current || stepIndexRef.current >= stepsRef.current.length) return;
    playingRef.current = true;
    setStatus('playing');
    advance();
  }, [advance]);

  const pause = useCallback(() => {
    stopPlayback();
    setStatus(stepIndexRef.current >= stepsRef.current.length ? 'done' : 'ready');
  }, [stopPlayback]);

  const stepForward = useCallback(() => {
    if (playingRef.current) return;
    advance();
  }, [advance]);

  useEffect(() => stopPlayback, [stopPlayback]);

  return {
    status,
    plan,      // { target, heals, flips, healCost, flipCost, totalCost }
    costs,     // { totalPairs, asymmetricPairs, dirtyPairs, strictCost, quotientCost }
    stepIndex,
    totalSteps: stepsRef.current.length,
    play,
    pause,
    stepForward,
  };
}
