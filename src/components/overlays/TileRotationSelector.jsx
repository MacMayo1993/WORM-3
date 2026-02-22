import React from 'react';

/**
 * Tile Rotation Selector - Shows directional arrows when a tile is tapped
 * Allows user to choose rotation direction with a second tap
 */
const TileRotationSelector = ({ onRotate, onCancel, onRotateFaceCW, onRotateFaceCCW }) => {
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
    background: 'rgba(0, 0, 0, 0.2)'
  };

  const containerStyle = {
    position: 'relative',
    width: '200px',
    height: '200px',
    zIndex: 1,
    animation: 'rotationSelectorIn 0.15s ease-out'
  };

  const arrowButtonStyle = {
    position: 'absolute',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    transition: 'transform 0.1s ease, background 0.1s ease'
  };

  const faceButtonStyle = {
    ...arrowButtonStyle,
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(109, 40, 217, 0.9))',
    borderColor: 'rgba(167, 139, 250, 0.5)'
  };

  const centerStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '50px',
    height: '50px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.15)',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const arrowIconStyle = {
    width: '28px',
    height: '28px',
    color: 'white'
  };

  const smallIconStyle = {
    width: '22px',
    height: '22px',
    color: 'white'
  };

  const hintStyle = {
    position: 'absolute',
    bottom: '-40px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '12px',
    fontWeight: 500,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
  };

  return (
    <>
      <style>{`
        @keyframes rotationSelectorIn {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .rotation-arrow:active {
          transform: scale(0.95);
        }
      `}</style>
      <div style={overlayStyle}>
        <div style={backdropStyle} onClick={onCancel} />
        <div style={containerStyle}>
          {/* Up arrow */}
          <button
            className="rotation-arrow"
            style={{ ...arrowButtonStyle, top: '0', left: '50%', transform: 'translateX(-50%)' }}
            onClick={() => onRotate('up')}
            aria-label="Rotate up"
          >
            <svg style={arrowIconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
          </button>

          {/* Down arrow */}
          <button
            className="rotation-arrow"
            style={{ ...arrowButtonStyle, bottom: '0', left: '50%', transform: 'translateX(-50%)' }}
            onClick={() => onRotate('down')}
            aria-label="Rotate down"
          >
            <svg style={arrowIconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </button>

          {/* Left arrow */}
          <button
            className="rotation-arrow"
            style={{ ...arrowButtonStyle, left: '0', top: '50%', transform: 'translateY(-50%)' }}
            onClick={() => onRotate('left')}
            aria-label="Rotate left"
          >
            <svg style={arrowIconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>

          {/* Right arrow */}
          <button
            className="rotation-arrow"
            style={{ ...arrowButtonStyle, right: '0', top: '50%', transform: 'translateY(-50%)' }}
            onClick={() => onRotate('right')}
            aria-label="Rotate right"
          >
            <svg style={arrowIconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          {/* CCW face rotation (top-left) */}
          <button
            className="rotation-arrow"
            style={{ ...faceButtonStyle, top: '20px', left: '20px' }}
            onClick={onRotateFaceCCW}
            aria-label="Rotate face counter-clockwise"
          >
            <svg style={smallIconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9"/>
              <polyline points="3 3 3 12 12 12"/>
            </svg>
          </button>

          {/* CW face rotation (top-right) */}
          <button
            className="rotation-arrow"
            style={{ ...faceButtonStyle, top: '20px', right: '20px' }}
            onClick={onRotateFaceCW}
            aria-label="Rotate face clockwise"
          >
            <svg style={smallIconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9"/>
              <polyline points="21 3 21 12 12 12"/>
            </svg>
          </button>

          {/* Center indicator */}
          <div style={centerStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </div>

          <div style={hintStyle}>
            Tap direction to rotate
          </div>
        </div>
      </div>
    </>
  );
};

export default TileRotationSelector;
