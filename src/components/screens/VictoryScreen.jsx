import React, { useState } from 'react';
import { VICTORY } from '../../utils/constants.js';

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
  const [showConfetti, _setShowConfetti] = useState(true);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Use level-specific win message if available
  const levelWinMessage = levelData?.winMessage;

  const winConfig = {
    rubiks: {
      title: 'Cube Solved!',
      subtitle: 'Classic Victory',
      description: 'You\'ve arranged all faces with uniform colors!',
      color: '#43a047',
      gradientFrom: '#43a047',
      gradientTo: '#2e7d32',
      bgGradient: 'linear-gradient(135deg, #f1f8e9, #c5e1a5)'
    },
    sudokube: {
      title: 'Sudokube Complete!',
      subtitle: 'Latin Square Master',
      description: 'Every face is a perfect Latin square - no repeated numbers in any row or column!',
      color: '#1e88e5',
      gradientFrom: '#1e88e5',
      gradientTo: '#1565c0',
      bgGradient: 'linear-gradient(135deg, #e3f2fd, #90caf9)'
    },
    ultimate: {
      title: 'ULTIMATE VICTORY!',
      subtitle: 'Topology Grandmaster',
      description: 'Incredible! You\'ve achieved the impossible - solving both the colors AND the Latin squares simultaneously!',
      color: '#fdd835',
      gradientFrom: '#fdd835',
      gradientTo: '#f9a825',
      bgGradient: 'linear-gradient(135deg, #fffde7, #fff59d)'
    },
    worm: {
      title: 'WORM³ COMPLETE!',
      subtitle: 'Secret Achievement Unlocked',
      description: 'You\'ve solved the ENTIRE CUBE through the WORMHOLES! Every single sticker traveled through antipodal space. You are a true master of manifold topology!',
      color: '#fb8c00',
      gradientFrom: '#fb8c00',
      gradientTo: '#f57c00',
      bgGradient: 'linear-gradient(135deg, #fff3e0, #ffcc80)'
    }
  };

  const config = winConfig[winType] || winConfig.rubiks;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      height: '100dvh',
      background: config.bgGradient,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      animation: 'fadeIn 0.5s ease-out',
      padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
      boxSizing: 'border-box'
    }}>
      {/* Confetti particles for ultimate win */}
      {winType === VICTORY.ULTIMATE && showConfetti && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none'
        }}>
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: '10px',
              height: '10px',
              background: ['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#f97316', '#ffffff'][i % 6],
              left: `${Math.random() * 100}%`,
              top: '-20px',
              borderRadius: i % 2 === 0 ? '50%' : '0',
              animation: `confetti-fall ${2 + Math.random() * 3}s linear infinite`,
              animationDelay: `${Math.random() * 2}s`
            }} />
          ))}
        </div>
      )}

      {/* WORM particles for worm victory */}
      {winType === VICTORY.WORM && showConfetti && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none'
        }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              fontSize: '24px',
              left: `${Math.random() * 100}%`,
              top: '-40px',
              animation: `worm-wiggle ${2 + Math.random() * 3}s linear infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}>
              ◎
            </div>
          ))}
        </div>
      )}

      <div style={{
        textAlign: 'center',
        maxWidth: '550px',
        width: '90%',
        padding: '48px',
        maxHeight: 'calc(100dvh - 40px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 2px 6px 2px rgba(60, 64, 67, 0.15), 0 8px 24px 4px rgba(60, 64, 67, 0.15)',
        border: `3px solid ${config.color}`,
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        {/* Decorative top bar */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '6px',
          background: `linear-gradient(90deg, ${config.gradientFrom}, ${config.gradientTo})`
        }} />

        {/* Title */}
        <h1 style={{
          fontSize: winType === VICTORY.ULTIMATE || winType === VICTORY.WORM ? '42px' : '36px',
          fontWeight: 700,
          margin: '0 0 8px 0',
          color: config.color,
          fontFamily: 'Georgia, serif',
          letterSpacing: '1px',
          textShadow: winType === VICTORY.ULTIMATE || winType === VICTORY.WORM ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
        }}>
          {config.title}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '14px',
          color: '#5f6368',
          marginBottom: '20px',
          fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontWeight: 500,
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          {config.subtitle}
        </p>

        {/* Description */}
        <p style={{
          fontSize: '16px',
          color: '#202124',
          marginBottom: '28px',
          lineHeight: 1.7,
          fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        }}>
          {levelWinMessage || config.description}
        </p>

        {/* Level indicator when playing a level */}
        {currentLevel && (
          <div style={{
            display: 'inline-block',
            marginBottom: '20px',
            padding: '8px 20px',
            background: `${config.color}15`,
            borderRadius: '20px',
            border: `1px solid ${config.color}30`
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: config.color,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Level {currentLevel} Complete
            </span>
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '32px',
          marginBottom: '32px',
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '12px',
          border: '1px solid #e8eaed'
        }}>
          <div>
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: '#5f6368',
              letterSpacing: '0.1em',
              marginBottom: '4px',
              fontWeight: 600
            }}>Moves</div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#202124',
              fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}>{moves}</div>
          </div>
          <div style={{
            width: '1px',
            background: '#e8eaed'
          }} />
          <div>
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: '#5f6368',
              letterSpacing: '0.1em',
              marginBottom: '4px',
              fontWeight: 600
            }}>Time</div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#202124',
              fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}>{formatTime(time)}</div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onContinue}
            style={{
              background: '#ffffff',
              border: `1px solid #e8eaed`,
              color: '#202124',
              fontSize: '14px',
              fontWeight: 500,
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              transition: 'all 0.2s',
              boxShadow: '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)'
            }}
            onMouseEnter={e => {
              e.target.style.background = '#f8f9fa';
              e.target.style.boxShadow = '0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15)';
            }}
            onMouseLeave={e => {
              e.target.style.background = '#ffffff';
              e.target.style.boxShadow = '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)';
            }}
          >
            Keep Playing
          </button>
          {/* Next Level button - shown when playing a level and there's a next level */}
          {hasNextLevel && onNextLevel && (
            <button
              onClick={onNextLevel}
              style={{
                background: '#1e88e5',
                border: 'none',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 500,
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)',
                fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={e => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15)';
                e.target.style.background = '#1565c0';
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)';
                e.target.style.background = '#1e88e5';
              }}
            >
              Next Level
              <span style={{ fontSize: '18px' }}>→</span>
            </button>
          )}
          <button
            onClick={onNewGame}
            style={{
              background: hasNextLevel
                ? '#f8f9fa'
                : config.color,
              border: hasNextLevel ? '1px solid #e8eaed' : 'none',
              color: hasNextLevel ? '#202124' : '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)',
              fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15)';
            }}
            onMouseLeave={e => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)';
            }}
          >
            {currentLevel ? 'Retry Level' : 'New Puzzle'}
          </button>
        </div>

        {/* Main Menu escape hatch */}
        {onMainMenu && (
          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <button
              onClick={onMainMenu}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#5f6368', fontSize: '13px', padding: '4px 8px',
                fontFamily: "'Roboto', 'Product Sans', 'Google Sans', -apple-system, sans-serif",
              }}
            >
              ← Main Menu
            </button>
          </div>
        )}

        {/* Achievement hint for non-ultimate wins */}
        {winType !== VICTORY.ULTIMATE && winType !== VICTORY.WORM && (
          <div style={{
            marginTop: '24px',
            padding: '12px 16px',
            background: 'rgba(234,179,8,0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(234,179,8,0.3)'
          }}>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#92400e',
              fontStyle: 'italic'
            }}>
              {winType === VICTORY.RUBIKS
                ? 'Challenge: Can you also solve the Sudokube (Latin squares) for the Ultimate Victory?'
                : 'Challenge: Can you also solve the colors for the Ultimate Victory?'}
            </p>
          </div>
        )}

        {/* Secret achievement message for worm victory */}
        {winType === VICTORY.WORM && (
          <div style={{
            marginTop: '24px',
            padding: '16px 20px',
            background: 'rgba(188, 108, 37, 0.15)',
            borderRadius: '8px',
            border: '2px solid rgba(188, 108, 37, 0.4)'
          }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#7f2d0e',
              fontWeight: 600,
              textAlign: 'center'
            }}>
              You've discovered the SECRET WORM VICTORY!<br/>
              <span style={{ fontSize: '12px', fontWeight: 'normal', fontStyle: 'italic' }}>
                The rarest achievement - solving through pure manifold chaos!
              </span>
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes worm-wiggle {
          0% { transform: translateY(-40px) rotate(0deg) translateX(0px); opacity: 1; }
          25% { transform: translateY(25vh) rotate(15deg) translateX(20px); opacity: 1; }
          50% { transform: translateY(50vh) rotate(-15deg) translateX(-20px); opacity: 1; }
          75% { transform: translateY(75vh) rotate(10deg) translateX(15px); opacity: 1; }
          100% { transform: translateY(100vh) rotate(0deg) translateX(0px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default VictoryScreen;
