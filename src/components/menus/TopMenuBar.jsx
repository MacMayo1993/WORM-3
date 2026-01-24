import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FACE_COLORS } from '../../utils/constants.js';

const TopMenuBar = ({
  moves,
  metrics,
  size,
  visualMode,
  flipMode,
  chaosMode,
  chaosLevel,
  cubies,
  onShowHelp,
  onShowSettings,
  achievedWins = { rubiks: false, sudokube: false, ultimate: false }
}) => {
  const [time, setTime] = useState(0);
  const startTime = useRef(Date.now());

  // Modern color palette - blue and white theme
  const colors = {
    primary: '#3b82f6',
    primaryLight: '#60a5fa',
    primaryDark: '#2563eb',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
    text: 'rgba(255, 255, 255, 0.95)',
    textMuted: 'rgba(255, 255, 255, 0.7)',
    textDim: 'rgba(255, 255, 255, 0.5)',
    background: 'rgba(30, 35, 50, 0.9)',
    divider: 'rgba(255, 255, 255, 0.12)'
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate parity (even/odd flips)
  const parity = metrics.flips % 2 === 0 ? 'EVEN' : 'ODD';
  const parityColor = parity === 'EVEN' ? colors.accent : colors.secondary;

  // Calculate face completion
  const faceStats = useMemo(() => {
    const faces = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const faceTargets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    for (const L of cubies) {
      for (const R of L) {
        for (const c of R) {
          for (const [dir, st] of Object.entries(c.stickers)) {
            const targetFace = dir === 'PZ' ? 1 : dir === 'NX' ? 2 : dir === 'PY' ? 3 :
                              dir === 'NZ' ? 4 : dir === 'PX' ? 5 : 6;
            faceTargets[targetFace]++;
            if (st.curr === targetFace) faces[targetFace]++;
          }
        }
      }
    }

    return Object.keys(faces).map(f => ({
      face: parseInt(f),
      complete: faces[f],
      total: faceTargets[f],
      percent: Math.round((faces[f] / faceTargets[f]) * 100)
    }));
  }, [cubies]);

  const totalComplete = faceStats.reduce((sum, f) => sum + f.complete, 0);
  const totalStickers = faceStats.reduce((sum, f) => sum + f.total, 0);
  const overallProgress = Math.round((totalComplete / totalStickers) * 100);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const modeLabel = visualMode === 'classic' ? 'Classic' :
                   visualMode === 'grid' ? 'Grid' :
                   visualMode === 'sudokube' ? 'Sudoku' : 'Wire';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
      gap: '16px',
      pointerEvents: 'auto'
    }}>
      {/* Left Section - Archive Header */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Logo Box - Library Archive Style */}
        <div className="bauhaus-box ui-element" style={{ padding: '12px 20px' }}>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontFamily: '"Product Sans", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontStyle: 'normal',
            fontWeight: 700,
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.02em',
            lineHeight: 1
          }}>WORM³</h1>
        </div>

        {/* Stats Panel - Library Checkout Card */}
        <div className="ui-element stats-panel" style={{
          padding: '8px 4px',
          display: 'flex',
          gap: '1px',
          background: colors.background,
          border: `1px solid ${colors.divider}`
        }}>
          {[
            { label: 'Moves', val: moves, color: colors.primaryLight },
            { label: 'Flips', val: metrics.flips, color: colors.accent },
            { label: 'Pairs', val: metrics.wormholes, color: colors.secondary },
            { label: 'Time', val: formatTime(time), color: colors.text }
          ].map((stat, i) => (
            <div key={stat.label} style={{
              padding: '4px 14px',
              borderRight: i < 3 ? `1px solid ${colors.divider}` : 'none',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '9px',
                textTransform: 'uppercase',
                color: colors.textMuted,
                letterSpacing: '0.1em',
                marginBottom: '2px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
              }}>{stat.label}</div>
              <div style={{
                fontSize: '18px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontWeight: 600,
                color: stat.color
              }}>{stat.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Center Section - Mode & Status Tags */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {/* Parity Tag */}
        <div className="ui-element" style={{
          padding: '5px 12px',
          background: `linear-gradient(135deg, ${parityColor}30, ${parityColor}10)`,
          borderColor: parityColor
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: parityColor,
            letterSpacing: '0.08em',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}>
            {parity}
          </span>
        </div>

        {/* Dimension Tag */}
        <div className="ui-element" style={{ padding: '5px 12px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: colors.text,
            letterSpacing: '0.05em',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}>
            {size}×{size}×{size}
          </span>
        </div>

        {/* Mode Tag */}
        <div className="ui-element" style={{
          padding: '5px 12px',
          background: `linear-gradient(135deg, ${colors.primaryLight}20, transparent)`
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: colors.primaryLight,
            fontStyle: 'normal',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}>
            {modeLabel}
          </span>
        </div>

        {/* Active Mode: Flip */}
        {flipMode && (
          <div className="ui-element" style={{
            padding: '5px 12px',
            background: `linear-gradient(135deg, ${colors.primary}30, ${colors.primary}10)`,
            borderColor: colors.primary
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: colors.primary,
              letterSpacing: '0.08em',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>Flip</span>
          </div>
        )}

        {/* Active Mode: Chaos */}
        {chaosMode && (
          <div className="ui-element" style={{
            padding: '5px 12px',
            background: 'linear-gradient(135deg, #ef444430, #ef444410)',
            borderColor: '#ef4444',
            animation: 'chaos-pulse 1.5s ease-in-out infinite'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#ef4444',
              letterSpacing: '0.08em',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>Chaos L{chaosLevel}</span>
          </div>
        )}

        {/* Achievement Badges */}
        {(achievedWins.rubiks || achievedWins.sudokube || achievedWins.ultimate) && (
          <div style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center'
          }}>
            {achievedWins.ultimate ? (
              <div className="ui-element" style={{
                padding: '5px 12px',
                background: 'linear-gradient(135deg, #fbbf2430, #fbbf2415)',
                borderColor: '#fbbf24',
                animation: 'pulse 2s ease-in-out infinite'
              }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#fbbf24',
                  letterSpacing: '0.08em',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>ULTIMATE</span>
              </div>
            ) : (
              <>
                {achievedWins.rubiks && (
                  <div className="ui-element" style={{
                    padding: '5px 10px',
                    background: 'linear-gradient(135deg, #10b98130, #10b98115)',
                    borderColor: '#10b981'
                  }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: '#10b981',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                    }}>Colors</span>
                  </div>
                )}
                {achievedWins.sudokube && (
                  <div className="ui-element" style={{
                    padding: '5px 10px',
                    background: `linear-gradient(135deg, ${colors.primary}30, ${colors.primary}15)`,
                    borderColor: colors.primary
                  }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: colors.primary,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                    }}>Latin</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right Section - Progress & Actions */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Progress Dial */}
        <div className="ui-element" style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: colors.background
        }}>
          <div style={{ position: 'relative', width: '42px', height: '42px' }}>
            <svg width="42" height="42" viewBox="0 0 42 42">
              <circle
                cx="21" cy="21" r="17"
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="3"
              />
              <circle
                cx="21" cy="21" r="17"
                fill="none"
                stroke={overallProgress === 100 ? '#10b981' : colors.primary}
                strokeWidth="3"
                strokeDasharray={`${overallProgress * 1.07} ${107 - overallProgress * 1.07}`}
                strokeDashoffset="26.75"
                strokeLinecap="round"
                transform="rotate(-90 21 21)"
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              color: overallProgress === 100 ? '#10b981' : colors.text
            }}>
              {overallProgress}%
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: colors.text,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>Solved</div>
            <div style={{
              fontSize: '11px',
              color: colors.textMuted,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>{totalComplete}/{totalStickers}</div>
          </div>
        </div>

        {/* Face Progress - Modern Bar Chart */}
        <div className="ui-element" style={{ padding: '8px 12px', background: colors.background }}>
          <div style={{
            fontSize: '9px',
            color: colors.textMuted,
            marginBottom: '6px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}>Faces</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {faceStats.map(f => (
              <div key={f.face} style={{
                width: '7px',
                height: '26px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '3px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column-reverse'
              }}>
                <div style={{
                  width: '100%',
                  height: `${f.percent}%`,
                  background: FACE_COLORS[f.face],
                  transition: 'height 0.3s ease',
                  opacity: 0.9
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions - Modern Buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onShowHelp}
            className="btn-compact"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}
          >
            ?
          </button>
          <button
            onClick={onShowSettings}
            className="btn-compact"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}
          >
            •••
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopMenuBar;
