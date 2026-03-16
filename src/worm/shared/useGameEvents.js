// src/worm/shared/useGameEvents.js
// Centralized side-effect dispatcher for WORM mode game events.
//
// Game loops call emitGameEvent({ type, ...payload }) AFTER dispatching their
// reducer action. Audio and Zustand store writes never appear inline inside the
// useFrame tick body — they're fully contained here.
//
// Benefits:
//   - Game loop is pure computation: compute → dispatch → emit
//   - Easy to throttle, mute, or add analytics without touching loop logic
//   - Single import point for all audio/store side effects

import { useCallback } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { play } from '../../utils/audio.js';

/** Game event type constants shared by surface and tunnel modes. */
export const GE = {
  WARP: 'WARP',             // Antipodal warp (surface) or tunnel-boundary exit (tunnel)
  EAT_ORB: 'EAT_ORB',      // Orb collected; optional { warpOccurred: true }
  HEAL: 'HEAL',             // Sticker healed; requires { cubies } for store write
  GAMEOVER: 'GAMEOVER',
  VICTORY: 'VICTORY',
};

/**
 * Returns an `emitGameEvent(event)` function that handles all audio and
 * Zustand store side-effects for WORM mode game events.
 *
 * Usage (inside a Canvas component that already has the game loop):
 *   const emitGameEvent = useGameEvents();
 *   // … after reducer dispatch …
 *   emitGameEvent({ type: GE.WARP });
 *   emitGameEvent({ type: GE.EAT_ORB, warpOccurred: true });
 *   emitGameEvent({ type: GE.HEAL, cubies: updatedCubies });
 */
export function useGameEvents() {
  const setCubies = useGameStore(s => s.setCubies);

  return useCallback((event) => {
    switch (event.type) {
      case GE.WARP:
        play('/sounds/warp.mp3');
        break;

      case GE.EAT_ORB:
        play('/sounds/eat.mp3');
        if (event.warpOccurred) play('/sounds/warp.mp3');
        break;

      case GE.HEAL:
        play('/sounds/eat.mp3');
        if (event.cubies) setCubies(event.cubies);
        break;

      case GE.GAMEOVER:
        play('/sounds/gameover.mp3');
        break;

      case GE.VICTORY:
        // eat sound plays first (the final orb was collected), then victory fanfare
        play('/sounds/eat.mp3');
        play('/sounds/victory.mp3');
        break;

      default:
        break;
    }
  }, [setCubies]);
}
