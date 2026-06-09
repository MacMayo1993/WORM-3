// src/components/screens/MobiIntroScreen.jsx
/**
 * MobiIntroScreen — mascot-dialogue intro shown before any game mode.
 * Layout: Mobi portrait (left, peeks above panel) + wide compact HUD bar (right).
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

// Stub banks for future modes — fill these in whenever you're ready.
export const MOBI_LINES_FREEPLAY = [];
export const MOBI_LINES_TEACH    = [];
export const MOBI_LINES_HOLONOMY = [];
export const MOBI_LINES_MERGE    = [];
export const MOBI_LINES_HOLLOW   = [];
export const MOBI_LINES_MIRROR   = [];
export const MOBI_LINES_CHAOS    = [];
export const MOBI_LINES_CAMPAIGN = [];

// ── CSS keyframes (injected once) ────────────────────────────────────────────
const _STYLE_ID = 'mobi-hud-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(_STYLE_ID)) {
  const s = document.createElement('style');
  s.id = _STYLE_ID;
  s.textContent = `
    @keyframes mobiSlideIn {
      from { transform: translateX(-30px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }
    @keyframes mobiPanelIn {
      from { opacity: 0; transform: translateY(16px); }
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

// ── Horizontal HUD panel (Hades-style) ───────────────────────────────────────
function HudPanel({ modeName, text, lines, index, isLast, onAdvance, onSkip }) {
  const cyan = '#00e5ff';

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      boxSizing: 'border-box',
      background: 'linear-gradient(180deg, rgba(2,6,18,0.99) 0%, rgba(1,3,10,0.99) 100%)',
      backdropFilter: 'blur(16px)',
      borderTop: `2px solid ${cyan}`,
      boxShadow: `0 -6px 40px rgba(0,229,255,0.1), inset 0 1px 0 rgba(0,229,255,0.08)`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 'clamp(8px, 1.6vh, 14px) clamp(12px, 2.5vw, 24px) clamp(8px, 1.4vh, 12px)',
      gap: '4px',
      minHeight: 'clamp(130px, 19vh, 175px)',
      animation: 'mobiPanelIn 0.4s ease forwards',
    }}>
      {/* Left accent stripe */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0, width: '3px',
        background: `linear-gradient(to bottom, ${cyan}, ${cyan}55)`,
        boxShadow: `0 0 14px ${cyan}88`,
      }} />

      {/* Header — large title + badge, like Hades boon card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
        <span style={{
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          fontSize: 'clamp(20px, 4vw, 28px)',
          fontWeight: '800',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#f0f8ff',
          textShadow: `0 0 24px ${cyan}66, 0 2px 4px rgba(0,0,0,0.8)`,
          lineHeight: 1,
          flexShrink: 0,
        }}>
          MOBI
        </span>
        {/* Mode badge — Hades EPIC-style pill */}
        <span style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 'clamp(8px, 1.2vw, 11px)',
          fontWeight: '700',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: cyan,
          border: `1px solid ${cyan}`,
          padding: '3px 8px',
          borderRadius: '2px',
          lineHeight: 1,
          boxShadow: `0 0 10px ${cyan}33, inset 0 0 6px ${cyan}0d`,
          flexShrink: 0,
        }}>
          {modeName || 'WORM MODE'}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 'clamp(9px, 1.1vw, 11px)',
          color: `${cyan}40`,
          flexShrink: 0,
        }}>
          {String(index + 1).padStart(2, '0')} / {String(lines.length).padStart(2, '0')}
        </span>
      </div>

      {/* Thin divider */}
      <div style={{
        height: '1px',
        background: `linear-gradient(90deg, ${cyan}88, ${cyan}22, transparent)`,
        margin: '0 0 2px',
      }} />

      {/* Dialogue */}
      <div key={index} style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        animation: 'textFadeIn 0.22s ease forwards',
        paddingLeft: '2px',
      }}>
        <span style={{
          fontFamily: 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif',
          fontSize: 'clamp(14px, 2.4vw, 18px)',
          fontWeight: '400',
          color: '#e2f0ff',
          lineHeight: 1.45,
          letterSpacing: '0.005em',
        }}>
          {text}
          <span style={{
            display: 'inline-block',
            width: '2px',
            height: '1em',
            background: cyan,
            marginLeft: '3px',
            verticalAlign: 'middle',
            animation: 'cursorBlink 1s step-end infinite',
          }} />
        </span>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {lines.map((_, i) => (
            <div key={i} style={{
              width: i === index ? '18px' : '5px',
              height: '5px',
              borderRadius: '3px',
              background: i === index ? cyan : `${cyan}40`,
              boxShadow: i === index ? `0 0 7px ${cyan}` : 'none',
              transition: 'all 0.28s cubic-bezier(0.4,0,0.2,1)',
            }} />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSkip(); }}
            style={{
              background: 'none',
              border: `1px solid ${cyan}44`,
              color: `${cyan}77`,
              fontSize: 'clamp(9px, 1.2vw, 11px)',
              fontWeight: '600',
              padding: '5px 12px',
              borderRadius: '2px',
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = cyan; e.currentTarget.style.borderColor = `${cyan}88`; }}
            onMouseLeave={e => { e.currentTarget.style.color = `${cyan}77`; e.currentTarget.style.borderColor = `${cyan}44`; }}
          >
            SKIP
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdvance(); }}
            style={{
              background: isLast ? cyan : 'transparent',
              border: `1px solid ${cyan}`,
              color: isLast ? '#001520' : cyan,
              fontSize: 'clamp(10px, 1.4vw, 12px)',
              fontWeight: '700',
              padding: '5px 18px',
              borderRadius: '2px',
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              boxShadow: isLast ? `0 0 18px ${cyan}bb` : `0 0 6px ${cyan}33`,
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 24px ${cyan}dd`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = isLast ? `0 0 18px ${cyan}bb` : `0 0 6px ${cyan}33`; e.currentTarget.style.transform = 'none'; }}
          >
            {isLast ? '► LAUNCH' : 'NEXT ►'}
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

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        background: 'linear-gradient(to top, rgba(0,4,16,0.72) 0%, rgba(0,4,16,0.1) 55%, transparent 100%)',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
    >
      {/* Bottom bar — full width, Hades-style */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        overflow: 'visible',
        zIndex: 901,
      }}>
        {/* Mobi portrait — left column, peeks above the panel */}
        <div style={{
          flexShrink: 0,
          alignSelf: 'flex-end',
          overflow: 'visible',
          zIndex: 903,
          pointerEvents: 'none',
          animation: 'mobiSlideIn 0.45s ease forwards',
          lineHeight: 0,
        }}>
          <img
            src={mobiImgSrc}
            alt="Mobi"
            style={{
              display: 'block',
              height: 'clamp(320px, 52vh, 560px)',
              width: 'auto',
              background: 'transparent',
            }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        </div>

        {/* HUD text panel — fills remaining width */}
        <div style={{ flex: 1, minWidth: 0, pointerEvents: 'auto' }}>
          <HudPanel
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

      {/* Click hint — floats above the panel */}
      <p style={{
        position: 'absolute',
        bottom: 'clamp(145px, 21vh, 192px)',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '10px',
        color: 'rgba(0,229,255,0.2)',
        margin: 0,
        letterSpacing: '0.12em',
        fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}>
        Tap / Click anywhere · Space · → to continue
      </p>
    </div>
  );
};

export default MobiIntroScreen;
