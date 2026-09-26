import { MODE_THEMES } from '../../utils/modeThemes.js';
import React, { useRef } from 'react';
import { UI_FONT, Z } from '../../utils/uiTheme.js';
import ModeArtwork from '../ui/ModeArtwork.jsx';
import WormWordmark from '../branding/WormWordmark.jsx';
import { useDialogBehavior } from '../ui/Panel.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';
import '../ui/pieceKey.css';
import '../ui/pathSelect.css';

// Flip Cube's two paths, each a piece of the cube in its mode's face colour.
const PATHS = [
  { id: 'freeplay', label: 'Flip Cube', note: 'Solve all six faces', meta: 'Flip, twist, restore', color: MODE_THEMES.cube.accent, glint: true },
  { id: 'chaos', label: 'Chaos', note: 'Bet on the surviving color pair', meta: 'Place your bet, ride the storm', color: MODE_THEMES.chaos.accent }
];

export default function CubeModeSelectScreen({ onRubiks, onDisparity, onBack }) {
  const ref = useRef(null);
  const onKeyDown = useDialogBehavior(ref, onBack);
  const actions = { freeplay: onRubiks, chaos: onDisparity };
  return <div ref={ref} onKeyDown={onKeyDown} tabIndex={-1} className="path-select" role="dialog" aria-modal="true"
    aria-labelledby="cube-mode-title" style={{ fontFamily: UI_FONT, zIndex: Z.FULLSCREEN }}>
    <div className="path-select-page">
      <header className="path-select-head">
        <button className="piece-icon" onClick={onBack} aria-label="Back"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <span className="path-select-brand" aria-hidden="true"><WormWordmark /></span>
        <span className="path-select-spacer" aria-hidden="true" />
      </header>
      <h1 id="cube-mode-title" className="path-select-title">Solve or survive?</h1>
      <div className="cube-path-options path-select-cards">
        {PATHS.map(path =>
          <button key={path.id} className={`path-select-card piece${path.glint ? ' piece--glint' : ''}`} style={{ '--piece-color': path.color }}
            onClick={() => { wormMenuFeedback(); actions[path.id](); }}>
            <span className="piece-face">
              <span className="path-select-art"><ModeArtwork mode={path.id} /></span>
              <span className="path-select-copy">
                <span className="path-select-cta piece-trailer">{path.label} <b aria-hidden="true">→</b></span>
                <span className="path-select-note">{path.note}</span>
                <span className="path-select-meta"><span>{path.meta}</span></span>
              </span>
            </span>
          </button>)}
      </div>
    </div>
  </div>;
}
