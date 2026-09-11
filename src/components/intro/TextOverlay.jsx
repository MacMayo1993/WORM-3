import React from 'react';
import { INTRO_END, ramp, windowOpacity } from './introChoreography.js';
import './intro.css';
import { TITLE_START, TITLE_END } from './introTiming.js';

const BEATS = [
  { start: 0.1, end: 2.2, text: 'What if opposite…' },
  { start: 2.3, end: 5.2, text: 'was the same place?' }
];

export default function TextOverlay({ time, reducedMotion = false }) {
  const beat = BEATS.find(b => time >= b.start && time <= b.end);
  const title = reducedMotion ? 1 : ramp(time, TITLE_START, TITLE_END);
  return (
    <>
      <div className="opening-edge" aria-hidden="true" />
      <div className="opening-copy" aria-hidden="true">
        {!reducedMotion && beat && <div style={{ opacity: windowOpacity(time, beat.start, beat.end) }}>
          <h1>{beat.text}</h1>
        </div>}
        {title > 0 && (reducedMotion || !beat) && <div style={{ opacity: title, transform: reducedMotion ? undefined : `translateY(${(1 - title) * 12}px) scale(${0.9 + title * 0.1})` }}>
          <h1 className="opening-title">WORM<sup>3</sup></h1>
        </div>}
      </div>
      <div className="opening-progress" aria-hidden="true"><span style={{ transform: `scaleX(${reducedMotion ? 1 : Math.min(1, time / INTRO_END)})` }} /></div>
    </>
  );
}
