import React, { useState, useMemo } from 'react';
import { VICTORY } from '../../utils/constants.js';
import { UI_FONT, DISPLAY_FONT } from '../../utils/uiTheme.js';

/**
 * VictoryScreen — themed to match the demo "STEP COMPLETE" beat: a warm dark
 * backdrop (no black, no neon), a cream Bungee title with a soft drop shadow, a
 * gold all-caps subtitle, and green pill actions. Per-win accents are warm, not
 * neon. The standalone Sudokube victory was removed.
 */

// ─── STEP COMPLETE palette ─────────────────────────────────────────────────────
const BG_RADIAL = 'radial-gradient(ellipse at center, rgba(24,31,18,0.55) 0%, rgba(24,31,18,0.86) 100%)';
const INK_CREAM = '#fffdf2';
const GOLD = '#ffe9ad';
const CREAM_SOFT = 'rgba(255,253,242,0.86)';
const CREAM_MUTED = 'rgba(255,253,242,0.6)';
const GREEN = '#5f7f4a';
const GREEN_LIGHT = '#9fdb7a';
const TITLE_SHADOW = '0 3px 0 rgba(43,53,35,0.55), 0 10px 34px rgba(24,31,18,0.6)';
const SOFT_SHADOW = '0 2px 12px rgba(24,31,18,0.7)';
const WARM_PANEL = 'rgba(250,247,238,0.08)';
const WARM_BORDER = 'rgba(255,245,220,0.18)';

