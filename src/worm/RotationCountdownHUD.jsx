// src/worm/RotationCountdownHUD.jsx
// "A layer turns in N seconds" — the clock for healer worm's rotation hazard.
//
// The hazard fires on a fixed ten-second cycle and the threatened slice is lit in
// the world for all of it (SliceWarningLights). What the light could not say is
// *when*: a player watching the rim brighten had to guess whether they had six
// seconds to cross it or one. This is that number, plus a bar draining toward the
// turn, so the two cues answer "where" and "when" together.
//
// It paints itself from requestAnimationFrame off the rotationClock bridge — the
// same arrangement MobiusHUD uses for tunnel progress. A countdown is new text
// every frame, and routing that through React would be a re-render per frame for
// the whole run.

import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import { UI_FONT, MONO_FONT, NIGHT_TEXT_MUTED } from '../utils/uiTheme.js';
import { rotationClock } from './healerWorm/rotationClockBridge.js';

const BAR_W = 132;
// Calm while the turn is far off, hot once the telegraph starts — the same
// reading as the rim on the cube, which brightens over the same window.
const CALM = '#1f8a4c';
const HOT = '#c26a00';
const CRITICAL = '#c41e3a';

export default function RotationCountdownHUD() {
  const { wormHealerMode, wormGamePhase, wormAlive, wormPaused, wormPhase } = useGameStore(
    useShallow(s => ({
      wormHealerMode: s.wormHealerMode ?? false,
      wormGamePhase: s.wormGamePhase ?? 'active',
      wormAlive: s.wormAlive ?? true,
      wormPhase: s.wormPhase ?? 'crawling',
      wormPaused: s.wormPaused ?? false
    }))
  );

  const running = wormHealerMode && wormAlive && !wormPaused && wormPhase === 'crawling'
    && (wormGamePhase === 'active' || wormGamePhase === 'finalHealing');

  const rootRef = useRef(null);
  const secondsRef = useRef(null);
  const fillRef = useRef(null);
  const labelRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!running) {
      cancelAnimationFrame(rafRef.current);
      return undefined;
    }
    const paint = () => {
      rafRef.current = requestAnimationFrame(paint);
      const root = rootRef.current;
      if (!root) return;

      if (!rotationClock.armed) {
        root.style.display = 'none';
        return;
      }
      const total = rotationClock.total || 1;
      const left = rotationClock.secondsLeft;
      const warn = rotationClock.warning;
      const held = rotationClock.held;

      root.style.display = 'flex';
      // The bar drains rather than fills: a shortening bar and a falling number
      // say the same thing, and two cues that agree are read faster than one.
      const remaining = Math.max(0, Math.min(1, left / total));
      const colour = held ? NIGHT_TEXT_MUTED : warn > 0.66 ? CRITICAL : warn > 0 ? HOT : CALM;
      const fill = fillRef.current;
      if (fill) {
        fill.style.width = `${remaining * 100}%`;
        fill.style.background = colour;
        fill.style.boxShadow = warn > 0 && !held ? `0 0 10px ${colour}` : 'none';
      }
      const seconds = secondsRef.current;
      if (seconds) {
        seconds.textContent = held ? '- -' : left.toFixed(1);
        seconds.style.color = colour;
      }
      const label = labelRef.current;
      // The wording stays put and the colour escalates: a label that rewrites
      // itself next to a number that is already moving is one moving thing too
      // many at the moment the player most needs to read it.
      if (label) label.textContent = held ? 'Turn paused' : 'Turn in';
    };
    rafRef.current = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running]);

  if (!running) return null;

  return (
    <div
      className="worm-rotation-clock" ref={rootRef}
      aria-hidden="true"
      style={{
        display: 'none',
        alignItems: 'center',
        gap: 9,
        padding: '0 3px 1px',
        lineHeight: 1,
        borderRadius: 999,
        background: 'transparent',
        border: 0,
        boxShadow: 'none',
        pointerEvents: 'none',
        fontFamily: UI_FONT
      }}
    >
      <span
        ref={labelRef}
        style={{
          fontSize: 8.5,
          fontWeight: 800,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: NIGHT_TEXT_MUTED,
          whiteSpace: 'nowrap'
        }}
      >
        Turn in
      </span>

      <div style={{ width: BAR_W, flex: '1 1 auto', minWidth: 0, height: 4, borderRadius: 999, background: '#26372d1f', overflow: 'hidden' }}>
        <div ref={fillRef} style={{ width: '100%', height: '100%', borderRadius: 999, background: CALM }} />
      </div>

      <span
        ref={secondsRef}
        style={{
          fontSize: 11,
          fontWeight: 800,
          fontFamily: MONO_FONT,
          fontVariantNumeric: 'tabular-nums',
          color: CALM,
          minWidth: 34,
          textAlign: 'right'
        }}
      >
        0.0
      </span>
    </div>
  );
}
