import React, { useRef, useState } from 'react';
import { ColorsPanel } from './settings/ColorsPanel.jsx';
import { TilesPanel } from './settings/TilesPanel.jsx';
import { ScenePanel } from './settings/ScenePanel.jsx';
import { DisplayPanel } from './settings/DisplayPanel.jsx';
import { ModesPanel } from './settings/ModesPanel.jsx';
import { useDialogBehavior } from '../ui/index.js';

const TABS = [
  { id: 'colors', label: 'Colors' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'scene', label: 'Scene' },
  { id: 'display', label: 'Display' },
  { id: 'modes', label: 'Modes' }
];

const SettingsMenu = ({ onClose, settings, onSettingsChange, faceImages = {}, onFaceImage }) => {
  const [activeTab, setActiveTab] = useState('colors');
  const overlayRef = useRef(null);
  // Escape, focus trap, focus restore, scroll lock — see ui/Panel.jsx. Settings
  // is CSS-styled rather than built from <Panel>, so it takes the behaviour
  // directly instead of the surface.
  const onKeyDown = useDialogBehavior(overlayRef, onClose);

  // Left/Right move between tabs, which is what the tablist role promises once
  // it is announced as one.
  const onTabKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === activeTab);
    const next = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    setActiveTab(TABS[next].id);
  };

  return (
    <div
      ref={overlayRef}
      className="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="settings-panel">

        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title" id="settings-title">Settings</h2>
          <button className="settings-close-btn ui-focusable" onClick={onClose} aria-label="Close settings">&times;</button>
        </div>

        {/* Tab bar */}
        <div className="settings-tabs" role="tablist" aria-label="Settings sections" onKeyDown={onTabKeyDown}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls="settings-tabpanel"
              // Roving tabindex: Tab reaches the tab strip once, then Left/Right
              // move within it, rather than stopping on all five.
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`settings-tab ui-focusable${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active panel */}
        <div className="settings-body" id="settings-tabpanel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`}>
          {activeTab === 'colors' && (
            <ColorsPanel
              settings={settings}
              onSettingsChange={onSettingsChange}
              faceImages={faceImages}
              onFaceImage={onFaceImage}
            />
          )}
          {activeTab === 'tiles' && (
            <TilesPanel settings={settings} onSettingsChange={onSettingsChange} />
          )}
          {activeTab === 'scene' && (
            <ScenePanel settings={settings} onSettingsChange={onSettingsChange} />
          )}
          {activeTab === 'display' && (
            <DisplayPanel settings={settings} onSettingsChange={onSettingsChange} />
          )}
          {activeTab === 'modes' && (
            <ModesPanel />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
