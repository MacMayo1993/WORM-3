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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import LottiePlayer from 'react-lottie-player';
import mobiLottie from '../../assets/mobi.json';

// ── Dialogue banks ────────────────────────────────────────────────────────────
// Export these so App.jsx (or any caller) can just import the right array.

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
export const MOBI_LINES_FREEPLAY    = [];
export const MOBI_LINES_TEACH       = [];
export const MOBI_LINES_HOLONOMY    = [];
export const MOBI_LINES_MERGE       = [];
export const MOBI_LINES_HOLLOW      = [];
export const MOBI_LINES_MIRROR      = [];
export const MOBI_LINES_CHAOS       = [];
export const MOBI_LINES_CAMPAIGN    = [];

// ── CSS keyframes injected once ───────────────────────────────────────────────
const _STYLE_ID = 'mobi-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(_STYLE_ID)) {
  const s = document.createElement('style');
  s.id = _STYLE_ID;
  s.textContent = `
    @keyframes mobiFloat {
      0%,100% { transform: translateY(0px); }
      50%      { transform: translateY(-10px); }
    }
    @keyframes mobiAnt1 {
      0%,100% { transform: rotate(18deg); }
      50%      { transform: rotate(28deg); }
    }
    @keyframes mobiAnt2 {
      0%,100% { transform: rotate(-18deg); }
      50%      { transform: rotate(-28deg); }
    }
    @keyframes mobiBlink {
      0%,90%,100% { transform: scaleY(1); }
      95%          { transform: scaleY(0.05); }
    }
    @keyframes mobiHalo {
      0%,100% { opacity: 0.18; transform: scale(1); }
      50%      { opacity: 0.28; transform: scale(1.08); }
    }
    @keyframes mobiSegBob {
      0%,100% { transform: translateY(0px) scale(1); }
      50%      { transform: translateY(-5px) scale(1.03); }
    }
  `;
  document.head.appendChild(s);
}

// ── True if mobi.json is still the placeholder shipped with the repo ─────────
const LOTTIE_READY = !mobiLottie.__placeholder;

// ── CSS fallback — only shown until a real Lottie asset is dropped in ─────────

const SEG_COLORS = ['#3be08a', '#2fd47e', '#24be72', '#1aa862', '#129650'];
const SEG_SIZES  = [88, 76, 66, 56, 46];

function MobiCSSFallback() {
  const segBobDelays = ['0s', '0.08s', '0.16s', '0.24s', '0.32s'];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
      animation: 'mobiFloat 2.8s ease-in-out infinite',
      userSelect: 'none', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: '30px', left: '50%', transform: 'translateX(-50%)',
        width: '110px', height: '110px', borderRadius: '50%',
        background: `radial-gradient(circle, ${SEG_COLORS[0]}55 0%, transparent 70%)`,
        animation: 'mobiHalo 2.8s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{ display: 'flex', gap: '38px', marginBottom: '-4px', position: 'relative', zIndex: 1 }}>
        {[0, 1].map(i => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column-reverse', alignItems: 'center',
            transformOrigin: 'bottom center',
            animation: i === 0 ? 'mobiAnt1 1.8s ease-in-out infinite' : 'mobiAnt2 1.8s ease-in-out infinite',
            animationDelay: i === 0 ? '0s' : '0.3s',
          }}>
            <div style={{ width: '4px', height: '28px', borderRadius: '2px', background: SEG_COLORS[0], boxShadow: '0 0 0 1.5px #001a08' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#80ffcc', boxShadow: '0 0 8px #80ffcc, 0 0 16px #80ffcc88, 0 0 0 2px #001a08', marginBottom: '2px' }} />
          </div>
        ))}
      </div>
      <div style={{
        width: SEG_SIZES[0], height: SEG_SIZES[0], borderRadius: '50%',
        background: `radial-gradient(circle at 38% 35%, ${SEG_COLORS[0]}ee 0%, ${SEG_COLORS[1]} 60%, ${SEG_COLORS[2]} 100%)`,
        boxShadow: `0 0 0 4px #001a08, 0 6px 24px #001a0888, 0 0 32px ${SEG_COLORS[0]}66`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '7px', position: 'relative', zIndex: 1, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
          {[0, 1].map(e => (
            <div key={e} style={{
              width: '20px', height: '20px', borderRadius: '50%', background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'mobiBlink 4s ease-in-out infinite',
              animationDelay: e === 1 ? '0.05s' : '0s', overflow: 'hidden',
            }}>
              <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#050510', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '2px', left: '2px', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ width: '30px', height: '14px', borderBottom: '3px solid #041a0a', borderLeft: '2px solid transparent', borderRight: '2px solid transparent', borderRadius: '0 0 16px 16px', marginTop: '-2px' }} />
      </div>
      {SEG_SIZES.slice(1).map((sz, i) => (
        <div key={i} style={{
          width: sz, height: sz, borderRadius: '50%',
          background: `radial-gradient(circle at 38% 35%, ${SEG_COLORS[i + 1]}ee 0%, ${SEG_COLORS[Math.min(i + 2, 4)]} 100%)`,
          boxShadow: `0 0 0 ${3 - Math.min(i, 1)}px #001a08, 0 4px 14px #001a0866, 0 0 18px ${SEG_COLORS[i + 1]}44`,
          flexShrink: 0, animation: 'mobiSegBob 2.8s ease-in-out infinite',
          animationDelay: segBobDelays[i + 1], zIndex: 1, position: 'relative',
        }} />
      ))}
    </div>
  );
}

// ── MobiCharacter — Lottie when asset is ready, CSS fallback until then ───────

function MobiCharacter({ talking }) {
  if (!LOTTIE_READY) return <MobiCSSFallback />;

  return (
    <div style={{ width: 180, flexShrink: 0, filter: 'drop-shadow(0 0 18px #3be08a44)' }}>
      <LottiePlayer
        loop
        play
        animationData={mobiLottie}
        // When the Lottie has named segments you can swap them here:
        // segments={talking ? [30, 60] : [0, 30]}
        style={{ width: '100%', height: 'auto' }}
        rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
      />
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
          <MobiCharacter talking={index < lines.length - 1} />
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
