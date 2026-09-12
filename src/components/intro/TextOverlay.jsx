import React from 'react';
import { INTRO_END, ramp, windowOpacity } from './introChoreography.js';
import './intro.css';
import { TITLE_START, TITLE_END, IMPLODE_START } from './introTiming.js';

const BEATS = [
  { start: 0.1, end: 2.2, text: 'What if opposite…' },
  { start: 2.3, end: IMPLODE_START + 0.4, text: 'was the same place?' }
];

export default function TextOverlay({ time, reducedMotion = false }) {
  const beat = BEATS.find(b => time >= b.start && time <= b.end);
  const title = reducedMotion ? 1 : ramp(time, TITLE_START, TITLE_END);
  return (
    <>
      <div className="opening-edge" aria-hidden="true" />
      <div className="opening-brand" aria-hidden="true">WORM<sup>3</sup></div>
      <div className="opening-copy" aria-hidden="true">
        {!reducedMotion && title === 0 && beat && <div className="opening-copy-beat" style={{ opacity: windowOpacity(time, beat.start, beat.end) }}>
          <h1>{beat.text}</h1>
        </div>}
        {title > 0 && <div className="opening-copy-beat" style={{ opacity: title, transform: reducedMotion ? undefined : `translateY(${(1 - title) * 12}px) scale(${0.9 + title * 0.1})` }}>
          <h1 className="opening-title">WORM<sup>3</sup></h1>
          <p className="opening-tagline">Opposite is closer than you think.</p>
        </div>}
      </div>
      <div className="opening-progress" aria-hidden="true"><span style={{ transform: `scaleX(${reducedMotion ? 1 : Math.min(1, time / INTRO_END)})` }} /></div>
    </>
  );
}
