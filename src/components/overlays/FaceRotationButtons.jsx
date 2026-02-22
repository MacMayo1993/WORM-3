import React from 'react';

/**
 * Face Rotation Buttons - Appears on long-press to allow CW/CCW face rotation
 * Shows two large buttons for rotating the selected face
 */
const FaceRotationButtons = ({ onRotateCW, onRotateCCW, onCancel }) => {
  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    pointerEvents: 'auto'
  };

  const backdropStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(2px)'
  };

  const containerStyle = {
    display: 'flex',
    gap: '24px',
    zIndex: 1,
    animation: 'faceRotateIn 0.2s ease-out'
  };

  const buttonBaseStyle = {
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
    touchAction: 'manipulation'
  };

  const ccwButtonStyle = {
    ...buttonBaseStyle,
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))',
    borderColor: 'rgba(96, 165, 250, 0.5)'
  };

  const cwButtonStyle = {
    ...buttonBaseStyle,
    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))',
    borderColor: 'rgba(74, 222, 128, 0.5)'
  };

  const iconStyle = {
    width: '32px',
    height: '32px',
    color: 'white'
  };

  const labelStyle = {
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: '4px',
    letterSpacing: '0.05em'
  };

  const hintStyle = {
    position: 'absolute',
    bottom: '120px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '14px',
    fontWeight: 500,
    textAlign: 'center',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
  };

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
      <div style={overlayStyle}>
        <div style={backdropStyle} onClick={onCancel} />
        <div style={hintStyle}>Rotate Face</div>
        <div style={containerStyle}>
          <button
            style={ccwButtonStyle}
            onClick={onRotateCCW}
            aria-label="Rotate counter-clockwise"
          >
            <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9"/>
              <polyline points="3 3 3 12 12 12"/>
            </svg>
            <span style={labelStyle}>CCW</span>
          </button>
          <button
            style={cwButtonStyle}
            onClick={onRotateCW}
            aria-label="Rotate clockwise"
          >
            <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9"/>
              <polyline points="21 3 21 12 12 12"/>
            </svg>
            <span style={labelStyle}>CW</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default FaceRotationButtons;
