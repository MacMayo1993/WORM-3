import React from 'react';
import { BACKGROUNDS } from '../../../utils/backgrounds.js';

const BG_OPTIONS = BACKGROUNDS.map(bg => ({ value: bg.id, label: bg.label }));

export function ScenePanel({ settings, onSettingsChange }) {
  const update = (key, val) => onSettingsChange({ ...settings, [key]: val });
  return (
    <section className="settings-section">
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
