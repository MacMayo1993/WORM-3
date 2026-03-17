import React from 'react';

const TOGGLES = [
  { key: 'showStats', label: 'Stats Bar' },
  { key: 'showManifoldFooter', label: 'Manifold Footer' },
  { key: 'showFaceProgress', label: 'Face Progress Bars' },
];

export function DisplayPanel({ settings, onSettingsChange }) {
  const update = (key, val) => onSettingsChange({ ...settings, [key]: val });
  return (
    <section className="settings-section">
      <h3 className="settings-section-title">UI Layout</h3>
      <div className="settings-toggles">
        {TOGGLES.map(item => (
          <label key={item.key} className="settings-toggle-row">
            <span className="toggle-label">{item.label}</span>
            <div className={`toggle-switch${settings[item.key] ? ' on' : ''}`}
              onClick={() => update(item.key, !settings[item.key])}>
              <div className="toggle-knob" />
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
