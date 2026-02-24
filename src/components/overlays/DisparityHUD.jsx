import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';

const NOTIFICATION_LIFETIME = 7000; // ms before a RIP entry fades out
const MAX_VISIBLE = 8;              // max simultaneous RIP lines shown

/**
 * DisparityHUD
 *
 * Shows a stack of "RIP M1-003 — #6" death notifications as tiles burn out
 * at FLIP_CAP, and a gold winner banner when the last tile survives.
 *
 * Rendered whenever Disparity Mode (chaos) is active.
 */
const DisparityHUD = () => {
  const disparityDeaths = useGameStore((s) => s.disparityDeaths);
  const disparityWinner = useGameStore((s) => s.disparityWinner);

  const [visibleIds, setVisibleIds] = useState(new Set());

  // When a new death arrives, mark it visible and schedule its removal
  useEffect(() => {
    if (!disparityDeaths.length) { setVisibleIds(new Set()); return; }
    const latest = disparityDeaths[disparityDeaths.length - 1];
    setVisibleIds((prev) => new Set([...prev, latest.id]));
    const timer = setTimeout(() => {
      setVisibleIds((prev) => { const next = new Set(prev); next.delete(latest.id); return next; });
    }, NOTIFICATION_LIFETIME);
    return () => clearTimeout(timer);
  }, [disparityDeaths]);

  const visible = disparityDeaths.filter((d) => visibleIds.has(d.id)).slice(-MAX_VISIBLE);

  if (!visible.length && !disparityWinner) return null;

  return (
    <div style={{
      position: 'fixed',
      right: '16px',
      bottom: '80px',
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '5px',
      zIndex: 200,
      pointerEvents: 'none',
      maxWidth: '220px',
    }}>
      {disparityWinner && (
        <div style={{
          background: 'rgba(30, 20, 0, 0.88)',
          border: '2px solid rgba(255, 215, 0, 0.75)',
          borderRadius: '10px',
          padding: '12px 18px',
          color: '#FFD700',
          fontFamily: "'Courier New', monospace",
          fontSize: '13px',
          fontWeight: 'bold',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          textShadow: '0 0 12px rgba(255, 215, 0, 0.7)',
          lineHeight: 1.5,
          marginBottom: '4px',
        }}>
          <div style={{ fontSize: '18px', marginBottom: '4px' }}>🏆</div>
          <div>Winner by least observation</div>
          <div style={{ fontSize: '15px', letterSpacing: '0.06em', marginTop: '4px' }}>
            {disparityWinner.gridId}
          </div>
        </div>
      )}
      {visible.map((death) => (
        <div key={death.id} style={{
          background: 'rgba(40, 0, 0, 0.80)',
          border: '1px solid rgba(180, 40, 40, 0.5)',
          borderRadius: '5px',
          padding: '4px 10px',
          color: 'rgba(220, 110, 110, 0.95)',
          fontFamily: "'Courier New', monospace",
          fontSize: '11px',
          backdropFilter: 'blur(6px)',
          whiteSpace: 'nowrap',
          letterSpacing: '0.04em',
        }}>
          ✝ RIP {death.gridId} — #{death.rank}
        </div>
      ))}
    </div>
  );
};

export default DisparityHUD;
