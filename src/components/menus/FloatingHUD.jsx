import React, { useState, useEffect, useRef } from 'react';

/**
 * FloatingHUD - Minimal auto-fading HUD
 *
 * Shows brief notifications (parity change, chaos level, etc.)
 * Auto-fades after 4s of inactivity
 */
const FloatingHUD = ({ metrics, chaosLevel, chaosMode }) => {
  const [message, setMessage] = useState(null);
  const [visible, setVisible] = useState(false);
  const fadeTimer = useRef(null);
  const prevParity = useRef(metrics.flips % 2);
  const prevChaosLevel = useRef(chaosLevel);

  // Watch for parity change
  useEffect(() => {
    const newParity = metrics.flips % 2;
    if (newParity !== prevParity.current) {
      prevParity.current = newParity;
      showMessage(`Parity flipped — ${newParity === 0 ? 'Even' : 'Odd'}`);
    }
  }, [metrics.flips]);

  // Watch for chaos level change
  useEffect(() => {
    if (chaosMode && chaosLevel !== prevChaosLevel.current) {
      prevChaosLevel.current = chaosLevel;
      showMessage(`Chaos Level ${chaosLevel}`);
    }
  }, [chaosLevel, chaosMode]);

  const showMessage = (msg) => {
    setMessage(msg);
    setVisible(true);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setVisible(false), 4000);
  };

  useEffect(() => {
    return () => { if (fadeTimer.current) clearTimeout(fadeTimer.current); };
  }, []);

  if (!message) return null;

  return (
    <div className={`floating-hud ${visible ? 'floating-hud-visible' : 'floating-hud-hidden'}`}>
      {message}
    </div>
  );
};

export default FloatingHUD;
