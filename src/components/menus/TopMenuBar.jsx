import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FLIP_CAP } from '../../utils/constants.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import ParityWallet from '../overlays/ParityWallet.jsx';

// Must match MAX_CASCADES in useChaosMode.js — keeps the bolt display accurate
const MAX_CASCADES = 6;

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
  cascadeCount = 0,
  onShowSettings,
  onHome,
  currentLevelData,
  showAntipodalPiP,
  onToggleAntipodalPiP,
}) => {
  const modeLabel = visualMode === 'classic' ? 'Classic' :
                   visualMode === 'grid' ? 'Grid' :
                   visualMode === 'sudokube' ? 'Sudoku' :
                   visualMode === 'wireframe' ? 'Wire' : 'Glass';

  const levelLabel = currentLevelData
    ? `Level ${currentLevelData.id} — ${currentLevelData.name}`
    : null;

  const centerText = levelLabel || `${modeLabel} ${size}×${size}`;

  // ── Opt: faceStats polled at 200 ms instead of O(N³) on every cubies change.
  // During chaos mode this cuts from 12×/s to 5×/s; during normal play the
  // 200ms lag after each move is imperceptible.  cubies is always read fresh
  // via the ref already kept for chaosStats above.
  const [faceStats, setFaceStats] = useState(() => ({ totalComplete: 0, totalStickers: 1, percent: 0 }));

  const lastScannedCubiesRef = useRef(null);
  useEffect(() => {
    const compute = () => {
      const cur = cubiesStatRef.current;
      // Skip the O(n³) scan entirely when the cube hasn't changed since the
      // last poll — makes idle polling free at any cube size.
      if (lastScannedCubiesRef.current === cur) return;
      lastScannedCubiesRef.current = cur;
      const faces = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      const faceTargets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      for (const L of cur) {
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
      setFaceStats({ totalComplete, totalStickers, percent: Math.round((totalComplete / totalStickers) * 100) });
    };

    compute(); // immediate snapshot on mount / size change
    const id = setInterval(compute, 200);
    return () => clearInterval(id);
  }, [size]); // cubies intentionally NOT a dep — read via cubiesStatRef

  // ── Chaos stats come from the chaos worker (pushed into the store on each
  // productive tick + an initial snapshot on START). No main-thread sticker
  // scan needed — the worker already walks the surface for its own accounting.
  const cubiesStatRef = useRef(cubies);
  cubiesStatRef.current = cubies;

  const workerStats = useGameStore((s) => s.chaosStats);
  const chaosStats = useMemo(() => {
    if (!chaosMode || !workerStats) return null;
    const { totalFlips = 0, flipActive = 0, deadTiles = 0, disparity = 0, edgeTotal = 0, flipPct = 0 } = workerStats;
    return {
      totalFlips,
      flipActive,
      deadTiles,
      edgeTotal,
      flipPct,
      disparate: disparity,
      disparityPct: edgeTotal > 0 ? Math.round((disparity / edgeTotal) * 100) : 0,
      deadPct: edgeTotal > 0 ? Math.round((deadTiles / edgeTotal) * 100) : 0,
    };
  }, [chaosMode, workerStats]);

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
            DISPARITY L{chaosLevel}
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

      {/* Right: PP wallet + PiP toggle + Home + Settings gear */}
      <div className="top-bar-right">
        {onToggleAntipodalPiP && (
          <button
            className="top-bar-icon-btn"
            onClick={onToggleAntipodalPiP}
            title={showAntipodalPiP ? 'Hide antipodal view' : 'Show antipodal view (back of cube)'}
            style={{
              marginRight: '4px',
              color: showAntipodalPiP ? '#00d9ff' : undefined,
              opacity: showAntipodalPiP ? 1 : 0.7,
            }}
          >
            {/* Two overlapping squares icon representing PiP */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="14" height="11" rx="1" />
              <rect x="10" y="12" width="12" height="9" rx="1" fill={showAntipodalPiP ? 'rgba(0,217,255,0.25)' : 'none'} />
            </svg>
          </button>
        )}
        {onHome && (
          <button className="top-bar-icon-btn" onClick={onHome} title="Main Menu" style={{ marginRight: '4px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
        )}
        <ParityWallet dark={false} />
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
            {/* A1/Stats: live lightning-bolt count shows cascade queue depth */}
            {chaosMode && (
              <ChaosStatItem
                label="BOLTS"
                value={`${cascadeCount}/${MAX_CASCADES}`}
                color={cascadeCount >= MAX_CASCADES ? fc[1] : cascadeCount > 0 ? fc[5] : hexToRgba(fc[5], 0.35)}
                dimColor={dimColor}
                title={`${cascadeCount} of ${MAX_CASCADES} lightning bolt slots active (A1 cap)`}
              />
            )}
            {/* C3/Stats: saturation-brake indicator — appears when tick is throttled */}
            {chaosStats.flipPct > 85 && (
              <span
                style={{ color: fc[4], fontStyle: 'italic', fontSize: '10px', letterSpacing: '0.04em' }}
                title={`Saturation brake active — tick period slowed ${Math.round(1 + ((chaosStats.flipPct - 85) / 15) * 2)}× (C3)`}
              >
                ◼ brake
              </span>
            )}
            {chaosStats.flipActive === 0 && (
              <span
                style={{ color: fc[1], fontStyle: 'italic', fontSize: '10px' }}
                title="Chaos engine seeding — first ignition is automatic"
              >
                igniting…
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
