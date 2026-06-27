import React from 'react';
import { useGameStore } from '../../../hooks/useGameStore.js';

export function ModesPanel() {
  const antipodalMode = useGameStore((state) => state.antipodalMode);
  const echoDelay = useGameStore((state) => state.echoDelay);
  const antipodalVizIntensity = useGameStore((state) => state.antipodalVizIntensity);
  const setAntipodalMode = useGameStore((state) => state.setAntipodalMode);
  const setEchoDelay = useGameStore((state) => state.setEchoDelay);
  const setAntipodalVizIntensity = useGameStore((state) => state.setAntipodalVizIntensity);

  const hollowMode = useGameStore((state) => state.hollowMode);
  const setHollowMode = useGameStore((state) => state.setHollowMode);

  const mirrorMode = useGameStore((state) => state.mirrorMode);
  const setMirrorMode = useGameStore((state) => state.setMirrorMode);

  const randomMode = useGameStore((state) => state.randomMode);
  const setRandomMode = useGameStore((state) => state.setRandomMode);

  return (
    <>
      {/* Random Style Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Random Style Mode</h3>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '16px', lineHeight: '1.5' }}>
          Every 10 seconds, the color scheme and tile styles randomize automatically, and each cubelet gets its own random view style (classic, grid, sudoku, wireframe, glass, chrome, sphere, neon, gap, heatmap) while you play.
        </p>
        <div className="settings-toggles">
          <label className="settings-toggle-row">
            <span className="toggle-label">Enable Random Mode</span>
            <div className={`toggle-switch${randomMode ? ' on' : ''}`}
              onClick={() => setRandomMode(!randomMode)}>
              <div className="toggle-knob" />
            </div>
          </label>
        </div>
      </section>

      {/* Hollow Void Cube Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Hollow Void Cube Mode</h3>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '16px', lineHeight: '1.5' }}>
          Hollow cube with 20 mini-cubes and 7 void tunnels. Tunnel glow reacts to parity and chaos levels.
        </p>
        <div className="settings-toggles">
          <label className="settings-toggle-row">
            <span className="toggle-label">Enable Hollow Mode</span>
            <div className={`toggle-switch${hollowMode ? ' on' : ''}`}
              onClick={() => setHollowMode(!hollowMode)}>
              <div className="toggle-knob" />
            </div>
          </label>
        </div>
      </section>

      {/* Mirror Blocks Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Mirror Blocks Mode</h3>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '16px', lineHeight: '1.5' }}>
          Each piece has a unique size instead of colored stickers. Solve the puzzle by restoring the cube to its perfect rectangular form.
        </p>
        <div className="settings-toggles">
          <label className="settings-toggle-row">
            <span className="toggle-label">Enable Mirror Mode</span>
            <div className={`toggle-switch${mirrorMode ? ' on' : ''}`}
              onClick={() => setMirrorMode(!mirrorMode)}>
              <div className="toggle-knob" />
            </div>
          </label>
        </div>
      </section>

      {/* Antipodal Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Antipodal Mode - "Mirror Quotient"</h3>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '16px', lineHeight: '1.5' }}>
          Enhanced RP² dynamics: rotating one face triggers its antipodal face to rotate in the OPPOSITE direction after a brief echo delay.
        </p>
        <div className="settings-toggles">
          <label className="settings-toggle-row">
            <span className="toggle-label">Enable Antipodal Mode</span>
            <div className={`toggle-switch${antipodalMode ? ' on' : ''}`}
              onClick={() => setAntipodalMode(!antipodalMode)}>
              <div className="toggle-knob" />
            </div>
          </label>

          {antipodalMode && (
            <>
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px' }}>
                  Echo Delay: {echoDelay.toFixed(2)}s
                </label>
                <input
                  type="range" min="0.05" max="0.8" step="0.05"
                  value={echoDelay}
                  onChange={(e) => setEchoDelay(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
                  <span>Fast (0.05s)</span>
                  <span>Slow (0.8s)</span>
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px' }}>
                  Visual Effects Intensity
                </label>
                <div className="settings-radio-group">
                  {[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }].map(opt => (
                    <label key={opt.value}
                      className={`settings-radio${antipodalVizIntensity === opt.value ? ' active' : ''}`}>
                      <input type="radio" name="antipodalVizIntensity" value={opt.value}
                        checked={antipodalVizIntensity === opt.value}
                        onChange={() => setAntipodalVizIntensity(opt.value)} />
                      <span className="settings-radio-label">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
