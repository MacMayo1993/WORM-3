import WormWordmark from '../branding/WormWordmark.jsx';
import React from 'react';
import { INTRO_END, ramp } from './introChoreography.js';
import './intro.css';
import { TITLE_START, TITLE_END } from './introTiming.js';

import { INTRO_COPY_TEXT, introCopyFrame } from './introCopy.js';

export default function TextOverlay({ time, reducedMotion = false }) {
  const frame = introCopyFrame(time);
  const title = reducedMotion ? 1 : ramp(time, TITLE_START, TITLE_END);
  return (
    <>
      <div className="opening-edge" aria-hidden="true" />
      <div className="opening-brand" aria-hidden="true"><WormWordmark /></div>
      <div className="opening-copy" aria-hidden="true">
        {!reducedMotion && title === 0 && frame && <div className="opening-copy-beat opening-trailer-beat" key={frame.beat.start}>
          <h1 className="opening-poem-line">{frame.words.map((word, index) => <React.Fragment key={index}>
            {index > 0 ? ' ' : null}<span className="opening-poem-word" style={{
              opacity: word.opacity,
              transform: `translateY(${(1 - word.opacity) * 6}px)`
            }}>{word.text}</span>
          </React.Fragment>)}</h1>
        </div>}
        {title > 0 && <div className="opening-copy-beat" style={{ opacity: title, transform: reducedMotion ? undefined : `translateY(${(1 - title) * 12}px) scale(${0.9 + title * 0.1})` }}>
          <h1 className="opening-title"><WormWordmark animated={!reducedMotion} /></h1>
          <p className="opening-tagline">{INTRO_COPY_TEXT}</p>
        </div>}
      </div>
      <div className="opening-progress" aria-hidden="true"><span style={{ transform: `scaleX(${reducedMotion ? 1 : Math.min(1, time / INTRO_END)})` }} /></div>
    </>
  );
}
