import React, { useMemo } from 'react';
import {
  BLUE_REVEAL_START, HINT_TILT_START,
  GREEN_SHOW_START, FULL_FLIP_START, FULL_FLIP_END,
  EXPLOSION_START, EXPLOSION_END,
  IMPLODE_START, IMPLODE_END,
} from './introTiming.js';

const ease = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = t => Math.max(0, Math.min(1, t));
const fadein  = (t, start, dur = 0.35) => ease(clamp01((t - start) / dur));
const fadeout = (t, end,   dur = 0.35) => ease(clamp01((end - t)   / dur));
const fadeWindow = (t, start, end, rampDur = 0.35) =>
  Math.min(fadein(t, start, rampDur), fadeout(t, end, rampDur));

const TextOverlay = ({ time }) => {
  const messages = useMemo(() => {
    const msgs = [];

    // "A Rubik's Cube..." — appears as the black cube first emerges
    if (time >= 0.6 && time < HINT_TILT_START) {
      msgs.push({
        text: 'A Rubik\'s Cube with a secret...',
        opacity: Math.min(fadein(time, 0.6), fadeout(time, HINT_TILT_START - 0.2)),
        size: 'lg',
      });
    }

    // "Six faces. Three antipodal pairs." — as blue reveals
    if (time >= BLUE_REVEAL_START + 0.3 && time < GREEN_SHOW_START) {
      msgs.push({
        text: 'Six faces. Three antipodal pairs.',
        opacity: Math.min(fadein(time, BLUE_REVEAL_START + 0.3), fadeout(time, GREEN_SHOW_START - 0.3)),
        size: 'md',
        color: '#93c5fd', // blue-300
      });
    }

    // Hint tilt caption
    if (time >= HINT_TILT_START + 0.2 && time < GREEN_SHOW_START) {
      msgs.push({
        text: 'Every tile has an opposite...',
        opacity: fadeWindow(time, HINT_TILT_START + 0.2, GREEN_SHOW_START),
        size: 'sm',
        italic: true,
      });
    }

    // Green face appears
    if (time >= GREEN_SHOW_START + 0.4 && time < FULL_FLIP_START) {
      msgs.push({
        text: 'Blue ↔ Green',
        opacity: fadeWindow(time, GREEN_SHOW_START + 0.4, FULL_FLIP_START),
        size: 'xl',
        color: '#4ade80', // green-400
        mono: true,
      });
    }

    // Full flip — tile turning
    if (time >= FULL_FLIP_START + 0.1 && time < FULL_FLIP_END + 0.4) {
      msgs.push({
        text: 'Through the manifold...',
        opacity: fadeWindow(time, FULL_FLIP_START + 0.1, FULL_FLIP_END + 0.4),
        size: 'md',
        italic: true,
        color: '#c4b5fd', // violet-300
      });
    }

    // Explosion phase
    if (time >= EXPLOSION_START + 0.3 && time < EXPLOSION_END - 0.5) {
      msgs.push({
        text: 'Antipodal topology',
        opacity: fadeWindow(time, EXPLOSION_START + 0.3, EXPLOSION_END - 0.5),
        size: 'xl',
        mono: true,
        color: '#fbbf24',
      });
    }

    // Highlight axis groups
    if (time >= EXPLOSION_END && time < EXPLOSION_END + 1.0) {
      msgs.push({ text: 'Red ↔ Orange', opacity: fadeWindow(time, EXPLOSION_END, EXPLOSION_END + 1.0), size: 'lg', color: '#f97316', mono: true });
    }
    if (time >= EXPLOSION_END + 1.0 && time < EXPLOSION_END + 2.0) {
      msgs.push({ text: 'Blue ↔ Green', opacity: fadeWindow(time, EXPLOSION_END + 1.0, EXPLOSION_END + 2.0), size: 'lg', color: '#4ade80', mono: true });
    }
    if (time >= EXPLOSION_END + 2.0 && time < EXPLOSION_END + 3.0) {
      msgs.push({ text: 'White ↔ Yellow', opacity: fadeWindow(time, EXPLOSION_END + 2.0, EXPLOSION_END + 3.0), size: 'lg', color: '#fde68a', mono: true });
    }

    // Implode / reassemble
    if (time >= IMPLODE_START && time < IMPLODE_END - 0.5) {
      msgs.push({
        text: 'The cube remembers...',
        opacity: fadeWindow(time, IMPLODE_START, IMPLODE_END - 0.5),
        size: 'md',
        italic: true,
      });
    }

    return msgs;
  }, [time]);

  const showFinal  = time >= IMPLODE_END;
  const finalFade  = showFinal ? ease(clamp01((time - IMPLODE_END) / 0.6)) : 0;

  const sizeMap = {
    sm: '13px', md: '16px', lg: '20px', xl: '26px',
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: '80px',
      fontFamily: '"Georgia", "Times New Roman", serif',
    }}>
      {/* Stacked message area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        minHeight: '80px',
        justifyContent: 'flex-end',
      }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              opacity: msg.opacity,
              color: msg.color || 'rgba(255, 255, 255, 0.92)',
              fontSize: sizeMap[msg.size] || '16px',
              fontStyle: msg.italic ? 'italic' : 'normal',
              fontFamily: msg.mono
                ? '"Courier New", "Courier", monospace'
                : '"Georgia", "Times New Roman", serif',
              fontWeight: msg.mono ? 600 : 400,
              letterSpacing: msg.mono ? '0.12em' : '0.02em',
              textShadow: `0 0 20px ${msg.color || 'rgba(255,255,255,0.4)'}, 0 2px 6px rgba(0,0,0,0.8)`,
              transition: 'opacity 0.1s linear',
              textAlign: 'center',
              maxWidth: '480px',
              padding: '0 24px',
            }}
          >
            {msg.text}
          </div>
        ))}
      </div>

      {/* Final card */}
      {showFinal && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: finalFade,
          textAlign: 'center',
        }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '4px',
            padding: '40px 56px',
            boxShadow: '0 0 60px rgba(99,102,241,0.25)',
          }}>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: 'clamp(42px, 8vw, 72px)',
              fontFamily: '"Georgia", serif',
              fontWeight: 700,
              fontStyle: 'italic',
              letterSpacing: '0.04em',
              color: '#ffffff',
              textShadow: '0 0 40px rgba(99,102,241,0.7)',
            }}>
              WORM³
            </h1>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '13px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              fontFamily: '"Courier New", monospace',
            }}>
              An Interactive Topology Puzzle
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: '"Georgia", serif',
              fontStyle: 'italic',
            }}>
              <p style={{ margin: 0 }}>Tap any sticker to flip it through the manifold</p>
              <p style={{ margin: 0 }}>Drag to rotate and explore</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextOverlay;
