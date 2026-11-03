import React, { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import './mobileControls.css';
import { Z, NIGHT_SHEET, NIGHT_BORDER, NIGHT_TEXT, TEXT_XS } from '../../utils/uiTheme.js';

const buttonStyle = {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  border: `1px solid ${NIGHT_BORDER}`,
  background: NIGHT_SHEET,
  color: NIGHT_TEXT,
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

// 44px is the minimum comfortable tap target — keep the glyph small via fontSize
// but never shrink the hit area below it.
const smallButtonStyle = {
  ...buttonStyle,
  width: '100%',
  minHeight: '52px',
  height: 'auto',
  borderRadius: '12px',
  padding: '8px',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '14px'
};

const activeSmallButtonStyle = {
  ...smallButtonStyle,
  background: '#dcecff',
  borderColor: 'rgba(96, 165, 250, 0.55)'
};

const flipOffButtonStyle = { ...smallButtonStyle, background: '#ffffff', color: '#1a1410' };
const flipOnButtonStyle = { ...flipOffButtonStyle, background: '#FFD500' };

const orbitButtonStyle = {
  ...smallButtonStyle,
  background: '#fff0bd',
  borderColor: 'rgba(251, 191, 36, 0.5)',
};

const shuffleButtonStyle = {
  ...smallButtonStyle,
  background: 'rgba(34, 197, 94, 0.8)',
  borderColor: 'rgba(74, 222, 128, 0.5)'
};

const resetButtonStyle = {
  ...smallButtonStyle,
  background: '#e2e8f0',
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
  width: '44px',
  height: '44px',
  fontSize: '18px',
};

const undoContainerStyle = {
  position: 'fixed',
  bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
  left: '16px',
  zIndex: Z.CONTROLS,
  pointerEvents: 'auto'
};

const flipLabelStyle = { fontSize: '10px', fontWeight: 600, letterSpacing: '0.02em' };
const teachLabelStyle = { fontSize: TEXT_XS, fontWeight: 700 };
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
  // The session menu hosts this launcher; bar-less screens use a floating key.
  actionSlot,
}) => {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef(null);
  const toggleRef = useRef(null);
  const panelId = useId();
  const restoreFocus = () => {
    const toggle = toggleRef.current;
    const details = toggle?.closest('details');
    // The launcher can live inside a session menu that closes when activated.
    (details && !details.open ? details.querySelector('summary') : toggle)?.focus();
  };
  const dismiss = () => { setExpanded(false); restoreFocus(); };

  useEffect(() => {
    if (!expanded) return undefined;
    panelRef.current?.querySelector('button')?.focus();
    const onKeyDown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setExpanded(false);
      restoreFocus();
    };
    const onPointerDown = event => {
      if (!panelRef.current?.contains(event.target) && !toggleRef.current?.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [expanded]);

  // Sized and coloured to match the bar's other icon buttons when docked there.
  const toggleButton = (
    <button
      ref={toggleRef}
      type="button"
      onClick={() => setExpanded(value => !value)}
      className={actionSlot ? 'top-bar-icon-btn' : undefined}
      style={actionSlot ? { fontSize: '18px', lineHeight: 1 } : toggleButtonStyle}
      aria-label={expanded ? 'Close menu' : 'Open menu'}
      aria-expanded={expanded}
      aria-controls={expanded ? panelId : undefined}
      title={expanded ? 'Close menu' : 'More actions'}
    >
      {expanded ? '×' : '☰'}
    </button>
  );

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

      {/* The session menu hosts the action launcher when available. */}
      {actionSlot && createPortal(toggleButton, actionSlot)}

      {/* Keep the sheet near the launcher and out of the thumb controls. */}
      <div className="mobile-actions-anchor" style={{ zIndex: Z.CONTROLS }}>
        {!actionSlot && toggleButton}

        {/* Expanded menu */}
        {expanded && (
          <section ref={panelRef} id={panelId} className="mobile-actions-sheet" aria-label="Cube actions">
            <div className="mobile-actions-heading">
              <strong>Cube actions</strong>
              <button type="button" onClick={dismiss} aria-label="Close cube actions">×</button>
            </div>
            <div className="mobile-actions-grid">
              {/* Help */}
              <button
                onClick={() => { onShowHelp(); setExpanded(false); }}
                style={smallButtonStyle}
                aria-label="Help"
              >
                ?
                <span className="mobile-action-label">Help</span>
              </button>

              {/* Orbit view left (CCW around Y axis) */}
              {onOrbitCCW && (
                <button
                  onClick={onOrbitCCW}
                  style={orbitButtonStyle}
                  aria-label="Rotate view left"
                  title="Rotate view left"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9"/>
                    <polyline points="3 3 3 12 12 12"/>
                    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
                  </svg>
                  <span className="mobile-action-label">View left</span>
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9"/>
                    <polyline points="21 3 21 12 12 12"/>
                    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
                  </svg>
                  <span className="mobile-action-label">View right</span>
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
                  <span className="mobile-action-label">Turn right</span>
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
                  <span className="mobile-action-label">Turn left</span>
                </button>
              )}

              {/* Flip toggle */}
              <button
                onClick={onToggleFlip}
                style={flipMode ? flipOnButtonStyle : flipOffButtonStyle}
                aria-label="Toggle flip mode"
                aria-pressed={flipMode}
              >
                <span style={flipLabelStyle} aria-hidden="true">↔</span>
                <span className="mobile-action-label">Flip mode</span>
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
                <span className="mobile-action-label">Tunnels: {showTunnels ? (tunnelDetail === 'full' ? 'Full' : 'Hints') : 'Off'}</span>
              </button>

              {/* Explode toggle */}
              <button
                onClick={onToggleExplode}
                style={exploded ? activeSmallButtonStyle : smallButtonStyle}
                aria-label="Toggle exploded view"
                aria-pressed={exploded}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                </svg>
                <span className="mobile-action-label">Exploded view</span>
              </button>

              {/* Net panel toggle */}
              <button
                onClick={onToggleNet}
                style={showNetPanel ? activeSmallButtonStyle : smallButtonStyle}
                aria-label="Toggle net view"
                aria-pressed={showNetPanel}
              >
                <span style={flipLabelStyle}>NET</span>
                <span className="mobile-action-label">Net view</span>
              </button>

              {/* Teach mode toggle */}
              {cubeSize === 3 && (
                <button
                  onClick={() => { onToggleTeachMode(); setExpanded(false); }}
                  style={teachModeActive ? teachActiveButtonStyle : smallButtonStyle}
                  aria-label="Toggle teach mode"
                  aria-pressed={teachModeActive}
                >
                  <span style={teachLabelStyle}>Teach</span>
                  <span className="mobile-action-label">Teach mode</span>
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
                <span className="mobile-action-label">Shuffle</span>
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
                <span className="mobile-action-label">Reset</span>
              </button>
            </div>
          </section>
        )}

      </div>

    </>
  );
});

export default MobileControls;
