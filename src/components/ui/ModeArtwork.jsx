import React from 'react';
import { modeArtwork } from '../../utils/modeArtwork.js';
import './screenDesign.css';

export default function ModeArtwork({ mode, className = '' }) {
  return <svg className={`mode-artwork ${className}`} viewBox="0 0 160 160" fill="none" aria-hidden="true" focusable="false">
    {modeArtwork(mode).map((p, i) => <path key={i} d={p.d} stroke={p.width ? 'currentColor' : 'none'} strokeWidth={p.width}
      fill={p.fill ? 'currentColor' : 'none'} opacity={p.opacity} strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}

export function ScreenHeading({ mode, title, detail }) {
  return <header className="screen-heading">
    <div><h1>{title}</h1>{detail && <p>{detail}</p>}</div>
    <ModeArtwork mode={mode} />
  </header>;
}
