// src/components/ui/ScreenFallback.jsx — what a lazily-loaded screen shows
// while its chunk is still in flight.
//
// Every React.lazy screen in UILayer used `<Suspense fallback={null}>`, so
// opening a mode on a slow connection blanked the UI with no acknowledgement
// that the tap registered — the screen simply did not appear until it did.
//
// The delay is the whole design. A chunk that arrives in 80ms should show
// nothing at all, because a spinner that flashes for one frame reads as a
// glitch and makes the app feel less responsive, not more. Only once loading
// has gone on long enough to feel like a stall does the indicator fade in.

import React, { useEffect, useState } from 'react';
import { UI_FONT, NIGHT_TEXT_MUTED, UI_MOSS_LIGHT, TEXT_SM, Z } from '../../utils/uiTheme.js';

// Below this, the load is imperceptible and deserves no UI.
const APPEAR_AFTER_MS = 180;

export default function ScreenFallback({ label = 'Loading', delayMs = APPEAR_AFTER_MS, zIndex = Z.FULLSCREEN }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        zIndex,
        // Deliberately light: the scene behind stays readable, so this reads as
        // "still working" rather than as a screen in its own right.
        background: 'rgba(24,31,18,0.42)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        fontFamily: UI_FONT,
        pointerEvents: 'auto', // swallow taps aimed at the screen still arriving
        animation: 'modalBackdropIn 0.18s ease'
      }}
    >
      <div
        aria-hidden="true"
        className="screen-fallback-spinner"
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          border: `2.5px solid ${UI_MOSS_LIGHT}33`,
          borderTopColor: UI_MOSS_LIGHT,
          animation: 'screenFallbackSpin 0.7s linear infinite'
        }}
      />
      <span style={{ color: NIGHT_TEXT_MUTED, fontSize: TEXT_SM, fontWeight: 600, letterSpacing: '0.06em' }}>
        {label}
      </span>
    </div>
  );
}
