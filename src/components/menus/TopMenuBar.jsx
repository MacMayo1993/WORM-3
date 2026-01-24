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

  // Retro color palette
  const colors = {
    ink: '#582f0e',
    inkMedium: '#7f5539',
    inkLight: '#9c6644',
    burntOrange: '#bc6c25',
    burntOrangeLight: '#dda15e',
    avocado: '#606c38',
    mustard: '#d4a373',
    paper: '#f2e8cf',
    paperCream: '#fefae0',
    divider: 'rgba(188, 108, 37, 0.25)'
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate parity (even/odd flips)
  const parity = metrics.flips % 2 === 0 ? 'EVEN' : 'ODD';
  const parityColor = parity === 'EVEN' ? colors.avocado : colors.burntOrange;

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
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 700,
            color: colors.ink,
            letterSpacing: '0.02em',
            lineHeight: 1
          }}>WORM³</h1>
        </div>

        {/* Stats Panel - Library Checkout Card */}
        <div className="ui-element stats-panel" style={{
          padding: '8px 4px',
          display: 'flex',
          gap: '1px',
          background: colors.paperCream,
          border: `1px solid ${colors.divider}`
        }}>
          {[
            { label: 'Moves', val: moves, color: colors.avocado },
            { label: 'Flips', val: metrics.flips, color: colors.burntOrange },
            { label: 'Pairs', val: metrics.wormholes, color: colors.mustard },
            { label: 'Time', val: formatTime(time), color: colors.ink }
          ].map((stat, i) => (
            <div key={stat.label} style={{
              padding: '4px 14px',
              borderRight: i < 3 ? `1px solid ${colors.divider}` : 'none',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '9px',
                textTransform: 'uppercase',
                color: colors.inkLight,
                letterSpacing: '0.1em',
                marginBottom: '2px'
              }}>{stat.label}</div>
              <div style={{
                fontSize: '18px',
                fontFamily: "'Courier New', monospace",
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
          background: `linear-gradient(135deg, ${parityColor}18, ${parityColor}08)`,
          borderColor: parityColor,
          borderWidth: '1px 2px 2px 1px'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: parityColor,
            letterSpacing: '0.1em',
            fontFamily: 'Georgia, serif'
          }}>
            ⟲ {parity}
          </span>
        </div>

        {/* Dimension Tag */}
        <div className="ui-element" style={{ padding: '5px 12px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: colors.ink,
            letterSpacing: '0.05em',
            fontFamily: "'Courier New', monospace"
          }}>
            {size}×{size}×{size}
          </span>
        </div>

        {/* Mode Tag */}
        <div className="ui-element" style={{
          padding: '5px 12px',
          background: `linear-gradient(135deg, ${colors.inkLight}15, transparent)`
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: colors.inkMedium,
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif'
          }}>
            {modeLabel}
          </span>
        </div>

        {/* Active Mode: Flip */}
        {flipMode && (
          <div className="ui-element" style={{
            padding: '5px 12px',
            background: `linear-gradient(135deg, ${colors.burntOrange}20, ${colors.burntOrange}08)`,
            borderColor: colors.burntOrange
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: colors.burntOrange,
              letterSpacing: '0.1em'
            }}>⚡ Flip</span>
          </div>
        )}

        {/* Active Mode: Chaos */}
        {chaosMode && (
          <div className="ui-element" style={{
            padding: '5px 12px',
            background: 'linear-gradient(135deg, #9c4a1a25, #9c4a1a10)',
            borderColor: '#9c4a1a',
            animation: 'chaos-pulse 1.5s ease-in-out infinite'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#9c4a1a',
              letterSpacing: '0.1em'
            }}>☢ Chaos L{chaosLevel}</span>
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
                background: 'linear-gradient(135deg, #eab30830, #eab30815)',
                borderColor: '#eab308',
                animation: 'pulse 2s ease-in-out infinite'
              }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#ca8a04',
                  letterSpacing: '0.05em'
                }}>👑 ULTIMATE</span>
              </div>
            ) : (
              <>
                {achievedWins.rubiks && (
                  <div className="ui-element" style={{
                    padding: '5px 10px',
                    background: 'linear-gradient(135deg, #22c55e25, #22c55e10)',
                    borderColor: '#22c55e'
                  }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: '#16a34a'
                    }}>🎲 Colors</span>
                  </div>
                )}
                {achievedWins.sudokube && (
                  <div className="ui-element" style={{
                    padding: '5px 10px',
                    background: 'linear-gradient(135deg, #3b82f625, #3b82f610)',
                    borderColor: '#3b82f6'
                  }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: '#2563eb'
                    }}>🔢 Latin</span>
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
          background: colors.paperCream
        }}>
          <div style={{ position: 'relative', width: '42px', height: '42px' }}>
            <svg width="42" height="42" viewBox="0 0 42 42">
              <circle
                cx="21" cy="21" r="17"
                fill="none"
                stroke="rgba(88, 47, 14, 0.15)"
                strokeWidth="3"
              />
              <circle
                cx="21" cy="21" r="17"
                fill="none"
                stroke={overallProgress === 100 ? colors.avocado : colors.burntOrange}
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
              fontFamily: "'Courier New', monospace",
              color: overallProgress === 100 ? colors.avocado : colors.ink
            }}>
              {overallProgress}%
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: colors.ink,
              letterSpacing: '0.1em',
              textTransform: 'uppercase'
            }}>Solved</div>
            <div style={{
              fontSize: '11px',
              color: colors.inkLight,
              fontFamily: "'Courier New', monospace"
            }}>{totalComplete}/{totalStickers}</div>
          </div>
        </div>

        {/* Face Progress - Vintage Bar Chart */}
        <div className="ui-element" style={{ padding: '8px 12px', background: colors.paperCream }}>
          <div style={{
            fontSize: '9px',
            color: colors.inkLight,
            marginBottom: '6px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase'
          }}>Faces</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {faceStats.map(f => (
              <div key={f.face} style={{
                width: '7px',
                height: '26px',
                background: 'rgba(88, 47, 14, 0.1)',
                border: '1px solid rgba(88, 47, 14, 0.15)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column-reverse'
              }}>
                <div style={{
                  width: '100%',
                  height: `${f.percent}%`,
                  background: FACE_COLORS[f.face],
                  transition: 'height 0.3s ease',
                  opacity: 0.85
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions - Vintage Buttons */}
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
              fontWeight: 700,
              fontFamily: 'Georgia, serif'
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
              fontSize: '13px'
            }}
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopMenuBar;
