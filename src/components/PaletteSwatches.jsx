import React from 'react';
import './PaletteSwatches.css';

// Keep every face visible in the same order wherever a palette is offered.
export default function PaletteSwatches({ colors, className = '' }) {
  return <span className={`palette-swatches ${className}`.trim()} aria-hidden="true">
    {[1, 2, 3, 4, 5, 6].map(id => <span key={id} style={{ background: colors[id] }} />)}
  </span>;
}
