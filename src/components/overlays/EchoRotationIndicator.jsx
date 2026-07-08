/**
 * EchoRotationIndicator.jsx
 *
 * Visual indicator for echo (antipodal) rotations.
 * Displays a colored overlay on the rotating layer to show it's automatic.
 */

import React, { useMemo } from 'react';
import { MONO_FONT } from '../../utils/uiTheme.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';

// ─── Static style constants ───────────────────────────────────────────────────
const BASE_INDICATOR_STYLE = {
  position: 'fixed',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
  zIndex: 150,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  borderRadius: '20px',
  backdropFilter: 'blur(8px)',
  animation: 'pulse 1s infinite',
};

const DOT_BASE_STYLE = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  animation: 'pulse 0.8s infinite',
};

const LABEL_BASE_STYLE = {
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: MONO_FONT,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

export default function EchoRotationIndicator() {
  const { animState, size } = useGameStore(
    useShallow(state => ({ animState: state.animState, size: state.size }))
  );

  // Calculate position based on axis and slice (must be called unconditionally)
  const sliceInfo = useMemo(() => {
    if (!animState || !animState.isEcho) {
      return null;
    }

    const { axis, sliceIndex } = animState;
    const k = (size - 1) / 2;
    const offset = sliceIndex - k;

    let label = '';
    let position = {};

    switch (axis) {
      case 'row': // Y-axis
        label = sliceIndex === 0 ? 'Bottom' : sliceIndex === size - 1 ? 'Top' : 'Middle';
        position = { top: `calc(50% - ${offset * 33}%)` };
        break;
      case 'col': // X-axis
        label = sliceIndex === 0 ? 'Left' : sliceIndex === size - 1 ? 'Right' : 'Middle';
        position = { left: `calc(50% + ${offset * 33}%)` };
        break;
      case 'depth': // Z-axis
        label = sliceIndex === 0 ? 'Back' : sliceIndex === size - 1 ? 'Front' : 'Middle';
        position = { bottom: '20%' };
        break;
      default:
        return null;
    }

    return { label, position, axis };
  }, [animState, size]);

  // Early return after all hooks
  if (!sliceInfo) {
    return null;
  }

  // Color based on axis (matching the tether colors)
  const color = sliceInfo.axis === 'col' ? '#22c55e' : sliceInfo.axis === 'row' ? '#3b82f6' : '#ef4444';

  const indicatorStyle = {
    ...BASE_INDICATOR_STYLE,
    ...sliceInfo.position,
    background: `${color}20`,
    border: `2px solid ${color}`,
  };

  const dotStyle = { ...DOT_BASE_STYLE, background: color, boxShadow: `0 0 10px ${color}` };
  const labelStyle = { ...LABEL_BASE_STYLE, color };

  return (
    <div style={indicatorStyle}>
      {/* Pulsing indicator */}
      <div style={dotStyle} />

      {/* Label */}
      <span style={labelStyle}>
        Echo: {sliceInfo.label}
      </span>

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}
