import React from 'react';
import { vibrate } from '../../utils/audio.js';
import { GAME_HUD_VARS } from '../../utils/uiTheme.js';
import './instrumentHud.css';

const ICONS = {
  Undo: <><path d="M4 9h10a6 6 0 0 1 0 12H9"/><path d="m8 5-4 4 4 4"/></>,
  Flip: <><rect x="4" y="5" width="7" height="14" rx="2"/><path d="m15 5 5 3v8l-5 3M14 2v20"/></>,
  Views: <><rect x="3" y="4" width="13" height="12" rx="2"/><rect x="10" y="11" width="11" height="9" rx="2"/></>,
  More: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  Reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></>,
  Shuffle: <><path d="m3 5 16 14M3 19 19 5M15 5h4v4M15 19h4v-4"/></>,
};

function InstrumentKey({ label, onClick, active, primary, disabled, spotlight }) {
  return <button type="button"
    className={`cube-tile-btn instrument-key${primary ? ' instrument-key-primary' : ''}${spotlight ? ' instrument-key-spotlight' : ''}`}
    disabled={disabled} aria-label={label} aria-pressed={active}
    onClick={() => { vibrate(12); onClick?.(); }}>
    <svg className="cube-tile-face" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[label]}</svg>
    <span className="cube-tile-label">{label}</span>
  </button>;
}

export default function BottomNavBar({ onUndo, canUndo, onReset, onShuffle, flipMode, onToggleFlip,
  flipLocked, hasActiveView, onToggleViews, onToggleMore, moreOpen, viewsOpen, chaosMode, spotlightTile = null }) {
  // The guided tour still exposes its requested control at the moment it teaches it.
  return <nav className="bottom-nav-bar instrument-dock" style={GAME_HUD_VARS} aria-label="Game controls">
    {spotlightTile === 'reset' ? <InstrumentKey label="Reset" onClick={onReset} spotlight />
      : spotlightTile === 'shuffle' && !chaosMode ? <InstrumentKey label="Shuffle" onClick={onShuffle} spotlight />
      : <InstrumentKey label="Undo" onClick={onUndo} disabled={!canUndo} />}
    <InstrumentKey label="Flip" onClick={onToggleFlip} primary active={flipMode} disabled={flipLocked} spotlight={spotlightTile === 'flip'} />
    <InstrumentKey label="Views" onClick={onToggleViews} active={viewsOpen || hasActiveView} spotlight={spotlightTile === 'views'} />
    <InstrumentKey label="More" onClick={onToggleMore} active={moreOpen} spotlight={spotlightTile === 'more'} />
  </nav>;
}
