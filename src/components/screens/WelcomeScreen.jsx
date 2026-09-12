// src/components/screens/WelcomeScreen.jsx
/**
 * WelcomeScreen — pure DOM overlay rendered on top of the single persistent Canvas.
 * All 3D content (IntroScene, EffectComposer) lives in App.jsx's Canvas IntroBranch.
 * Receives introTime from App so the TextOverlay and buttons stay in sync with the
 * 3D animation without needing their own RAF loop.
 */

import React, { useEffect } from 'react';
import { TITLE_END } from '../intro/introTiming.js';
import TextOverlay from '../intro/TextOverlay.jsx';

const WelcomeScreen = ({ onEnter, introTime, reducedMotion = false }) => {
  // Returning players have seen the cinematic — give them ENTER immediately
  // instead of making them wait for the title reveal.
  const [introSeen] = React.useState(() => {
    try { return localStorage.getItem('worm3_intro_seen') === '1'; } catch { return false; }
  });

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
      <p className="opening-accessible">WORM cubed. One day… Front left, and flipped right to Back.</p>
      <TextOverlay time={introTime} reducedMotion={reducedMotion} />

      <button
        type="button"
        aria-label="Skip intro and enter game"
        className="opening-skip"
        onClick={onEnter}
      >
        Skip →
      </button>

      {(introSeen || reducedMotion || introTime >= TITLE_END) && (
        <button
          type="button"
          aria-label="Enter game"
          className="opening-enter"
          onClick={onEnter}
          style={{ pointerEvents: 'auto' }}
        >
          LET’S PLAY
        </button>
      )}
    </div>
  );
};

export default WelcomeScreen;
