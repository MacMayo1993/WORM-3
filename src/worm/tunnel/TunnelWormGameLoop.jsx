// src/worm/tunnel/TunnelWormGameLoop.jsx
// Game loop component for WORM tunnel mode — must be inside Canvas for useFrame

import { useFrame } from '@react-three/fiber';
import { findNextTunnel, checkTunnelSelfCollision } from '../wormLogic.js';
import { play } from '../../utils/audio.js';
import { TUNNEL_CONFIG } from './useTunnelWormGame.js';

// Game loop component for tunnel mode — must be inside Canvas for useFrame
export function TunnelWormGameLoop({
  cubies: _cubies,
  size,
  animState,
  game // from useTunnelWormGame
}) {
  const {
    gameState,
    worm,
    orbs,
    tunnels,
    speed,
    pendingGrowth,
    pendingGrowthColorsRef,
    lastOrbColorRef,
    lastMoveTime,
    timeAliveAcc,
    setGameState,
    setWorm,
    setOrbs,
    setScore,
    setTunnelsTraversed,
    setPendingGrowth,
    setOrbInventory,
    setTargetTunnelId,
    setTimeAlive,
    inactiveTunnelSides,
    setInactiveTunnelSides,
  } = game;

  useFrame((_state, delta) => {
    if (gameState !== 'playing') return;
    if (animState) return;
    if (worm.length === 0 || tunnels.length === 0) return;

    // Track time alive (update display state at whole-second boundaries)
    const prevSecs = Math.floor(timeAliveAcc.current);
    timeAliveAcc.current += delta;
    const newSecs = Math.floor(timeAliveAcc.current);
    if (newSecs !== prevSecs) setTimeAlive(newSecs);

    lastMoveTime.current += delta;

    // Continuous movement through tunnel
    const moveAmount = speed * delta;

    const head = worm[0];
    if (!head || !head.tunnel) return;

    // Advance worm through tunnel
    const movementDir = head.direction ?? 1;
    let newT = head.t + (moveAmount * movementDir);
    let newTunnelId = head.tunnelId;
    let newTunnel = head.tunnel;
    let newDirection = movementDir;

    // Check if we've reached the end of the tunnel
    if (newT >= 1.0 || newT <= 0.0) {
      // Exited tunnel - find next tunnel to enter
      const exitedFromEntry = newT <= 0.0;
      const exitPos = exitedFromEntry ? head.tunnel.entry : head.tunnel.exit;
      const nextTunnelInfo = findNextTunnel(exitPos, tunnels, head.tunnelId, size, inactiveTunnelSides);

      if (nextTunnelInfo) {
        // Entering from this side consumes only that side; opposite side remains usable.
        setInactiveTunnelSides(prev => {
          const next = new Set(prev);
          next.add(nextTunnelInfo.enteredSideKey);
          return next;
        });

        newTunnel = nextTunnelInfo.tunnel;
        newTunnelId = newTunnel.id;
        // Enter from appropriate end
        newT = nextTunnelInfo.enterFromEntry ? 0.0 : 1.0;
        // If entering from exit, travel backwards (decreasing t).
        newDirection = nextTunnelInfo.enterFromEntry ? 1 : -1;
        setTunnelsTraversed(t => t + 1);
        setScore(s => s + TUNNEL_CONFIG.tunnelBonus);
        play('/sounds/warp.mp3');
      } else {
        // No connected tunnel - game over or bounce back
        setGameState('gameover');
        play('/sounds/gameover.mp3');
        return;
      }
    }

    // Determine growth state BEFORE collision check so we can exclude the tail
    // correctly — when growing, the tail stays; when not growing, it vacates.
    const growing = pendingGrowth > 0;

    // Check for self-collision
    const newHead = {
      tunnelId: newTunnelId,
      t: Math.max(0, Math.min(1, newT)),
      tunnel: newTunnel,
      direction: newDirection
    };
    if (checkTunnelSelfCollision(newHead, worm, growing)) {
      setGameState('gameover');
      play('/sounds/gameover.mp3');
      return;
    }

    // Check for orb collision
    const collisionThreshold = 0.15;
    const orbIndex = orbs.findIndex(orb =>
      orb.tunnelId === newTunnelId &&
      Math.abs(orb.t - newT) < collisionThreshold
    );

    // ateOrbColor set this frame so color applies immediately (avoids stale pendingGrowth)
    let ateOrbColor = null;
    if (orbIndex !== -1) {
      const eatenOrb = orbs[orbIndex];
      ateOrbColor = eatenOrb.color ?? null;
      lastOrbColorRef.current = ateOrbColor;
      setOrbs(prev => prev.filter((_, i) => i !== orbIndex));
      // Track orb in color inventory
      if (eatenOrb.faceId) {
        setOrbInventory(prev => ({ ...prev, [eatenOrb.faceId]: (prev[eatenOrb.faceId] ?? 0) + 1 }));
      }
      for (let g = 1; g < TUNNEL_CONFIG.growthPerOrb; g++) pendingGrowthColorsRef.current.push(ateOrbColor);
      setPendingGrowth(g => g + TUNNEL_CONFIG.growthPerOrb - 1);
      setScore(s => s + 50 + (worm.length * 10));
      play('/sounds/eat.mp3');

      // Update target tunnel
      const remainingOrbs = orbs.filter((_, i) => i !== orbIndex);
      if (remainingOrbs.length > 0) {
        setTargetTunnelId(remainingOrbs[0].tunnelId);
      }

      if (orbs.length === 1) {
        setGameState('victory');
        play('/sounds/victory.mp3');
      }
    }

    // segColor keeps the worm colored after an orb pickup
    const segColor = lastOrbColorRef.current;

    // Update worm positions
    let growthColor;
    let effectiveGrowing = growing;
    if (ateOrbColor !== null) {
      growthColor = ateOrbColor; // use orb color immediately
      effectiveGrowing = true;   // grow this frame without waiting for pendingGrowth state
    } else {
      growthColor = growing ? (pendingGrowthColorsRef.current.shift() ?? segColor) : segColor;
      if (growing) setPendingGrowth(g => g - 1);
    }

    setWorm(prev => {
      // Standard snake algorithm: new head prepended, each existing segment
      // takes the position of the one in front of it (old head → seg[0], etc.).
      // This makes the body flow through tunnels behind the head instead of
      // staying frozen, which prevents false self-collision when the head
      // re-enters a tunnel the body hasn't vacated yet.
      const head = growthColor ? { ...newHead, color: growthColor } : newHead;
      return effectiveGrowing ? [head, ...prev] : [head, ...prev].slice(0, -1);
    });
  });

  return null;
}
