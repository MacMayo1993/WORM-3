/**
 * AntipodalModeHUD.jsx
 *
 * HUD overlay for Antipodal Mode (Mirror Quotient)
 * Displays echo sync percentage and reversal count
 */

import React, { useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { calculateEchoSync } from '../../game/antipodalMode.js';
import { UI_FONT, GLASS_PANEL_DEEP, GLASS_PANEL_BORDER } from '../../utils/uiTheme.js';

// ─── Static style constants ───────────────────────────────────────────────────
const CONTAINER_STYLE = {
  position: 'fixed',
  bottom: '80px',
  right: '16px',
  background: GLASS_PANEL_DEEP,
  border: '1px solid rgba(59, 130, 246, 0.6)',
  borderRadius: '8px',
  padding: '12px 16px',
  color: '#e5e7eb',
  fontFamily: UI_FONT,
  fontSize: '12px',
  zIndex: 200,
  backdropFilter: 'blur(8px)',
  minWidth: '180px',
  userSelect: 'none',
};

const HEADER_STYLE = {
  fontWeight: 'bold',
  color: '#3b82f6',
  letterSpacing: '0.1em',
  marginBottom: '8px',
  textAlign: 'center',
  fontSize: '11px',
};

const ECHO_SYNC_SECTION_STYLE = { marginBottom: '8px' };

const SYNC_ROW_STYLE = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '4px',
};

const SYNC_LABEL_STYLE = { fontSize: '10px', color: '#9ca3af' };

const PROGRESS_TRACK_STYLE = {
  height: '6px',
  background: '#1f2937',
  borderRadius: '3px',
  overflow: 'hidden',
};

const REVERSAL_ROW_STYLE = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '8px',
  borderTop: `1px solid ${GLASS_PANEL_BORDER}`,
};

const REVERSAL_LABEL_STYLE = { fontSize: '10px', color: '#9ca3af' };

const REVERSAL_VALUE_STYLE = { fontSize: '16px', fontWeight: 'bold', color: '#60a5fa' };

const ECHO_ACTIVE_SECTION_STYLE = {
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: `1px solid ${GLASS_PANEL_BORDER}`,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '10px',
  color: '#fbbf24',
};

const ECHO_DOT_STYLE = {
  width: '8px',
  height: '8px',
  background: '#fbbf24',
  borderRadius: '50%',
  animation: 'pulse 1s infinite',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function AntipodalModeHUD() {
  const { antipodalMode, reversalCount, moves, pendingEchoRotations } = useGameStore(
    useShallow(state => ({
      antipodalMode: state.antipodalMode,
      reversalCount: state.reversalCount,
      moves: state.moves,
      pendingEchoRotations: state.pendingEchoRotations,
    }))
  );

  const echoSync = useMemo(() => {
    return calculateEchoSync(moves, reversalCount);
  }, [moves, reversalCount]);

  // Color based on sync percentage (must be before hooks that depend on it)
  const syncColor = echoSync >= 90 ? '#22c55e' : echoSync >= 70 ? '#fbbf24' : '#ef4444';

  const syncValueStyle = useMemo(
    () => ({ fontSize: '16px', fontWeight: 'bold', color: syncColor }),
    [syncColor]
  );

  const progressFillStyle = useMemo(
    () => ({ height: '100%', width: `${echoSync}%`, background: syncColor, transition: 'all 0.3s ease' }),
    [echoSync, syncColor]
  );

  if (!antipodalMode) {
    return null;
  }

  return (
    <div style={CONTAINER_STYLE}>
      {/* Header */}
      <div style={HEADER_STYLE}>
        ANTIPODAL MODE
      </div>

      {/* Echo Sync */}
      <div style={ECHO_SYNC_SECTION_STYLE}>
        <div style={SYNC_ROW_STYLE}>
          <span style={SYNC_LABEL_STYLE}>Echo Sync:</span>
          <span style={syncValueStyle}>
            {echoSync}%
          </span>
        </div>
        {/* Progress bar */}
        <div style={PROGRESS_TRACK_STYLE}>
          <div style={progressFillStyle} />
        </div>
      </div>

      {/* Reversal Count */}
      <div style={REVERSAL_ROW_STYLE}>
        <span style={REVERSAL_LABEL_STYLE}>Reversals:</span>
        <span style={REVERSAL_VALUE_STYLE}>
          {reversalCount}
        </span>
      </div>

      {/* Active Echo Indicator */}
      {pendingEchoRotations.length > 0 && (
        <div style={ECHO_ACTIVE_SECTION_STYLE}>
          <div style={ECHO_DOT_STYLE} />
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
