// src/components/screens/MobiIntroScreen.jsx
/**
 * MobiIntroScreen — mascot-dialogue intro shown before any game mode.
 * Layout: Mobi portrait (bottom-left) + frosted-glass card floating over his head.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ── Dialogue banks ────────────────────────────────────────────────────────────

export const MOBI_LINES_WORM = [
  "Hi...I'm Mobi!",
  "This ain't your mama's old Nokia SNAKE game....this is WORM^3",
  "In my world...Rubik's cubes are flat",
  "But then one day....",
  "We uncovered the TRUE secret of the cube.",
  "Each tile has a twin!  And they can switch places!",
  "But not for too long....",
];

export const MOBI_LINES_FREEPLAY = [];
export const MOBI_LINES_TEACH    = [];
export const MOBI_LINES_HOLONOMY = [];
export const MOBI_LINES_MERGE    = [];
export const MOBI_LINES_HOLLOW   = [];
export const MOBI_LINES_MIRROR   = [];
export const MOBI_LINES_CHAOS    = [];
export const MOBI_LINES_CAMPAIGN = [];

// ── CSS keyframes ─────────────────────────────────────────────────────────────
const _STYLE_ID = 'mobi-hud-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(_STYLE_ID)) {
  const s = document.createElement('style');
  s.id = _STYLE_ID;
  s.textContent = `
    @keyframes mobiSlideIn {
      from { transform: translateX(-24px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }
    @keyframes cardSlideUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes textFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes cursorBlink {
      0%,100% { opacity: 1; }
      50%      { opacity: 0; }
    }
  `;
  document.head.appendChild(s);
}

// ── Floating dialogue card ────────────────────────────────────────────────────
function DialogueCard({ modeName, text, lines, index, isLast, onAdvance, onSkip }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.86)',
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
      borderRadius: '18px',
      border: '1px solid rgba(255, 255, 255, 0.7)',
      boxShadow: '0 12px 48px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
      animation: 'cardSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    }}>
      {/* Label */}
      <div style={{
        padding: '13px 18px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          fontSize: '10px',
          fontWeight: '600',
          letterSpacing: '0.11em',
          textTransform: 'uppercase',
          color: '#8e99aa',
        }}>
          MOBI · {modeName || 'Worm Mode'}
        </span>
        <span style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '10px',
          color: '#b0bac8',
          letterSpacing: '0.04em',
        }}>
          {index + 1} / {lines.length}
        </span>
      </div>

      {/* Thin rule */}
      <div style={{ height: '1px', background: 'rgba(0, 0, 0, 0.07)', margin: '0 18px' }} />

      {/* Dialogue text */}
      <div key={index} style={{
        padding: '12px 18px 14px',
        animation: 'textFadeIn 0.2s ease forwards',
      }}>
        <p style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif',
          fontSize: 'clamp(14px, 3.8vw, 17px)',
          fontWeight: '500',
          color: '#0d1117',
          lineHeight: 1.5,
          letterSpacing: '-0.01em',
        }}>
          {text}
          <span style={{
            display: 'inline-block',
            width: '2px',
            height: '1em',
            background: '#0d1117',
            marginLeft: '3px',
            verticalAlign: 'middle',
            opacity: 0.6,
            animation: 'cursorBlink 1s step-end infinite',
          }} />
        </p>
      </div>

      {/* Footer */}
      <div style={{
        padding: '0 18px 13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {lines.map((_, i) => (
            <div key={i} style={{
              width: i === index ? '16px' : '5px',
              height: '5px',
              borderRadius: '3px',
              background: i === index ? '#0d1117' : '#cbd5e1',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSkip(); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#8e99aa',
              fontSize: '12px',
              fontWeight: '500',
              padding: '6px 10px',
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.04em',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#4a5568'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#8e99aa'; }}
          >
            Skip
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdvance(); }}
            style={{
              background: '#0d1117',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9px',
              padding: '7px 18px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.03em',
              boxShadow: isLast ? '0 4px 14px rgba(13,17,23,0.35)' : '0 2px 6px rgba(13,17,23,0.2)',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(13,17,23,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isLast ? '0 4px 14px rgba(13,17,23,0.35)' : '0 2px 6px rgba(13,17,23,0.2)'; }}
          >
            {isLast ? '▶ Launch' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MobiIntroScreen = ({ lines, modeName, _accentColor, onComplete }) => {
  const [index, setIndex] = useState(0);
  const isLast = index === lines.length - 1;

  const mobiImgSrc = `${import.meta.env.BASE_URL}Mobi.png`;

  const advance = useCallback(() => {
    if (isLast) onComplete();
    else setIndex(i => i + 1);
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

  // Mobi image height — used to anchor the card just above his head
  const MOBI_H = 'clamp(320px, 52vh, 560px)';

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 55%)',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
    >
      {/* Mobi portrait — bottom-left */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        zIndex: 901,
        pointerEvents: 'none',
        animation: 'mobiSlideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        lineHeight: 0,
      }}>
        <img
          src={mobiImgSrc}
          alt="Mobi"
          style={{
            display: 'block',
            height: MOBI_H,
            width: 'auto',
          }}
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* Dialogue card — floats directly over Mobi's head */}
      <div
        style={{
          position: 'absolute',
          // bottom aligns with the top of the Mobi image (his head area)
          bottom: 'calc(clamp(320px, 52vh, 560px) - 20px)',
          left: '12px',
          width: 'min(78vw, 340px)',
          zIndex: 902,
          pointerEvents: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <DialogueCard
          modeName={modeName}
          text={lines[index]}
          lines={lines}
          index={index}
          isLast={isLast}
          onAdvance={advance}
          onSkip={onComplete}
        />
      </div>
    </div>
  );
};

export default MobiIntroScreen;
