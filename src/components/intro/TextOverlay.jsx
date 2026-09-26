import WormWordmark from '../branding/WormWordmark.jsx';
import React, { useLayoutEffect, useRef } from 'react';
import { INTRO_END, ramp } from './introChoreography.js';
import './intro.css';
import { TITLE_START, TITLE_END, DISSOLVE_START } from './introTiming.js';
import { INTRO_COPY, introCopyFrame, tileFacesOf } from './introCopy.js';
import { introOutro, outroWordFade } from './introOutro.js';
import { RUBIKS_FACE_COLORS } from '../../utils/constants.js';

// A spring that overshoots and settles: the trailer "slam" every word lands with.
const backOut = r => { const c = 1.9; return 1 + (c + 1) * (r - 1) ** 3 + c * (r - 1) ** 2; };

// The tagline is the script again: a first clause that dissolves at the end, and
// the phrase that survives it.
const LEAD = INTRO_COPY[0].text.split(' ');
const [FLIP, ...REST] = INTRO_COPY.at(-1).text.split(' ');
const CUBE = REST.at(-1);
const THROUGH = REST.slice(0, -1).join(' ');

/** A word on a Rubik's sticker, turning (0→1) to its antipode: FLIP blue → green, CUBE red → orange. */
function Tile({ text, faces, turn }) {
  return <span className="opening-tile" style={{ transform: `rotateX(${turn * 180}deg)` }}>
    {faces.map((face, side) => <span key={side} className={side ? 'opening-tile-face opening-tile-back' : 'opening-tile-face'}
      style={{ background: RUBIKS_FACE_COLORS[face] }}>{text}</span>)}
  </span>;
}

function Word({ word, index, dissolve }) {
  const spring = backOut(word.reveal);
  const tilt = (1 - word.reveal) * (index % 2 ? 9 : -9);
  const style = {
    opacity: word.opacity,
    transform: `translateY(${(1 - spring) * 26 - dissolve * 30}px) scale(${(0.35 + 0.65 * spring) * (1 - dissolve * 0.18)}) rotate(${tilt}deg)`
  };
  if (word.accent === 'tile') {
    return <span className="opening-poem-word opening-word-tile" style={style}>
      <Tile text={word.text} faces={word.faces} turn={word.move} />
    </span>;
  }
  if (word.accent === 'box') {
    return <span className="opening-poem-word opening-word-box" style={style}>
      {word.text}
      {/* White line on a black line, like the lettering. Styled here, not in CSS:
          the intro sheet ships in the size-capped initial bundle. */}
      <svg className="opening-box" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100" fill="none"
        strokeLinejoin="round" strokeLinecap="round" strokeDasharray="1">
        {[['#111', 9], ['#fff', 4]].map(([stroke, width]) => <rect key={stroke} stroke={stroke} strokeWidth={width}
          x="3" y="3" width="94" height="94" rx="9" pathLength="1" vectorEffect="non-scaling-stroke"
          strokeDashoffset={1 - word.move} />)}
      </svg>
    </span>;
  }
  return <span className="opening-poem-word" style={style}>{word.text}</span>;
}

/** Dissolving away: fade and soften, and (motion, so not for reduced motion) lift. */
function dissolving(amount, reducedMotion, lift = 10) {
  if (!(amount > 0)) return undefined;
  return { opacity: 1 - amount, filter: `blur(${(amount * 6).toFixed(2)}px)`,
    ...(reducedMotion ? null : { transform: `translateY(${-amount * lift}px)` }) };
}

/**
 * Where the surviving phrase glides to: the middle of the emptied screen, grown
 * to a title-card size that still fits a phone. Measured once, from its resting
 * place, just before it starts to move.
 */
function measureGlide(element) {
  const rect = element.getBoundingClientRect();
  if (!rect.width) return null;
  const { innerWidth: width, innerHeight: height } = window;
  return {
    x: width / 2 - (rect.left + rect.width / 2),
    y: height * 0.53 - (rect.top + rect.height / 2),
    scale: Math.max(1, Math.min(1.6, (width * 0.86) / rect.width))
  };
}

/** The phrase part-way along its glide (0→1) to `to`, grown by `push` as it leaves. */
function phraseTransform(to, glide, push) {
  if (!to && push === 1) return undefined;
  const { x = 0, y = 0, scale = 1 } = to ?? {};
  return `translate(${x * glide}px, ${y * glide}px) scale(${(1 + (scale - 1) * glide) * push})`;
}

