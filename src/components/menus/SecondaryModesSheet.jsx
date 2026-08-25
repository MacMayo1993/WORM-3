import React, { useEffect } from 'react';

/**
 * SecondaryModesSheet - Bottom sheet modal with grouped controls
 *
 * Groups: Core | Views | Advanced
 * Slides up from bottom with backdrop
 */

const SheetItem = ({ label, active, onClick, color, locked, icon }) => (
  <button
    className={`sheet-item ${active ? 'sheet-item-active' : ''} ${locked ? 'sheet-item-locked' : ''}`}
    onClick={locked ? undefined : onClick}
    style={active ? { borderColor: color, color } : undefined}
  >
    {icon && <span className="sheet-item-icon">{icon}</span>}
    <span className="sheet-item-label">{label}</span>
    {active && <span className="sheet-item-dot" style={{ background: color }} />}
    {locked && <span className="sheet-item-lock">&#128274;</span>}
  </button>
);

const SecondaryModesSheet = ({
  open,
  onClose,
  mode, // 'more' or 'views'
  // Core toggles
  chaosMode, chaosLevel, onToggleChaos, onSetChaosLevel, chaosLocked, maxChaosLevel,
  autoRotateEnabled, onToggleAutoRotate,
  showTunnels, tunnelDetail, onToggleTunnels, tunnelsLocked,
  // View toggles
  exploded, onToggleExplode, explodeLocked,
  showNetPanel, onToggleNet, netLocked,
  hollowMode, onToggleHollow,
  visualMode, onCycleVisualMode,
  size, onChangeSize, sizeLocked,
  // Solver (3×3 only — Flip moved to the main nav bar)
  solveModeActive, onToggleSolve,
  teachModeActive, onToggleTeach,
  solverLocked,
  // Advanced
  handsMode, onToggleHands,
  // Leaderboard
  showLeaderboard, onToggleLeaderboard,
  // Level
  currentLevelData, onShowLevels, onFreeplay
}) => {
  // Backdrop click closes the sheet for pointer users; mirror it on Escape so
  // keyboard users get the same dismissal.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isViewsMode = mode === 'views';

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet-container ${open ? 'sheet-open' : ''}`}>
        <div className="sheet-handle" />

        {isViewsMode ? (
          <>
            {/* Visual Modes */}
            <div className="sheet-group">
              <div className="sheet-group-title">Visual Style</div>
              <div className="sheet-grid">
                {['classic', 'grid', 'sudokube', 'wireframe', 'glass', 'chrome', 'neon', 'gap', 'lego'].map((m) => (
                  <SheetItem
                    key={m}
                    label={m === 'sudokube' ? 'Sudoku' : m.charAt(0).toUpperCase() + m.slice(1)}
                    active={visualMode === m}
                    onClick={() => onCycleVisualMode(m)}
                    color="#FF9800"
                  />
                ))}
              </div>
            </div>

            {/* View Toggles */}
            <div className="sheet-group">
              <div className="sheet-group-title">View Options</div>
              <div className="sheet-grid">
                <SheetItem label="Explode" active={exploded} onClick={onToggleExplode} color="#FF9800" locked={explodeLocked} />
                <SheetItem label="Net" active={showNetPanel} onClick={onToggleNet} color="#FF9800" locked={netLocked} />
                <SheetItem label="Hollow" active={hollowMode} onClick={onToggleHollow} color="#ff9500" />
                {/* Three-state: Off → Hints (thin cords only) → Full (cords + live ribbons) → Off.
                    "Hints" is the useful middle the old binary toggle lacked — showing every
                    pair at full detail made most players turn tunnels off entirely. */}
                <SheetItem
                  label={showTunnels ? (tunnelDetail === 'full' ? 'Tunnels: Full' : 'Tunnels: Hints') : 'Tunnels'}
                  active={showTunnels}
                  onClick={onToggleTunnels}
                  color="#FF9800"
                  locked={tunnelsLocked}
                />
                <SheetItem label="Leaders" active={showLeaderboard} onClick={onToggleLeaderboard} color="#764ba2" />
              </div>
            </div>

            {/* Cube Size */}
            <div className="sheet-group">
              <div className="sheet-group-title">Cube Size</div>
              <div className="sheet-grid">
                {[2, 3, 4, 5].map((n) => (
                  <SheetItem
                    key={n}
                    label={`${n}×${n}`}
                    active={size === n}
                    onClick={() => onChangeSize(n)}
                    color="#2196F3"
                    locked={sizeLocked}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Core Modes */}
            <div className="sheet-group">
              <div className="sheet-group-title">Core Modes</div>
              <div className="sheet-grid">
                <SheetItem label="Chaos" active={chaosMode} onClick={onToggleChaos} color="#ef4444" locked={chaosLocked} />
                {chaosMode && !chaosLocked && (
                  <>
                    {[1, 2, 3, 4, 5].map((l) => (
                      <SheetItem
                        key={l}
                        label={`L${l}`}
                        active={chaosLevel === l}
                        onClick={() => onSetChaosLevel(l)}
                        color="#ef4444"
                        locked={l > maxChaosLevel}
                      />
                    ))}
                    <SheetItem label="Auto" active={autoRotateEnabled} onClick={onToggleAutoRotate} color="#ef4444" />
                  </>
                )}
              </div>
            </div>

            {/* Solver — 3×3 only */}
            <div className="sheet-group">
              <div className="sheet-group-title">{solverLocked ? 'Solver (3×3 only)' : 'Solver'}</div>
              <div className="sheet-grid">
                <SheetItem label="Solve" active={solveModeActive} onClick={onToggleSolve} color="#0051A2" locked={solverLocked} />
                <SheetItem label="Teach" active={teachModeActive} onClick={onToggleTeach} color="#FFD500" locked={solverLocked} />
              </div>
            </div>

            {/* Advanced */}
            <div className="sheet-group">
              <div className="sheet-group-title">Advanced</div>
              <div className="sheet-grid">
                <SheetItem label="Hands" active={handsMode} onClick={onToggleHands} color="#ff6b35" />
              </div>
            </div>

            {/* Level Controls */}
            {currentLevelData && (
              <div className="sheet-group">
                <div className="sheet-group-title">Level</div>
                <div className="sheet-grid">
                  <SheetItem label="Levels" active={false} onClick={onShowLevels} color="#9370DB" />
                  <SheetItem label="Freeplay" active={false} onClick={onFreeplay} color="#9370DB" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default SecondaryModesSheet;
