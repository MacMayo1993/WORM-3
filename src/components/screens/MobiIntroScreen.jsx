// src/components/screens/MobiIntroScreen.jsx
/**
 * MobiIntroScreen — reusable mascot-dialogue intro shown before any game mode.
 *
 * Layout: Mobi image (left, full-height) + sci-fi HUD panel (right) with
 * dialogue text. Drop public/Mobi.png into the repo to activate the image.
 *
 * To add this intro to a new mode:
 *   1. Define a MOBI_LINES_<MODE> array below.
 *   2. Add showMobiIntro state + pendingSettings ref in App.jsx.
 *   3. Show the intro after the setup wizard completes.
 *   4. Render <MobiIntroScreen> in UILayer with the right lines/modeName/accentColor.
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
    @keyframes hudScan {
      0%   { background-position: 0 0; }
      100% { background-position: 0 120px; }
    }
    @keyframes hudPulse {
      0%,100% { opacity: 1; }
      50%      { opacity: 0.6; }
    }
    @keyframes hudCornerBlink {
      0%,100% { opacity: 1; }
      50%      { opacity: 0.3; }
    }
    @keyframes mobiSlideIn {
      from { transform: translateX(-40px); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }
    @keyframes hudFadeIn {
      from { opacity: 0; transform: translateY(12px); }
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

// ── HUD panel corner decoration ───────────────────────────────────────────────
function HudCorner({ position }) {
  const size = 18;
  const thickness = 2;
  const color = '#00e5ff';

  const styles = {
    position: 'absolute',
    width: size, height: size,
    ...(position.includes('top')    ? { top: -1 }    : { bottom: -1 }),
    ...(position.includes('left')   ? { left: -1 }   : { right: -1 }),
  };

  const hBar = {
    position: 'absolute',
    height: thickness, width: size,
    background: color,
    boxShadow: `0 0 6px ${color}`,
    top: position.includes('top') ? 0 : 'auto',
    bottom: position.includes('bottom') ? 0 : 'auto',
    left: 0,
  };

  const vBar = {
    position: 'absolute',
    width: thickness, height: size,
    background: color,
    boxShadow: `0 0 6px ${color}`,
    top: 0,
    left: position.includes('left') ? 0 : 'auto',
    right: position.includes('right') ? 0 : 'auto',
  };

  return (
    <div style={styles}>
      <div style={hBar} />
      <div style={vBar} />
    </div>
  );
}

// ── Sci-fi HUD panel ──────────────────────────────────────────────────────────
function HudPanel({ modeName, text, lines, index, isLast, onAdvance, onSkip }) {
  const cyan = '#00e5ff';

  return (
    <div style={{
      position: 'relative',
      flex: 1,
      maxWidth: '580px',
      animation: 'hudFadeIn 0.4s ease forwards',
    }}>
      {/* Outer border */}
      <div style={{
        position: 'relative',
        border: `1px solid ${cyan}55`,
        borderRadius: '4px',
        background: 'rgba(2, 12, 30, 0.88)',
        backdropFilter: 'blur(12px)',
        boxShadow: `0 0 30px ${cyan}22, inset 0 0 40px rgba(0,20,40,0.6)`,
        overflow: 'hidden',
      }}>

        {/* Scanline overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,229,255,0.025) 3px, rgba(0,229,255,0.025) 4px)',
          animation: 'hudScan 4s linear infinite',
        }} />

        {/* Corner decorations */}
        <HudCorner position="top-left" />
        <HudCorner position="top-right" />
        <HudCorner position="bottom-left" />
        <HudCorner position="bottom-right" />

        {/* Header bar */}
        <div style={{
          position: 'relative', zIndex: 1,
          borderBottom: `1px solid ${cyan}44`,
          padding: '10px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(90deg, ${cyan}18 0%, transparent 100%)`,
        }}>
          <div style={{
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px', fontWeight: '700',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: cyan,
            textShadow: `0 0 10px ${cyan}`,
          }}>
            MOBI // GUIDE
          </div>
          <div style={{
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '10px', color: `${cyan}88`,
            letterSpacing: '0.12em',
          }}>
            {String(index + 1).padStart(2, '0')} / {String(lines.length).padStart(2, '0')}
          </div>
        </div>

        {/* Mode badge strip */}
        <div style={{
          position: 'relative', zIndex: 1,
          padding: '6px 18px',
          borderBottom: `1px solid ${cyan}22`,
          background: `${cyan}0a`,
        }}>
          <span style={{
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '9px', letterSpacing: '0.22em',
            color: `${cyan}77`, textTransform: 'uppercase',
          }}>
            ► {modeName || 'WORM MODE'}
          </span>
        </div>

        {/* Dialogue text area */}
        <div style={{
          position: 'relative', zIndex: 1,
          padding: '28px 24px 20px',
          minHeight: '130px',
          display: 'flex', alignItems: 'center',
        }}>
          {/* Left accent bar */}
          <div style={{
            position: 'absolute', left: 0, top: '20px', bottom: '20px',
            width: '3px',
            background: `linear-gradient(to bottom, transparent, ${cyan}, transparent)`,
            boxShadow: `0 0 8px ${cyan}`,
          }} />

          <p key={index} style={{
            margin: 0,
            paddingLeft: '16px',
            fontSize: 'clamp(15px, 2vw, 19px)',
            fontWeight: '400',
            color: '#cff4ff',
            lineHeight: 1.65,
            fontFamily: '"Courier New", Courier, monospace',
            letterSpacing: '0.03em',
            animation: 'textFadeIn 0.25s ease forwards',
            textShadow: '0 0 20px rgba(0,229,255,0.2)',
          }}>
            {text}
            {/* Blinking cursor */}
            <span style={{
              display: 'inline-block',
              width: '2px', height: '1.1em',
              background: cyan,
              marginLeft: '4px',
              verticalAlign: 'text-bottom',
              animation: 'cursorBlink 1s step-end infinite',
            }} />
          </p>
        </div>

        {/* Footer — dots + button */}
        <div style={{
          position: 'relative', zIndex: 1,
          borderTop: `1px solid ${cyan}22`,
          padding: '12px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `rgba(0,10,24,0.4)`,
        }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {lines.map((_, i) => (
              <div key={i} style={{
                width: i === index ? '18px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === index ? cyan : `${cyan}44`,
                boxShadow: i === index ? `0 0 8px ${cyan}` : 'none',
                transition: 'all 0.28s cubic-bezier(0.4,0,0.2,1)',
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Skip */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSkip(); }}
              style={{
                background: 'none',
                border: `1px solid ${cyan}33`,
                color: `${cyan}66`,
                fontSize: '11px', fontWeight: '600',
                padding: '6px 14px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: '"Courier New", Courier, monospace',
                letterSpacing: '0.1em',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = cyan; e.currentTarget.style.borderColor = `${cyan}88`; }}
              onMouseLeave={e => { e.currentTarget.style.color = `${cyan}66`; e.currentTarget.style.borderColor = `${cyan}33`; }}
            >
              SKIP
            </button>

            {/* Next / Launch */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdvance(); }}
              style={{
                background: isLast ? cyan : 'transparent',
                border: `1px solid ${cyan}`,
                color: isLast ? '#001a24' : cyan,
                fontSize: '12px', fontWeight: '700',
                padding: '8px 22px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: '"Courier New", Courier, monospace',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                boxShadow: isLast ? `0 0 20px ${cyan}88` : `0 0 8px ${cyan}33`,
                transition: 'all 0.18s ease',
                textShadow: isLast ? 'none' : `0 0 8px ${cyan}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 24px ${cyan}cc`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = isLast ? `0 0 20px ${cyan}88` : `0 0 8px ${cyan}33`; e.currentTarget.style.transform = 'none'; }}
            >
              {isLast ? "► LAUNCH" : "NEXT ►"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MobiIntroScreen = ({ lines, modeName, _accentColor, onComplete }) => {
  const [index, setIndex] = useState(0);
  const isLast = index === lines.length - 1;

  // Mobi.png lives at public/Mobi.png — drop the file there to activate it.
  // BASE_URL handles the /WORM-3/ prefix in production.
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

  const screenW = typeof window !== 'undefined' ? window.innerWidth : 800;
  // On very narrow screens Mobi is smaller but always visible on the left.
  const mobiWidth = screenW < 400 ? '80px' : screenW < 600 ? '110px' : 'clamp(160px, 22vw, 380px)';
  const mobiMargin = screenW < 600 ? '-10px' : '-16px';
  const rowPadding = screenW < 600 ? '0 8px 20px' : '0 32px 36px';

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
        background: 'linear-gradient(to top, rgba(0,6,20,0.85) 0%, rgba(0,6,20,0.3) 45%, transparent 100%)',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
    >
      {/* Main layout row — pinned to bottom */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '0px',
          width: '100%',
          maxWidth: '1100px',
          padding: rowPadding,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobi image — always left, scales down on mobile */}
        <div style={{
          flexShrink: 0,
          width: mobiWidth,
          alignSelf: 'flex-end',
          animation: 'mobiSlideIn 0.5s ease forwards',
          pointerEvents: 'none',
          marginRight: mobiMargin,
          zIndex: 2,
          position: 'relative',
        }}>
          <img
            src={mobiImgSrc}
            alt="Mobi"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              filter: 'drop-shadow(0 0 24px rgba(0,229,255,0.35)) drop-shadow(0 8px 16px rgba(0,0,0,0.7))',
            }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        </div>

        {/* HUD panel */}
        <div style={{ flex: 1, minWidth: 0, pointerEvents: 'auto', zIndex: 1 }}>
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

      {/* Click hint */}
      <p style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '10px',
        color: 'rgba(0,229,255,0.25)',
        margin: 0,
        letterSpacing: '0.12em',
        fontFamily: '"Courier New", Courier, monospace',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}>
        {'Tap / Click anywhere · Space · → to continue'}
      </p>
    </div>
  );
};

export default MobiIntroScreen;
