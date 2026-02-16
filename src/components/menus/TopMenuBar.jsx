import React, { useMemo } from 'react';

/**
 * TopMenuBar - Thin 48dp Google-inspired top app bar
 *
 * Left: Parity pill (EVEN/ODD)
 * Center: Current mode + dimension label
 * Right: Settings gear icon
 */
const TopMenuBar = ({
  metrics,
  size,
  visualMode,
  flipMode,
  chaosMode,
  chaosLevel,
  cubies,
  onShowSettings,
  currentLevelData
}) => {
  const parity = metrics.flips % 2 === 0 ? 'EVEN' : 'ODD';
  const parityBg = parity === 'EVEN' ? '#4CAF50' : '#FF9800';

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

  return (
    <div className="top-app-bar">
      {/* Left: Parity pill */}
      <div className="top-bar-left">
        <span className="parity-pill" style={{ background: parityBg }}>
          {parity}
        </span>
        {chaosMode && (
          <span className="chaos-pill">
            CHAOS L{chaosLevel}
          </span>
        )}
        {flipMode && (
          <span className="flip-pill">FLIP</span>
        )}
      </div>

      {/* Center: Mode / Level */}
      <div className="top-bar-center">
        <span className="top-bar-title">{centerText}</span>
        <span className="top-bar-progress">{faceStats.percent}%</span>
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
    </div>
  );
};

export default TopMenuBar;
