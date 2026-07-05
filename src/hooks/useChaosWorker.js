import { useEffect, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

const MAX_CASCADES = 6;

function makeCowWriter(state) {
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

  return { get: () => next, getCubieForWrite };
}

function applyChaosFlipsBatch(state, flips, size, manifoldMap, flipCap) {
  if (!flips?.length || !manifoldMap) return state;

  const { get, getCubieForWrite } = makeCowWriter(state);

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

  return get();
}

function applyChaosRecoveriesBatch(state, recoveries, size, manifoldMap) {
  if (!recoveries?.length || !manifoldMap) return state;

  const { get, getCubieForWrite } = makeCowWriter(state);

  const recoverOne = (loc) => {
    if (!loc) return;
    const c = getCubieForWrite(loc.x, loc.y, loc.z);
    const st = c.stickers[loc.dirKey];
    if (!st) return;
    const currentFlips = st.flips || 0;
    if (currentFlips <= 0) return;
    c.stickers[loc.dirKey] = {
      ...st,
      curr: ANTIPODAL_COLOR[st.curr],
      flips: currentFlips - 1,
    };
  };

  for (const [x, y, z, dirKey] of recoveries) {
    const sticker = state[x]?.[y]?.[z]?.stickers?.[dirKey];
    if (!sticker) continue;
    const anti = findAntipodalStickerByGrid(manifoldMap, sticker, size);
    recoverOne({ x, y, z, dirKey });
    recoverOne(anti);
  }

  return get();
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
  const disparityFlipCapRef = useRef(disparityFlipCap);

  useEffect(() => {
    disparityFlipCapRef.current = disparityFlipCap;
  }, [disparityFlipCap]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/chaosWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type === 'METRICS') {
        // Initial snapshot posted on START so HUDs have data before the first tick.
        useGameStore.getState().setChaosStats(e.data.payload.metrics);
        return;
      }
      if (e.data.type !== 'TICK') return;
      const { flips, cascades, recoveries, deaths, eliminatedFaces, winner, metrics } = e.data.payload;

      if (flips?.length > 0 || recoveries?.length > 0) {
        // manifoldMapRef may have been invalidated (set to null) by the rotationEpoch
        // effect below — rebuild lazily here, on the next flip, instead of eagerly on
        // every rotation. This keeps the rotation-completion frame cheap.
        if (!manifoldMapRef.current) {
          manifoldMapRef.current = buildManifoldGridMap(cubiesRef.current, size);
        }
        let next = cubiesRef.current;
        if (flips?.length > 0) {
          next = applyChaosFlipsBatch(next, flips, size, manifoldMapRef.current, disparityFlipCapRef.current);
        }
        if (recoveries?.length > 0) {
          next = applyChaosRecoveriesBatch(next, recoveries, size, manifoldMapRef.current);
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
          // Drop oldest entries when over the cap — skip entries with missing coords
          // to avoid passing malformed data into ChaosWave's geometry creation.
          const valid = merged.filter(c => c?.from && c?.to);
          return valid.length > MAX_CASCADES ? valid.slice(-MAX_CASCADES) : valid;
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
        const finalWinner = winner;
        const announce = () => {
          useGameStore.getState().setDisparityWinner({ pair: finalWinner });
          useGameStore.getState().setShowDisparityWinner(true);
        };
        // Always delay: the final deaths may have arrived in a prior TICK whose
        // 500ms animation is still playing. The unconditional 700ms window lets
        // all in-flight death animations finish before the winner screen appears.
        setTimeout(announce, 700);
      }

      if (metrics) {
        disparityRef.current = metrics.disparity;
        flipPctRef.current = metrics.flipPct;
        // Publish to the store so TopMenuBar can read live stats without
        // re-scanning all stickers on its own interval.
        useGameStore.getState().setChaosStats(metrics);
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // disparityFlipCap is intentionally excluded: the handler reads disparityFlipCapRef
    // (synced above) and flip-cap changes are propagated via the dedicated SET_FLIP_CAP
    // effect below. Including the raw value here would terminate and recreate the whole
    // worker thread on every flip-cap change instead of sending a lightweight message.
  }, [addDisparityDeathsBulk, addDisparityEliminatedFacesBulk, cubiesRef, disparityRef, flipPctRef, setCascades, setCubies, size]);

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
    // This effect must only fire on actual cube rotations (rotationEpoch), not on
    // every disparity flip — otherwise the worker state rolls back to the main
    // thread's lagging snapshot and M2/corner stickers spaz from being re-flipped.
    const lastRotation = useGameStore.getState().lastRotation;
    if (lastRotation) {
      // Single-slice rotation: replay the lightweight move params on the worker's
      // own state instead of structured-cloning the entire cubies array across the
      // postMessage boundary. Invalidate the cached manifold map rather than rebuild
      // it eagerly — the next TICK that actually applies a flip will rebuild it lazily.
      manifoldMapRef.current = null;
      workerRef.current.postMessage({ type: 'ROTATE_SLICE', payload: lastRotation });
    } else {
      // Full resync (size change, shuffle reset, loaded state) — no single move to
      // replay, so fall back to a full clone + eager rebuild.
      manifoldMapRef.current = buildManifoldGridMap(cubiesRef.current, size);
      workerRef.current.postMessage({ type: 'SYNC_CUBIES', payload: { cubies: cubiesRef.current } });
    }
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
