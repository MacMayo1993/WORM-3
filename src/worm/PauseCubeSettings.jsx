// src/worm/PauseCubeSettings.jsx
// The pause menu's Cube page: how the cube looks (its colours, its tile style
// and the scene round it), changed without leaving the run, with the run still
// visible behind the paused card.
//
// It is the Settings sheet's own Colors, Tiles and Scene panels, so there is one
// implementation of each and the two places can never disagree. Loaded lazily
// by WormCrawlerHUD the first time the page opens: the tile previews and the
// scheme lists are no use to a player who never pauses to restyle.

import React, { useCallback, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { ColorsPanel } from '../components/menus/settings/ColorsPanel.jsx';
import { TilesPanel } from '../components/menus/settings/TilesPanel.jsx';
import { ScenePanel } from '../components/menus/settings/ScenePanel.jsx';

const TABS = [
  { id: 'colors', label: 'Colors' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'scene', label: 'Scene' }
];

export default function PauseCubeSettings() {
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
    setTab(TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id);
  };

  return (
    <div className="worm-pause-cube">
      <div className="worm-pause-tabs" role="tablist" aria-label="Cube settings" onKeyDown={onTabKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`worm-pause-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="worm-pause-tabpanel"
            tabIndex={tab === t.id ? 0 : -1}
            className="worm-pause-tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="worm-pause-tabpanel settings-body" id="worm-pause-tabpanel" role="tabpanel" aria-labelledby={`worm-pause-tab-${tab}`}>
        {tab === 'colors' && (
          <ColorsPanel settings={settings} onSettingsChange={setSettings} faceImages={faceImages} onFaceImage={onFaceImage} />
        )}
        {tab === 'tiles' && <TilesPanel settings={settings} onSettingsChange={setSettings} />}
        {tab === 'scene' && <ScenePanel settings={settings} onSettingsChange={setSettings} />}
      </div>
    </div>
  );
}
