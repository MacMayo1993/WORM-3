import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Z } from '../../utils/uiTheme.js';

const FloatingHUD = ({ metrics, chaosLevel, chaosMode }) => {
  const [queue, setQueue] = useState([]);
  const prevParity = useRef(metrics.flips % 2);
  const prevChaosLevel = useRef(chaosLevel);
  const idRef = useRef(0);

  const push = useCallback((msg) => {
    const id = ++idRef.current;
    // Cap at 3 queued so a burst of events doesn't pile up forever
    setQueue(prev => [...prev, { id, msg }].slice(-3));
  }, []);

  // Auto-advance: when the head message changes, start its 4s timer
  const headId = queue[0]?.id;
  useEffect(() => {
    if (!headId) return;
    const t = setTimeout(() => setQueue(prev => prev.slice(1)), 4000);
    return () => clearTimeout(t);
  }, [headId]);

  useEffect(() => {
    const newParity = metrics.flips % 2;
    if (newParity !== prevParity.current) {
      prevParity.current = newParity;
      push(`Parity flipped — ${newParity === 0 ? 'Even' : 'Odd'}`);
    }
  }, [metrics.flips, push]);

  useEffect(() => {
    if (chaosMode && chaosLevel !== prevChaosLevel.current) {
      prevChaosLevel.current = chaosLevel;
      push(`Chaos Level ${chaosLevel}`);
    }
  }, [chaosLevel, chaosMode, push]);

  if (queue.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column-reverse',
      alignItems: 'center',
      gap: '6px',
      zIndex: Z.HUD_RAISED,
      pointerEvents: 'none',
    }}>
      {queue.map((item, i) => (
        <div
          key={item.id}
          className="floating-hud floating-hud-visible"
          style={i > 0 ? { opacity: 0.40, transform: `scale(${0.92 - i * 0.04})`, fontSize: '11px' } : undefined}
        >
          {item.msg}
        </div>
      ))}
    </div>
  );
};

export default FloatingHUD;
