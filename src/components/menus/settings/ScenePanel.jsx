import React, { Suspense, useState } from 'react';
import { BACKGROUNDS } from '../../../utils/backgrounds.js';
import { useGameStore } from '../../../hooks/useGameStore.js';
import WormCameraZoomControl from '../../../worm/WormCameraZoomControl.jsx';

const BG_OPTIONS = BACKGROUNDS.map(bg => ({ value: bg.id, label: bg.label }));
const ProjectiscopeCreator = React.lazy(() => import('../../../projectiscope/ProjectiscopeCreator.jsx'));

export function ScenePanel({ settings, onSettingsChange }) {
  const [creating, setCreating] = useState(false);
  const canInspect = useGameStore(s => !s.showWelcome && !s.showMainMenu &&
    !(s.wormHealerMode && ['entering', 'tunnel', 'exiting'].includes(s.wormPhase)));
  const update = (key, val) => onSettingsChange({ ...settings, [key]: val });
  return (
    <section className="settings-section">
      <h3 className="settings-section-title">WORM camera</h3>
      <p>How far back the camera follows your worm. Further out shows more of a long worm and the orbs around it. The mouse wheel changes it while you crawl.</p>
      <WormCameraZoomControl label="Distance" />
      <h3 className="settings-section-title">Portal windows</h3>
      <p>Optional live view through one nearby portal. Uses extra graphics power; off by default.</p>
      <div className="settings-radio-group">
        {[[true, 'Live views'], [false, 'Off']].map(([value, label]) => (
          <label key={label} className={`settings-radio${(settings.livePortalViews === true) === value ? ' active' : ''}`}>
            <input type="radio" name="livePortalViews" checked={(settings.livePortalViews === true) === value}
              onChange={() => update('livePortalViews', value)} />
            <span className="settings-radio-label">{label}</span>
          </label>
        ))}
      </div>
      <p>If play slows down, the normal animated portal effect takes over. Toggle live views off and on to retry.</p>
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
        {BG_OPTIONS.map(opt => opt.value === 'projectiscope' ? (
          <button type="button" key={opt.value} className={`settings-radio${settings.backgroundTheme === opt.value ? ' active' : ''}`}
            aria-pressed={settings.backgroundTheme === opt.value} onClick={() => setCreating(true)}>{opt.label}</button>
        ) : (
          <label key={opt.value}
            className={`settings-radio${settings.backgroundTheme === opt.value ? ' active' : ''}`}>
            <input type="radio" name="backgroundTheme" value={opt.value}
              checked={settings.backgroundTheme === opt.value}
              onChange={() => update('backgroundTheme', opt.value)} />
            <span className="settings-radio-label">{opt.label}</span>
          </label>
        ))}
      </div>
      {creating && <Suspense fallback={<p role="status">Opening background creator…</p>}>
        <ProjectiscopeCreator design={settings.projectiscopeDesign} onCancel={() => setCreating(false)}
          onApply={projectiscopeDesign => {
            onSettingsChange({ ...settings, backgroundTheme: 'projectiscope', projectiscopeDesign });
            setCreating(false);
          }} />
      </Suspense>}
    </section>
  );
}
