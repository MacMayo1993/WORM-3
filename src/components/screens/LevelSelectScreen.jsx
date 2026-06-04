import React, { useState, useEffect } from 'react';
import { LEVELS, isLevelUnlocked, loadProgress, getNewFeatures } from '../../utils/levels.js';

// Size/Chaos indicator badges
const LevelBadge = ({ size, chaos }) => (
  <div style={{
    display: 'flex',
    gap: '4px',
    marginTop: '4px'
  }}>
    <span style={{
      fontSize: '8px',
      padding: '1px 4px',
      background: 'rgba(30, 136, 229, 0.20)',
      borderRadius: '3px',
      color: 'rgba(200, 220, 255, 0.75)',
      fontWeight: 600,
    }}>
      {size}x{size}
    </span>
    {chaos > 0 && (
      <span style={{
        fontSize: '8px',
        padding: '1px 4px',
        background: `rgba(239, 68, 68, ${0.15 + chaos * 0.08})`,
        borderRadius: '3px',
        color: 'rgba(200, 220, 255, 0.75)',
        fontWeight: 600,
      }}>
        C{chaos}
      </span>
    )}
  </div>
);

const LevelSelectScreen = ({ onSelectLevel, onBack }) => {
  const [hoveredLevel, setHoveredLevel] = useState(null);
  const [completedLevels, setCompletedLevels] = useState([]);

  // Load progress on mount
  useEffect(() => {
    setCompletedLevels(loadProgress());
  }, []);

  const hoveredLevelData = hoveredLevel ? LEVELS.find(l => l.id === hoveredLevel) : null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      height: '100dvh',
      background: 'rgba(8, 10, 22, 0.72)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
      boxSizing: 'border-box',
      fontFamily: 'var(--ui-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '750px',
        width: '95%',
        padding: '32px',
        maxHeight: 'calc(100dvh - 40px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
        background: 'rgba(14, 17, 38, 0.94)',
        borderRadius: '20px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.06)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(24px)',
        boxSizing: 'border-box',
      }}>
        {/* Header */}
        <h1 style={{
          fontSize: 'clamp(28px, 6vw, 42px)',
          fontWeight: 700,
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #e53935 0%, #fb8c00 20%, #fdd835 40%, #43a047 60%, #1e88e5 80%, #e53935 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0.02em'
        }}>Select Level</h1>

        <p style={{
          fontSize: '14px',
          color: 'rgba(200, 220, 255, 0.65)',
          marginBottom: '24px',
        }}>
          Master topology one concept at a time
        </p>

        {/* Level Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '10px',
          marginBottom: '24px'
        }}>
          {LEVELS.map((level) => {
            const isHovered = hoveredLevel === level.id;
            const isUnlocked = isLevelUnlocked(level.id, completedLevels);
            const isCompleted = completedLevels.includes(level.id);
            const isBlackHole = level.id === 10;
            const canPlay = isUnlocked;

            return (
              <button
                key={level.id}
                onClick={() => canPlay && onSelectLevel(level.id)}
                onMouseEnter={() => setHoveredLevel(level.id)}
                onMouseLeave={() => setHoveredLevel(null)}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  background: isBlackHole
                    ? 'radial-gradient(circle at center, #1a0a2e 0%, #0d0015 50%, #000 100%)'
                    : isCompleted
                      ? 'rgba(34, 197, 94, 0.14)'
                      : !isUnlocked
                        ? 'rgba(255, 255, 255, 0.03)'
                        : isHovered
                          ? 'rgba(30, 136, 229, 0.18)'
                          : 'rgba(255, 255, 255, 0.06)',
                  border: isBlackHole
                    ? '2px solid #8b5cf6'
                    : isCompleted
                      ? '2px solid rgba(34, 197, 94, 0.45)'
                      : !isUnlocked
                        ? '1px solid rgba(255, 255, 255, 0.06)'
                        : isHovered
                          ? '2px solid rgba(30, 136, 229, 0.55)'
                          : '1px solid rgba(255, 255, 255, 0.10)',
                  borderRadius: '12px',
                  cursor: canPlay ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  transform: isHovered && canPlay ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isBlackHole
                    ? '0 0 30px rgba(139, 92, 246, 0.4), inset 0 0 20px rgba(0, 0, 0, 0.8)'
                    : isCompleted
                      ? '0 0 12px rgba(34, 197, 94, 0.18)'
                      : isHovered && canPlay
                        ? '0 4px 16px rgba(30, 136, 229, 0.22)'
                        : 'none',
                  opacity: !isUnlocked ? 0.40 : 1,
                  overflow: 'hidden'
                }}
              >
                {/* Black hole animated ring effect */}
                {isBlackHole && (
                  <div style={{
                    position: 'absolute',
                    inset: '3px',
                    borderRadius: '10px',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    animation: 'pulse 2s ease-in-out infinite',
                    pointerEvents: 'none'
                  }} />
                )}

                {/* Completed checkmark */}
                {isCompleted && !isBlackHole && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '16px',
                    height: '16px',
                    background: 'rgba(34, 197, 94, 0.9)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: '#fff'
                  }}>
                    ✓
                  </div>
                )}

                {/* Lock icon */}
                {!isUnlocked && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    fontSize: '12px',
                    opacity: 0.45
                  }}>
                    🔒
                  </div>
                )}

                {/* Level number */}
                <span style={{
                  fontSize: isBlackHole ? '24px' : '28px',
                  fontWeight: 700,
                  color: isBlackHole
                    ? '#c084fc'
                    : isCompleted
                      ? '#4ade80'
                      : !isUnlocked
                        ? 'rgba(255, 255, 255, 0.20)'
                        : '#e8edf8',
                  fontFamily: '"Courier New", monospace',
                  textShadow: isBlackHole ? '0 0 10px #8b5cf6' : 'none'
                }}>
                  {isBlackHole ? '∞' : level.id}
                </span>

                {/* Size/Chaos badges */}
                {isUnlocked && (
                  <LevelBadge size={level.cubeSize} chaos={level.chaosLevel} />
                )}
              </button>
            );
          })}
        </div>

        {/* Level Info Panel */}
        {hoveredLevelData && (
          <div style={{
            background: hoveredLevelData.id === 10
              ? 'rgba(139, 92, 246, 0.10)'
              : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${hoveredLevelData.id === 10 ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            textAlign: 'left',
            minHeight: '80px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
              flexWrap: 'wrap'
            }}>
              <span style={{
                fontSize: '17px',
                fontWeight: 700,
                color: hoveredLevelData.id === 10 ? '#a78bfa' : '#60a5fa',
              }}>
                {hoveredLevelData.id === 10 ? '∞' : hoveredLevelData.id}: {hoveredLevelData.name}
              </span>
              {completedLevels.includes(hoveredLevelData.id) && (
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  background: 'rgba(34, 197, 94, 0.20)',
                  borderRadius: '4px',
                  color: '#4ade80',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}>
                  COMPLETED
                </span>
              )}
              {!isLevelUnlocked(hoveredLevelData.id, completedLevels) && (
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '4px',
                  color: 'rgba(200, 220, 255, 0.55)',
                  fontWeight: 600,
                }}>
                  LOCKED — Complete Level {hoveredLevelData.id - 1}
                </span>
              )}
            </div>

            <p style={{
              margin: '0 0 10px 0',
              fontSize: '14px',
              color: 'rgba(200, 220, 255, 0.65)',
              lineHeight: 1.5
            }}>
              {hoveredLevelData.description}
            </p>

            {/* New features unlocked */}
            {(() => {
              const newFeatures = getNewFeatures(hoveredLevelData.id);
              if (newFeatures.length > 0) {
                return (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginTop: '8px'
                  }}>
                    <span style={{
                      fontSize: '10px',
                      color: 'rgba(200, 220, 255, 0.55)',
                      marginRight: '4px',
                      fontWeight: 600,
                    }}>
                      NEW:
                    </span>
                    {newFeatures.map((feat, i) => (
                      <span key={i} style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: 'rgba(34, 197, 94, 0.14)',
                        border: '1px solid rgba(34, 197, 94, 0.30)',
                        borderRadius: '4px',
                        color: '#4ade80',
                        fontWeight: 600,
                      }}>
                        {feat}
                      </span>
                    ))}
                  </div>
                );
              }
              return null;
            })()}

            {/* Win condition */}
            <div style={{
              marginTop: '10px',
              fontSize: '11px',
              color: 'rgba(200, 220, 255, 0.55)',
            }}>
              <span style={{ color: 'rgba(180, 210, 255, 0.40)', fontWeight: 600 }}>Goal: </span>
              {hoveredLevelData.winCondition === 'classic' && 'Solve the cube (match all face colors)'}
              {hoveredLevelData.winCondition === 'sudokube' && 'Solve Sudokube (no repeated numbers per face)'}
              {hoveredLevelData.winCondition === 'ultimate' && 'Solve Ultimate (colors + numbers)'}
            </div>
          </div>
        )}

        {/* Placeholder info when nothing hovered */}
        {!hoveredLevel && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            textAlign: 'center',
            minHeight: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: 'rgba(180, 210, 255, 0.45)',
            }}>
              Hover over a level to see details. Complete levels to unlock the next!
            </p>
          </div>
        )}

        {/* Progress */}
        <div style={{
          marginBottom: '20px',
          fontSize: '12px',
          color: 'rgba(200, 220, 255, 0.55)',
          fontWeight: 500,
        }}>
          Progress: {completedLevels.length} / {LEVELS.length} levels completed
          <div style={{
            marginTop: '8px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.10)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(completedLevels.length / LEVELS.length) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #22c55e, #4ade80)',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(200, 220, 255, 0.75)',
              fontSize: '15px',
              fontWeight: 600,
              padding: '10px 28px',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.target.style.background = 'rgba(255, 255, 255, 0.10)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.20)';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'rgba(255, 255, 255, 0.06)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            }}
          >
            Back
          </button>

          {/* Quick Start - first unlocked incomplete level */}
          {(() => {
            const nextLevel = LEVELS.find(l =>
              isLevelUnlocked(l.id, completedLevels) && !completedLevels.includes(l.id)
            );
            if (nextLevel && nextLevel.id !== 10) {
              return (
                <button
                  onClick={() => onSelectLevel(nextLevel.id)}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                    border: '1px solid rgba(59, 130, 246, 0.5)',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 600,
                    padding: '10px 28px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.28)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.42)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.28)';
                  }}
                >
                  Continue: Level {nextLevel.id}
                </button>
              );
            }
            return null;
          })()}

          <button
            onClick={() => onSelectLevel(10)}
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 600,
              padding: '10px 28px',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.35)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 30px rgba(139, 92, 246, 0.55)';
            }}
            onMouseLeave={e => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 20px rgba(139, 92, 246, 0.35)';
            }}
          >
            Black Hole
          </button>
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.98); }
        }
      `}</style>
    </div>
  );
};

export default LevelSelectScreen;
