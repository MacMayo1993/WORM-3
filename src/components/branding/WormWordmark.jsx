import React from 'react';
import './wormWordmark.css';

const WORM_BRAND_COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6'];
const ARCADE_COLORS = ['#20cb38', '#ff4b40', '#159fff', '#ffd02c'];

/** One mark for the menu, cinematic, loading screens, and inline game name. */
export default function WormWordmark({ inline = false, menu = false, animated = false, arcade = false }) {
  return <span className={`worm-wordmark${inline ? ' worm-wordmark--inline' : ''}${menu ? ' worm-wordmark--menu' : ''}${animated ? ' worm-wordmark--animated' : ''}`}
    role="img" aria-label="WORM cubed">
    <span className="worm-wordmark-letters" aria-hidden="true">
      {[...'WORM'].map((letter, index) => <span key={letter} className="worm-wordmark-letter"
        style={{ color: (arcade ? ARCADE_COLORS : WORM_BRAND_COLORS)[index], '--letter-delay': `${index * .15}s` }}>{letter}</span>)}
    </span>
    <span className="worm-wordmark-cube" aria-hidden="true"><span className="worm-wordmark-cube-inner">
      {['front', 'right', 'top', 'back', 'left', 'bottom'].map(face => <span key={face} className={`worm-wordmark-face worm-wordmark-face--${face}`}>3</span>)}
    </span></span>
  </span>;
}