export default function TextOverlay({ time, reducedMotion = false }) {
  const frame = introCopyFrame(time);
  const title = reducedMotion ? 1 : ramp(time, TITLE_START, TITLE_END);
  // The title slams down from over-size; the tagline follows a beat later.
  const slam = reducedMotion ? 1 : backOut(title);
  const tag = reducedMotion ? 1 : ramp(time, TITLE_START + 0.2, TITLE_END + 0.3);
  const outro = introOutro(time, reducedMotion);
  const phrase = useRef(null);
  const glide = useRef(null);
  const middle = useRef(null);
  const middleWidth = useRef(0);
  useLayoutEffect(() => {
    if (middle.current && outro.join === 0) middleWidth.current = middle.current.offsetWidth;
    if (time < DISSOLVE_START || reducedMotion) glide.current = null;
    else if (!glide.current && phrase.current) glide.current = measureGlide(phrase.current);
  });
  // The phrase pushes through into the menu as it leaves.
  const phraseMove = phraseTransform(outro.glide > 0 ? glide.current : null, outro.glide, reducedMotion ? 1 : (1 + 0.6 * outro.join) * (1 + 0.25 * outro.exit));
  const chrome = outro.chrome > 0 ? { opacity: 1 - outro.chrome } : undefined;
  return (
    <>
      <div className="opening-edge" aria-hidden="true" style={chrome} />
      <div className="opening-brand" aria-hidden="true" style={chrome}><WormWordmark /></div>
      <div className="opening-copy" aria-hidden="true">
        {!reducedMotion && title === 0 && frame && <div className="opening-copy-beat opening-trailer-beat" key={frame.beat.start}>
          <h1 className="opening-poem-line">{frame.words.map((word, index) => <React.Fragment key={index}>
            {index > 0 ? ' ' : null}<Word word={word} index={index} dissolve={frame.dissolve} />
          </React.Fragment>)}</h1>
        </div>}
        {title > 0 && <div className="opening-copy-beat">
          <h1 className="opening-title" style={reducedMotion ? dissolving(outro.title, true) : {
            opacity: Math.min(1, title * 3) * (1 - outro.title),
            filter: outro.title > 0 ? `blur(${(outro.title * 8).toFixed(2)}px)` : undefined,
            transform: `translateY(${-outro.title * 18}px) scale(${1 + (1 - slam) * 0.6 + outro.title * 0.06}) `
              + `rotate(${(1 - title) * -4}deg)`
          }}><WormWordmark animated={!reducedMotion} /></h1>
          <p className="opening-tagline" style={reducedMotion ? undefined : {
            opacity: tag, transform: `translateY(${(1 - backOut(tag)) * 18}px)`
          }}>
            <span style={{ display: 'block', textWrap: 'balance' }}>{LEAD.map((text, index) => <React.Fragment key={index}>
              {index > 0 ? ' ' : null}
              <span className="opening-poem-word" style={dissolving(outroWordFade(time, index), reducedMotion)}>{text}</span>
            </React.Fragment>)}</span>
            {/* The last line descends, loses its middle, then its two stickers
                meet edge to edge and turn together for the final colour swap. */}
            <span ref={phrase} className="opening-final-phrase" style={{ opacity: 1 - outro.exit, transform: phraseMove }}>
              <span className="opening-poem-word opening-word-tile">
                <Tile text={FLIP} faces={tileFacesOf(FLIP)} turn={outro.turns[0]} />
              </span>
              <span className="opening-through" style={{
                width: outro.join > 0 ? middleWidth.current * (1 - outro.join) : undefined
              }}><span ref={middle} style={dissolving(outro.through, reducedMotion, 14)}>{THROUGH}</span></span>
              <span className="opening-poem-word opening-word-tile">
                <Tile text={CUBE} faces={tileFacesOf(CUBE)} turn={outro.turns[1]} />
              </span>
            </span>
          </p>
        </div>}
      </div>
      <div className="opening-progress" aria-hidden="true" style={chrome}><span style={{ transform: `scaleX(${reducedMotion ? 1 : Math.min(1, time / INTRO_END)})` }} /></div>
    </>
  );
}
