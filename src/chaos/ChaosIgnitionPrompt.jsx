import React from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { arcadeModeVars } from '../utils/arcadeTheme.js';
import { Z } from '../utils/uiTheme.js';
import '../components/ui/arcadeTheme.css';
import './chaosIgnition.css';

// Between the scramble and the countdown: the player aims chaos's first strike.
// Docked at the bottom and click-through everywhere but the card, so the cube
// stays in view and every tile stays tappable — CubeAssembly routes the tap to
// the pick while this is up, and ChaosIgnitionMarker shows where it landed.
// The game HUD is hidden meanwhile (no Shuffle/Undo on the waiting board), so the
// way home lives here.
export default function ChaosIgnitionPrompt({ onConfirm, onSurprise, onLeave }) {
  const picked = useGameStore((s) => !!s.chaosIgnition);
  return (
    <div className="chaos-ignition" style={{ zIndex: Z.COUNTDOWN }}>
      <section className="chaos-ignition-card arcade-card" style={arcadeModeVars('chaos')} role="dialog" aria-modal="false"
        aria-labelledby="chaos-ignition-title" aria-describedby="chaos-ignition-help">
        <span className="arcade-eyebrow">Chaos · First strike</span>
        <h2 id="chaos-ignition-title" className="arcade-title">Pick the first strike</h2>
        <p id="chaos-ignition-help" className="arcade-blurb" aria-live="polite">
          {picked
            ? 'Locked on. Tap another tile to move it, or strike.'
            : 'Tap any tile. Lightning hits it first, and the storm spreads out from there.'}
        </p>
        <div className="chaos-ignition-keys">
          <button type="button" className="arcade-key" onClick={onSurprise}>Surprise me</button>
          <button type="button" className="arcade-primary" onClick={onConfirm} disabled={!picked}>Strike here ▶</button>
        </div>
        {onLeave && <button type="button" className="chaos-ignition-leave" onClick={onLeave}>Leave to menu</button>}
      </section>
    </div>
  );
}
