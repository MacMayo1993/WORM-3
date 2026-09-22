import React, { useEffect } from 'react';
import { Z } from '../../utils/uiTheme.js';

/**
 * Face Rotation Buttons - Appears on long-press to allow CW/CCW face rotation
 * Shows two large buttons for rotating the selected face
 */

// ─── Static style constants (module scope avoids per-render allocation) ────────
const OVERLAY_STYLE = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: Z.MODAL,
  pointerEvents: 'auto',
};

const BACKDROP_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.3)',
  backdropFilter: 'blur(2px)',
};

const CONTAINER_STYLE = {
  display: 'flex',
  gap: '24px',
  zIndex: 1,
  animation: 'faceRotateIn 0.2s ease-out',
};

const BUTTON_BASE_STYLE = {
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  border: '2px solid rgba(255, 255, 255, 0.3)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
};

const CCW_BUTTON_STYLE = {
  ...BUTTON_BASE_STYLE,
  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))',
  borderColor: 'rgba(96, 165, 250, 0.5)',
};

const CW_BUTTON_STYLE = {
  ...BUTTON_BASE_STYLE,
  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))',
  borderColor: 'rgba(74, 222, 128, 0.5)',
};

const ICON_STYLE = {
  width: '32px',
  height: '32px',
  color: 'white',
};

const LABEL_STYLE = {
  fontSize: '10px',
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.9)',
  marginTop: '4px',
  letterSpacing: '0.05em',
};

const HINT_STYLE = {
  position: 'absolute',
  bottom: '120px',
  left: '50%',
  transform: 'translateX(-50%)',
  color: 'rgba(255, 255, 255, 0.8)',
  fontSize: '14px',
  fontWeight: 500,
  textAlign: 'center',
  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
};

// ─── Component ────────────────────────────────────────────────────────────────
const FaceRotationButtons = ({ onRotateCW, onRotateCCW, onCancel }) => {
  // The dismiss affordance is a pointer-only backdrop; give keyboard users the
  // same escape hatch so the modal is not a trap once it has focus.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <>
      <style>{`
        @keyframes faceRotateIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      <div style={OVERLAY_STYLE}>
        <div style={BACKDROP_STYLE} onClick={onCancel} />
        <div style={HINT_STYLE}>Rotate Face</div>
        <div style={CONTAINER_STYLE}>
          <button
            style={CCW_BUTTON_STYLE}
            onClick={onRotateCCW}
            aria-label="Rotate counter-clockwise"
          >
            <svg style={ICON_STYLE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9"/>
              <polyline points="3 3 3 12 12 12"/>
            </svg>
            <span style={LABEL_STYLE}>CCW</span>
          </button>
          <button
            style={CW_BUTTON_STYLE}
            onClick={onRotateCW}
            aria-label="Rotate clockwise"
          >
            <svg style={ICON_STYLE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9"/>
              <polyline points="21 3 21 12 12 12"/>
            </svg>
            <span style={LABEL_STYLE}>CW</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default FaceRotationButtons;
