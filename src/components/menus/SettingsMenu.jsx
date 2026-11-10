import React, { useRef, useState } from 'react';
import CapturePanel from '../capture/CapturePanel.jsx';
import { ColorsPanel } from './settings/ColorsPanel.jsx';
import { TilesPanel } from './settings/TilesPanel.jsx';
import { ScenePanel } from './settings/ScenePanel.jsx';
import { ModesPanel } from './settings/ModesPanel.jsx';
import { AboutPanel } from './settings/AboutPanel.jsx';
import { useDialogBehavior } from '../ui/index.js';

// One 16-unit line icon per tab, drawn in the wizard's stroke so the two strips match.
const TABS = [
  { id: 'colors', label: 'Colors', icon: <><circle cx="5.5" cy="6" r="3.3" /><circle cx="10.5" cy="6" r="3.3" /><circle cx="8" cy="10.3" r="3.3" /></> },
  { id: 'tiles', label: 'Tiles', icon: <><rect x="2.2" y="2.2" width="4.8" height="4.8" rx="1" /><rect x="9" y="2.2" width="4.8" height="4.8" rx="1" /><rect x="2.2" y="9" width="4.8" height="4.8" rx="1" /><rect x="9" y="9" width="4.8" height="4.8" rx="1" /></> },
  { id: 'scene', label: 'Scene', icon: <><path d="M2 12.5h12" /><path d="M3 12.5l3.4-4.7 2.3 3 1.9-2.4L14 12.5" /><circle cx="11.4" cy="4.4" r="1.3" /></> },
  { id: 'capture', label: 'Capture', icon: <><rect x="1.8" y="4.4" width="12.4" height="8.6" rx="1.8" /><path d="M5.8 4.4l1-1.6h2.4l1 1.6" /><circle cx="8" cy="8.7" r="2.2" /></> },
  { id: 'modes', label: 'Modes', icon: <><path d="M8 1.8l5.4 3.1v6.2L8 14.2l-5.4-3.1V4.9z" /><path d="M2.6 4.9L8 8l5.4-3.1M8 8v6.2" /></> },
  { id: 'about', label: 'About', icon: <><circle cx="8" cy="8" r="6.1" /><path d="M8 7.4v3.8" /><path d="M8 4.9v.2" /></> }
];

const Icon = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

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
          <button className="settings-close-btn ui-focusable" onClick={onClose} aria-label="Close settings">
            <Icon><path d="M4 4l8 8M12 4l-8 8" strokeWidth="2" /></Icon>
          </button>
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
              // move within it, rather than stopping on every tab.
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`settings-tab ui-focusable${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon>{tab.icon}</Icon>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Active panel */}
        <div className="settings-body" id="settings-tabpanel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`}>
          {activeTab === 'capture' && <CapturePanel />}
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
          {activeTab === 'modes' && (
            <ModesPanel />
          )}
          {activeTab === 'about' && (
            <AboutPanel />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
