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
        <h3 className="settings-section-title">Random looks</h3>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '16px', lineHeight: '1.5' }}>
          Every 10 seconds the colors and tile styles reshuffle, and each piece picks its own view (Classic, Grid, Sudoku, Glass, Neon and more) while you play.
        </p>
        <div className="settings-toggles">
          <label className="settings-toggle-row">
            <span className="toggle-label">Turn on random looks</span>
            <div className={`toggle-switch${randomMode ? ' on' : ''}`}
              onClick={() => setRandomMode(!randomMode)}>
              <div className="toggle-knob" />
            </div>
          </label>
        </div>
      </section>

      {/* Hollow Void Cube Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Hollow cube</h3>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '16px', lineHeight: '1.5' }}>
          Draws every piece as an open frame so you can see through the cube. The glow at the center reacts to flips and Chaos.
        </p>
        <div className="settings-toggles">
          <label className="settings-toggle-row">
            <span className="toggle-label">Turn on hollow cube</span>
            <div className={`toggle-switch${hollowMode ? ' on' : ''}`}
              onClick={() => setHollowMode(!hollowMode)}>
              <div className="toggle-knob" />
            </div>
          </label>
        </div>
      </section>

      {/* Mirror Blocks Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Mirror blocks</h3>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '16px', lineHeight: '1.5' }}>
          Pieces differ in size instead of color. Solve by turning the cube back into a perfect block.
        </p>
        <div className="settings-toggles">
          <label className="settings-toggle-row">
            <span className="toggle-label">Turn on mirror blocks</span>
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
