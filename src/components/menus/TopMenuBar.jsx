import React, { useMemo } from 'react';
import { FLIP_CAP } from '../../utils/constants.js';

// Compact stat chip used in the chaos stats strip
const ChaosStatItem = ({ label, value, color, title }) => (
  <span title={title} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px', cursor: 'default' }}>
    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
    <span style={{ color, fontWeight: 700, fontSize: '12px' }}>{value}</span>
  </span>
);

/**
 * TopMenuBar - Thin 48dp Google-inspired top app bar
 *
 * Left: Mode label (Classic 3×3) + Completion percentage
 * Center: WORM³ title
 * Right: Settings gear icon
 */
const TopMenuBar = ({
  metrics: _metrics,
  size,
  visualMode,
  flipMode,
  chaosMode,
  chaosLevel,
  cubies,
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

  // Chaos flip stats — only computed when chaos mode is active
  const chaosStats = useMemo(() => {
    if (!chaosMode) return null;
    let totalFlips = 0;
    let flipActive = 0; // stickers with flips > 0
    let deadTiles = 0;  // stickers at FLIP_CAP
    let disparate = 0;  // stickers where curr !== orig
    let edgeTotal = 0;
    const S = size;

    for (const L of cubies) {
      for (const R of L) {
        for (const c of R) {
          for (const [dir, st] of Object.entries(c.stickers)) {
            const onEdge =
              (dir === 'PX' && c.x === S - 1) || (dir === 'NX' && c.x === 0) ||
              (dir === 'PY' && c.y === S - 1) || (dir === 'NY' && c.y === 0) ||
              (dir === 'PZ' && c.z === S - 1) || (dir === 'NZ' && c.z === 0);
            if (!onEdge) continue;
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
    return { totalFlips, flipActive, deadTiles, disparate, flipPct, disparityPct, deadPct, edgeTotal };
  }, [chaosMode, cubies, size]);

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

      {/* Chaos Stats Strip — visible when chaos mode is active */}
      {chaosMode && chaosStats && (
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          padding: '3px 16px 5px',
          borderTop: '1px solid rgba(0, 217, 255, 0.15)',
          fontSize: '11px',
          fontFamily: "'Courier New', monospace",
          color: 'rgba(255,255,255,0.65)',
          flexWrap: 'wrap',
        }}>
          <ChaosStatItem
            label="FLIPS"
            value={chaosStats.totalFlips}
            color="#00d9ff"
            title={`${chaosStats.flipActive} of ${chaosStats.edgeTotal} tiles have been flipped at least once`}
          />
          <ChaosStatItem
            label="ACTIVE"
            value={`${chaosStats.flipPct}%`}
            color={chaosStats.flipPct > 50 ? '#ff6b6b' : chaosStats.flipPct > 20 ? '#ffa94d' : '#00d9ff'}
            title={`${chaosStats.flipActive} tiles with flips > 0`}
          />
          <ChaosStatItem
            label="DISPARITY"
            value={`${chaosStats.disparityPct}%`}
            color={chaosStats.disparityPct > 60 ? '#ff6b6b' : chaosStats.disparityPct > 30 ? '#ffa94d' : '#69db7c'}
            title={`${chaosStats.disparate} of ${chaosStats.edgeTotal} stickers are off their home face`}
          />
          {chaosStats.deadTiles > 0 && (
            <ChaosStatItem
              label="DEAD"
              value={`${chaosStats.deadPct}%`}
              color="#868e96"
              title={`${chaosStats.deadTiles} tiles burned out at flip cap (${FLIP_CAP})`}
            />
          )}
          {chaosStats.flipActive === 0 && (
            <span style={{ color: '#ff6b6b', fontStyle: 'italic', fontSize: '10px' }} title="Chaos engine needs at least one flipped sticker to bootstrap cascade propagation">
              ⚡ no seed — flip a tile to ignite
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default TopMenuBar;
