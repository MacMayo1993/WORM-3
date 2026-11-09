import React from 'react';
import { useGameStore } from '../../../hooks/useGameStore.js';

// A real switch: reachable by keyboard and announced with its state. The whole
// row is the target, as it was when the row was a label.
const Toggle = ({ label, on, onChange }) => (
  <div className="settings-toggle-row" onClick={() => onChange(!on)}>
    <span className="toggle-label">{label}</span>
    <button type="button" role="switch" aria-checked={on} aria-label={label}
      className={`toggle-switch ui-focusable${on ? ' on' : ''}`}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}>
      <span className="toggle-knob" />
    </button>
  </div>
);

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
        <p>
          Every 10 seconds the colors and tile styles reshuffle, and each piece picks its own view (Classic, Grid, Sudoku, Glass, Neon and more) while you play.
        </p>
        <div className="settings-toggles">
          <Toggle label="Turn on random looks" on={randomMode} onChange={setRandomMode} />
        </div>
      </section>

      {/* Hollow Void Cube Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Hollow cube</h3>
        <p>
          Draws every piece as an open frame so you can see through the cube. The glow at the center reacts to flips and Chaos.
        </p>
        <div className="settings-toggles">
          <Toggle label="Turn on hollow cube" on={hollowMode} onChange={setHollowMode} />
        </div>
      </section>

      {/* Mirror Blocks Mode */}
      <section className="settings-section">
        <h3 className="settings-section-title">Mirror blocks</h3>
        <p>
          Pieces differ in size instead of color. Solve by turning the cube back into a perfect block.
        </p>
        <div className="settings-toggles">
          <Toggle label="Turn on mirror blocks" on={mirrorMode} onChange={setMirrorMode} />
        </div>
      </section>
    </>
  );
}
