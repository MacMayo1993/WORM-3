// src/worm/surface/SurfaceWormGameLoop.jsx
// Game loop component for WORM surface mode — must be inside Canvas for useFrame.
// Dispatches a single reducer action per movement tick instead of multiple setters,
// eliminating stale-closure risk and producing a deterministic tick trace.

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  getNextSurfacePosition,
  isPositionFlipped,
  getAntipodalPosition,
  checkSelfCollision,
  positionKey,
  pressState,
  getPressedTileKeys,
  checkHealingCandidates,
} from '../wormLogic.js';
import { healSticker } from '../../game/cubeState.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { play } from '../../utils/audio.js';
import { CONFIG } from './useSurfaceWormGame.js';
import { SA } from './surfaceReducer.js';

export function SurfaceWormGameLoop({ cubies, size, animState, game }) {
  const {
    stateRef,
    dispatch,
    lastMoveTime,
    timeAliveAcc,
    lastOrbColorRef,
    pendingGrowthColorsRef,
  } = game;

  const setCubies = useGameStore(s => s.setCubies);
  const recentlyHealedRef = useRef(new Set());
  // Healing scan is O(size³×6) — only run it after the worm steps onto a new tile.
  const needsHealCheckRef = useRef(false);

  // Clear press state on unmount so tiles don't stay depressed after leaving worm mode
  useEffect(() => {
    return () => { pressState.tiles.clear(); };
  }, []);

  useFrame((_state, delta) => {
    const s = stateRef.current; // always-fresh state — no stale closure
    if (s.gameState !== 'playing') return;
    if (animState) return;

    // ── Press state: set depth=1 for current worm tiles, decay released tiles ──
    const currentPressedKeys = getPressedTileKeys(s.worm);
    pressState.tiles.forEach((_depth, key) => {
      if (currentPressedKeys.has(key)) return;
      const next = pressState.tiles.get(key) * 0.78;
      if (next < 0.01) pressState.tiles.delete(key);
      else pressState.tiles.set(key, next);
    });
    for (const key of currentPressedKeys) {
      pressState.tiles.set(key, 1.0);
    }

    // ── Healing check: only runs the frame after a step ──
    if (needsHealCheckRef.current) {
      needsHealCheckRef.current = false;
      const candidates = checkHealingCandidates(cubies, size, s.worm);
      if (candidates.length > 0) {
        let updatedCubies = cubies;
        let healScore = 0;
        let healed = false;
        for (const c of candidates) {
          const key = positionKey(c);
          if (!recentlyHealedRef.current.has(key)) {
            updatedCubies = healSticker(updatedCubies, size, c.x, c.y, c.z, c.dirKey);
            recentlyHealedRef.current.add(key);
            healScore += CONFIG.healBonus;
            healed = true;
            setTimeout(() => recentlyHealedRef.current.delete(key), 500);
          }
        }
        if (healed) {
          setCubies(updatedCubies);
          play('/sounds/eat.mp3');
          dispatch({ type: SA.HEAL, payload: { score: s.score + healScore } });
        }
      }
    }

    // ── Time alive (update display state at whole-second boundaries) ──
    const prevSecs = Math.floor(timeAliveAcc.current);
    timeAliveAcc.current += delta;
    const newSecs = Math.floor(timeAliveAcc.current);
    const secondTicked = newSecs !== prevSecs;

    // ── Movement interval check ──
    lastMoveTime.current += delta;
    const speed = Math.min(CONFIG.baseSpeed + s.worm.length * CONFIG.speedIncrement, CONFIG.maxSpeed);
    if (lastMoveTime.current < 1 / speed) {
      if (secondTicked) dispatch({ type: SA.TICK_TIME, payload: { timeAlive: newSecs } });
      return;
    }

    lastMoveTime.current = 0;
    needsHealCheckRef.current = true;

    const head = s.worm[0];
    if (!head) return;

    // ── Compute next position ──
    const nextPos = getNextSurfacePosition(
      { x: head.x, y: head.y, z: head.z, dirKey: head.dirKey },
      s.moveDir,
      size
    );

    if (!nextPos) {
      dispatch({ type: SA.GAMEOVER });
      play('/sounds/gameover.mp3');
      return;
    }

    const newMoveDir = (nextPos.moveDir && nextPos.moveDir !== s.moveDir) ? nextPos.moveDir : s.moveDir;
    let finalPos = nextPos;
    let warpOccurred = false;

    if (isPositionFlipped(nextPos, cubies)) {
      const antipodalPos = getAntipodalPosition(nextPos, cubies, size);
      if (antipodalPos) {
        finalPos = { ...antipodalPos, moveDir: newMoveDir };
        warpOccurred = true;
      }
    }

    if (checkSelfCollision(finalPos, s.worm, s.pendingGrowth > 0)) {
      dispatch({ type: SA.GAMEOVER });
      play('/sounds/gameover.mp3');
      return;
    }

    // ── Orb collision ──
    const orbKey = positionKey(finalPos);
    const orbIndex = s.orbs.findIndex(o => positionKey(o) === orbKey);
    const ateOrb = orbIndex !== -1;
    let ateOrbColor = null;

    if (ateOrb) {
      const eatenOrb = s.orbs[orbIndex];
      ateOrbColor = eatenOrb.color ?? null;
      lastOrbColorRef.current = ateOrbColor;
      // Queue extra growth colors for growthPerOrb > 1
      for (let g = 1; g < CONFIG.growthPerOrb; g++) pendingGrowthColorsRef.current.push(ateOrbColor);
    }

    // ── Build new worm ──
    const segColor = ateOrbColor ?? lastOrbColorRef.current;
    let newWorm;
    let newPendingGrowth = s.pendingGrowth;

    if (ateOrb) {
      // Grow immediately with orb color
      newWorm = [{ ...finalPos, moveDir: newMoveDir, color: ateOrbColor }, ...s.worm];
      newPendingGrowth = s.pendingGrowth + CONFIG.growthPerOrb - 1;
    } else if (s.pendingGrowth > 0) {
      const growthColor = pendingGrowthColorsRef.current.shift() ?? segColor;
      newWorm = [growthColor ? { ...finalPos, moveDir: newMoveDir, color: growthColor } : { ...finalPos, moveDir: newMoveDir }, ...s.worm];
      newPendingGrowth = s.pendingGrowth - 1;
    } else {
      const newHead = segColor ? { ...finalPos, moveDir: newMoveDir, color: segColor } : { ...finalPos, moveDir: newMoveDir };
      newWorm = [newHead, ...s.worm].slice(0, -1);
    }

    // ── Build single payload for this tick ──
    const payload = {
      worm: newWorm,
      moveDir: newMoveDir,
      pendingGrowth: newPendingGrowth,
    };
    if (secondTicked) payload.timeAlive = newSecs;

    if (ateOrb) {
      const newOrbs = s.orbs.filter((_, i) => i !== orbIndex);
      const eatenOrb = s.orbs[orbIndex];
      payload.orbs = newOrbs;
      payload.score = s.score + 50 + (s.worm.length * 10) + (warpOccurred ? CONFIG.warpBonus : 0);
      payload.orbInventory = eatenOrb.faceId
        ? { ...s.orbInventory, [eatenOrb.faceId]: (s.orbInventory[eatenOrb.faceId] ?? 0) + 1 }
        : s.orbInventory;
      if (warpOccurred) payload.warps = s.warps + 1;

      // Check victory before dispatching
      if (newOrbs.length === 0) {
        dispatch({ type: SA.VICTORY });
        play('/sounds/eat.mp3');
        play('/sounds/victory.mp3');
        return;
      }

      dispatch({ type: SA.STEP_EAT, payload });
      play('/sounds/eat.mp3');
      if (warpOccurred) play('/sounds/warp.mp3');
    } else if (warpOccurred) {
      payload.score = s.score + CONFIG.warpBonus;
      payload.warps = s.warps + 1;
      dispatch({ type: SA.STEP_WARP, payload });
      play('/sounds/warp.mp3');
    } else {
      dispatch({ type: SA.STEP, payload });
    }
  });

  return null;
}

// Keep WormGameLoop as an alias for backward compatibility
export { SurfaceWormGameLoop as WormGameLoop };
