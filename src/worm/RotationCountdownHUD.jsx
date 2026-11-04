// Paint from the simulation clock so holds and pause never drift with wall time.
import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { rotationClock } from './healerWorm/rotationClockBridge.js';

export default function RotationCountdownHUD() {
  const running = useGameStore(s => !!s.wormHealerMode && (s.wormAlive ?? true)
    && !s.wormPaused && (s.wormPhase ?? 'crawling') === 'crawling'
    && ['active', 'finalHealing'].includes(s.wormGamePhase ?? 'active'));
  const rootRef = useRef(null);
  const valueRef = useRef(null);
  useEffect(() => {
    if (!running) return undefined;
    let raf;
    const paint = () => {
      const root = rootRef.current;
      if (root) {
        const seconds = Math.max(0, rotationClock.secondsLeft).toFixed(1);
        root.hidden = !rotationClock.armed;
        root.dataset.held = String(rotationClock.held);
        root.dataset.urgent = String(!rotationClock.held && rotationClock.secondsLeft <= 3);
        root.setAttribute('aria-label', `Rotation ${rotationClock.held ? 'held at' : 'in'} ${seconds} seconds`);
        valueRef.current.textContent = `${seconds}s`;
      }
      raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return running ? <span ref={rootRef} className="worm-rotation-clock" role="timer" hidden>
    <span className="worm-rotation-label">ROTATE</span><strong ref={valueRef} />
    <span className="worm-rotation-held">HELD</span>
  </span> : null;
}
