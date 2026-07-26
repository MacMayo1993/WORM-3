import React, { useState } from 'react';

const buttonStyle = {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  background: 'rgba(14, 17, 38, 0.92)',
  color: 'rgba(200, 220, 255, 0.80)',
  fontSize: '18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.40)',
  transition: 'all 0.15s ease',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation'
};

const smallButtonStyle = {
  ...buttonStyle,
  width: '42px',
  height: '42px',
  fontSize: '14px'
};

const activeSmallButtonStyle = {
  ...smallButtonStyle,
  background: 'rgba(59, 130, 246, 0.35)',
  borderColor: 'rgba(96, 165, 250, 0.55)'
};

const orbitButtonStyle = {
  ...smallButtonStyle,
  background: 'rgba(251, 191, 36, 0.15)',
  borderColor: 'rgba(251, 191, 36, 0.5)',
};

const shuffleButtonStyle = {
  ...smallButtonStyle,
  background: 'rgba(34, 197, 94, 0.8)',
  borderColor: 'rgba(74, 222, 128, 0.5)'
};

const resetButtonStyle = {
  ...smallButtonStyle,
  background: 'rgba(100, 116, 139, 0.8)',
  borderColor: 'rgba(148, 163, 184, 0.5)'
};

const undoButtonStyle = {
  ...buttonStyle,
  width: '54px',
  height: '54px',
  fontSize: '22px',
  background: 'rgba(0, 0, 0, 0.85)',
  borderColor: 'rgba(255, 255, 255, 0.25)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.40)',
  position: 'relative'
};

const toggleButtonStyle = {
  ...buttonStyle,
  width: '40px',
  height: '40px',
  fontSize: '18px',
};

const undoContainerStyle = {
  position: 'fixed',
  bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
  left: '16px',
  zIndex: 500,
  pointerEvents: 'auto'
};

// Docked below the 48dp top bar, on the right — the action menu opens downward.
const topRightContainerStyle = {
  position: 'fixed',
  top: 'calc(56px + env(safe-area-inset-top, 0px))',
  right: '12px',
  zIndex: 500,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
  pointerEvents: 'auto'
};

const expandedMenuStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  animation: 'fadeInDown 0.2s ease'
};

const flipLabelStyle = { fontSize: '10px', fontWeight: 600, letterSpacing: '0.02em' };
const teachLabelStyle = { fontSize: '9px', fontWeight: 700 };
const teachActiveButtonStyle = {
  ...smallButtonStyle,
  background: 'rgba(251, 191, 36, 0.8)',
  borderColor: 'rgba(251, 191, 36, 0.5)',
  color: '#000'
};

const undoBadgeStyle = {
  position: 'absolute',
  top: '-4px',
  right: '-4px',
  background: '#fff',
  color: '#000',
  borderRadius: '50%',
  width: '20px',
  height: '20px',
  fontSize: '11px',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const MobileControls = React.memo(({
  onShowHelp,
  flipMode,
  onToggleFlip,
  exploded,
  onToggleExplode,
  showTunnels,
  tunnelDetail,
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
  showUndo = true,
  teachModeActive,
  onToggleTeachMode,
  cubeSize,
  onOrbitCW,
  onOrbitCCW,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Left side - Undo button (hidden while a demo dialogue is presenting) */}
      {canUndo && showUndo && (
        <div style={undoContainerStyle}>
          <button
            onClick={onUndo}
            style={undoButtonStyle}
            aria-label={`Undo last move (${undoCount} available)`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10h10a5 5 0 0 1 0 10H9"/>
              <polyline points="7 14 3 10 7 6"/>
            </svg>
            {undoCount > 0 && (
              <span style={undoBadgeStyle}>
                {undoCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Top right - action menu (☰) docked under the top bar */}
      <div style={topRightContainerStyle}>
        {/* Toggle expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={toggleButtonStyle}
          aria-label={expanded ? "Close menu" : "Open menu"}
        >
          {expanded ? '×' : '☰'}
        </button>

        {/* Expanded menu */}
        {expanded && (
          <div style={expandedMenuStyle}>
            {/* Help */}
            <button
              onClick={() => { onShowHelp(); setExpanded(false); }}
              style={smallButtonStyle}
              aria-label="Help"
            >
              ?
            </button>

            {/* Orbit view left (CCW around Y axis) */}
            {onOrbitCCW && (
              <button
                onClick={onOrbitCCW}
                style={orbitButtonStyle}
                aria-label="Rotate view left"
                title="Rotate view left"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9"/>
                  <polyline points="3 3 3 12 12 12"/>
                  <circle cx="12" cy="12" r="2" fill="#fbbf24" stroke="none"/>
                </svg>
              </button>
            )}

            {/* Orbit view right (CW around Y axis) */}
            {onOrbitCW && (
              <button
                onClick={onOrbitCW}
                style={orbitButtonStyle}
                aria-label="Rotate view right"
                title="Rotate view right"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9"/>
                  <polyline points="21 3 21 12 12 12"/>
                  <circle cx="12" cy="12" r="2" fill="#fbbf24" stroke="none"/>
                </svg>
              </button>
            )}

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
              <span style={flipLabelStyle}>FLIP</span>
            </button>

            {/* Tunnels — three-state: Off → Hints → Full → Off. The ring around the
                hub thickens on Full so the current tier is readable at a glance. */}
            <button
              onClick={onToggleTunnels}
              style={showTunnels ? activeSmallButtonStyle : smallButtonStyle}
              aria-label={`Tunnels: ${showTunnels ? (tunnelDetail === 'full' ? 'full' : 'hints') : 'off'} — tap to cycle`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M2 12h20"/>
                <circle cx="12" cy="12" r="4" strokeWidth={showTunnels && tunnelDetail === 'full' ? 4 : 2} />
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
              <span style={flipLabelStyle}>NET</span>
            </button>

            {/* Teach mode toggle */}
            {cubeSize === 3 && (
              <button
                onClick={() => { onToggleTeachMode(); setExpanded(false); }}
                style={teachModeActive ? teachActiveButtonStyle : smallButtonStyle}
                aria-label="Toggle teach mode"
              >
                <span style={teachLabelStyle}>TEACH</span>
              </button>
            )}

            {/* Shuffle */}
            <button
              onClick={() => { onShuffle(); setExpanded(false); }}
              style={shuffleButtonStyle}
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
              style={resetButtonStyle}
              aria-label="Reset"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
          </div>
        )}

      </div>

      {/* Styles */}
      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
});

export default MobileControls;
