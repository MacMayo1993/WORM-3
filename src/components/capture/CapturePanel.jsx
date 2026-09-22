import React from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { UI_FONT, TEXT_SM } from '../../utils/uiTheme.js';

export default function CapturePanel({ viewer = false }) {
  const available = useGameStore(s => viewer || (!s.showWelcome && !s.showMainMenu
    && !s.showLevelTutorial && !s.showFirstFlipTutorial && !s.showTutorial
    && !s.showLevelSelect && !s.showPackSelect && !s.showCutscene
    && !s.victory && !s.showDisparityWinner
    && (!s.wormHealerMode || (s.wormAlive && (!s.wormStoryLevel || s.wormStoryStarted)
      && (!s.demoMode || s.demoStep !== 'worm-traversal' || s.demoWormStarted)))));
  return <section className="settings-section" style={{ fontFamily: UI_FONT, fontSize: TEXT_SM, lineHeight: 1.6 }}>
    <h3 className="settings-section-title">Just the Game</h3>
    <p>Capture Mode hides menus, scores, hints and notifications in every mode. Your game keeps running.</p>
    <p>Use your device’s screen recorder. To bring the UI back, hold two fingers still for one second anywhere on the game, or press Escape.</p>
    {!viewer && <p>Worm: swipe to steer, tap to jump or dive. Swipe up to boost with relative steering; tap with two fingers for your signature move. Hold one finger to fire. Keyboard controls still work.</p>}
    <button type="button" className="capture-start ui-focusable" disabled={!available}
      style={{ fontFamily: UI_FONT, fontSize: TEXT_SM }}
      onClick={() => useGameStore.getState().setCaptureMode(true)}>Start Capture Mode</button>
    {!available && <p>Start playing a mode and finish its briefing first, then open Settings → Capture.</p>}
  </section>;
}
