// The rotation clock lives behind the orb reserve: one continuous color change,
// with no extra countdown row or animated text competing with the game.
import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { rotationClock } from './healerWorm/rotationClockBridge.js';

function rotationTint(clock) {
  const remaining = Math.max(0, Math.min(1, clock.secondsLeft / (clock.total || 1)));
  // Green → amber → red across the whole cycle, independent of telegraph timing.
  return `hsl(${Math.round(remaining * 120)} 65% 52%)`;
}

export default function RotationCountdownHUD() {
  const running = useGameStore(s => !!s.wormHealerMode && (s.wormAlive ?? true)
    && !s.wormPaused && (s.wormPhase ?? 'crawling') === 'crawling'
    && ['active', 'finalHealing'].includes(s.wormGamePhase ?? 'active'));
  const rootRef = useRef(null);
  useEffect(() => {
    if (!running) return undefined;
    let raf;
    const paint = () => {
      const root = rootRef.current;
      if (root) {
        root.hidden = !rotationClock.armed;
        root.style.backgroundColor = rotationTint(rotationClock);
        root.style.opacity = rotationClock.held ? '0.16' : '0.38';
      }
      raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return running ? <span ref={rootRef} className="worm-rotation-clock" aria-hidden="true" hidden /> : null;
}
