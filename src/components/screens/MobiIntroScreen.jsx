// src/components/screens/MobiIntroScreen.jsx
/**
 * MobiIntroScreen — Civ 6-style dialogue: full-width panel at bottom,
 * character portrait on the left peaking above, nameplate tab on top-left edge.
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

// ── CSS ───────────────────────────────────────────────────────────────────────
const _STYLE_ID = 'mobi-hud-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(_STYLE_ID)) {
  const s = document.createElement('style');
  s.id = _STYLE_ID;
  s.textContent = `
    @keyframes mobiSlideIn {
      from { transform: translateX(-30px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }
    @keyframes mobiDissolveOut {
      from { opacity: 1; transform: translateX(0) scale(1); }
      to   { opacity: 0; transform: translateX(-22px) scale(0.95); }
    }
    @keyframes panelRise {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes panelFadeDown {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(10px); }
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

// ── Main component ────────────────────────────────────────────────────────────

const MobiIntroScreen = ({ lines, modeName, _accentColor, onComplete }) => {
  const [index, setIndex]           = useState(0);
  const [isDismissing, setDismissing] = useState(false);
  const isLast = index === lines.length - 1;

  const mobiImgSrc = `${import.meta.env.BASE_URL}Mobi.png`;

  // Trigger dissolve then hand off to parent after animation finishes
  const dismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(() => onComplete(), 750);
  }, [onComplete]);

  const advance = useCallback(() => {
    if (isDismissing) return;
    if (isLast) dismiss();
    else setIndex(i => i + 1);
  }, [isDismissing, isLast, dismiss]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      } else if (e.key === 'Escape') {
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, dismiss]);

  if (!lines || lines.length === 0) {
    onComplete();
    return null;
  }

  const accent      = 'rgba(0, 210, 248, 0.85)';
  const accentSolid = '#00d2f8';
  const PANEL_H     = 'clamp(132px, 18vh, 172px)';
  const NAMEPLATE_H = 32;

  const mobiAnim = isDismissing
    ? 'mobiDissolveOut 0.55s ease forwards'
    : 'mobiSlideIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards';

  const uiAnim = isDismissing
    ? 'panelFadeDown 0.35s ease forwards'
    : 'panelRise 0.4s cubic-bezier(0.16,1,0.3,1) forwards';

  return (
    <div
      onClick={advance}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 50%)',
        pointerEvents: isDismissing ? 'none' : 'auto',
        cursor: isDismissing ? 'default' : 'pointer',
      }}
    >
      {/* Background blur layer — always transitioning so backdrop-filter animates correctly */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        backdropFilter:       isDismissing ? 'blur(0px)' : 'blur(5px)',
        WebkitBackdropFilter: isDismissing ? 'blur(0px)' : 'blur(5px)',
        transition: 'backdrop-filter 0.7s ease, -webkit-backdrop-filter 0.7s ease',
      }} />
      {/* ── Mobi portrait — bottom-left, behind panel (z:901 < panel z:903) ── */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        zIndex: 901,
        pointerEvents: 'none',
        lineHeight: 0,
        animation: mobiAnim,
      }}>
        <img
          src={mobiImgSrc}
          alt="Mobi"
          style={{ display: 'block', height: 'clamp(384px, 62vh, 672px)', width: 'auto' }}
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* ── Nameplate tab — sits directly on top-left edge of the panel ── */}
      <div style={{
        position: 'absolute',
        bottom: PANEL_H,
        left: 0,
        zIndex: 905,
        pointerEvents: 'none',
        animation: uiAnim,
      }}>
        {/* Outer layer = border color */}
        <div style={{
          background: accent,
          clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
          padding: '2px',
          display: 'inline-block',
        }}>
          {/* Inner layer = fill */}
          <div style={{
            background: 'rgba(2, 7, 20, 0.97)',
            height: NAMEPLATE_H,
            padding: '0 22px 0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{
              fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#fff',
            }}>
              MOBI
            </span>
            <span style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: accentSolid,
              opacity: 0.85,
            }}>
              {modeName || 'WORM MODE'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Dialogue panel — full screen width, anchored at bottom ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: PANEL_H,
          background: 'rgba(3, 7, 20, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: `2px solid ${accent}`,
          boxShadow: `0 -2px 40px rgba(0,200,240,0.08)`,
          zIndex: 903,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop:    'clamp(12px, 2vh, 18px)',
          paddingLeft:   'clamp(16px, 3vw, 32px)',
          paddingRight:  'clamp(16px, 3vw, 32px)',
          paddingBottom: 'max(clamp(20px, 3.5vh, 30px), env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
          animation: uiAnim,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Dialogue text */}
        <div
          key={index}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            animation: 'textFadeIn 0.2s ease forwards',
          }}
        >
          <p style={{
            margin: 0,
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: 'clamp(14px, 2.8vw, 18px)',
            fontWeight: '450',
            color: '#e6f2ff',
            lineHeight: 1.5,
            letterSpacing: '0.005em',
          }}>
            {lines[index]}
            <span style={{
              display: 'inline-block',
              width: '2px',
              height: '1em',
              background: accentSolid,
              marginLeft: '3px',
              verticalAlign: 'middle',
              opacity: 0.7,
              animation: 'cursorBlink 1s step-end infinite',
            }} />
          </p>
        </div>

        {/* Footer: dots + buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {lines.map((_, i) => (
              <div key={i} style={{
                width: i === index ? '16px' : '5px',
                height: '5px',
                borderRadius: '3px',
                background: i === index ? accentSolid : 'rgba(0,210,248,0.3)',
                transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.45)',
                fontSize: '11px',
                fontWeight: '500',
                padding: '5px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: '0.06em',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
            >
              Skip
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); advance(); }}
              style={{
                background: isLast ? accentSolid : 'rgba(0,210,248,0.12)',
                border: `1px solid ${accentSolid}`,
                color: isLast ? '#000e1a' : accentSolid,
                fontSize: '12px',
                fontWeight: '700',
                padding: '5px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                boxShadow: isLast ? `0 0 18px ${accentSolid}99` : `0 0 8px ${accentSolid}33`,
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 22px ${accentSolid}cc`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = isLast ? `0 0 18px ${accentSolid}99` : `0 0 8px ${accentSolid}33`; e.currentTarget.style.transform = 'none'; }}
            >
              {isLast ? '▶ Launch' : 'Next ▶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobiIntroScreen;
