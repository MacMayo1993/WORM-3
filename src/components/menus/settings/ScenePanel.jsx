import React from 'react';
import { BACKGROUNDS } from '../../../utils/backgrounds.js';
import { useGameStore } from '../../../hooks/useGameStore.js';

const BG_OPTIONS = BACKGROUNDS.map(bg => ({ value: bg.id, label: bg.label }));

export function ScenePanel({ settings, onSettingsChange }) {
  const canInspect = useGameStore(s => !s.showWelcome && !s.showMainMenu &&
    !(s.wormHealerMode && ['entering', 'tunnel', 'exiting'].includes(s.wormPhase)));
  const update = (key, val) => onSettingsChange({ ...settings, [key]: val });
  return (
    <section className="settings-section">
      <h3 className="settings-section-title">Portal windows</h3>
      <p>See the destination through nearby flipped tiles.</p>
      <div className="settings-radio-group">
        {[[true, 'Live views'], [false, 'Off']].map(([value, label]) => (
          <label key={label} className={`settings-radio${(settings.livePortalViews !== false) === value ? ' active' : ''}`}>
            <input type="radio" name="livePortalViews" checked={(settings.livePortalViews !== false) === value}
              onChange={() => update('livePortalViews', value)} />
            <span className="settings-radio-label">{label}</span>
          </label>
        ))}
      </div>
      <h3 className="settings-section-title">Inside the cube</h3>
      <p>Move a cutaway lens over the cube to follow its tunnels and the worm inside.</p>
      <button type="button" className="settings-radio" disabled={!canInspect}
        title={canInspect ? 'Inspect the interior' : 'Available during a game on the cube surface'} onClick={() => {
        const state = useGameStore.getState();
        state.setShowCutawayLens(true); state.setShowSettings(false);
      }}>Open cutaway lens</button>
      <h3 className="settings-section-title">Flip pads</h3>
      <p>A flipped tile raises its whole cubie. Choose how much the small pads bounce.</p>
      <div className="settings-radio-group">
        {[['full', 'Full bounce'], ['subtle', 'Subtle bounce'], ['off', 'Flat tiles']].map(([value, label]) => (
          <label key={value} className={`settings-radio${(settings.flipPads ?? 'full') === value ? ' active' : ''}`}>
            <input type="radio" name="flipPads" value={value} checked={(settings.flipPads ?? 'full') === value}
              onChange={() => update('flipPads', value)} />
            <span className="settings-radio-label">{label}</span>
          </label>
        ))}
      </div>
      <h3 className="settings-section-title">Background</h3>
      <div className="settings-radio-group">
        {BG_OPTIONS.map(opt => (
          <label key={opt.value}
            className={`settings-radio${settings.backgroundTheme === opt.value ? ' active' : ''}`}>
            <input type="radio" name="backgroundTheme" value={opt.value}
              checked={settings.backgroundTheme === opt.value}
              onChange={() => update('backgroundTheme', opt.value)} />
            <span className="settings-radio-label">{opt.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
