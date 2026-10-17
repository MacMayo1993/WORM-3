import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useGameStore, selectEffectiveFlipCap } from '../../hooks/useGameStore.js';
import ParityWallet from '../overlays/ParityWallet.jsx';
import { GAME_HUD, GAME_HUD_VARS } from '../../utils/uiTheme.js';
import './instrumentHud.css';
import { InspectionToggle } from '../overlays/InspectionLens.jsx';

// The session menu's Cube page: the Settings sheet's own Colors, Tiles and Scene
// panels, loaded the first time the page opens (shared with WORM's pause card).
const CubeLookSettings = React.lazy(() => import('./settings/CubeLookSettings.jsx'));

const ICONS = {
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" /></>,
  cube: <><path d="M12 3 4 7.5v9L12 21l8-4.5v-9Z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></>,
  home: <path d="M4 11 12 4l8 7M6 10v9h12v-9" />,
  back: <path d="M15 5 8 12l7 7" />,
  sound: <path d="M4 9h4l5-4v14l-5-4H4ZM16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12" />,
  muted: <path d="M4 9h4l5-4v14l-5-4H4ZM16 9l5 6m0-6-5 6" />,
  buzz: <><rect x="8" y="4" width="8" height="16" rx="2" /><path d="M4 9v6M20 9v6" /></>,
  noBuzz: <><rect x="8" y="4" width="8" height="16" rx="2" /><path d="M4 4l16 16" /></>,
  tunnels: <><circle cx="6" cy="12" r="3" /><circle cx="18" cy="12" r="3" /><path d="M9 12c2-3 4-3 6 0" /></>,
};

const SessionKey = ({ label, icon, onClick, pressed, disabled }) => (
  <button type="button" className="instrument-session-key" onClick={onClick} aria-pressed={pressed} disabled={disabled}>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
    <span>{label}</span>
  </button>
);

