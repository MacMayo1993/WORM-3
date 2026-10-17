// src/components/menus/settings/CubeLookSettings.jsx
// How the cube looks (its colours, its tile style and the scene round it),
// changed without leaving the game, with the game still visible behind it: the
// Cube page of WORM's pause card and of the Flip Cube / Chaos session menu.
//
// It is the Settings sheet's own Colors, Tiles and Scene panels, so there is one
// implementation of each and the places that show them can never disagree. Both
// hosts load it lazily the first time the page opens: the tile previews and the
// scheme lists are no use to a player who never stops to restyle.

import React, { useCallback, useState } from 'react';
import { useGameStore } from '../../../hooks/useGameStore.js';
import { ColorsPanel } from './ColorsPanel.jsx';
import { TilesPanel } from './TilesPanel.jsx';
import { ScenePanel } from './ScenePanel.jsx';
import './cubeLookSettings.css';

const TABS = [
  { id: 'colors', label: 'Colors' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'scene', label: 'Scene' }
];

export default function CubeLookSettings({ idPrefix = 'cube-look' }) {
  const [tab, setTab] = useState('colors');
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const faceImages = useGameStore((s) => s.faceImages);
  const setFaceImages = useGameStore((s) => s.setFaceImages);
  // Same contract as useSettings' handleFaceImage: a URL sets a face's image,
  // nothing clears it.
  const onFaceImage = useCallback(
    (faceId, url) =>
      setFaceImages((prev) => {
        const next = { ...prev };
        if (url) next[faceId] = url;
        else delete next[faceId];
        return next;
      }),
    [setFaceImages]
  );

  const onTabKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
    setTab(next);
    // Roving tabindex: focus follows the selection, so the new tab is announced
    // and the old one (now tabIndex -1) does not keep it.
    e.currentTarget.querySelector(`#${idPrefix}-tab-${next}`)?.focus();
  };

  const panelId = `${idPrefix}-tabpanel`;
  return (
    <div className="cube-look">
      <div className="cube-look-tabs" role="tablist" aria-label="Cube settings" onKeyDown={onTabKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={panelId}
            tabIndex={tab === t.id ? 0 : -1}
            className="cube-look-tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="cube-look-tabpanel settings-body" id={panelId} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${tab}`}>
        {tab === 'colors' && (
          <ColorsPanel settings={settings} onSettingsChange={setSettings} faceImages={faceImages} onFaceImage={onFaceImage} />
        )}
        {tab === 'tiles' && <TilesPanel settings={settings} onSettingsChange={setSettings} />}
        {tab === 'scene' && <ScenePanel settings={settings} onSettingsChange={setSettings} />}
      </div>
    </div>
  );
}
