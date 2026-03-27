import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

const MAX_CASCADES = 6;

function applyChaosFlipsBatch(state, flips, size, manifoldMap, flipCap) {
  if (!flips?.length || !manifoldMap) return state;

  // Lazy copy-on-write: only clone the x-layer and y-row arrays that contain a
  // touched cubie. Avoids the O(size²) upfront clone of the entire 3-D array.
  let next = state;
  const touchedCubies = new Map();

  const cloneLayerIfNeeded = (x) => {
    if (next === state) next = state.slice();
    if (next[x] === state[x]) next[x] = state[x].slice();
  };

  const getCubieForWrite = (x, y, z) => {
    const key = `${x},${y},${z}`;
    const cached = touchedCubies.get(key);
    if (cached) return cached;
    cloneLayerIfNeeded(x);
    if (next[x][y] === state[x][y]) next[x][y] = state[x][y].slice();
    const cloned = { ...next[x][y][z], stickers: { ...next[x][y][z].stickers } };
    next[x][y][z] = cloned;
    touchedCubies.set(key, cloned);
    return cloned;
  };

  const applyOne = (loc) => {
    if (!loc) return;
    const c = getCubieForWrite(loc.x, loc.y, loc.z);
    const st = c.stickers[loc.dirKey];
    if (!st) return;
    const currentFlips = st.flips || 0;
    if (currentFlips >= flipCap) return;
    c.stickers[loc.dirKey] = {
      ...st,
      curr: ANTIPODAL_COLOR[st.curr],
      flips: Math.min(flipCap, currentFlips + 1),
    };
  };

  for (const [x, y, z, dirKey] of flips) {
    const sticker = state[x]?.[y]?.[z]?.stickers?.[dirKey];
    if (!sticker) continue;
    const anti = findAntipodalStickerByGrid(manifoldMap, sticker, size);
    applyOne({ x, y, z, dirKey });
    applyOne(anti);
  }

  return next;
}

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
  const manifoldMapRef = useRef(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/chaosWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type !== 'TICK') return;
      const { flips, cascades, deaths, eliminatedFaces, winner, metrics } = e.data.payload;

      if (flips?.length > 0) {
        const next = applyChaosFlipsBatch(cubiesRef.current, flips, size, manifoldMapRef.current, disparityFlipCap);
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
        const seen = useGameStore.getState().disparityDeathByGridId || {};
        const deduped = deaths.filter((d) => d?.gridId && !seen[d.gridId]);
        if (deduped.length > 0) {
          addDisparityDeathsBulk(deduped.map((d, i) => ({ id: now + i + Math.random(), ...d })));
        }
      }

      if (eliminatedFaces?.length > 0) {
        addDisparityEliminatedFacesBulk(eliminatedFaces);
      }

      if (winner?.length) {
        // Flush any lingering bolt visuals when the winner pair is finalized.
        setCascades([]);
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
  }, [addDisparityDeathsBulk, addDisparityEliminatedFacesBulk, cubiesRef, disparityFlipCap, disparityRef, flipPctRef, setCascades, setCubies, size]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    if (chaosMode) {
      manifoldMapRef.current = buildManifoldGridMap(cubies, size);
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
    setCascades([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaosMode]);

  useEffect(() => {
    if (!workerRef.current || !chaosMode) return;
    // Use cubiesRef to read current state without triggering on every chaos flip.
    // SYNC_CUBIES must only fire on actual cube rotations (rotationEpoch), not on
    // every disparity flip — otherwise the worker state rolls back to the main
    // thread's lagging snapshot and M2/corner stickers spaz from being re-flipped.
    manifoldMapRef.current = buildManifoldGridMap(cubiesRef.current, size);
    workerRef.current.postMessage({ type: 'SYNC_CUBIES', payload: { cubies: cubiesRef.current } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaosMode, rotationEpoch]);

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
