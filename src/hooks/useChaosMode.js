/**
 * useChaosMode Hook
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameStore } from './useGameStore.js';
import { useChaosWorker } from './useChaosWorker.js';

const buildSurfaceCoords = (S) => {
  const coords = [];
  for (let x = 0; x < S; x++)
    for (let y = 0; y < S; y++)
      for (let z = 0; z < S; z++)
        if (x === 0 || x === S - 1 || y === 0 || y === S - 1 || z === 0 || z === S - 1)
          coords.push([x, y, z]);
  return coords;
};

const computeChaosMetrics = (state, surfCoords) => {
  let disparity = 0;
  let flipActive = 0;
  let edgeTotal = 0;
  for (const [x, y, z] of surfCoords) {
    const c = state[x][y][z];
    for (const key of Object.keys(c.stickers)) {
      const st = c.stickers[key];
      edgeTotal++;
      if (st.curr !== st.orig) disparity++;
      if ((st.flips || 0) > 0) flipActive++;
    }
  }
  return { disparity, flipActive, edgeTotal };
};

const COUNTDOWN_PUBLISH_MS = 100;

export function useChaosMode() {
  const chaosLevel = useGameStore((state) => state.chaosLevel);
  const setChaosLevel = useGameStore((state) => state.setChaosLevel);
  const disparityFlipCap = useGameStore((state) => state.disparityFlipCap);
  const autoRotateEnabled = useGameStore((state) => state.autoRotateEnabled);
  const setAutoRotateEnabled = useGameStore((state) => state.setAutoRotateEnabled);
  const cascades = useGameStore((state) => state.cascades);
  const setCascades = useGameStore((state) => state.setCascades);
  const explosionT = useGameStore((state) => state.explosionT);
  const size = useGameStore((state) => state.size);
  const animState = useGameStore((state) => state.animState);
  const cubies = useGameStore((state) => state.cubies);
  const setCubies = useGameStore((state) => state.setCubies);
  const rotationEpoch = useGameStore((state) => state.rotationEpoch);
  const addDisparityDeathsBulk = useGameStore((state) => state.addDisparityDeathsBulk);
  const addDisparityEliminatedFacesBulk = useGameStore((state) => state.addDisparityEliminatedFacesBulk);

  const upcomingRotation = useGameStore((state) => state.upcomingRotation);
  const setUpcomingRotation = useGameStore((state) => state.setUpcomingRotation);
  const rotationCountdown = useGameStore((state) => state.rotationCountdown);
  const setRotationCountdown = useGameStore((state) => state.setRotationCountdown);
  const setAnimState = useGameStore((state) => state.setAnimState);
  const setPendingMove = useGameStore((state) => state.setPendingMove);

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
  const countdownRef = useRef(rotationCountdown);
  countdownRef.current = rotationCountdown;

  const surfaceCoordsRef = useRef(buildSurfaceCoords(size));
  const surfaceCoordsMemo = useMemo(() => buildSurfaceCoords(size), [size]);
  useEffect(() => {
    surfaceCoordsRef.current = surfaceCoordsMemo;
  }, [surfaceCoordsMemo]);

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
      return;
    }

    if (!upcomingRotation) {
      setUpcomingRotation(generateRandomRotation(size));
    }

    let raf = 0;
    let last = performance.now();
    let publishAcc = 0;

    const loop = (now) => {
      const dt = now - last;
      last = now;

      if (animStateRef.current) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const disparity = disparityRef.current;
      const maxDisparity = sizeRef.current * sizeRef.current * 6;
      const disparityRatio = Math.min(1, disparity / maxDisparity);

      const maxInterval = 10000;
      const minInterval = 750;
      const targetInterval = maxInterval - disparityRatio * (maxInterval - minInterval);

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
        countdownRef.current = targetInterval;
        setRotationCountdown(targetInterval);
        publishAcc = 0;
      } else {
        countdownRef.current = newCountdown;
        publishAcc += dt;
        if (publishAcc >= COUNTDOWN_PUBLISH_MS) {
          setRotationCountdown(newCountdown);
          publishAcc = 0;
        }
      }

      raf = requestAnimationFrame(loop);
    };

    const disparity = disparityRef.current;
    const maxDisparity = size * size * 6;
    const disparityRatio = Math.min(1, disparity / maxDisparity);
    const initialCountdown = 10000 - disparityRatio * 9250;
    countdownRef.current = initialCountdown;
    setRotationCountdown(initialCountdown);

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoRotateEnabled, chaosMode, size, upcomingRotation, generateRandomRotation, setAnimState, setPendingMove, setUpcomingRotation, setRotationCountdown]);

  const onCascadeComplete = useCallback((id) => {
    setCascades((prev) => prev.filter((c) => c.id !== id));
  }, [setCascades]);

  return {
    chaosLevel,
    chaosMode,
    autoRotateEnabled,
    cascades,
    upcomingRotation,
    rotationCountdown,
    setChaosLevel,
    setAutoRotateEnabled,
    setCascades,
    onCascadeComplete,
  };
}
