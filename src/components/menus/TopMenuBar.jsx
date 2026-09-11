import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGameStore, selectEffectiveFlipCap } from '../../hooks/useGameStore.js';
import ParityWallet from '../overlays/ParityWallet.jsx';
import { GAME_HUD, GAME_HUD_VARS } from '../../utils/uiTheme.js';
import './instrumentHud.css';

// Must match MAX_CASCADES in useChaosMode.js — keeps the bolt display accurate
const MAX_CASCADES = 6;

const TopMenuBar = ({
  metrics,
  size,
  visualMode,
  flipMode,
  chaosMode,
  chaosLevel,
  cubies,
  faceColors: _faceColors,
  cascadeCount = 0,
  onShowSettings,
  onHome,
  currentLevelData,
  showAntipodalPiP,
  onToggleAntipodalPiP,
  // The mobile action launcher lives inside the session menu.
  actionSlotRef,
}) => {
  // The cap this session actually enforces — the DEAD readout used to report
  // the standard-play constant during a cap-13 Disparity game.
  const flipCap = useGameStore(selectEffectiveFlipCap);
  const VISUAL_MODE_LABELS = {
    classic: 'Classic', grid: 'Grid', sudokube: 'Sudoku', wireframe: 'Wire', glass: 'Glass',
    chrome: 'Chrome', neon: 'Neon', gap: 'Gap', lego: 'Lego'
  };
  const modeLabel = VISUAL_MODE_LABELS[visualMode] || 'Classic';

  const levelLabel = currentLevelData
    ? `Level ${currentLevelData.id} — ${currentLevelData.name}`
    : null;

  const centerText = levelLabel || `${modeLabel} ${size}×${size}`;

  // ── Opt: faceStats polled at 200–800 ms instead of O(N³) on every cubies change.
  // During chaos mode the poll interval is widened to 800ms since the worker
  // already pushes live chaos stats — the O(n³) face scan is purely supplemental
  // and doesn't need to fire 5×/s when the cube changes on every chaos TICK.
  const [faceStats, setFaceStats] = useState(() => ({ totalComplete: 0, totalStickers: 1, percent: 0 }));

  const lastScannedCubiesRef = useRef(null);
  useEffect(() => {
    const compute = () => {
      const cur = cubiesStatRef.current;
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

    compute();
    const pollInterval = chaosMode ? 800 : 200;
    const id = setInterval(compute, pollInterval);
    return () => clearInterval(id);
  }, [size, chaosMode]); // cubies intentionally NOT a dep — read via cubiesStatRef

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

  const menuRef = useRef(null);
  useEffect(() => {
    const closeOutside = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) menuRef.current.open = false;
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  const pressure = chaosStats?.flipPct ?? 0;

  return (
    <header className="top-app-bar instrument-hud" style={GAME_HUD_VARS}>
      <div className="top-bar-left">
        <span className="top-bar-title" title={centerText}>{centerText}</span>
        <span className="top-bar-progress" aria-label={`${faceStats.percent}% solved`}>
          {faceStats.percent}<small>%</small>
        </span>
        {chaosMode && <span className="instrument-tag">Chaos {chaosLevel}</span>}
        {flipMode && <span className="instrument-tag">Flip</span>}
      </div>
      <div className="top-bar-right">
        {onToggleAntipodalPiP && <button type="button" className="top-bar-icon-btn"
          aria-label="Far-side view" aria-pressed={showAntipodalPiP} onClick={onToggleAntipodalPiP}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <rect x="2" y="3" width="14" height="11" rx="2"/><rect x="10" y="12" width="12" height="9" rx="2"/>
          </svg>
        </button>}
        <details className="instrument-menu" ref={menuRef} onKeyDown={e => {
          if (e.key === 'Escape') { closeMenu(); menuRef.current?.querySelector('summary')?.focus(); }
        }}>
          <summary className="top-bar-icon-btn" aria-label="Session menu" title="Session menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14"/></svg>
          </summary>
          <div className="instrument-menu-panel">
            <span className="instrument-eyebrow">Session</span>
            <ParityWallet dark neutral />
            <dl className="instrument-stats">
              <div><dt>Flips</dt><dd>{metrics?.flips ?? 0}</dd></div>
              <div><dt>Wormholes</dt><dd>{metrics?.wormholes ?? 0}</dd></div>
              {chaosStats && <>
                <div><dt>Active tiles</dt><dd>{chaosStats.flipPct}%</dd></div>
                <div><dt>Disparity</dt><dd>{chaosStats.disparityPct}%</dd></div>
                <div title={`Flip cap: ${flipCap}`}><dt>Dead tiles</dt><dd>{chaosStats.deadTiles}</dd></div>
                <div><dt>Bolts</dt><dd>{cascadeCount}/{MAX_CASCADES}</dd></div>
              </>}
            </dl>
            <button type="button" onClick={() => { closeMenu(); onShowSettings?.(); }}>Settings</button>
            <div className="instrument-extra-actions"><span>More actions</span><span className="top-bar-action-slot" ref={actionSlotRef} onClick={closeMenu} /></div>
            {onHome && <button type="button" onClick={() => { closeMenu(); onHome(); }}>Main menu</button>}
          </div>
        </details>
      </div>
      {chaosMode && chaosStats && <div className="instrument-pressure" role="progressbar"
        aria-label="Chaos pressure" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pressure}>
        <span style={{ width: `${pressure}%`, background: pressure > 50 ? GAME_HUD.warning : GAME_HUD.accent }} />
      </div>}
    </header>
  );
};

export default TopMenuBar;
