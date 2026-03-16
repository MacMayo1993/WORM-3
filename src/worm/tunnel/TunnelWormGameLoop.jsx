// src/worm/tunnel/TunnelWormGameLoop.jsx
// Game loop component for WORM tunnel mode — must be inside Canvas for useFrame.
// Dispatches a single reducer action per movement step instead of multiple setters,
// eliminating stale-closure risk and producing a deterministic tick trace.

import { useFrame } from '@react-three/fiber';
import { findNextTunnel, checkTunnelSelfCollision } from '../wormLogic.js';
import { play } from '../../utils/audio.js';
import { TUNNEL_CONFIG } from './useTunnelWormGame.js';
import { TA } from './tunnelReducer.js';
import { advanceStepClock, SIMULATION_HZ, FIXED_DT } from '../shared/movementClock.js';

export function TunnelWormGameLoop({
  cubies: _cubies,
  size,
  animState,
  game // from useTunnelWormGame
}) {
  const {
    stateRef,
    dispatch,
    lastMoveTime,
    timeAliveAcc,
    lastOrbColorRef,
    pendingGrowthColorsRef,
  } = game;

  useFrame((_state, delta) => {
    const s = stateRef.current; // always-fresh state — no stale closure
    if (s.gameState !== 'playing') return;
    if (animState) return;
    if (s.worm.length === 0 || s.tunnels.length === 0) return;

    // ── Time alive (update display state at whole-second boundaries) ──
    const prevSecs = Math.floor(timeAliveAcc.current);
    timeAliveAcc.current += delta;
    const newSecs = Math.floor(timeAliveAcc.current);
    const secondTicked = newSecs !== prevSecs;

    // ── Fixed-step movement clock (shared with surface mode) ──
    // Steps at SIMULATION_HZ so tunnel advance is frame-rate independent.
    // Each step advances speed * FIXED_DT in t-space (same concept as surface's
    // "one tile per step", just with a continuous position instead of a discrete tile).
    const speed = Math.min(
      TUNNEL_CONFIG.baseSpeed + s.worm.length * TUNNEL_CONFIG.speedIncrement,
      TUNNEL_CONFIG.maxSpeed
    );
    const steps = advanceStepClock(lastMoveTime, delta, SIMULATION_HZ);
    if (steps < 1) {
      if (secondTicked) dispatch({ type: TA.TICK_TIME, payload: { timeAlive: newSecs } });
      return;
    }
    const moveAmount = speed * steps * FIXED_DT;

    const head = s.worm[0];
    if (!head || !head.tunnel) {
      if (secondTicked) dispatch({ type: TA.TICK_TIME, payload: { timeAlive: newSecs } });
      return;
    }

    const movementDir = head.direction ?? 1;
    let newT = head.t + (moveAmount * movementDir);
    let newTunnelId = head.tunnelId;
    let newTunnel = head.tunnel;
    let newDirection = movementDir;
    let tunnelExitOccurred = false;
    let newInactiveTunnelSides = s.inactiveTunnelSides;
    let newTunnelsTraversed = s.tunnelsTraversed;
    let newScore = s.score;

    // ── Tunnel boundary check ──
    if (newT >= 1.0 || newT <= 0.0) {
      const exitedFromEntry = newT <= 0.0;
      const exitPos = exitedFromEntry ? head.tunnel.entry : head.tunnel.exit;
      const nextTunnelInfo = findNextTunnel(exitPos, s.tunnels, head.tunnelId, size, s.inactiveTunnelSides);

      if (nextTunnelInfo) {
        const next = new Set(s.inactiveTunnelSides);
        next.add(nextTunnelInfo.enteredSideKey);
        newInactiveTunnelSides = next;
        newTunnel = nextTunnelInfo.tunnel;
        newTunnelId = newTunnel.id;
        newT = nextTunnelInfo.enterFromEntry ? 0.0 : 1.0;
        newDirection = nextTunnelInfo.enterFromEntry ? 1 : -1;
        newTunnelsTraversed = s.tunnelsTraversed + 1;
        newScore += TUNNEL_CONFIG.tunnelBonus;
        tunnelExitOccurred = true;
      } else {
        dispatch({ type: TA.GAMEOVER });
        play('/sounds/gameover.mp3');
        return;
      }
    }

    // ── Self-collision check ──
    const growing = s.pendingGrowth > 0;
    const newHead = {
      tunnelId: newTunnelId,
      t: Math.max(0, Math.min(1, newT)),
      tunnel: newTunnel,
      direction: newDirection,
    };

    if (checkTunnelSelfCollision(newHead, s.worm, growing)) {
      dispatch({ type: TA.GAMEOVER });
      play('/sounds/gameover.mp3');
      return;
    }

    // ── Orb collision ──
    const collisionThreshold = 0.15;
    const orbIndex = s.orbs.findIndex(orb =>
      orb.tunnelId === newTunnelId &&
      Math.abs(orb.t - newT) < collisionThreshold
    );
    const ateOrb = orbIndex !== -1;
    let ateOrbColor = null;

    if (ateOrb) {
      const eatenOrb = s.orbs[orbIndex];
      ateOrbColor = eatenOrb.color ?? null;
      lastOrbColorRef.current = ateOrbColor;
      for (let g = 1; g < TUNNEL_CONFIG.growthPerOrb; g++) pendingGrowthColorsRef.current.push(ateOrbColor);
    }

    // ── Build new worm ──
    const segColor = ateOrbColor ?? lastOrbColorRef.current;
    let newPendingGrowth = s.pendingGrowth;
    let growthColor;
    let effectiveGrowing = growing;

    if (ateOrb) {
      growthColor = ateOrbColor;
      effectiveGrowing = true;
      newPendingGrowth = s.pendingGrowth + TUNNEL_CONFIG.growthPerOrb - 1;
    } else {
      growthColor = growing ? (pendingGrowthColorsRef.current.shift() ?? segColor) : segColor;
      if (growing) newPendingGrowth = s.pendingGrowth - 1;
    }

    const coloredHead = growthColor ? { ...newHead, color: growthColor } : newHead;
    const newWorm = effectiveGrowing
      ? [coloredHead, ...s.worm]
      : [coloredHead, ...s.worm].slice(0, -1);

    // ── Build single payload for this tick ──
    const payload = {
      worm: newWorm,
      pendingGrowth: newPendingGrowth,
      score: newScore,
      tunnelsTraversed: newTunnelsTraversed,
      inactiveTunnelSides: newInactiveTunnelSides,
    };
    if (secondTicked) payload.timeAlive = newSecs;

    if (ateOrb) {
      const newOrbs = s.orbs.filter((_, i) => i !== orbIndex);
      const eatenOrb = s.orbs[orbIndex];
      payload.orbs = newOrbs;
      payload.score = newScore + 50 + (s.worm.length * 10);
      payload.orbInventory = eatenOrb.faceId
        ? { ...s.orbInventory, [eatenOrb.faceId]: (s.orbInventory[eatenOrb.faceId] ?? 0) + 1 }
        : s.orbInventory;
      payload.targetTunnelId = newOrbs.length > 0 ? newOrbs[0].tunnelId : s.targetTunnelId;

      if (newOrbs.length === 0) {
        dispatch({ type: TA.VICTORY });
        play('/sounds/eat.mp3');
        play('/sounds/victory.mp3');
        return;
      }

      dispatch({ type: TA.STEP_EAT, payload });
      play('/sounds/eat.mp3');
      if (tunnelExitOccurred) play('/sounds/warp.mp3');
    } else if (tunnelExitOccurred) {
      dispatch({ type: TA.STEP_TUNNEL_EXIT, payload });
      play('/sounds/warp.mp3');
    } else {
      dispatch({ type: TA.STEP, payload });
    }
  });

  return null;
}
