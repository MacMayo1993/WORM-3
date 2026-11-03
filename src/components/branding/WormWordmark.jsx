import React from 'react';
import { RUBIKS_CLASSIC } from '../../utils/constants.js';
import './wormWordmark.css';

const WORM_BRAND_COLORS = [RUBIKS_CLASSIC.red, RUBIKS_CLASSIC.orange, RUBIKS_CLASSIC.green, RUBIKS_CLASSIC.blue];

/** One mark for the menu, cinematic, loading screens, and inline game name.
 * The exponent is a small vector sculpture, not six tiny rotating numerals:
 * its silhouette and single, front-facing 3 stay readable at every size. */
export default function WormWordmark({ inline = false, menu = false, animated = false }) {
  return <span className={`worm-wordmark${inline ? ' worm-wordmark--inline' : ''}${menu ? ' worm-wordmark--menu' : ''}${animated ? ' worm-wordmark--animated' : ''}`}
    role="img" aria-label="WORM cubed">
    <span className="worm-wordmark-letters" aria-hidden="true">
      {[...'WORM'].map((letter, index) => <span key={letter} className="worm-wordmark-letter"
        style={{ color: WORM_BRAND_COLORS[index], '--letter-delay': `${index * .09}s` }}>{letter}</span>)}
    </span>
    <svg className="worm-wordmark-cube" viewBox="0 0 80 88" aria-hidden="true" focusable="false">
      <g stroke="#182a31" strokeWidth="4" strokeLinejoin="round">
        <path d="M7 20 29 7 73 20 73 62 51 75 7 62Z" fill="#182a31" transform="translate(0 3)" />
        <path d="M7 20 29 7 73 20 51 33Z" fill={RUBIKS_CLASSIC.white} />
        <path d="M51 33 73 20 73 62 51 75Z" fill={RUBIKS_CLASSIC.blue} />
        <path d="M7 20 51 33 51 75 7 62Z" fill={RUBIKS_CLASSIC.yellow} />
      </g>
      {/* Bevels catch the same upper-left light as the letters. */}
      <path d="M11 25 47 36M11 25V58M55 37 69 28" fill="none" stroke="#fffdf2" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />
      <path d="M51 33 73 20" fill="none" stroke="#182a31" strokeWidth="4" />
      <path d="M18 14 62 27M40 10 18 23M56 15 34 28" fill="none" stroke="#182a31" strokeOpacity=".18" strokeWidth="1.5" />
      <text x="0" y="0" transform="matrix(1 .295 0 1 17 57)" fill="#182a31" fontSize="34" fontFamily="var(--display-font, Bungee), sans-serif">3</text>
    </svg>
  </span>;
}
