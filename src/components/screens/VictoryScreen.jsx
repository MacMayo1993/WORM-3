import React, { useState } from 'react';

const VictoryScreen = ({ winType, moves, time, onContinue, onNewGame }) => {
  const [showConfetti, setShowConfetti] = useState(true);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const winConfig = {
    rubiks: {
      title: 'Cube Solved!',
      subtitle: 'Classic Victory',
      description: 'You\'ve arranged all faces with uniform colors!',
      color: '#22c55e',
      gradientFrom: '#22c55e',
      gradientTo: '#16a34a',
      icon: '🎲',
      bgGradient: 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
    },
    sudokube: {
      title: 'Sudokube Complete!',
      subtitle: 'Latin Square Master',
      description: 'Every face is a perfect Latin square - no repeated numbers in any row or column!',
      color: '#3b82f6',
      gradientFrom: '#3b82f6',
      gradientTo: '#2563eb',
      icon: '🔢',
      bgGradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)'
    },
    ultimate: {
      title: 'ULTIMATE VICTORY!',
      subtitle: 'Topology Grandmaster',
      description: 'Incredible! You\'ve achieved the impossible - solving both the colors AND the Latin squares simultaneously!',
      color: '#eab308',
      gradientFrom: '#eab308',
      gradientTo: '#ca8a04',
      icon: '👑',
      bgGradient: 'linear-gradient(135deg, #fef9c3, #fde047)'
    },
    worm: {
      title: 'WORM³ COMPLETE!',
      subtitle: '🪱 Secret Achievement Unlocked 🪱',
      description: 'You\'ve solved the ENTIRE CUBE through the WORMHOLES! Every single sticker traveled through antipodal space. You are a true master of manifold topology!',
      color: '#bc6c25',
      gradientFrom: '#bc6c25',
      gradientTo: '#9c4a1a',
      icon: '🪱',
      bgGradient: 'linear-gradient(135deg, #dda15e, #bc6c25)'
    }
  };

  const config = winConfig[winType] || winConfig.rubiks;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: config.bgGradient,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      animation: 'fadeIn 0.5s ease-out'
    }}>
      {/* Confetti particles for ultimate win */}
      {winType === 'ultimate' && showConfetti && (
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
      {winType === 'worm' && showConfetti && (
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
              🪱
            </div>
          ))}
        </div>
      )}

      <div style={{
        textAlign: 'center',
        maxWidth: '550px',
        padding: '48px',
        background: '#fdfbf7',
        borderRadius: '16px',
        boxShadow: `0 8px 40px rgba(0,0,0,0.15), 0 0 0 4px ${config.color}40`,
        border: `2px solid ${config.color}`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative top bar */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '6px',
          background: `linear-gradient(90deg, ${config.gradientFrom}, ${config.gradientTo})`
        }} />

        {/* Icon */}
        <div style={{
          fontSize: '64px',
          marginBottom: '16px',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))'
        }}>
          {config.icon}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: winType === 'ultimate' || winType === 'worm' ? '42px' : '36px',
          fontWeight: 700,
          margin: '0 0 8px 0',
          color: config.color,
          fontFamily: 'Georgia, serif',
          letterSpacing: '1px',
          textShadow: winType === 'ultimate' || winType === 'worm' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
        }}>
          {config.title}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '16px',
          color: '#8b6f47',
          marginBottom: '20px',
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          letterSpacing: '0.1em',
          textTransform: 'uppercase'
        }}>
          {config.subtitle}
        </p>

        {/* Description */}
        <p style={{
          fontSize: '16px',
          color: '#5a4a3a',
          marginBottom: '28px',
          lineHeight: 1.7,
          fontFamily: 'Georgia, serif'
        }}>
          {config.description}
        </p>

        {/* Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '32px',
          marginBottom: '32px',
          padding: '20px',
          background: 'rgba(0,0,0,0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(0,0,0,0.06)'
        }}>
          <div>
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: '#9b8b7a',
              letterSpacing: '0.1em',
              marginBottom: '4px'
            }}>Moves</div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#6b4423',
              fontFamily: "'Courier New', monospace"
            }}>{moves}</div>
          </div>
          <div style={{
            width: '1px',
            background: 'rgba(0,0,0,0.1)'
          }} />
          <div>
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              color: '#9b8b7a',
              letterSpacing: '0.1em',
              marginBottom: '4px'
            }}>Time</div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#6b4423',
              fontFamily: "'Courier New', monospace"
            }}>{formatTime(time)}</div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            onClick={onContinue}
            style={{
              background: 'transparent',
              border: `2px solid ${config.color}`,
              color: config.color,
              fontSize: '16px',
              fontWeight: 600,
              padding: '12px 28px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: 'Georgia, serif',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.target.style.background = `${config.color}10`;
            }}
            onMouseLeave={e => {
              e.target.style.background = 'transparent';
            }}
          >
            Keep Playing
          </button>
          <button
            onClick={onNewGame}
            style={{
              background: `linear-gradient(135deg, ${config.gradientFrom}, ${config.gradientTo})`,
              border: 'none',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 600,
              padding: '12px 28px',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: `0 4px 12px ${config.color}40`,
              fontFamily: 'Georgia, serif',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = `0 6px 20px ${config.color}50`;
            }}
            onMouseLeave={e => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = `0 4px 12px ${config.color}40`;
            }}
          >
            New Puzzle
          </button>
        </div>

        {/* Achievement hint for non-ultimate wins */}
        {winType !== 'ultimate' && winType !== 'worm' && (
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
              {winType === 'rubiks'
                ? '🎯 Challenge: Can you also solve the Sudokube (Latin squares) for the Ultimate Victory?'
                : '🎯 Challenge: Can you also solve the colors for the Ultimate Victory?'}
            </p>
          </div>
        )}

        {/* Secret achievement message for worm victory */}
        {winType === 'worm' && (
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
              🌟 You've discovered the SECRET WORM VICTORY! 🌟<br/>
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
