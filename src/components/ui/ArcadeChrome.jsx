import React from 'react';
import WormWordmark from '../branding/WormWordmark.jsx';
import './arcadeChrome.css';

/** Shared game identity and thumb-sized controls for mode selection and setup. */
export function ArcadeHeader({ onSettings, onHome }) {
  return <header className="arcade-brand">
    {onHome ? <button className="arcade-home" onClick={onHome} aria-label="Back to main menu"><WormWordmark arcade /></button> : <span><WormWordmark arcade /></span>}
    {onSettings && <button type="button" className="arcade-icon-button" onClick={onSettings} aria-label="Settings">
      <svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor" aria-hidden="true"><path d="m10 2-1 3-2 1-3-.5-2 3 2 2v3l-2 2 2 3 3-.5 2 1 1 3h4l1-3 2-1 3 .5 2-3-2-2v-3l2-2-2-3-3 .5-2-1-1-3Zm2 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" /></svg>
    </button>}
  </header>;
}

export function ArcadeAction({ children, className = '', ...props }) {
  return <button type="button" className={`arcade-action ${className}`} {...props}>
    <svg aria-hidden="true" viewBox="0 0 24 28" width="24" height="28"><path d="M3 2Q1 1 1 4v20q0 3 3 1L22 15q2-1 0-3Z" fill="currentColor" /></svg>
    <span>{children}</span>
  </button>;
}

/** Decorative art only; the actual game continues to use the shared 3D canvas. */
export function ArcadeArtwork({ mode, className = '' }) {
  const source = ['worm', 'teach', 'chaos'].includes(mode) ? mode : 'cube';
  return <div className={`arcade-artwork arcade-artwork--${mode} ${className}`} aria-hidden="true">
    <img className="arcade-hero-image" src={`${import.meta.env.BASE_URL}images/arcade/${source}.webp`} alt="" draggable="false" width="768" height="768" />
    {mode === 'random' && <><span className="arcade-spark arcade-spark--one">✦</span><span className="arcade-spark arcade-spark--two">✦</span></>}
    {mode === 'store' && <span className="arcade-store-token">★</span>}
  </div>;
}
