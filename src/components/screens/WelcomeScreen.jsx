// src/components/screens/WelcomeScreen.jsx
/**
 * WelcomeScreen — pure DOM overlay rendered on top of the single persistent Canvas.
 * All 3D content (IntroScene, EffectComposer) lives in App.jsx's Canvas IntroBranch.
 * Receives introTime from App so the TextOverlay and buttons stay in sync with the
 * 3D animation without needing their own RAF loop.
 */

import React, { useEffect } from 'react';
import { TITLE_END } from '../intro/introTiming.js';
import { ramp } from '../intro/introChoreography.js';
import TextOverlay from '../intro/TextOverlay.jsx';
import { INTRO_COPY_TEXT } from '../intro/introCopy.js';

// Play springs up from below the title card as the cinematic hands over.
const playSpring = p => {
  if (p >= 1) return undefined;
  const c = 1.9, spring = 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
  return { opacity: Math.min(1, p * 2.5), transform: `translateX(-50%) translateY(${(1 - spring) * 40}px) scale(${0.8 + 0.2 * spring})` };
};

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
      {/* The cinematic is aria-hidden, so this is the only place a screen reader
          hears the opening. Read from INTRO_COPY so it cannot drift from the
          script the way a hand-copied duplicate did. */}
      <p className="opening-accessible">WORM cubed. {INTRO_COPY_TEXT}</p>
      <TextOverlay time={introTime} reducedMotion={reducedMotion} />

      <button
        type="button"
        aria-label="Skip intro and enter game"
        className="opening-skip"
        onClick={onEnter}
      >
        Skip Intro →
      </button>

      {(introSeen || reducedMotion || introTime >= TITLE_END) && (
        <button
          type="button"
          aria-label="Enter game"
          className="opening-enter"
          onClick={onEnter}
          style={{ pointerEvents: 'auto', ...playSpring(introSeen || reducedMotion ? 1 : ramp(introTime, TITLE_END, TITLE_END + 0.45)) }}
        >
          Play <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
};

export default WelcomeScreen;