const SessionPageHead = ({ title, onBack }) => (
  <div className="instrument-page-head">
    <button type="button" className="instrument-back" onClick={onBack} aria-label="Back to session menu">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS.back}</svg>
    </button>
    <h2>{title}</h2>
  </div>
);

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

  // The session menu is three pages of one panel, as WORM's pause card is: the
  // session (numbers, the Settings · Cube · Home keys, More actions), Settings
  // (sound, buzz, tunnels, and All settings for the rest of the sheet) and Cube
  // (colours, tiles, scene). Closing the menu returns it to the session page.
  const menuRef = useRef(null);
  const panelRef = useRef(null);
  const [page, setPage] = useState('main');
  const sfxOn = useGameStore((s) => s.settings?.sfx ?? true);
  const hapticsOn = useGameStore((s) => s.settings?.haptics ?? true);
  const setSettings = useGameStore((s) => s.setSettings);
  const showTunnels = useGameStore((s) => s.showTunnels);
  const tunnelDetail = useGameStore((s) => s.tunnelDetail);
  const cycleTunnelDetail = useGameStore((s) => s.cycleTunnelDetail);
  const tunnelsLocked = !!(currentLevelData && !currentLevelData.features?.tunnels);
  useEffect(() => {
    const closeOutside = e => {
      // A dialog the Cube page opens (the background creator) is portalled out
      // of the panel; working in it must not close the page that opened it.
      if (e.target instanceof Element && e.target.closest('dialog, [role="dialog"]')) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) menuRef.current.open = false;
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  // A new page starts at its top, with focus on its first control.
  const pageShown = useRef(false);
  useEffect(() => {
    if (!pageShown.current) { pageShown.current = true; return; }
    const panel = panelRef.current;
    if (!panel || !menuRef.current?.open) return;
    panel.scrollTop = 0;
    panel.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [page]);
  const onMenuKeyDown = e => {
    if (!menuRef.current?.open) return;
    // Keys typed in the open menu are the menu's: arrows on the Cube tabs or
    // Space on a key must not also turn or shuffle the cube behind it.
    e.stopPropagation();
    if (e.key !== 'Escape') return;
    if (page !== 'main') { setPage('main'); return; }
    closeMenu(); menuRef.current?.querySelector('summary')?.focus();
  };
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
        <InspectionToggle />
        {onToggleAntipodalPiP && <button type="button" className="top-bar-icon-btn"
          aria-label="Far-side view" aria-pressed={showAntipodalPiP} onClick={onToggleAntipodalPiP}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <rect x="2" y="3" width="14" height="11" rx="2"/><rect x="10" y="12" width="12" height="9" rx="2"/>
          </svg>
        </button>}
        <details className="instrument-menu" ref={menuRef} onKeyDown={onMenuKeyDown}
          onToggle={e => { if (!e.currentTarget.open) setPage('main'); }}>
          <summary className="top-bar-icon-btn" aria-label="Session menu" title="Session menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14"/></svg>
          </summary>
          <div className={`instrument-menu-panel is-${page}`} ref={panelRef}>
            {page === 'main' && <>
              <span className="instrument-eyebrow">Session</span>
              <ParityWallet dark neutral />
              <dl className="instrument-stats">
                <div><dt>Flips</dt><dd>{metrics?.flips ?? 0}</dd></div>
                <div title="Tiles showing their twin’s color right now"><dt>Flipped tiles</dt><dd>{metrics?.wormholes ?? 0}</dd></div>
                {chaosStats && <>
                  <div><dt>Active tiles</dt><dd>{chaosStats.flipPct}%</dd></div>
                  <div title="Tiles not showing their original color"><dt>Off-color</dt><dd>{chaosStats.disparityPct}%</dd></div>
                  <div title={`A tile is spent after ${flipCap} flips`}><dt>Spent tiles</dt><dd>{chaosStats.deadTiles}</dd></div>
                  <div><dt>Bolts</dt><dd>{cascadeCount}/{MAX_CASCADES}</dd></div>
                </>}
              </dl>
              <div className="instrument-session-keys">
                <SessionKey label="Settings" icon={ICONS.settings} onClick={() => setPage('settings')} />
                <SessionKey label="Cube" icon={ICONS.cube} onClick={() => setPage('cube')} />
                {onHome && <SessionKey label="Home" icon={ICONS.home} onClick={() => { closeMenu(); onHome(); }} />}
              </div>
              <div className="instrument-extra-actions"><span>More actions</span><span className="top-bar-action-slot" ref={actionSlotRef} onClick={closeMenu} /></div>
            </>}
            {page === 'settings' && <>
              <SessionPageHead title="Settings" onBack={() => setPage('main')} />
              <div className="instrument-session-keys">
                <SessionKey label={sfxOn ? 'Sound' : 'Muted'} pressed={sfxOn} icon={sfxOn ? ICONS.sound : ICONS.muted}
                  onClick={() => setSettings?.(st => ({ ...st, sfx: !(st.sfx ?? true) }))} />
                <SessionKey label={hapticsOn ? 'Vibrate' : 'No buzz'} pressed={hapticsOn} icon={hapticsOn ? ICONS.buzz : ICONS.noBuzz}
                  onClick={() => setSettings?.(st => ({ ...st, haptics: !(st.haptics ?? true) }))} />
                {/* Off → Hints (thin cords) → Full (cords and live ribbons), as in Views. */}
                <SessionKey label={!showTunnels ? 'No tunnels' : tunnelDetail === 'full' ? 'Tunnels' : 'Hints'} pressed={!!showTunnels}
                  icon={ICONS.tunnels} disabled={tunnelsLocked} onClick={() => cycleTunnelDetail?.()} />
              </div>
              <button type="button" className="instrument-all-settings" onClick={() => { closeMenu(); onShowSettings?.(); }}>
                All settings
              </button>
            </>}
            {page === 'cube' && <>
              <SessionPageHead title="Cube" onBack={() => setPage('main')} />
              <Suspense fallback={<p className="instrument-loading">Loading…</p>}>
                <CubeLookSettings idPrefix="session-cube" />
              </Suspense>
            </>}
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
