import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';

const MAX_CASCADES = 6;

export function useChaosWorker({
  chaosMode,
  chaosLevel,
  size,
  cubies,
  cubiesRef,
  disparityFlipCap,
  explosionT,
  animState,
  rotationEpoch,
  setCubies,
  setCascades,
  disparityRef,
  flipPctRef,
  addDisparityDeathsBulk,
  addDisparityEliminatedFacesBulk,
}) {
  const workerRef = useRef(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/chaosWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type !== 'TICK') return;
      const { flips, cascades, deaths, eliminatedFaces, winner, metrics } = e.data.payload;

      if (flips?.length > 0) {
        let next = cubiesRef.current;
        const mmap = buildManifoldGridMap(next, size);
        for (const [x, y, z, dirKey] of flips) {
          next = flipStickerPair(next, size, x, y, z, dirKey, mmap);
        }
        setCubies(next);
      }

      if (cascades?.length > 0) {
        setCascades((prev) => {
          const now = Date.now();
          const append = cascades.map((c, i) => ({
            ...c,
            id: now + i + Math.random(),
            key: `${c.from.join(',')}→${c.to.join(',')}`,
          }));
          const merged = [...prev, ...append];
          return merged.length > MAX_CASCADES ? merged.slice(-MAX_CASCADES) : merged;
        });
      }

      if (deaths?.length > 0) {
        const now = Date.now();
        addDisparityDeathsBulk(deaths.map((d, i) => ({ id: now + i + Math.random(), ...d })));
      }

      if (eliminatedFaces?.length > 0) {
        addDisparityEliminatedFacesBulk(eliminatedFaces);
      }

      if (winner?.length) {
        useGameStore.getState().setDisparityWinner({ pair: winner });
        useGameStore.getState().setShowDisparityWinner(true);
      }

      if (metrics) {
        disparityRef.current = metrics.disparity;
        flipPctRef.current = metrics.flipPct;
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [addDisparityDeathsBulk, addDisparityEliminatedFacesBulk, cubiesRef, disparityRef, flipPctRef, setCascades, setCubies, size]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    if (chaosMode) {
      useGameStore.getState().clearDisparityGame();
      worker.postMessage({
        type: 'START',
        payload: {
          cubies,
          size,
          chaosLevel,
          disparityFlipCap,
          explosionT,
          animating: !!animState,
        },
      });
      return;
    }

    worker.postMessage({ type: 'STOP' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaosMode]);

  useEffect(() => {
    if (!workerRef.current || !chaosMode) return;
    workerRef.current.postMessage({ type: 'SYNC_CUBIES', payload: { cubies } });
  }, [chaosMode, cubies, rotationEpoch]);

  useEffect(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'SET_FLIP_CAP', payload: { disparityFlipCap } });
  }, [disparityFlipCap]);

  useEffect(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'SET_CHAOS_LEVEL', payload: { chaosLevel } });
  }, [chaosLevel]);

  useEffect(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'SET_EXPLOSION', payload: { explosionT } });
  }, [explosionT]);

  useEffect(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'SET_ANIMATING', payload: { animating: !!animState } });
  }, [animState]);
}
