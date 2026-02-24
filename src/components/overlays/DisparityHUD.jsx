import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';

const NOTIFICATION_LIFETIME = 8000; // ms before a death entry fades out
const MAX_PAIR_GROUPS = 6;           // max simultaneous pair groups visible

/**
 * DisparityHUD
 *
 * Shows a stack of death notifications as tiles burn out at FLIP_CAP.
 * Deaths that occur in the same tick (antipodal pairs dying together) are
 * grouped into one line: "✝✝ M1-003 #1 + M4-003 #2"
 * Solo deaths show as:  "✝ M1-003 — #1"
 *
 * A gold "🏆 Winner by least observation" banner appears when one tile survives.
 * Rendered whenever Disparity Mode (chaos) is active.
 */
const DisparityHUD = () => {
  const disparityDeaths = useGameStore((s) => s.disparityDeaths);
  const disparityWinner = useGameStore((s) => s.disparityWinner);

  const [visiblePairRanks, setVisiblePairRanks] = useState(new Set());

  // When a new death arrives, mark its pairRank visible and schedule removal
  useEffect(() => {
    if (!disparityDeaths.length) { setVisiblePairRanks(new Set()); return; }
    const latest = disparityDeaths[disparityDeaths.length - 1];
    const pr = latest.pairRank ?? latest.rank;
    setVisiblePairRanks((prev) => new Set([...prev, pr]));
    const timer = setTimeout(() => {
      setVisiblePairRanks((prev) => { const next = new Set(prev); next.delete(pr); return next; });
    }, NOTIFICATION_LIFETIME);
    return () => clearTimeout(timer);
  }, [disparityDeaths]);

  // Group deaths by pairRank, only include visible groups
  const groups = {};
  disparityDeaths.forEach((d) => {
    const pr = d.pairRank ?? d.rank;
    if (!visiblePairRanks.has(pr)) return;
    if (!groups[pr]) groups[pr] = [];
    groups[pr].push(d);
  });

  // Sort groups descending (most recent first) and cap display
  const sortedGroups = Object.entries(groups)
    .sort(([a], [b]) => Number(b) - Number(a))
    .slice(0, MAX_PAIR_GROUPS);

  if (!sortedGroups.length && !disparityWinner) return null;

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
      maxWidth: '260px',
    }}>
      {disparityWinner && (
        <div style={{
          background: 'rgba(30, 20, 0, 0.90)',
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
      {sortedGroups.map(([pr, deaths]) => {
        const isPair = deaths.length > 1;
        return (
          <div key={pr} style={{
            background: 'rgba(40, 0, 0, 0.82)',
            border: `1px solid rgba(180, 40, 40, ${isPair ? '0.7' : '0.45'})`,
            borderRadius: '5px',
            padding: '4px 10px',
            color: 'rgba(220, 110, 110, 0.95)',
            fontFamily: "'Courier New', monospace",
            fontSize: '11px',
            backdropFilter: 'blur(6px)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.04em',
          }}>
            {isPair ? (
              // Antipodal pair died together
              <>
                <span style={{ marginRight: '4px' }}>✝✝</span>
                {deaths.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && <span style={{ color: 'rgba(200,80,80,0.6)', margin: '0 4px' }}>+</span>}
                    <span>{d.gridId} </span>
                    <span style={{ fontWeight: 'bold' }}>#{d.rank}</span>
                  </span>
                ))}
              </>
            ) : (
              // Solo death
              <>✝ {deaths[0].gridId} — <span style={{ fontWeight: 'bold' }}>#{deaths[0].rank}</span></>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DisparityHUD;
