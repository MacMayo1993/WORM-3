import React from 'react';
import './DevConsole.css';

export default function DevConsole({
  onClose,
  onPreset,
  onSaveState,
  onLoadState,
  hasSavedState,
  size: _size,
  onJumpToLevel,
  onInstantChaos,
  moveHistory
}) {
  const presets = [
    { id: 'solved', name: 'Solved State', desc: 'Reset to solved cube' },
    { id: 'near-solved', name: 'Near Solved', desc: '3 moves from solved' },
    { id: 'parity-error', name: 'Parity Error', desc: 'Single face swap (unsolvable)' },
    { id: 'two-faces', name: 'Two Faces Done', desc: 'Two opposite faces solved' },
    { id: 'checkerboard', name: 'Checkerboard', desc: 'Classic checkerboard pattern' },
    { id: 'scrambled-10', name: 'Light Scramble', desc: '10 random moves' },
    { id: 'scrambled-25', name: 'Medium Scramble', desc: '25 random moves' },
    { id: 'scrambled-50', name: 'Heavy Scramble', desc: '50 random moves' },
  ];

  const shortcuts = [
    { key: 'Z', desc: 'Undo last move', badge: moveHistory.length > 0 ? `${moveHistory.length}` : null },
    { key: 'Shift+R', desc: 'Reset + Scramble' },
    { key: 'Ctrl+S', desc: 'Save current state' },
    { key: 'Ctrl+L', desc: 'Load saved state', disabled: !hasSavedState },
    { key: 'Shift+1-9', desc: 'Jump to level 1-9' },
    { key: '`', desc: 'Toggle dev console' },
  ];

  const chaosOptions = [
    { level: 1, disparity: 10, name: 'Chaos Lv1 (10%)' },
    { level: 2, disparity: 25, name: 'Chaos Lv2 (25%)' },
    { level: 3, disparity: 50, name: 'Chaos Lv3 (50%)' },
    { level: 4, disparity: 75, name: 'Chaos Lv4 (75%)' },
  ];

  return (
    <div className="dev-console-overlay" onClick={onClose}>
      <div className="dev-console" onClick={e => e.stopPropagation()}>
        <div className="dev-console-header">
          <h2>🛠️ Developer Console</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="dev-console-content">
          {/* State Presets */}
          <section className="dev-section">
            <h3>State Presets</h3>
            <div className="preset-grid">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  className="preset-btn"
                  onClick={() => {
                    onPreset(preset.id);
                    onClose();
                  }}
                  title={preset.desc}
                >
                  <div className="preset-name">{preset.name}</div>
                  <div className="preset-desc">{preset.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Instant Chaos */}
          <section className="dev-section">
            <h3>Instant Chaos / Disparity</h3>
            <div className="chaos-grid">
              {chaosOptions.map(chaos => (
                <button
                  key={chaos.level}
                  className="chaos-btn"
                  onClick={() => {
                    onInstantChaos(chaos.disparity);
                    onClose();
                  }}
                  title={`Set cube to ${chaos.disparity}% disparity instantly`}
                >
                  {chaos.name}
                </button>
              ))}
            </div>
          </section>

          {/* State Management */}
          <section className="dev-section">
            <h3>State Management</h3>
            <div className="state-controls">
              <button className="state-btn" onClick={onSaveState}>
                💾 Save Current State
              </button>
              <button
                className="state-btn"
                onClick={onLoadState}
                disabled={!hasSavedState}
                title={hasSavedState ? 'Load saved state' : 'No saved state'}
              >
                📂 Load Saved State
              </button>
            </div>
          </section>

          {/* Quick Level Jump */}
          <section className="dev-section">
            <h3>Quick Level Jump</h3>
            <div className="level-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                <button
                  key={level}
                  className="level-btn"
                  onClick={() => {
                    onJumpToLevel(level);
                    onClose();
                  }}
                >
                  Level {level}
                </button>
              ))}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="dev-section">
            <h3>Keyboard Shortcuts</h3>
            <div className="shortcuts-list">
              {shortcuts.map((sc, i) => (
                <div key={i} className={`shortcut-item ${sc.disabled ? 'disabled' : ''}`}>
                  <kbd className="shortcut-key">{sc.key}</kbd>
                  <span className="shortcut-desc">{sc.desc}</span>
                  {sc.badge && <span className="shortcut-badge">{sc.badge}</span>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
