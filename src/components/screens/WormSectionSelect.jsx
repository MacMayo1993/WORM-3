import React from 'react';
import './wormSectionSelect.css';

export default function WormSectionSelect({ value, onChange }) {
  return <select className="worm-section-select" aria-label="Worm mode section" value={value}
    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}
    onChange={event => onChange(event.target.value)}>
    <option value="story">Story Mode</option>
    <option value="free">Free Play</option>
    <option value="customize">Worm Customization</option>
  </select>;
}
