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
      background: 'rgba(59, 130, 246, 0.3)',
      borderRadius: '3px',
      color: 'rgba(255, 255, 255, 0.7)'
    }}>
      {size}x{size}
    </span>
    {chaos > 0 && (
      <span style={{
        fontSize: '8px',
        padding: '1px 4px',
        background: `rgba(239, 68, 68, ${0.2 + chaos * 0.15})`,
        borderRadius: '3px',
        color: 'rgba(255, 255, 255, 0.7)'
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
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
      boxSizing: 'border-box'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '750px',
        width: '95%',
        padding: '32px',
        maxHeight: 'calc(100dvh - 40px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 2px 6px 2px rgba(60, 64, 67, 0.15), 0 8px 24px 4px rgba(60, 64, 67, 0.15)',
        border: '1px solid #e8eaed',
        boxSizing: 'border-box'
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
          fontFamily: '"Roboto", "Product Sans", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          letterSpacing: '0.02em'
        }}>Select Level</h1>

        <p style={{
          fontSize: '14px',
          color: '#5f6368',
          marginBottom: '24px',
          fontFamily: '"Roboto", "Product Sans", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
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
                      ? 'rgba(34, 197, 94, 0.15)'
                      : !isUnlocked
                        ? 'rgba(40, 45, 60, 0.4)'
                        : isHovered
                          ? 'rgba(59, 130, 246, 0.3)'
                          : 'rgba(50, 55, 70, 0.8)',
                  border: isBlackHole
                    ? '2px solid #8b5cf6'
                    : isCompleted
                      ? '2px solid rgba(34, 197, 94, 0.5)'
                      : !isUnlocked
                        ? '1px solid rgba(255, 255, 255, 0.05)'
                        : isHovered
                          ? '2px solid rgba(96, 165, 250, 0.8)'
                          : '1px solid rgba(255, 255, 255, 0.15)',
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
                      ? '0 0 15px rgba(34, 197, 94, 0.2)'
                      : isHovered && canPlay
                        ? '0 4px 20px rgba(59, 130, 246, 0.4)'
                        : 'none',
                  opacity: !isUnlocked ? 0.4 : 1,
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
                    opacity: 0.5
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
                      ? '#22c55e'
                      : !isUnlocked
                        ? 'rgba(255, 255, 255, 0.2)'
                        : '#fff',
                  fontFamily: '"Courier New", monospace',
                  textShadow: isBlackHole ? '0 0 10px #8b5cf6' : 'none'
                }}>
                  {isBlackHole ? '\u221E' : level.id}
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
              ? 'rgba(139, 92, 246, 0.08)'
              : 'rgba(59, 130, 246, 0.08)',
            border: `1px solid ${hoveredLevelData.id === 10 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
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
                color: hoveredLevelData.id === 10 ? '#c084fc' : '#60a5fa',
                fontFamily: '-apple-system, sans-serif'
              }}>
                {hoveredLevelData.id === 10 ? '∞' : hoveredLevelData.id}: {hoveredLevelData.name}
              </span>
              {completedLevels.includes(hoveredLevelData.id) && (
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  background: 'rgba(34, 197, 94, 0.2)',
                  borderRadius: '4px',
                  color: '#22c55e'
                }}>
                  COMPLETED
                </span>
              )}
              {!isLevelUnlocked(hoveredLevelData.id, completedLevels) && (
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  color: 'rgba(255, 255, 255, 0.5)'
                }}>
                  LOCKED - Complete Level {hoveredLevelData.id - 1}
                </span>
              )}
            </div>

            <p style={{
              margin: '0 0 10px 0',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontFamily: '-apple-system, sans-serif',
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
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginRight: '4px'
                    }}>
                      NEW:
                    </span>
                    {newFeatures.map((feat, i) => (
                      <span key={i} style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '4px',
                        color: '#4ade80'
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
              color: 'rgba(255, 255, 255, 0.5)'
            }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>Goal: </span>
              {hoveredLevelData.winCondition === 'classic' && 'Solve the cube (match all face colors)'}
              {hoveredLevelData.winCondition === 'sudokube' && 'Solve Sudokube (no repeated numbers per face)'}
              {hoveredLevelData.winCondition === 'ultimate' && 'Solve Ultimate (colors + numbers)'}
            </div>
          </div>
        )}

        {/* Placeholder info when nothing hovered */}
        {!hoveredLevel && (
          <div style={{
            background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
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
              color: 'rgba(255, 255, 255, 0.5)',
              fontFamily: '-apple-system, sans-serif'
            }}>
              Hover over a level to see details. Complete levels to unlock the next!
            </p>
          </div>
        )}

        {/* Progress */}
        <div style={{
          marginBottom: '20px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.4)'
        }}>
          Progress: {completedLevels.length} / {LEVELS.length} levels completed
          <div style={{
            marginTop: '8px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.1)',
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
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '15px',
              fontWeight: 500,
              padding: '10px 28px',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}
            onMouseEnter={e => {
              e.target.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'rgba(255, 255, 255, 0.08)';
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
                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.2s',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  }}
                  onMouseEnter={e => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.5)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.3)';
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
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
              transition: 'all 0.2s',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}
            onMouseEnter={e => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 30px rgba(139, 92, 246, 0.6)';
            }}
            onMouseLeave={e => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 20px rgba(139, 92, 246, 0.4)';
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
