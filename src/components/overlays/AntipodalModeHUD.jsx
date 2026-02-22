/**
 * AntipodalModeHUD.jsx
 *
 * HUD overlay for Antipodal Mode (Mirror Quotient)
 * Displays echo sync percentage and reversal count
 */

import React, { useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { calculateEchoSync } from '../../game/antipodalMode.js';

export default function AntipodalModeHUD() {
  const antipodalMode = useGameStore((state) => state.antipodalMode);
  const reversalCount = useGameStore((state) => state.reversalCount);
  const moves = useGameStore((state) => state.moves);
  const pendingEchoRotations = useGameStore((state) => state.pendingEchoRotations);

  const echoSync = useMemo(() => {
    return calculateEchoSync(moves, reversalCount);
  }, [moves, reversalCount]);

  if (!antipodalMode) {
    return null;
  }

  // Color based on sync percentage
  const syncColor = echoSync >= 90 ? '#22c55e' : echoSync >= 70 ? '#fbbf24' : '#ef4444';

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '16px',
      background: 'rgba(0, 0, 0, 0.85)',
      border: '1px solid rgba(59, 130, 246, 0.6)',
      borderRadius: '8px',
      padding: '12px 16px',
      color: '#e5e7eb',
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      zIndex: 200,
      backdropFilter: 'blur(8px)',
      minWidth: '180px',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        fontWeight: 'bold',
        color: '#3b82f6',
        letterSpacing: '0.1em',
        marginBottom: '8px',
        textAlign: 'center',
        fontSize: '11px'
      }}>
        ANTIPODAL MODE
      </div>

      {/* Echo Sync */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px'
        }}>
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>Echo Sync:</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: syncColor }}>
            {echoSync}%
          </span>
        </div>
        {/* Progress bar */}
        <div style={{
          height: '6px',
          background: '#1f2937',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${echoSync}%`,
            background: syncColor,
            transition: 'all 0.3s ease'
          }} />
        </div>
      </div>

      {/* Reversal Count */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '8px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <span style={{ fontSize: '10px', color: '#9ca3af' }}>Reversals:</span>
        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#60a5fa' }}>
          {reversalCount}
        </span>
      </div>

      {/* Active Echo Indicator */}
      {pendingEchoRotations.length > 0 && (
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '10px',
          color: '#fbbf24'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            background: '#fbbf24',
            borderRadius: '50%',
            animation: 'pulse 1s infinite'
          }} />
          <span>
            {pendingEchoRotations.length} echo{pendingEchoRotations.length > 1 ? 'es' : ''} pending
          </span>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
