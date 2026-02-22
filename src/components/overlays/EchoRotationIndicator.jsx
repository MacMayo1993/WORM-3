/**
 * EchoRotationIndicator.jsx
 *
 * Visual indicator for echo (antipodal) rotations.
 * Displays a colored overlay on the rotating layer to show it's automatic.
 */

import React, { useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';

export default function EchoRotationIndicator() {
  const animState = useGameStore((state) => state.animState);
  const size = useGameStore((state) => state.size);

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

  return (
    <div
      style={{
        position: 'fixed',
        ...sliceInfo.position,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: `${color}20`,
        border: `2px solid ${color}`,
        borderRadius: '20px',
        backdropFilter: 'blur(8px)',
        animation: 'pulse 1s infinite',
      }}
    >
      {/* Pulsing indicator */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 10px ${color}`,
          animation: 'pulse 0.8s infinite',
        }}
      />

      {/* Label */}
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: color,
          fontFamily: "'Courier New', monospace",
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
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
