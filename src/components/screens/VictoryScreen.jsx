import React, { useState, useMemo } from 'react';
import { VICTORY } from '../../utils/constants.js';
import { UI_FONT, GLASS_PANEL, GLASS_PANEL_BORDER, GLASS_TEXT, GLASS_TEXT_MUTED, GLASS_TEXT_SOFT, GLASS_SHADOW } from '../../utils/uiTheme.js';

/**
 * VictoryScreen — themed to match the dark "Mobi" UI (LevelTutorial / MobiIntro):
 * dark navy panel, accent glow per win type, system-ui type, accent-filled
 * primary actions. The standalone Sudokube victory was removed.
 */

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

  const CONFETTI_COLORS = ['#00d2f8', '#22c55e', '#3b82f6', '#eab308', '#f97316', '#ffffff', '#a855f7', '#ec4899'];
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

  // Per-win theming — all share the dark Mobi panel, only the accent changes.
  // Only the classic and worm victories remain (Sudokube/Ultimate were removed).
  const winConfig = {
    rubiks: {
      title: 'Cube Solved!',
      subtitle: 'Classic Victory',
      description: "You've arranged every face with a single uniform color.",
      accent: '#00d2f8',
    },
    worm: {
      title: 'WORM³ Complete!',
      subtitle: 'Secret Achievement',
      description: "You solved the entire cube through the WORMHOLES — every sticker traveled through antipodal space.",
      accent: '#fb8c00',
    },
  };

  const config = winConfig[winType] || winConfig.rubiks;
  const accent = config.accent;

  // Shared button styles ----------------------------------------------------
  const primaryBtn = {
    background: accent,
    border: `1px solid ${accent}`,
    color: '#00121b',
    fontSize: '13px',
    fontWeight: 700,
    padding: '11px 26px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: UI_FONT,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    boxShadow: `0 0 18px ${accent}66`,
    transition: 'all 0.18s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };
  const outlineBtn = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: '13px',
    fontWeight: 600,
    padding: '11px 22px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: UI_FONT,
    letterSpacing: '0.04em',
    transition: 'all 0.18s',
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      height: '100dvh',
      background: 'radial-gradient(120% 120% at 50% 0%, rgba(0,40,60,0.35) 0%, rgba(0,0,0,0.78) 60%)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
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
              color: accent,
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
        padding: 'clamp(28px, 5vw, 40px)',
        maxHeight: 'calc(100dvh - 32px)',
        overflowY: 'auto',
        background: GLASS_PANEL,
        borderRadius: '16px',
        border: `1px solid ${accent}`,
        boxShadow: `${GLASS_SHADOW}, 0 0 60px ${accent}33`,
        boxSizing: 'border-box',
        animation: 'vsPanelRise 0.45s cubic-bezier(0.16,1,0.3,1)'
      }}>
        {/* Accent top bar */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '3px',
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          borderRadius: '16px 16px 0 0'
        }} />

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(26px, 6vw, 36px)',
          fontWeight: 800,
          margin: '0 0 6px 0',
          color: accent,
          fontFamily: UI_FONT,
          letterSpacing: '0.01em',
          textShadow: `0 0 24px ${accent}55`
        }}>
          {config.title}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '12px',
          color: accent,
          opacity: 0.85,
          margin: '0 0 18px 0',
          fontFamily: UI_FONT,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase'
        }}>
          {config.subtitle}
        </p>

        {/* Description */}
        <p style={{
          fontSize: '15px',
          color: GLASS_TEXT_SOFT,
          margin: '0 0 22px 0',
          lineHeight: 1.6,
          fontFamily: UI_FONT
        }}>
          {levelWinMessage || config.description}
        </p>

        {/* Level indicator */}
        {currentLevel && (
          <div style={{
            display: 'inline-block',
            marginBottom: '20px',
            padding: '6px 16px',
            background: `${accent}1a`,
            borderRadius: '20px',
            border: `1px solid ${accent}40`
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: accent,
              fontFamily: UI_FONT,
              textTransform: 'uppercase',
              letterSpacing: '0.12em'
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
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '10px',
              border: `1px solid ${GLASS_PANEL_BORDER}`
            }}>
              <div style={{
                fontSize: '10px', textTransform: 'uppercase', color: GLASS_TEXT_MUTED,
                letterSpacing: '0.12em', marginBottom: '6px', fontWeight: 700,
                fontFamily: UI_FONT
              }}>{stat.label}</div>
              <div style={{
                fontSize: '26px', fontWeight: 800, color: '#fff',
                fontFamily: UI_FONT
              }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onContinue}
            style={outlineBtn}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
          >
            Keep Playing
          </button>

          {hasNextLevel && onNextLevel && (
            <button
              onClick={onNextLevel}
              style={primaryBtn}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 0 24px ${accent}aa`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 0 18px ${accent}66`; }}
            >
              Next Level <span style={{ fontSize: '16px' }}>→</span>
            </button>
          )}

          <button
            onClick={onNewGame}
            style={hasNextLevel ? outlineBtn : primaryBtn}
            onMouseEnter={e => {
              if (hasNextLevel) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)'; e.currentTarget.style.color = '#fff'; }
              else { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 0 24px ${accent}aa`; }
            }}
            onMouseLeave={e => {
              if (hasNextLevel) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }
              else { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 0 18px ${accent}66`; }
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
                color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '4px 8px',
                fontFamily: UI_FONT, letterSpacing: '0.04em'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
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
            background: `${accent}1a`,
            borderRadius: '10px',
            border: `1px solid ${accent}55`
          }}>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#ffd9b0',
              fontWeight: 600,
              fontFamily: UI_FONT
            }}>
              You discovered the SECRET WORM VICTORY!<br/>
              <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85 }}>
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
