import React, { useState } from 'react';

/**
 * Mobile-optimized floating controls for touch devices
 * Provides quick access to settings, help, and essential game controls
 */
const MobileControls = ({
  onShowSettings,
  onShowHelp,
  flipMode,
  onToggleFlip,
  exploded,
  onToggleExplode,
  showTunnels,
  onToggleTunnels,
  onShuffle,
  onReset,
  showNetPanel,
  onToggleNet,
  onRotateCW,
  onRotateCCW,
  onUndo,
  canUndo,
  undoCount,
  teachModeActive,
  onToggleTeachMode,
  cubeSize
}) => {
  const [expanded, setExpanded] = useState(false);

  const buttonStyle = {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(30, 35, 50, 0.9)',
    backdropFilter: 'blur(12px)',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    transition: 'all 0.15s ease',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation'
  };

  const _activeButtonStyle = {
    ...buttonStyle,
    background: 'rgba(59, 130, 246, 0.8)',
    borderColor: 'rgba(96, 165, 250, 0.5)'
  };

  const smallButtonStyle = {
    ...buttonStyle,
    width: '42px',
    height: '42px',
    fontSize: '14px'
  };

  const activeSmallButtonStyle = {
    ...smallButtonStyle,
    background: 'rgba(59, 130, 246, 0.8)',
    borderColor: 'rgba(96, 165, 250, 0.5)'
  };

  return (
    <>
      {/* Left side - Undo button (always visible when available) */}
      {canUndo && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
          left: '16px',
          zIndex: 500,
          pointerEvents: 'auto'
        }}>
          <button
            onClick={onUndo}
            style={{
              ...buttonStyle,
              width: '54px',
              height: '54px',
              fontSize: '22px',
              background: 'rgba(0, 217, 255, 0.2)',
              borderColor: 'rgba(0, 217, 255, 0.5)',
              boxShadow: '0 4px 20px rgba(0, 217, 255, 0.3)',
              position: 'relative'
            }}
            aria-label={`Undo last move (${undoCount} available)`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d9ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10h10a5 5 0 0 1 0 10H9"/>
              <polyline points="7 14 3 10 7 6"/>
            </svg>
            {undoCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: 'rgba(0, 217, 255, 0.9)',
                color: '#000',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '11px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {undoCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Right side - Settings FAB */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
        right: '16px',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        pointerEvents: 'auto'
      }}>
        {/* Expanded menu */}
        {expanded && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            animation: 'fadeInUp 0.2s ease'
          }}>
            {/* Help */}
            <button
              onClick={() => { onShowHelp(); setExpanded(false); }}
              style={smallButtonStyle}
              aria-label="Help"
            >
              ?
            </button>

            {/* CW rotation */}
            {onRotateCW && (
              <button
                onClick={onRotateCW}
                style={smallButtonStyle}
                aria-label="Rotate clockwise"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9"/>
                  <polyline points="21 3 21 12 12 12"/>
                </svg>
              </button>
            )}

            {/* CCW rotation */}
            {onRotateCCW && (
              <button
                onClick={onRotateCCW}
                style={smallButtonStyle}
                aria-label="Rotate counter-clockwise"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9"/>
                  <polyline points="3 3 3 12 12 12"/>
                </svg>
              </button>
            )}

            {/* Flip toggle */}
            <button
              onClick={onToggleFlip}
              style={flipMode ? activeSmallButtonStyle : smallButtonStyle}
              aria-label="Toggle flip mode"
            >
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.02em' }}>FLIP</span>
            </button>

            {/* Tunnels toggle */}
            <button
              onClick={onToggleTunnels}
              style={showTunnels ? activeSmallButtonStyle : smallButtonStyle}
              aria-label="Toggle tunnels"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M2 12h20"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </button>

            {/* Explode toggle */}
            <button
              onClick={onToggleExplode}
              style={exploded ? activeSmallButtonStyle : smallButtonStyle}
              aria-label="Toggle exploded view"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>

            {/* Net panel toggle */}
            <button
              onClick={onToggleNet}
              style={showNetPanel ? activeSmallButtonStyle : smallButtonStyle}
              aria-label="Toggle net view"
            >
              <span style={{ fontSize: '10px', fontWeight: 600 }}>NET</span>
            </button>

            {/* Teach mode toggle */}
            {cubeSize === 3 && (
              <button
                onClick={() => { onToggleTeachMode(); setExpanded(false); }}
                style={teachModeActive ? {
                  ...smallButtonStyle,
                  background: 'rgba(251, 191, 36, 0.8)',
                  borderColor: 'rgba(251, 191, 36, 0.5)',
                  color: '#000'
                } : smallButtonStyle}
                aria-label="Toggle teach mode"
              >
                <span style={{ fontSize: '9px', fontWeight: 700 }}>TEACH</span>
              </button>
            )}

            {/* Shuffle */}
            <button
              onClick={() => { onShuffle(); setExpanded(false); }}
              style={{
                ...smallButtonStyle,
                background: 'rgba(34, 197, 94, 0.8)',
                borderColor: 'rgba(74, 222, 128, 0.5)'
              }}
              aria-label="Shuffle"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 3 21 3 21 8"/>
                <line x1="4" y1="20" x2="21" y2="3"/>
                <polyline points="21 16 21 21 16 21"/>
                <line x1="15" y1="15" x2="21" y2="21"/>
                <line x1="4" y1="4" x2="9" y2="9"/>
              </svg>
            </button>

            {/* Reset */}
            <button
              onClick={() => { onReset(); setExpanded(false); }}
              style={{
                ...smallButtonStyle,
                background: 'rgba(100, 116, 139, 0.8)',
                borderColor: 'rgba(148, 163, 184, 0.5)'
              }}
              aria-label="Reset"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
          </div>
        )}

        {/* Settings button (main FAB) */}
        <button
          onClick={() => { onShowSettings(); setExpanded(false); }}
          style={{
            ...buttonStyle,
            width: '54px',
            height: '54px',
            fontSize: '22px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))',
            borderColor: 'rgba(96, 165, 250, 0.5)',
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)'
          }}
          aria-label="Settings"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* Toggle expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            ...buttonStyle,
            width: '40px',
            height: '40px',
            fontSize: '18px',
            background: 'rgba(50, 55, 70, 0.9)'
          }}
          aria-label={expanded ? "Close menu" : "Open menu"}
        >
          {expanded ? '×' : '☰'}
        </button>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

export default MobileControls;
