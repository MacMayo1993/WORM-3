/**
 * useChaosMode Hook
 *
 * Manages chaos cascade system and auto-rotate effects.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from './useGameStore.js';
import { buildManifoldGridMap, flipStickerPair, getManifoldNeighbors, isOnSeam, isCrossFaceNeighbor } from '../game/manifoldLogic.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { isOnEdge } from '../game/cubeUtils.js';
import { FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';

/**
 * Hook for chaos mode management
 */
export function useChaosMode() {
  const chaosLevel = useGameStore((state) => state.chaosLevel);
  const setChaosLevel = useGameStore((state) => state.setChaosLevel);
  const autoRotateEnabled = useGameStore((state) => state.autoRotateEnabled);
  const setAutoRotateEnabled = useGameStore((state) => state.setAutoRotateEnabled);
  const cascades = useGameStore((state) => state.cascades);
  const setCascades = useGameStore((state) => state.setCascades);
  const explosionT = useGameStore((state) => state.explosionT);
  const size = useGameStore((state) => state.size);
  const animState = useGameStore((state) => state.animState);
  const cubies = useGameStore((state) => state.cubies);
  const setCubies = useGameStore((state) => state.setCubies);

  // Auto-rotate state
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

  // Cache the manifold map between ticks — it only changes on face rotations,
  // not on sticker flips, so rebuilding every 100ms is wasteful.
  const manifoldMapCacheRef = useRef(null);
  const animStateRef = useRef(animState);
  animStateRef.current = animState;

  // Helper: count stickers where curr !== orig (disparity)
  const countDisparity = useCallback((state) => {
    let count = 0;
    const S = state.length;
    for (let x = 0; x < S; x++)
      for (let y = 0; y < S; y++)
        for (let z = 0; z < S; z++) {
          const c = state[x][y][z];
          for (const dirKey of Object.keys(c.stickers)) {
            const st = c.stickers[dirKey];
            if (isOnEdge(x, y, z, dirKey, S) && st.curr !== st.orig) count++;
          }
        }
    return count;
  }, []);

  // Generate a random rotation
  const generateRandomRotation = useCallback((cubeSize) => {
    const axes = ['col', 'row', 'depth'];
    const axis = axes[Math.floor(Math.random() * axes.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const sliceIndex = Math.floor(Math.random() * cubeSize);
    return { axis, dir, sliceIndex };
  }, []);

  // Chaos chain propagation effect
  useEffect(() => {
    if (!chaosMode) return;

    let raf = 0, last = performance.now(), tickAcc = 0, cooldownAcc = 0;
    let wasAnimating = !!animStateRef.current;

    const delayByLevel = [0, 500, 350, 200, 100];
    const baseChanceByLevel = [0, 0.03, 0.05, 0.08, 0.12];
    const decayByLevel = [0, 0.7, 0.8, 0.85, 0.9];
    const cooldownByLevel = [0, 3000, 2000, 1500, 1000];

    const tickPeriod = delayByLevel[chaosLevel] || 350;
    const basePerTally = baseChanceByLevel[chaosLevel] || 0.05;
    const strengthDecay = decayByLevel[chaosLevel] || 0.8;
    const chainCooldown = cooldownByLevel[chaosLevel] || 2000;

    let currentChainTile = null;
    let chainStrength = 1.0;
    let inCooldown = false;
    let visitedSet = new Set();

    const findChainStart = (state) => {
      const S = state.length;
      const candidates = [];

      for (let x = 0; x < S; x++)
        for (let y = 0; y < S; y++)
          for (let z = 0; z < S; z++) {
            const c = state[x][y][z];
            for (const dirKey of Object.keys(c.stickers)) {
              const st = c.stickers[dirKey];
              if (st.flips > 0 && st.flips < FLIP_CAP && st.curr !== st.orig && isOnEdge(x, y, z, dirKey, S)) {
                candidates.push({ x, y, z, dirKey, flips: st.flips });
              }
            }
          }

      if (!candidates.length) return null;

      const totalWeight = candidates.reduce((sum, c) => sum + c.flips, 0);
      let roll = Math.random() * totalWeight;
      for (const c of candidates) {
        roll -= c.flips;
        if (roll <= 0) return { tile: c, strength: 1.0 };
      }
      return { tile: candidates[candidates.length - 1], strength: 1.0 };
    };

    const stepChain = (state) => {
      const S = state.length;
      // Use cached manifold map — it only depends on cube geometry (positions/dirs),
      // not on sticker colors/flips, so it stays valid across all flip operations.
      if (!manifoldMapCacheRef.current) {
        manifoldMapCacheRef.current = buildManifoldGridMap(state, S);
      }
      const currentManifoldMap = manifoldMapCacheRef.current;

      if (!currentChainTile) {
        const start = findChainStart(state);
        if (!start) return state;
        currentChainTile = start.tile;
        chainStrength = start.strength;
        visitedSet = new Set();
        visitedSet.add(`${start.tile.x},${start.tile.y},${start.tile.z},${start.tile.dirKey}`);
      }

      const next = flipStickerPair(
        state, S,
        currentChainTile.x, currentChainTile.y, currentChainTile.z,
        currentChainTile.dirKey, currentManifoldMap
      );

      chainStrength *= strengthDecay;

      if (chainStrength < 0.1) {
        currentChainTile = null;
        chainStrength = 1.0;
        visitedSet = new Set();
        inCooldown = true;
        cooldownAcc = 0;
        return next;
      }

      const neighbors = getManifoldNeighbors(
        currentChainTile.x, currentChainTile.y, currentChainTile.z,
        currentChainTile.dirKey, S
      );

      const validNeighbors = [];
      for (const neighbor of neighbors) {
        // Skip already-visited tiles so the chain spreads outward, not back
        const nKey = `${neighbor.x},${neighbor.y},${neighbor.z},${neighbor.dirKey}`;
        if (visitedSet.has(nKey)) continue;

        const nc = next[neighbor.x]?.[neighbor.y]?.[neighbor.z];
        if (!nc) continue;
        const nst = nc.stickers[neighbor.dirKey];
        if (!nst) continue;
        // Skip dead tiles — they can no longer participate in cascades
        if ((nst.flips || 0) >= FLIP_CAP) continue;
        if (isOnEdge(neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, S)) {
          // Seam Lightning: cross-face neighbors and on-seam tiles get a weight boost
          const crossFace = isCrossFaceNeighbor(currentChainTile.dirKey, neighbor.dirKey);
          const onSeam = isOnSeam(neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, S);
          // Cross-face = 4x weight, on-seam = 2x weight, interior = 1x
          const seamWeight = crossFace ? 4 : onSeam ? 2 : 1;
          validNeighbors.push({ ...neighbor, flips: nst.flips || 0, seamWeight });
        }
      }

      let nextTile = null;
      if (validNeighbors.length > 0) {
        // Seam Lightning: weighted shuffle — seam neighbors get picked first
        const sorted = [];
        const pool = [...validNeighbors];
        while (pool.length > 0) {
          let roll = Math.random() * pool.reduce((s, n) => s + n.seamWeight, 0);
          let pick = pool.length - 1;
          for (let i = 0; i < pool.length; i++) {
            roll -= pool[i].seamWeight;
            if (roll <= 0) { pick = i; break; }
          }
          sorted.push(pool.splice(pick, 1)[0]);
        }

        for (const neighbor of sorted) {
          const tallyBonus = Math.max(1, neighbor.flips);
          // Half-life acceleration: tiles closer to death get flipped faster
          const halfLifeMult = getHalfLifeMultiplier(neighbor.flips);
          // Seam Lightning: seam weight also boosts propagation chance
          const propagateChance = chainStrength * basePerTally * tallyBonus * (neighbor.seamWeight * 0.5 + 0.5) * halfLifeMult;

          if (Math.random() < propagateChance) {
            const fromPos = getStickerWorldPos(
              currentChainTile.x, currentChainTile.y, currentChainTile.z,
              currentChainTile.dirKey, S, explosionT
            );
            const toPos = getStickerWorldPos(
              neighbor.x, neighbor.y, neighbor.z,
              neighbor.dirKey, S, explosionT
            );
            const crossFace = isCrossFaceNeighbor(currentChainTile.dirKey, neighbor.dirKey);
            setCascades((prev) => [
              ...prev,
              { id: Date.now() + Math.random(), from: fromPos, to: toPos, crossFace }
            ]);

            nextTile = neighbor;
            break;
          }
        }
      }

      if (nextTile) {
        visitedSet.add(`${nextTile.x},${nextTile.y},${nextTile.z},${nextTile.dirKey}`);
        currentChainTile = nextTile;
      } else {
        currentChainTile = null;
        chainStrength = 1.0;
        visitedSet = new Set();
        inCooldown = true;
        cooldownAcc = 0;
      }

      return next;
    };

    const loop = (now) => {
      const dt = now - last;
      last = now;

      // When a face rotation completes, cube geometry changes — invalidate the cache.
      const isAnimating = !!animStateRef.current;
      if (wasAnimating && !isAnimating) {
        manifoldMapCacheRef.current = null;
      }
      wasAnimating = isAnimating;

      if (inCooldown) {
        cooldownAcc += dt;
        if (cooldownAcc >= chainCooldown) {
          inCooldown = false;
          cooldownAcc = 0;
        }
      } else {
        tickAcc += dt;
        if (tickAcc >= tickPeriod) {
          // Pre-compute outside Zustand's setter so clone3D/chain work happens
          // in the RAF callback, not inside React's state reconciliation.
          const next = stepChain(cubiesRef.current);
          if (next !== cubiesRef.current) setCubies(next);
          tickAcc = 0;
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [chaosMode, chaosLevel, explosionT, setCubies, setCascades]);

  // Auto-rotate effect
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

    const loop = (now) => {
      const dt = now - last;
      last = now;

      if (animState) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const disparity = countDisparity(cubiesRef.current);
      const maxDisparity = size * size * 6;
      const disparityRatio = Math.min(1, disparity / maxDisparity);

      const maxInterval = 10000;
      const minInterval = 750;
      const targetInterval = maxInterval - disparityRatio * (maxInterval - minInterval);

      setRotationCountdown((prev) => {
        const newCountdown = prev - dt;

        if (newCountdown <= 0) {
          if (upcomingRotation) {
            const { axis, dir, sliceIndex } = upcomingRotation;
            setAnimState({ axis, dir, sliceIndex, t: 0 });
            const move = { axis, dir, sliceIndex };
            setPendingMove(move);
            pendingMoveRef.current = move;
          }
          setUpcomingRotation(generateRandomRotation(size));
          return targetInterval;
        }

        return newCountdown;
      });

      raf = requestAnimationFrame(loop);
    };

    const disparity = countDisparity(cubiesRef.current);
    const maxDisparity = size * size * 6;
    const disparityRatio = Math.min(1, disparity / maxDisparity);
    const initialInterval = 10000 - disparityRatio * 9250;
    setRotationCountdown(initialInterval);

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoRotateEnabled, chaosMode, size, animState, upcomingRotation, generateRandomRotation, countDisparity, setAnimState, setPendingMove, setUpcomingRotation, setRotationCountdown]);

  // Cascade completion handler
  const onCascadeComplete = useCallback((id) => {
    setCascades((prev) => prev.filter((c) => c.id !== id));
  }, [setCascades]);

  return {
    // State
    chaosLevel,
    chaosMode,
    autoRotateEnabled,
    cascades,
    upcomingRotation,
    rotationCountdown,

    // Actions
    setChaosLevel,
    setAutoRotateEnabled,
    setCascades,
    onCascadeComplete,
  };
}
