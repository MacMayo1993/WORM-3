import React from 'react';
import { useGameStore } from '../../../hooks/useGameStore.js';

export function ModesPanel() {
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
          Every 10 seconds, the color scheme and tile styles randomize automatically, and each cubelet gets its own random view style (classic, grid, sudoku, wireframe, glass, chrome, neon, gap, lego) while you play.
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
    </>
  );
}
