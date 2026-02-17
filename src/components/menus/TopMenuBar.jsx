import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FLIP_CAP } from '../../utils/constants.js';

// Convert a hex color string to an rgba() string
const hexToRgba = (hex, alpha = 1) => {
  if (!hex || hex.length < 7) return `rgba(128,128,128,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// Compact stat chip — colors drawn from the cube's own face palette
const ChaosStatItem = ({ label, value, color, dimColor, title }) => (
  <span title={title} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px', cursor: 'default' }}>
    <span style={{ color: dimColor, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
    <span style={{ color, fontWeight: 700, fontSize: '12px' }}>{value}</span>
  </span>
);

/**
 * TopMenuBar - Thin 48dp Google-inspired top app bar
 *
 * Left: Mode label (Classic 3×3) + Completion percentage
 * Center: WORM³ title
 * Right: Settings gear icon
 *
 * When chaos mode is active a second row shows live flip stats and a
 * Chaos Pressure bar whose gradient is drawn from the cube's face colors.
 */
const TopMenuBar = ({
  metrics: _metrics,
  size,
  visualMode,
  flipMode,
  chaosMode,
  chaosLevel,
  cubies,
  faceColors,
  onShowSettings,
  currentLevelData
}) => {
  const modeLabel = visualMode === 'classic' ? 'Classic' :
                   visualMode === 'grid' ? 'Grid' :
                   visualMode === 'sudokube' ? 'Sudoku' :
                   visualMode === 'wireframe' ? 'Wire' : 'Glass';

  const levelLabel = currentLevelData
    ? `Level ${currentLevelData.id} — ${currentLevelData.name}`
    : null;

  const centerText = levelLabel || `${modeLabel} ${size}×${size}`;

  // Compact face completion for the bar
  const faceStats = useMemo(() => {
    const faces = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const faceTargets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const L of cubies) {
      for (const R of L) {
        for (const c of R) {
          for (const [dir, st] of Object.entries(c.stickers)) {
            const targetFace = dir === 'PZ' ? 1 : dir === 'NX' ? 2 : dir === 'PY' ? 3 :
                              dir === 'NZ' ? 4 : dir === 'PX' ? 5 : 6;
            faceTargets[targetFace]++;
            if (st.curr === targetFace) faces[targetFace]++;
          }
        }
      }
    }
    const totalComplete = Object.values(faces).reduce((a, b) => a + b, 0);
    const totalStickers = Object.values(faceTargets).reduce((a, b) => a + b, 0);
    return { totalComplete, totalStickers, percent: Math.round((totalComplete / totalStickers) * 100) };
  }, [cubies]);

  // ── Opt #5: chaosStats polled at 500 ms instead of recomputing on every
  // cubies update (which fires every 80–250 ms during chaos mode).
  // cubies is read through a ref so the interval callback is never stale.
  const cubiesStatRef = useRef(cubies);
  cubiesStatRef.current = cubies;
  const sizeStatRef = useRef(size);
  sizeStatRef.current = size;

  const [chaosStats, setChaosStats] = useState(null);

  useEffect(() => {
    if (!chaosMode) {
      setChaosStats(null);
      return;
    }

    const compute = () => {
      const cur = cubiesStatRef.current;
      const S = sizeStatRef.current;
      let totalFlips = 0;
      let flipActive = 0;
      let deadTiles = 0;
      let disparate = 0;
      let edgeTotal = 0;

      for (const L of cur) {
        for (const R of L) {
          for (const c of R) {
            // Every key in c.stickers is an outward-facing (edge) sticker by
            // construction — no isOnEdge guard needed.
            for (const [_dir, st] of Object.entries(c.stickers)) {
              edgeTotal++;
              const flips = st.flips || 0;
              totalFlips += flips;
              if (flips > 0) flipActive++;
              if (flips >= FLIP_CAP) deadTiles++;
              if (st.curr !== st.orig) disparate++;
            }
          }
        }
      }

      const flipPct = edgeTotal > 0 ? Math.round((flipActive / edgeTotal) * 100) : 0;
      const disparityPct = edgeTotal > 0 ? Math.round((disparate / edgeTotal) * 100) : 0;
      const deadPct = edgeTotal > 0 ? Math.round((deadTiles / edgeTotal) * 100) : 0;
      setChaosStats({ totalFlips, flipActive, deadTiles, disparate, flipPct, disparityPct, deadPct, edgeTotal });
    };

    compute(); // immediate first snapshot when chaos activates
    const id = setInterval(compute, 500);
    return () => clearInterval(id);
  }, [chaosMode, size]); // cubies intentionally NOT a dep — read via ref

  // Resolved face palette — safe fallbacks if faceColors not yet loaded
  const fc = faceColors || { 1: '#ef4444', 2: '#22c55e', 3: '#ffffff', 4: '#f97316', 5: '#3b82f6', 6: '#eab308' };

  // Pick stat colors based on the cube's face palette:
  //   FLIPS     → face 5 (right/blue in standard) — a cool metric readout
  //   ACTIVE %  → face 2 calm → face 4 warm → face 1 hot (threshold-stepped)
  //   DISPARITY → face 3 calm → face 4 warn → face 1 danger (threshold-stepped)
  //   DEAD %    → face 6 at reduced opacity
  //   NO-SEED   → face 1 (the "danger" face in every scheme)
  const dimColor = hexToRgba(fc[5], 0.45);

  const activeColor = chaosStats
    ? (chaosStats.flipPct > 50 ? fc[1] : chaosStats.flipPct > 20 ? fc[4] : fc[2])
    : fc[2];

  const disparityColor = chaosStats
    ? (chaosStats.disparityPct > 60 ? fc[1] : chaosStats.disparityPct > 30 ? fc[4] : fc[3])
    : fc[3];

  // Pressure bar: gradient from face 2 (calm) through face 6 (tension) to face 1 (danger)
  const pressureGradient = `linear-gradient(to right, ${fc[2]}, ${fc[6]}, ${fc[1]})`;
  const pressureTrack = hexToRgba(fc[2], 0.15);

  return (
    <div className="top-app-bar" style={chaosMode ? { flexWrap: 'wrap', height: 'auto', minHeight: '48px' } : {}}>
      {/* Left: Mode label + Percentage */}
      <div className="top-bar-left">
        <span className="top-bar-title">{centerText}</span>
        <span className="top-bar-progress" style={{ marginLeft: '12px' }}>{faceStats.percent}%</span>
        {chaosMode && (
          <span className="chaos-pill" style={{ marginLeft: '12px' }}>
            CHAOS L{chaosLevel}
          </span>
        )}
        {flipMode && (
          <span className="flip-pill" style={{ marginLeft: '12px' }}>FLIP</span>
        )}
      </div>

      {/* Center: WORM³ Title */}
      <div className="top-bar-center">
        <span style={{
          fontSize: '24px',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #e53935 0%, #fb8c00 20%, #fdd835 40%, #43a047 60%, #1e88e5 80%, #e53935 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0.12em',
        }}>
          WORM³
        </span>
      </div>

      {/* Right: Settings gear */}
      <div className="top-bar-right">
        <button className="top-bar-icon-btn" onClick={onShowSettings} title="Settings">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Chaos Stats Strip + Pressure Bar — visible when chaos mode is active */}
      {chaosMode && chaosStats && (
        <>
          {/* Stats row */}
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            padding: '3px 16px 4px',
            borderTop: `1px solid ${hexToRgba(fc[5], 0.18)}`,
            fontSize: '11px',
            fontFamily: "'Courier New', monospace",
            flexWrap: 'wrap',
          }}>
            <ChaosStatItem
              label="FLIPS"
              value={chaosStats.totalFlips}
              color={fc[5]}
              dimColor={dimColor}
              title={`${chaosStats.flipActive} of ${chaosStats.edgeTotal} tiles have been flipped at least once`}
            />
            <ChaosStatItem
              label="ACTIVE"
              value={`${chaosStats.flipPct}%`}
              color={activeColor}
              dimColor={dimColor}
              title={`${chaosStats.flipActive} tiles with flips > 0`}
            />
            <ChaosStatItem
              label="DISPARITY"
              value={`${chaosStats.disparityPct}%`}
              color={disparityColor}
              dimColor={dimColor}
              title={`${chaosStats.disparate} of ${chaosStats.edgeTotal} stickers are off their home face`}
            />
            {chaosStats.deadTiles > 0 && (
              <ChaosStatItem
                label="DEAD"
                value={`${chaosStats.deadPct}%`}
                color={hexToRgba(fc[6], 0.6)}
                dimColor={dimColor}
                title={`${chaosStats.deadTiles} tiles burned out at flip cap (${FLIP_CAP})`}
              />
            )}
            {chaosStats.flipActive === 0 && (
              <span
                style={{ color: fc[1], fontStyle: 'italic', fontSize: '10px' }}
                title="Chaos engine seeding — first ignition is automatic"
              >
                ⚡ igniting…
              </span>
            )}
          </div>

          {/* Chaos Pressure Bar — full-width gradient fill tracking ACTIVE % */}
          <div style={{
            width: '100%',
            height: '4px',
            background: pressureTrack,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${chaosStats.flipPct}%`,
              background: pressureGradient,
              transition: 'width 0.6s ease',
              boxShadow: chaosStats.flipPct > 0 ? `0 0 6px ${hexToRgba(fc[1], 0.7)}` : 'none',
            }} />
          </div>
        </>
      )}
    </div>
  );
};

export default TopMenuBar;
