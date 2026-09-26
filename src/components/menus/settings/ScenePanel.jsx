import React from 'react';
import { BACKGROUNDS } from '../../../utils/backgrounds.js';

const BG_OPTIONS = BACKGROUNDS.map(bg => ({ value: bg.id, label: bg.label }));

export function ScenePanel({ settings, onSettingsChange }) {
  const update = (key, val) => onSettingsChange({ ...settings, [key]: val });
  return (
    <section className="settings-section">
      <h3 className="settings-section-title">Flip pads</h3>
      <p>Raised tiles show which twins have flipped. Choose how much they bounce.</p>
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
