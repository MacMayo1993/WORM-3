import { wizardPaperBackground } from './WizardChrome.jsx';
import { MODE_THEMES } from '../../utils/modeThemes.js';
import React, { useRef } from 'react';
import { UI_FONT, PAPER_BACKDROP, PAPER_TEXT, Z } from '../../utils/uiTheme.js';
import ModeArtwork from '../ui/ModeArtwork.jsx';
import { useDialogBehavior } from '../ui/Panel.jsx';
import { wormMenuFeedback } from './wormMenuFeedback.js';

export default function CubeModeSelectScreen({ onRubiks, onDisparity, onBack }) {
  const ref = useRef(null);
  const onKeyDown = useDialogBehavior(ref, onBack);
  return <div ref={ref} onKeyDown={onKeyDown} tabIndex={-1} className="cube-path-screen" role="dialog" aria-modal="true" aria-labelledby="cube-mode-title"
    style={{ '--mode-accent': MODE_THEMES.cube.accent, fontFamily: UI_FONT, background: PAPER_BACKDROP, color: PAPER_TEXT, zIndex: Z.FULLSCREEN }}>
    <section style={wizardPaperBackground}>
      <button className="cube-path-back" onClick={onBack}>← Back</button>
      <h1 id="cube-mode-title">Solve or survive?</h1>
      <div className="cube-path-options">
        {[{ id: 'freeplay', label: 'Cube', note: 'No clock. Just you and six faces.', action: onRubiks, accent: MODE_THEMES.cube.accent },
          { id: 'chaos', label: 'Chaos', note: 'Back the last pair standing.', action: onDisparity, accent: MODE_THEMES.chaos.accent }].map(option =>
          <button key={option.id} style={{ '--mode-accent': option.accent }} onClick={() => { wormMenuFeedback(); option.action(); }}>
            <ModeArtwork mode={option.id} /><strong>{option.label}<span aria-hidden="true">↗</span></strong><span>{option.note}</span>
          </button>)}
      </div>
    </section>
  </div>;
}
