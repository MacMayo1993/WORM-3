/**
 * useChaosMode Hook
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameStore } from './useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { useChaosWorker } from './useChaosWorker.js';
import { buildSurfaceCoords, computeChaosMetrics } from '../game/chaosMetrics.js';

// Mutable object shared with RotationPreview for zero-overhead countdown display.
// RotationPreview polls this in its own RAF loop and mutates the DOM directly,
// bypassing React's render cycle entirely.
export const chaosCountdownState = { countdown: 0 };

export function useChaosMode() {
  const {
    chaosLevel, setChaosLevel, disparityFlipCap,
    autoRotateEnabled, setAutoRotateEnabled,
    cascades, setCascades, explosionT, size, animState,
    cubies, setCubies, rotationEpoch,
    addDisparityDeathsBulk, addDisparityEliminatedFacesBulk,
    upcomingRotation, setUpcomingRotation, setRotationCountdown,
    setAnimState, setPendingMove,
  } = useGameStore(useShallow(s => ({
    chaosLevel: s.chaosLevel,
    setChaosLevel: s.setChaosLevel,
    disparityFlipCap: s.disparityFlipCap,
    autoRotateEnabled: s.autoRotateEnabled,
    setAutoRotateEnabled: s.setAutoRotateEnabled,
    cascades: s.cascades,
    setCascades: s.setCascades,
    explosionT: s.explosionT,
    size: s.size,
    animState: s.animState,
    cubies: s.cubies,
    setCubies: s.setCubies,
    rotationEpoch: s.rotationEpoch,
    addDisparityDeathsBulk: s.addDisparityDeathsBulk,
    addDisparityEliminatedFacesBulk: s.addDisparityEliminatedFacesBulk,
    upcomingRotation: s.upcomingRotation,
    setUpcomingRotation: s.setUpcomingRotation,
    setRotationCountdown: s.setRotationCountdown,
    setAnimState: s.setAnimState,
    setPendingMove: s.setPendingMove,
  })));

  const chaosMode = chaosLevel > 0;

  const cubiesRef = useRef(cubies);
  cubiesRef.current = cubies;
  const pendingMoveRef = useRef(null);

  const sizeRef = useRef(size);
  sizeRef.current = size;
  const upcomingRotationRef = useRef(upcomingRotation);
  upcomingRotationRef.current = upcomingRotation;
  const animStateRef = useRef(animState);
  animStateRef.current = animState;
  const countdownRef = useRef(0);

  // Compute surface coords once per size change. Keep a ref so callbacks
  // always read the latest value without re-subscribing. Initialising the ref
  // from the memo (and keeping it in sync during render) avoids the double
  // buildSurfaceCoords call that happened when the ref was initialised
  // independently and then synced via a useEffect.
  const surfaceCoordsMemo = useMemo(() => buildSurfaceCoords(size), [size]);
  const surfaceCoordsRef = useRef(surfaceCoordsMemo);
  surfaceCoordsRef.current = surfaceCoordsMemo;

  const disparityRef = useRef(0);
  const flipPctRef = useRef(0);

  useEffect(() => {
    if (!chaosMode) return;
    const { disparity, flipActive, edgeTotal } = computeChaosMetrics(cubiesRef.current, surfaceCoordsRef.current);
    disparityRef.current = disparity;
    flipPctRef.current = edgeTotal > 0 ? Math.round((flipActive / edgeTotal) * 100) : 0;
  }, [chaosMode]);

  useChaosWorker({
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
  });

  const generateRandomRotation = useCallback((cubeSize) => {
    const axes = ['col', 'row', 'depth'];
    const axis = axes[Math.floor(Math.random() * axes.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const sliceIndex = Math.floor(Math.random() * cubeSize);
    return { axis, dir, sliceIndex };
  }, []);

  useEffect(() => {
    if (!autoRotateEnabled || !chaosMode) {
      setUpcomingRotation(null);
      setRotationCountdown(0);
      chaosCountdownState.countdown = 0;
      return;
    }

    // Interval shrinks from 10 s toward 0.75 s as disparity grows.
    const targetInterval = () => {
      const maxDisparity = sizeRef.current * sizeRef.current * 6;
      const disparityRatio = Math.min(1, disparityRef.current / maxDisparity);
      const maxInterval = 10000;
      const minInterval = 750;
      return maxInterval - disparityRatio * (maxInterval - minInterval);
    };

    // Seed the first upcoming rotation (or replace one that is invalid for the
    // current cube size). Reading the ref instead of the store value keeps
    // `upcomingRotation` out of this effect's deps, so the RAF loop below
    // survives the whole chaos session instead of tearing down and remounting
    // once per fired rotation.
    if (!upcomingRotationRef.current || upcomingRotationRef.current.sliceIndex >= size) {
      const seeded = generateRandomRotation(size);
      upcomingRotationRef.current = seeded;
      setUpcomingRotation(seeded);
    }

    let raf = 0;
    let last = performance.now();

    const loop = (now) => {
      const dt = now - last;
      last = now;

      if (animStateRef.current) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const newCountdown = countdownRef.current - dt;
      if (newCountdown <= 0) {
        const nextRotation = upcomingRotationRef.current;
        if (nextRotation) {
          const { axis, dir, sliceIndex } = nextRotation;
          setAnimState({ axis, dir, sliceIndex, t: 0 });
          const move = { axis, dir, sliceIndex };
          setPendingMove(move);
          pendingMoveRef.current = move;
        }
        const generated = generateRandomRotation(sizeRef.current);
        setUpcomingRotation(generated);
        upcomingRotationRef.current = generated;
        const interval = targetInterval();
        countdownRef.current = interval;
        chaosCountdownState.countdown = interval;
        // Notify Zustand once per rotation cycle (not per frame) so listeners
        // that genuinely need the reset value (e.g. DisparityHUD) can react.
        setRotationCountdown(interval);
      } else {
        countdownRef.current = newCountdown;
        // Write directly to the shared mutable object — RotationPreview reads
        // this via its own RAF loop without touching React's render pipeline.
        chaosCountdownState.countdown = newCountdown;
      }

      raf = requestAnimationFrame(loop);
    };

    const initialCountdown = targetInterval();
    countdownRef.current = initialCountdown;
    chaosCountdownState.countdown = initialCountdown;
    setRotationCountdown(initialCountdown);

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoRotateEnabled, chaosMode, size, generateRandomRotation, setAnimState, setPendingMove, setUpcomingRotation, setRotationCountdown]);

  const onCascadeComplete = useCallback((id) => {
    setCascades((prev) => prev.filter((c) => c.id !== id));
  }, [setCascades]);

  return {
    chaosLevel,
    chaosMode,
    autoRotateEnabled,
    cascades,
    upcomingRotation,
    setChaosLevel,
    setAutoRotateEnabled,
    setCascades,
    onCascadeComplete,
  };
}
