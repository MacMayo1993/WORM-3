// src/components/screens/MobiIntroScreen.jsx
/**
 * MobiIntroScreen — reusable mascot-dialogue intro shown before any game mode.
 *
 * Usage:
 *   <MobiIntroScreen
 *     lines={['Hi...I'm Mobi!', 'This is WORM^3']}
 *     modeName="WORM MODE"
 *     accentColor="#33ff66"
 *     onComplete={handleDone}
 *   />
 *
 * To add this intro to a new mode:
 *   1. Define a MOBI_LINES_<MODE> array in this file (or pass inline).
 *   2. Add a `showMobiIntro` state + config in App.jsx.
 *   3. Set the config + show flag when entering that mode.
 *   4. Render <MobiIntroScreen> with the appropriate props.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ── Dialogue banks ────────────────────────────────────────────────────────────
// Export these so App.jsx (or any caller) can just import the right array.

export const MOBI_LINES_WORM = [
  "Hi...I'm Mobi!",
  "This ain't your mama's old Nokia SNAKE game....this is WORM^3",
  "In my world...Rubik's cubes are flat",
  "but then we covered a secret....",
];

// Stub banks for future modes — fill these in whenever you're ready.
export const MOBI_LINES_FREEPLAY    = [];
export const MOBI_LINES_TEACH       = [];
export const MOBI_LINES_HOLONOMY    = [];
export const MOBI_LINES_MERGE       = [];
export const MOBI_LINES_HOLLOW      = [];
export const MOBI_LINES_MIRROR      = [];
export const MOBI_LINES_CHAOS       = [];
export const MOBI_LINES_CAMPAIGN    = [];

// ── Mobi CSS character ────────────────────────────────────────────────────────

function MobiCharacter({ accentColor }) {
  const glow   = accentColor || '#33ff66';
  const body   = '#1a8c3a';
  const belly  = '#2dd460';
  const ant    = '#0e5c26';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '5px',
      filter: `drop-shadow(0 0 18px ${glow}55)`,
      userSelect: 'none',
    }}>
      {/* Antennae */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '2px' }}>
        {[-1, 1].map((tilt, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column-reverse', alignItems: 'center',
            transform: `rotate(${tilt * 18}deg)`,
            transformOrigin: 'bottom center',
          }}>
            <div style={{ width: '3px', height: '18px', borderRadius: '2px', background: ant }} />
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: glow,
              boxShadow: `0 0 8px ${glow}, 0 0 16px ${glow}88`,
              marginBottom: '2px',
            }} />
          </div>
        ))}
      </div>

      {/* Head */}
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: body,
        boxShadow: `0 0 22px ${glow}88`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '6px', position: 'relative', flexShrink: 0,
      }}>
        {/* Eyes */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {[0, 1].map(e => (
            <div key={e} style={{
              width: '13px', height: '13px', borderRadius: '50%',
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#111' }} />
            </div>
          ))}
        </div>
        {/* Mouth dots */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '4px', height: '4px', borderRadius: '50%',
              background: '#111', opacity: 0.7,
              marginBottom: i === 1 ? '-3px' : '0',
            }} />
          ))}
        </div>
      </div>

      {/* Body segments */}
      {[
        { w: 60, h: 60 },
        { w: 50, h: 50 },
        { w: 40, h: 40 },
        { w: 30, h: 30 },
      ].map(({ w, h }, i) => (
        <div key={i} style={{
          width: w, height: h, borderRadius: '50%',
          background: belly,
          boxShadow: `0 0 8px ${glow}44`,
          opacity: 1 - i * 0.08,
          flexShrink: 0,
        }} />
      ))}
    </div>
  );
}

// ── Speech bubble ─────────────────────────────────────────────────────────────

