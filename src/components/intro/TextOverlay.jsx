import WormWordmark from '../branding/WormWordmark.jsx';
import React from 'react';
import { INTRO_END, ramp } from './introChoreography.js';
import './intro.css';
import { TITLE_START, TITLE_END } from './introTiming.js';
import { INTRO_COPY_TEXT, introCopyFrame } from './introCopy.js';
import { RUBIKS_FACE_COLORS } from '../../utils/constants.js';

// A spring that overshoots and settles: the trailer "slam" every word lands with.
const backOut = r => { const c = 1.9; return 1 + (c + 1) * (r - 1) ** 3 + c * (r - 1) ** 2; };

// "cube" rides a red sticker that flips to its antipode, orange — the same move
// the cube behind it just made.
const TILE_FRONT = RUBIKS_FACE_COLORS[1];
const TILE_BACK = RUBIKS_FACE_COLORS[4];

function Word({ word, index, dissolve }) {
  const spring = backOut(word.reveal);
  const tilt = (1 - word.reveal) * (index % 2 ? 9 : -9);
  const style = {
    opacity: word.opacity,
    transform: `translateY(${(1 - spring) * 26 - dissolve * 30}px) scale(${(0.35 + 0.65 * spring) * (1 - dissolve * 0.18)}) rotate(${tilt}deg)`
  };
  if (word.accent === 'flip') {
    return <span className="opening-poem-word opening-word-flip" style={style}>
      <span style={{ transform: `rotateX(${word.move * 360}deg)` }}>{word.text}</span>
    </span>;
  }
  if (word.accent === 'tile') {
    return <span className="opening-poem-word opening-word-tile" style={style}>
      <span className="opening-tile" style={{ transform: `rotateX(${word.move * 180}deg)` }}>
        <span className="opening-tile-face" style={{ background: TILE_FRONT }}>{word.text}</span>
        <span className="opening-tile-face opening-tile-back" style={{ background: TILE_BACK }}>{word.text}</span>
      </span>
    </span>;
  }
  if (word.accent === 'box') {
    return <span className="opening-poem-word opening-word-box" style={style}>
      {word.text}
      <svg className="opening-box" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
        {['opening-box-ink', 'opening-box-line'].map(className => <rect key={className} className={className}
          x="3" y="3" width="94" height="94" rx="9" pathLength="1" vectorEffect="non-scaling-stroke"
          style={{ strokeDashoffset: 1 - word.move }} />)}
      </svg>
    </span>;
  }
  return <span className="opening-poem-word" style={style}>{word.text}</span>;
}

export default function TextOverlay({ time, reducedMotion = false }) {
  const frame = introCopyFrame(time);
  const title = reducedMotion ? 1 : ramp(time, TITLE_START, TITLE_END);
  // The title slams down from over-size; the tagline follows a beat later.
  const slam = reducedMotion ? 1 : backOut(title);
  const tag = reducedMotion ? 1 : ramp(time, TITLE_START + 0.2, TITLE_END + 0.3);
  return (
    <>
      <div className="opening-edge" aria-hidden="true" />
      <div className="opening-brand" aria-hidden="true"><WormWordmark /></div>
      <div className="opening-copy" aria-hidden="true">
        {!reducedMotion && title === 0 && frame && <div className="opening-copy-beat opening-trailer-beat" key={frame.beat.start}>
          <h1 className="opening-poem-line">{frame.words.map((word, index) => <React.Fragment key={index}>
            {index > 0 ? ' ' : null}<Word word={word} index={index} dissolve={frame.dissolve} />
          </React.Fragment>)}</h1>
        </div>}
        {title > 0 && <div className="opening-copy-beat">
          <h1 className="opening-title" style={reducedMotion ? undefined : {
            opacity: Math.min(1, title * 3),
            transform: `scale(${1 + (1 - slam) * 0.6}) rotate(${(1 - title) * -4}deg)`
          }}><WormWordmark animated={!reducedMotion} /></h1>
          <p className="opening-tagline" style={reducedMotion ? undefined : {
            opacity: tag, transform: `translateY(${(1 - backOut(tag)) * 18}px)`
          }}>{INTRO_COPY_TEXT}</p>
        </div>}
      </div>
      <div className="opening-progress" aria-hidden="true"><span style={{ transform: `scaleX(${reducedMotion ? 1 : Math.min(1, time / INTRO_END)})` }} /></div>
    </>
  );
}
