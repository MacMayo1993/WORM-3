import React from 'react';
import { getNewFeatures } from '../../utils/levels.js';

/**
 * Level Tutorial Overlay
 * Shows when starting a new level to explain the mechanics
 */
const LevelTutorial = ({ level, onClose }) => {
  if (!level || !level.tutorial) return null;

  const { tutorial } = level;
  const newFeatures = getNewFeatures(level.id);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        background: 'rgba(30, 35, 50, 0.95)',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        textAlign: 'center'
      }}>
        {/* Level Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          padding: '6px 16px',
          background: level.id === 10
            ? 'rgba(139, 92, 246, 0.2)'
            : 'rgba(59, 130, 246, 0.2)',
          borderRadius: '20px',
          border: `1px solid ${level.id === 10 ? 'rgba(139, 92, 246, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: 600,
            color: level.id === 10 ? '#c084fc' : '#60a5fa',
            fontFamily: '"Courier New", monospace'
          }}>
            LEVEL {level.id === 10 ? '∞' : level.id}
          </span>
          <span style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.7)'
          }}>
            {level.name}
          </span>
        </div>

        {/* Tutorial Title */}
        <h2 style={{
          fontSize: 'clamp(22px, 5vw, 28px)',
          fontWeight: 700,
          margin: '0 0 16px 0',
          color: '#fff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
          {tutorial.title}
        </h2>

        {/* Tutorial Text */}
        <p style={{
          fontSize: '15px',
          color: 'rgba(255, 255, 255, 0.8)',
          lineHeight: 1.7,
          margin: '0 0 20px 0',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
          {tutorial.text}
        </p>

        {/* New Features */}
        {newFeatures.length > 0 && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#4ade80',
              marginBottom: '8px',
              fontWeight: 600,
              letterSpacing: '0.1em'
            }}>
              NEW FEATURES UNLOCKED
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              justifyContent: 'center'
            }}>
              {newFeatures.map((feat, i) => (
                <span key={i} style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '6px',
                  color: '#4ade80'
                }}>
                  {feat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tip */}
        {tutorial.tip && (
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '24px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#fbbf24',
              marginBottom: '4px',
              fontWeight: 600
            }}>
              TIP
            </div>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontStyle: 'italic'
            }}>
              {tutorial.tip}
            </p>
          </div>
        )}

        {/* Level Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          marginBottom: '24px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.5)'
        }}>
          <div>
            <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>Size: </span>
            <span style={{ color: '#60a5fa' }}>{level.cubeSize}×{level.cubeSize}</span>
          </div>
          <div>
            <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>Chaos: </span>
            <span style={{ color: level.chaosLevel > 0 ? '#ef4444' : '#22c55e' }}>
              {level.chaosLevel > 0 ? `Level ${level.chaosLevel}` : 'Off'}
            </span>
          </div>
          <div>
            <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>Mode: </span>
            <span style={{ color: '#a78bfa' }}>
              {level.mode.charAt(0).toUpperCase() + level.mode.slice(1)}
            </span>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={onClose}
          style={{
            background: level.id === 10
              ? 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)'
              : 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
            border: 'none',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 600,
            padding: '14px 40px',
            borderRadius: '10px',
            cursor: 'pointer',
            boxShadow: level.id === 10
              ? '0 4px 20px rgba(139, 92, 246, 0.4)'
              : '0 4px 20px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}
          onMouseEnter={e => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = level.id === 10
              ? '0 8px 30px rgba(139, 92, 246, 0.6)'
              : '0 8px 30px rgba(59, 130, 246, 0.5)';
          }}
          onMouseLeave={e => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = level.id === 10
              ? '0 4px 20px rgba(139, 92, 246, 0.4)'
              : '0 4px 20px rgba(59, 130, 246, 0.3)';
          }}
        >
          Got it! Start Level
        </button>

        {/* Keyboard hint */}
        <div style={{
          marginTop: '16px',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.3)'
        }}>
          Press <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>SPACE</span> or <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>ENTER</span> to continue
        </div>
      </div>
    </div>
  );
};

export default LevelTutorial;
