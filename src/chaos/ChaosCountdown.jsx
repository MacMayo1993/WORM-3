import React from 'react';
import { bettingPalette } from '../utils/disparityBetting.js';
import { MODE_THEMES } from '../utils/modeThemes.js';
import { Z } from '../utils/uiTheme.js';
import './chaosCountdown.css';

export default function ChaosCountdown({ value, settings }) {
  if (value == null) return null;
  const { faces } = bettingPalette(settings);
  const go = value === 'GO!';
  return <div className="chaos-countdown" style={{ zIndex: Z.COUNTDOWN, '--countdown-accent': MODE_THEMES.chaos.accent }}
    role="status" aria-live="polite" aria-atomic="true" aria-label={go ? 'Go! Chaos begins.' : `Chaos begins in ${value}`}>
    <div className="chaos-countdown-card" data-go={go}>
      <span className="chaos-countdown-label" aria-hidden="true">{go ? 'Let it flip' : 'Chaos incoming'}</span>
      <div className="chaos-countdown-face" key={value} aria-hidden="true">
        <div className="chaos-countdown-tiles">{Object.entries(faces).map(([id, face]) =>
          <i key={id} style={{ '--tile-color': face.hex }} />
        )}</div>
        <strong>{value}</strong>
        <svg className="chaos-countdown-sweep" viewBox="0 0 200 200"><rect x="5" y="5" width="190" height="190" rx="32" pathLength="1" /></svg>
      </div>
      <div className="chaos-countdown-beats" aria-hidden="true">{[3, 2, 1].map(n =>
        <span key={n} data-active={value === n} data-done={go || value < n}>{go || value < n ? '✓' : n}</span>
      )}</div>
    </div>
  </div>;
}