function SpeechBubble({ text, accentColor }) {
  const accent = accentColor || '#33ff66';
  return (
    <div style={{ position: 'relative', maxWidth: '360px', width: '100%' }}>
      {/* Tail pointing left toward Mobi */}
      <div style={{
        position: 'absolute',
        left: '-18px',
        top: '32px',
        width: 0, height: 0,
        borderTop: '12px solid transparent',
        borderBottom: '12px solid transparent',
        borderRight: `20px solid rgba(255,255,255,0.95)`,
        filter: 'drop-shadow(-2px 0 4px rgba(0,0,0,0.18))',
      }} />

      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '20px',
        padding: '24px 28px',
        boxShadow: `0 8px 40px rgba(0,0,0,0.28), 0 0 0 2px ${accent}44`,
        minHeight: '80px',
        display: 'flex', alignItems: 'center',
      }}>
        <p style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: '600',
          color: '#1a1a2e',
          lineHeight: 1.5,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
        }}>
          {text}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MobiIntroScreen = ({ lines, modeName, accentColor, onComplete }) => {
  const [index, setIndex] = useState(0);
  const accent = accentColor || '#33ff66';
  const isLast = index === lines.length - 1;

  const advance = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setIndex(i => i + 1);
    }
  }, [isLast, onComplete]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      } else if (e.key === 'Escape') {
        onComplete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onComplete]);

  if (!lines || lines.length === 0) {
    onComplete();
    return null;
  }

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: '48px',
        cursor: 'pointer',
        // Subtle dark gradient at bottom so dialogue is always readable
        background: 'linear-gradient(to top, rgba(8,10,22,0.72) 0%, transparent 55%)',
        pointerEvents: 'auto',
      }}
    >
      {/* Mode badge — top center */}
      <div style={{
        position: 'absolute',
        top: '28px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: `${accent}22`,
        border: `1.5px solid ${accent}66`,
        borderRadius: '20px',
        padding: '5px 16px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: accent,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
        pointerEvents: 'none',
      }}>
        {modeName || 'WORM MODE'}
      </div>

      {/* Skip — top right */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onComplete(); }}
        style={{
          position: 'absolute',
          top: '24px',
          right: '28px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.55)',
          fontSize: '13px',
          fontWeight: '500',
          padding: '7px 16px',
          borderRadius: '20px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s ease',
          pointerEvents: 'auto',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      >
        Skip ▶
      </button>

      {/* Bottom dialogue row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '32px',
          padding: '0 40px',
          width: '100%',
          maxWidth: '800px',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobi */}
        <div style={{ flexShrink: 0 }}>
          <MobiCharacter accentColor={accent} />
        </div>

        {/* Bubble + controls */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flex: 1,
          pointerEvents: 'auto',
        }}>
          <SpeechBubble text={lines[index]} accentColor={accent} />

          {/* Progress dots + Next button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: '4px',
          }}>
            {/* Dot indicators */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {lines.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === index ? '20px' : '7px',
                    height: '7px',
                    borderRadius: '4px',
                    background: i === index ? accent : 'rgba(255,255,255,0.30)',
                    transition: 'all 0.28s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: i === index ? `0 0 8px ${accent}88` : 'none',
                  }}
                />
              ))}
            </div>

            {/* Next / Let's Go */}
            <button
              type="button"
              onClick={advance}
              style={{
                background: isLast
                  ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
                  : 'rgba(255,255,255,0.12)',
                border: isLast ? 'none' : '1px solid rgba(255,255,255,0.22)',
                color: isLast ? '#0a1a0a' : '#fff',
                fontSize: '14px',
                fontWeight: '700',
                padding: '11px 24px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
                transition: 'all 0.18s ease',
                letterSpacing: '0.02em',
                boxShadow: isLast ? `0 4px 20px ${accent}55` : 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.opacity = '1'; }}
            >
              {isLast ? "Let's Go!" : 'Next  ›'}
            </button>
          </div>
        </div>
      </div>

      {/* Click-anywhere hint */}
      <p style={{
        position: 'absolute',
        bottom: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.28)',
        margin: 0,
        letterSpacing: '0.04em',
        fontFamily: 'inherit',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        Click anywhere or press Space / → to continue
      </p>
    </div>
  );
};

export default MobiIntroScreen;
