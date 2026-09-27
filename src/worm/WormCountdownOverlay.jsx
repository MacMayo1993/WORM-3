import React from 'react';
import { COUNTDOWN_STEP_DURATION } from './healerWorm/constants.js';
import { DISPLAY_FONT, UI_FONT } from '../utils/uiTheme.js';
import './wormCountdown.css';

const LETTERS = [
  { letter: 'W', color: '#ef4444', dock: '1.3em' },
  { letter: 'O', color: '#ff9c29', dock: '.45em' },
  { letter: 'R', color: '#54cf73', dock: '-.4em' },
  { letter: 'M', color: '#488dff', dock: '-1.3em' }
];
const BEAT_COLORS = { 3: '#488dff', 2: '#ff9c29', 1: '#54cf73' };

export default function WormCountdownOverlay({ step }) {
  const number = typeof step === 'number';
  const leaving = step === 'hold';
  return <div className="worm-countdown" data-stage={number ? 'count' : leaving ? 'exit' : 'launch'} style={{
    '--countdown-display': DISPLAY_FONT,
    '--countdown-ui': UI_FONT,
    '--beat': `${COUNTDOWN_STEP_DURATION}s`,
    '--accent': BEAT_COLORS[step] ?? '#54cf73'
  }}>
    <span className="worm-countdown-announcement" role="status" aria-live="polite" aria-atomic="true">
      {number ? `${step}` : 'WORM!'}
    </span>
    <div className="worm-countdown-art" aria-hidden="true">
      <div className="worm-countdown-portal">
        <i /><i /><i />
      </div>
      {number ? <div className="worm-countdown-beat" key={step}>
        <div className="worm-countdown-ripple" />
        <span className="worm-countdown-digit">{step}</span>
        <span className="worm-countdown-ready">GET READY</span>
        <div className="worm-countdown-pips">{[3, 2, 1].map(value =>
          <i key={value} data-lit={value >= step} style={{ '--pip-color': BEAT_COLORS[value] }} />
        )}</div>
      </div> : <div className="worm-countdown-word">
        {LETTERS.map(({ letter, color, dock }, index) => <span key={letter} className="worm-countdown-letter" style={{
          '--letter-color': color,
          '--dock': dock,
          '--letter-delay': `${index * COUNTDOWN_STEP_DURATION * 0.055}s`
        }}>{letter}</span>)}
      </div>}
    </div>
  </div>;
}
