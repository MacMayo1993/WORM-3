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
  checkHealingCandidatesNearHead,
} from '../wormLogic.js';
import { healSticker } from '../../game/cubeState.js';
import { CONFIG } from './useSurfaceWormGame.js';
import { SA } from './surfaceReducer.js';
import { advanceStepClock } from '../shared/movementClock.js';
import { useGameEvents, GE } from '../shared/useGameEvents.js';

export function SurfaceWormGameLoop({ cubies, size, animState, game }) {
  const {
    stateRef,
    dispatch,
    lastMoveTime,
    timeAliveAcc,
    lastOrbColorRef,
    pendingGrowthColorsRef,
  } = game;

  const emitGameEvent = useGameEvents();
  const recentlyHealedRef = useRef(new Set());
  // Healing scan runs only after a step and only checks the head neighborhood (medium #1).
  const needsHealCheckRef = useRef(false);

  // ── Orb spatial map: positionKey → orb (O(1) lookup) ──────────────────────
  // Rebuilt lazily only when the orbs array reference changes (i.e. after an eat
  // or restart), not every frame. During normal play the map is reused as-is.
  const lastOrbsRef = useRef(null);
  const orbMapRef = useRef(new Map());

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

    // ── Healing check: only runs the frame after a step; scans head neighborhood only ──
    if (needsHealCheckRef.current) {
      needsHealCheckRef.current = false;
      const candidates = checkHealingCandidatesNearHead(cubies, size, s.worm);
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
          dispatch({ type: SA.HEAL, payload: { score: s.score + healScore } });
          emitGameEvent({ type: GE.HEAL, cubies: updatedCubies });
        }
      }
    }

    // ── Time alive (update display state at whole-second boundaries) ──
    const prevSecs = Math.floor(timeAliveAcc.current);
    timeAliveAcc.current += delta;
    const newSecs = Math.floor(timeAliveAcc.current);
    const secondTicked = newSecs !== prevSecs;

    // ── Movement interval check (shared fixed-step clock) ──
    // stepHz = speed tiles/sec → one tile step per 1/speed seconds.
    // advanceStepClock preserves remainder so timing drift does not accumulate.
    const speed = Math.min(CONFIG.baseSpeed + s.worm.length * CONFIG.speedIncrement, CONFIG.maxSpeed);
    const steps = advanceStepClock(lastMoveTime, delta, speed);
    if (steps < 1) {
      if (secondTicked) dispatch({ type: SA.TICK_TIME, payload: { timeAlive: newSecs } });
      return;
    }
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
      emitGameEvent({ type: GE.GAMEOVER });
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
      emitGameEvent({ type: GE.GAMEOVER });
      return;
    }

    // ── Orb spatial map: rebuild if orbs array was replaced (eat / restart) ──
    if (s.orbs !== lastOrbsRef.current) {
      lastOrbsRef.current = s.orbs;
      const m = new Map();
      for (const orb of s.orbs) m.set(positionKey(orb), orb);
      orbMapRef.current = m;
    }

    // ── Orb collision — O(1) map lookup ──
    const eatenOrb = orbMapRef.current.get(positionKey(finalPos));
    const ateOrb = eatenOrb !== undefined;
    let ateOrbColor = null;

    if (ateOrb) {
      ateOrbColor = eatenOrb.color ?? null;
      lastOrbColorRef.current = ateOrbColor;
      for (let g = 1; g < CONFIG.growthPerOrb; g++) pendingGrowthColorsRef.current.push(ateOrbColor);
    }

    // ── Build new worm ──
    const segColor = ateOrbColor ?? lastOrbColorRef.current;
    let newWorm;
    let newPendingGrowth = s.pendingGrowth;

    if (ateOrb) {
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
      const newOrbs = s.orbs.filter(o => o !== eatenOrb);
      payload.orbs = newOrbs;
      payload.score = s.score + 50 + (s.worm.length * 10) + (warpOccurred ? CONFIG.warpBonus : 0);
      payload.orbInventory = eatenOrb.faceId
        ? { ...s.orbInventory, [eatenOrb.faceId]: (s.orbInventory[eatenOrb.faceId] ?? 0) + 1 }
        : s.orbInventory;
      if (warpOccurred) payload.warps = s.warps + 1;

      if (newOrbs.length === 0) {
        dispatch({ type: SA.VICTORY });
        emitGameEvent({ type: GE.VICTORY });
        return;
      }

      dispatch({ type: SA.STEP_EAT, payload });
      emitGameEvent({ type: GE.EAT_ORB, warpOccurred });
    } else if (warpOccurred) {
      payload.score = s.score + CONFIG.warpBonus;
      payload.warps = s.warps + 1;
      dispatch({ type: SA.STEP_WARP, payload });
      emitGameEvent({ type: GE.WARP });
    } else {
      dispatch({ type: SA.STEP, payload });
    }
  });

  return null;
}

// Keep WormGameLoop as an alias for backward compatibility
export { SurfaceWormGameLoop as WormGameLoop };
