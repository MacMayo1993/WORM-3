import React, { useState } from 'react';
import { ColorsPanel } from './settings/ColorsPanel.jsx';
import { TilesPanel } from './settings/TilesPanel.jsx';
import { ScenePanel } from './settings/ScenePanel.jsx';
import { DisplayPanel } from './settings/DisplayPanel.jsx';
import { ModesPanel } from './settings/ModesPanel.jsx';

const TABS = [
  { id: 'colors', label: 'Colors' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'scene', label: 'Scene' },
  { id: 'display', label: 'Display' },
  { id: 'modes', label: 'Modes' },
];

const SettingsMenu = ({ onClose, settings, onSettingsChange, faceImages = {}, onFaceImage }) => {
  const [activeTab, setActiveTab] = useState('colors');

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="settings-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Tab bar */}
        <div className="settings-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active panel */}
        <div className="settings-body">
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