const VictoryScreen = ({
  winType,
  moves,
  time,
  onContinue,
  onNewGame,
  currentLevel = null,
  levelData = null,
  onNextLevel = null,
  hasNextLevel = false,
  onMainMenu = null
}) => {
  const [showConfetti] = useState(true);

  // Warm celebratory confetti — no neon cyan / magenta.
  const CONFETTI_COLORS = ['#ffe9ad', '#9fdb7a', '#5f7f4a', '#e0b25c', '#d98a3d', '#fffdf2', '#c94f3d'];
  const confettiParticles = useMemo(() => {
    const count = 35;
    return Array.from({ length: count }).map((_, i) => {
      const phi = i * 137.508; // golden-angle spread avoids clumping
      return {
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left: `${((phi % 360) / 360) * 100}%`,
        width: 6 + (i % 4) * 3,
        height: i % 5 === 0 ? 14 : i % 3 === 0 ? 8 : 10,
        radius: i % 3 === 0 ? '50%' : i % 4 === 0 ? '2px' : '0',
        duration: 2.2 + (i % 9) * 0.35,
        delay: (i * 0.08) % 2.5,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winType]);

  const wormParticles = useMemo(() => (
    Array.from({ length: 32 }).map((_, i) => ({
      id: i,
      left: `${((i * 137.508) % 360 / 360) * 100}%`,
      duration: 2.2 + (i % 7) * 0.4,
      delay: (i * 0.09) % 2,
    }))
  ), []);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const levelWinMessage = levelData?.winMessage;

  // Per-win theming — all share the warm STEP COMPLETE look; only the confetti
  // mascot glyph color shifts. Only classic and worm victories remain.
  const winConfig = {
    rubiks: {
      title: 'Cube Solved!',
      subtitle: 'Classic Victory',
      description: "You've arranged every face with a single uniform color.",
    },
    worm: {
      title: 'WORM³ Complete!',
      subtitle: 'Secret Achievement',
      description: "You solved the entire cube through the WORMHOLES — every sticker traveled through antipodal space.",
    },
  };

  const config = winConfig[winType] || winConfig.rubiks;

  // Shared button styles ----------------------------------------------------
  const primaryBtn = {
    background: GREEN,
    border: 'none',
    color: INK_CREAM,
    fontSize: '13px',
    fontWeight: 800,
    padding: '12px 26px',
    borderRadius: '999px',
    cursor: 'pointer',
    fontFamily: UI_FONT,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    boxShadow: '0 7px 16px rgba(95,127,74,0.30)',
    transition: 'all 0.18s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };
  const outlineBtn = {
    background: 'transparent',
    border: `1.5px solid ${WARM_BORDER}`,
    color: CREAM_SOFT,
    fontSize: '13px',
    fontWeight: 700,
    padding: '12px 22px',
    borderRadius: '999px',
    cursor: 'pointer',
    fontFamily: UI_FONT,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    transition: 'all 0.18s',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      height: '100dvh',
      background: BG_RADIAL,
      backdropFilter: 'blur(9px) saturate(1.03)',
      WebkitBackdropFilter: 'blur(9px) saturate(1.03)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      animation: 'vsFadeIn 0.45s ease-out',
      padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px))',
      boxSizing: 'border-box'
    }}>
      {/* Confetti — non-worm wins */}
      {winType !== VICTORY.WORM && showConfetti && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {confettiParticles.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              width: `${p.width}px`,
              height: `${p.height}px`,
              background: p.color,
              left: p.left,
              top: '-20px',
              borderRadius: p.radius,
              animation: `vsConfettiFall ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }} />
          ))}
        </div>
      )}

      {/* Worm particles for worm victory */}
      {winType === VICTORY.WORM && showConfetti && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {wormParticles.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              fontSize: '24px',
              left: p.left,
              top: '-40px',
              color: GREEN_LIGHT,
              animation: `vsWormWiggle ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }}>◎</div>
          ))}
        </div>
      )}

      <div style={{
        position: 'relative',
        textAlign: 'center',
        maxWidth: '460px',
        width: '92%',
        padding: 'clamp(24px, 5vw, 36px)',
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
        boxSizing: 'border-box',
        animation: 'vsPanelRise 0.45s cubic-bezier(0.16,1,0.3,1)'
      }}>
        {/* Green check — echoes the demo STEP COMPLETE stamp */}
        <div style={{
          fontSize: 'clamp(40px, 11vw, 64px)',
          lineHeight: 1,
          color: GREEN_LIGHT,
          textShadow: '0 4px 0 rgba(43,53,35,0.5), 0 12px 38px rgba(24,31,18,0.65)',
          margin: '0 0 8px'
        }}>✓</div>

        {/* Subtitle (eyebrow) */}
        <p style={{
          fontSize: 'clamp(12px, 3.4vw, 15px)',
          color: GOLD,
          margin: '0 0 8px 0',
          fontFamily: UI_FONT,
          fontWeight: 900,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          textShadow: SOFT_SHADOW
        }}>
          {config.subtitle}
        </p>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(30px, 8vw, 52px)',
          fontWeight: 900,
          margin: '0 0 14px 0',
          color: INK_CREAM,
          fontFamily: DISPLAY_FONT,
          lineHeight: 0.95,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          textShadow: TITLE_SHADOW
        }}>
          {config.title}
        </h1>

        {/* Description */}
        <p style={{
          fontSize: '13px',
          color: CREAM_SOFT,
          margin: '0 0 22px 0',
          lineHeight: 1.6,
          fontFamily: UI_FONT,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase'
        }}>
          {levelWinMessage || config.description}
        </p>

        {/* Level indicator */}
        {currentLevel && (
          <div style={{
            display: 'inline-block',
            marginBottom: '20px',
            padding: '7px 16px',
            background: WARM_PANEL,
            borderRadius: '999px',
            border: `1px solid ${WARM_BORDER}`
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              color: GOLD,
              fontFamily: UI_FONT,
              textTransform: 'uppercase',
              letterSpacing: '0.14em'
            }}>
              Level {currentLevel} Complete
            </span>
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '26px',
        }}>
          {[{ label: 'Moves', value: moves }, { label: 'Time', value: formatTime(time) }].map((stat) => (
            <div key={stat.label} style={{
              flex: 1,
              maxWidth: '150px',
              padding: '14px 10px',
              background: WARM_PANEL,
              borderRadius: '14px',
              border: `1px solid ${WARM_BORDER}`
            }}>
              <div style={{
                fontSize: '10px', textTransform: 'uppercase', color: CREAM_MUTED,
                letterSpacing: '0.14em', marginBottom: '6px', fontWeight: 800,
                fontFamily: UI_FONT
              }}>{stat.label}</div>
              <div style={{
                fontSize: '26px', fontWeight: 900, color: INK_CREAM,
                fontFamily: DISPLAY_FONT
              }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onContinue}
            style={outlineBtn}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,245,220,0.42)'; e.currentTarget.style.color = INK_CREAM; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = WARM_BORDER; e.currentTarget.style.color = CREAM_SOFT; }}
          >
            Keep Playing
          </button>

          {hasNextLevel && onNextLevel && (
            <button
              onClick={onNextLevel}
              style={primaryBtn}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#6b8f53'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = GREEN; }}
            >
              Next Level <span style={{ fontSize: '16px' }}>→</span>
            </button>
          )}

          <button
            onClick={onNewGame}
            style={hasNextLevel ? outlineBtn : primaryBtn}
            onMouseEnter={e => {
              if (hasNextLevel) { e.currentTarget.style.borderColor = 'rgba(255,245,220,0.42)'; e.currentTarget.style.color = INK_CREAM; }
              else { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#6b8f53'; }
            }}
            onMouseLeave={e => {
              if (hasNextLevel) { e.currentTarget.style.borderColor = WARM_BORDER; e.currentTarget.style.color = CREAM_SOFT; }
              else { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = GREEN; }
            }}
          >
            {currentLevel ? 'Retry Level' : 'New Puzzle'}
          </button>
        </div>

        {/* Main Menu escape hatch */}
        {onMainMenu && (
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={onMainMenu}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: CREAM_MUTED, fontSize: '12px', padding: '4px 8px',
                fontFamily: UI_FONT, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700
              }}
              onMouseEnter={e => { e.currentTarget.style.color = INK_CREAM; }}
              onMouseLeave={e => { e.currentTarget.style.color = CREAM_MUTED; }}
            >
              ← Main Menu
            </button>
          </div>
        )}

        {/* Secret achievement message for worm victory */}
        {winType === VICTORY.WORM && (
          <div style={{
            marginTop: '22px',
            padding: '14px 18px',
            background: WARM_PANEL,
            borderRadius: '14px',
            border: `1px solid ${WARM_BORDER}`
          }}>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: GOLD,
              fontWeight: 800,
              fontFamily: UI_FONT,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              You discovered the SECRET WORM VICTORY!<br/>
              <span style={{ fontSize: '11px', fontWeight: 600, color: CREAM_SOFT, letterSpacing: '0.03em' }}>
                The rarest achievement — solving through pure manifold chaos.
              </span>
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes vsFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes vsPanelRise { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes vsConfettiFall {
          0%   { transform: translateY(-20px) rotate(0deg) skewX(0deg); opacity: 1; }
          60%  { opacity: 1; }
          100% { transform: translateY(100vh) rotate(540deg) skewX(12deg); opacity: 0; }
        }
        @keyframes vsWormWiggle {
          0%   { transform: translateY(-40px) rotate(0deg) translateX(0px); opacity: 1; }
          25%  { transform: translateY(25vh) rotate(15deg) translateX(20px); opacity: 1; }
          50%  { transform: translateY(50vh) rotate(-15deg) translateX(-20px); opacity: 1; }
          75%  { transform: translateY(75vh) rotate(10deg) translateX(15px); opacity: 1; }
          100% { transform: translateY(100vh) rotate(0deg) translateX(0px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes vsConfettiFall { from {} to {} }
          @keyframes vsWormWiggle   { from {} to {} }
          @keyframes vsFadeIn       { from {} to {} }
          @keyframes vsPanelRise    { from {} to {} }
        }
      `}</style>
    </div>
  );
};

export default VictoryScreen;
