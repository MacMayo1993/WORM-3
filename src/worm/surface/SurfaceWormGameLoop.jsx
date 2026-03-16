// src/worm/surface/SurfaceWormGameLoop.jsx
// Game loop component for WORM surface mode — must be inside Canvas for useFrame

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  getNextSurfacePosition,
  isPositionFlipped,
  getAntipodalPosition,
  checkSelfCollision,
  positionKey,
  spawnOrbs,
  pressState,
  getPressedTileKeys,
  checkHealingCandidates,
} from '../wormLogic.js';
import { healSticker } from '../../game/cubeState.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { play } from '../../utils/audio.js';
import { CONFIG } from './useSurfaceWormGame.js';

// Game loop component for surface mode — must be inside Canvas for useFrame
export function SurfaceWormGameLoop({ cubies, size, animState, game }) {
  const {
    gameState,
    worm,
    moveDir,
    orbs,
    speed,
    pendingGrowth,
    pendingGrowthColorsRef,
    lastOrbColorRef,
    lastMoveTime,
    timeAliveAcc,
    setGameState,
    setWorm,
    setMoveDir,
    setOrbs,
    setScore,
    setWarps,
    setPendingGrowth,
    setOrbInventory,
    setTimeAlive,
  } = game;

  const setCubies = useGameStore(s => s.setCubies);
  const recentlyHealedRef = useRef(new Set());
  // Healing scan is O(size³×6) — only run it after the worm actually steps onto a new tile.
  const needsHealCheckRef = useRef(false);

  // Clear press state on unmount so tiles don't stay depressed after leaving worm mode
  useEffect(() => {
    return () => { pressState.tiles.clear(); };
  }, []);

  useFrame((_state, delta) => {
    if (gameState !== 'playing') return;
    if (animState) return;

    // ── Press state: set depth=1 for current worm tiles, decay released tiles ──
    const currentPressedKeys = getPressedTileKeys(worm);
    pressState.tiles.forEach((_depth, key) => {
      if (currentPressedKeys.has(key)) return;
      const next = pressState.tiles.get(key) * 0.78;
      if (next < 0.01) pressState.tiles.delete(key);
      else pressState.tiles.set(key, next);
    });
    for (const key of currentPressedKeys) {
      pressState.tiles.set(key, 1.0);
    }

    // ── Healing check: only runs after a worm step (not every frame) ──
    if (needsHealCheckRef.current) {
      needsHealCheckRef.current = false;
      const candidates = checkHealingCandidates(cubies, size, worm);
      if (candidates.length > 0) {
        let updatedCubies = cubies;
        let healed = false;
        for (const c of candidates) {
          const key = positionKey(c);
          if (!recentlyHealedRef.current.has(key)) {
            updatedCubies = healSticker(updatedCubies, size, c.x, c.y, c.z, c.dirKey);
            recentlyHealedRef.current.add(key);
            setScore(s => s + CONFIG.healBonus);
            healed = true;
            setTimeout(() => recentlyHealedRef.current.delete(key), 500);
          }
        }
        if (healed) {
          setCubies(updatedCubies);
          play('/sounds/eat.mp3');
        }
      }
    }

    // Track time alive (update display state at whole-second boundaries)
    const prevSecs = Math.floor(timeAliveAcc.current);
    timeAliveAcc.current += delta;
    const newSecs = Math.floor(timeAliveAcc.current);
    if (newSecs !== prevSecs) setTimeAlive(newSecs);

    lastMoveTime.current += delta;

    const moveInterval = 1 / speed;
    if (lastMoveTime.current < moveInterval) return;

    lastMoveTime.current = 0;
    // Worm just stepped — schedule the heal scan for this frame's tail.
    needsHealCheckRef.current = true;

    const head = worm[0];
    if (!head) return;

    const nextPos = getNextSurfacePosition(
      { x: head.x, y: head.y, z: head.z, dirKey: head.dirKey },
      moveDir,
      size
    );

    if (!nextPos) {
      setGameState('gameover');
      play('/sounds/gameover.mp3');
      return;
    }

    if (nextPos.moveDir && nextPos.moveDir !== moveDir) {
      setMoveDir(nextPos.moveDir);
    }

    let finalPos = nextPos;

    if (isPositionFlipped(nextPos, cubies)) {
      const antipodalPos = getAntipodalPosition(nextPos, cubies, size);
      if (antipodalPos) {
        finalPos = { ...antipodalPos, moveDir: moveDir };
        setWarps(w => w + 1);
        setScore(s => s + CONFIG.warpBonus);
        play('/sounds/warp.mp3');
      }
    }

    if (checkSelfCollision(finalPos, worm, pendingGrowth > 0)) {
      setGameState('gameover');
      play('/sounds/gameover.mp3');
      return;
    }

    const orbKey = positionKey(finalPos);
    const orbIndex = orbs.findIndex(o => positionKey(o) === orbKey);

    // ateOrbColor is set this frame so we can apply color immediately (avoids stale pendingGrowth)
    let ateOrbColor = null;
    if (orbIndex !== -1) {
      const eatenOrb = orbs[orbIndex];
      ateOrbColor = eatenOrb.color ?? null;
      lastOrbColorRef.current = ateOrbColor; // remember for all subsequent segments
      setOrbs(prev => prev.filter((_, i) => i !== orbIndex));
      // Track orb in color inventory
      if (eatenOrb.faceId) {
        setOrbInventory(prev => ({ ...prev, [eatenOrb.faceId]: (prev[eatenOrb.faceId] ?? 0) + 1 }));
      }
      // Push extra growth colors for growthPerOrb > 1 (first is handled this frame)
      for (let g = 1; g < CONFIG.growthPerOrb; g++) pendingGrowthColorsRef.current.push(ateOrbColor);
      setPendingGrowth(g => g + CONFIG.growthPerOrb - 1);
      setScore(s => s + 50 + (worm.length * 10));
      play('/sounds/eat.mp3');

      if (orbs.length === 1) {
        setGameState('victory');
        play('/sounds/victory.mp3');
      }
    }

    // segColor applies to every new segment — worm inherits color of last eaten orb
    const segColor = lastOrbColorRef.current;

    if (ateOrbColor !== null) {
      // Orb eaten this frame — grow immediately with orb color (bypasses stale pendingGrowth)
      setWorm(prev => [{ ...finalPos, moveDir, color: ateOrbColor }, ...prev]);
    } else if (pendingGrowth > 0) {
      const growthColor = pendingGrowthColorsRef.current.shift() ?? segColor;
      setPendingGrowth(g => g - 1);
      setWorm(prev => {
        const newHead = growthColor ? { ...finalPos, moveDir, color: growthColor } : { ...finalPos, moveDir };
        return [newHead, ...prev];
      });
    } else {
      // Regular movement — apply lastOrbColor so worm trail stays colored after eating
      const newHead = segColor ? { ...finalPos, moveDir, color: segColor } : { ...finalPos, moveDir };
      setWorm(prev => [newHead, ...prev].slice(0, -1));
    }
  });

  return null;
}

// Keep WormGameLoop as an alias for backward compatibility
export { SurfaceWormGameLoop as WormGameLoop };
