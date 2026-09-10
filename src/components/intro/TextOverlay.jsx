import React from 'react';
import { INTRO_END, ramp, windowOpacity } from './introChoreography.js';
import './intro.css';

const BEATS = [
  { start: 0.3, end: 3.1, eyebrow: 'A different kind of puzzle', text: 'What if…' },
  { start: 3.2, end: 6.4, eyebrow: 'Turn your perspective', text: 'Front was back?' },
  { start: 6.5, end: 9.8, eyebrow: 'Two sides. One connection.', text: 'What if opposite…' },
  { start: 9.9, end: 13.6, eyebrow: 'Follow the worm', text: 'was the same place?' }
];

export default function TextOverlay({ time, reducedMotion = false }) {
  const beat = BEATS.find(b => time >= b.start && time <= b.end);
  const title = reducedMotion ? 1 : ramp(time, 13.7, 14.5);
  return (
    <>
      <div className="opening-edge" aria-hidden="true" />
      <div className="opening-brand" aria-hidden="true">WORM<sup>3</sup><span>WORLD OF RUBIK’S MANIFOLDS</span></div>
      <div className="opening-copy" aria-hidden="true">
        {!reducedMotion && beat && <div style={{ opacity: windowOpacity(time, beat.start, beat.end) }}>
          <p className="opening-eyebrow">{beat.eyebrow}</p>
          <h1>{beat.text}</h1>
        </div>}
        {title > 0 && <div style={{ opacity: title }}>
          <h1 className="opening-title">WORM<sup>3</sup></h1>
          <p className="opening-tagline">Opposite is closer than you think.</p>
        </div>}
      </div>
      <div className="opening-progress" aria-hidden="true"><span style={{ transform: `scaleX(${reducedMotion ? 1 : Math.min(1, time / INTRO_END)})` }} /></div>
    </>
  );
}
