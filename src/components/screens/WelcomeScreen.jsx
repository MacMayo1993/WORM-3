// src/components/screens/WelcomeScreen.jsx
/**
 * WelcomeScreen — pure DOM overlay rendered on top of the single persistent Canvas.
 * All 3D content (IntroScene, EffectComposer) lives in App.jsx's Canvas IntroBranch.
 * Self-clocked with its own rAF loop so per-frame intro time stays out of App
 * state (which would re-render the whole App tree at 60fps during the intro).
 */

import React, { useEffect, useState } from 'react';
import TextOverlay from '../intro/TextOverlay.jsx';

const WelcomeScreen = ({ onEnter }) => {
  const [introTime, setIntroTime] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = (now) => {
      setIntroTime((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (key === 'enter' || key === 's') {
        event.preventDefault();
        onEnter();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEnter]);

  return (
    <div
      className="welcome-screen"
      style={{ background: 'transparent', pointerEvents: 'none' }}
    >
      <TextOverlay time={introTime} />

      <button
        type="button"
        aria-label="Skip intro and enter game"
        className="skip-intro-btn"
        onClick={onEnter}
        style={{
          background: 'rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.75)',
          border: '1px solid rgba(255,255,255,0.2)',
          pointerEvents: 'auto',
        }}
      >
        Skip ►
      </button>

      {introTime >= 10 && (
        <button
          type="button"
          aria-label="Enter game"
          className="enter-btn"
          onClick={onEnter}
          style={{
            background: '#1e88e5',
            border: 'none',
            color: '#ffffff',
            pointerEvents: 'auto',
          }}
        >
          ENTER
        </button>
      )}
    </div>
  );
};

export default WelcomeScreen;
