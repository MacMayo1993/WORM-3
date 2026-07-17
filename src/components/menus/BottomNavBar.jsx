import React, { useState, useCallback } from 'react';
import { vibrate } from '../../utils/audio.js';

// Classic Rubik's face colours
const COLORS = {
  red:    '#C41E3A',
  green:  '#009B48',
  blue:   '#0051A2',
  orange: '#FF5800',
  yellow: '#FFD500',
  white:  '#F0F0F0',
};

const SPOTLIGHT_STYLE_ID = 'worm3-nav-spotlight-style';

const ensureSpotlightStyle = () => {
  if (typeof document === 'undefined' || document.getElementById(SPOTLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SPOTLIGHT_STYLE_ID;
  style.textContent = `
    @keyframes cube-tile-spotlight-pulse {
      0%, 100% { box-shadow: 0 0 0 3px rgba(255, 216, 110, 0.85), 0 0 18px 6px rgba(255, 200, 60, 0.55); opacity: 1; }
      50% { box-shadow: 0 0 0 7px rgba(255, 216, 110, 0.35), 0 0 30px 14px rgba(255, 200, 60, 0.30); opacity: 0.8; }
    }
    .cube-tile-spotlight-halo {
      position: absolute;
      inset: -4px;
      border-radius: 12px;
      pointer-events: none;
      animation: cube-tile-spotlight-pulse 1.2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
};

function CubeTile({ color, label, onClick, size = 42, elevated = false, lit = false, spotlight = false }) {
  const [pressed, setPressed] = useState(false);
  if (spotlight) ensureSpotlightStyle();

  const handlePress = useCallback(() => {
    setPressed(true);
  }, []);

  const handleRelease = useCallback(() => {
    setPressed(false);
  }, []);

  const handleClick = useCallback(() => {
    vibrate(12);
    onClick?.();
  }, [onClick]);

  const depth = pressed ? 1 : 5;
  const translateY = pressed ? 4 : 0;

  return (
    <button
      className="cube-tile-btn"
      style={{ '--tile-size': `${size}px`, marginTop: elevated ? -10 : 0 }}
      onPointerDown={handlePress}
      onPointerUp={handleRelease}
      onPointerLeave={handleRelease}
      onClick={handleClick}
    >
      <div
        className="cube-tile-face"
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.16),
          background: `radial-gradient(ellipse at 38% 28%, rgba(255,255,255,${lit ? 0.45 : 0.22}) 0%, rgba(255,255,255,0) 65%), ${color}`,
          border: `${Math.max(2, Math.round(size * 0.065))}px solid rgba(0,0,0,0.82)`,
          boxShadow: pressed
            ? `inset 0 3px 7px rgba(0,0,0,0.45), 0 ${depth}px 0 rgba(0,0,0,0.55)`
            : `0 ${depth}px 0 rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.18)${lit ? `, 0 0 10px 3px rgba(255,255,255,0.2)` : ''}`,
          transform: `translateY(${translateY}px)`,
          transition: 'transform 0.06s ease, box-shadow 0.06s ease',
          flexShrink: 0,
        }}
      >
        {spotlight && <div className="cube-tile-spotlight-halo" style={{ borderRadius: Math.round(size * 0.16) + 4 }} />}
      </div>
      <span className="cube-tile-label" style={{ color: lit ? '#fff' : undefined }}>
        {label}
      </span>
    </button>
  );
}

const BottomNavBar = ({
  onReset,
  onShuffle,
  solveModeActive,
  teachModeActive,
  onToggleSolve,
  onToggleTeach,
  hasActiveView,
  onToggleViews,
  onToggleMore,
  moreOpen,
  viewsOpen,
  chaosMode,
  spotlightViews = false,
}) => {
  const centralState = solveModeActive ? 'solve' : teachModeActive ? 'teach' : 'idle';

  const handleCentralTap = useCallback(() => {
    if (centralState === 'idle') onToggleSolve();
    else if (centralState === 'solve') { onToggleSolve(); onToggleTeach(); }
    else onToggleTeach();
  }, [centralState, onToggleSolve, onToggleTeach]);

  return (
    <div className="bottom-nav-bar">
      <CubeTile color={COLORS.red}    label="Reset"   onClick={onReset} />
      {!chaosMode && (
        <CubeTile color={COLORS.green} label="Shuffle" onClick={onShuffle} />
      )}
      <CubeTile
        color={centralState === 'teach' ? COLORS.yellow : COLORS.blue}
        label={centralState === 'teach' ? 'Teach' : 'Solve'}
        onClick={handleCentralTap}
        size={50}
        elevated
        lit={centralState !== 'idle'}
      />
      <CubeTile
        color={COLORS.orange}
        label="Views"
        onClick={onToggleViews}
        lit={viewsOpen || hasActiveView}
        spotlight={spotlightViews}
      />
      <CubeTile
        color={COLORS.white}
        label="More"
        onClick={onToggleMore}
        lit={moreOpen}
      />
    </div>
  );
};

export default BottomNavBar;
