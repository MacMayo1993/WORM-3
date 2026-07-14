// src/components/screens/WelcomeScreen.jsx
/**
 * WelcomeScreen — pure DOM overlay rendered on top of the single persistent Canvas.
 * All 3D content (IntroScene, EffectComposer) lives in App.jsx's Canvas IntroBranch.
 * Receives introTime from App so the TextOverlay and buttons stay in sync with the
 * 3D animation without needing their own RAF loop.
 */

import React, { useEffect } from 'react';
import TextOverlay from '../intro/TextOverlay.jsx';

const WelcomeScreen = ({ onEnter, introTime }) => {
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
          style={{ pointerEvents: 'auto' }}
        >
          ENTER
        </button>
      )}
    </div>
  );
};

export default WelcomeScreen;
