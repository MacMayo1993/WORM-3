import React from 'react';

// Small, local vector marks keep the mode crisp at every screen size.
export function ChaosGlyph({ kind = 'storm', className = '' }) {
  const paths = {
    storm: 'M13 2 4 14h7l-1 8 10-13h-8l1-7Z',
    SURVIVOR: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6',
    PAIR: 'M8 4H3v5h5V4Zm13 11h-5v5h5v-5ZM8 7h5l4 4M7 13l4 4h5',
    FIRST_OUT: 'M6 3v18M6 4h13l-3 4 3 4H6',
    SPEED: 'M9 2h6M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2M18 5l2-2',
    heal: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
    trophy: 'M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H3v3a5 5 0 0 0 5 5m8-8h5v3a5 5 0 0 1-5 5m-4 1v5m-5 2h10',
  };
  return <svg className={`chaos-glyph ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind] || paths.storm} /></svg>;
}

export function ChaosEmblem({ colors } = {}) {
  return <div className="chaos-emblem" aria-hidden="true">
    <div className="chaos-orbit" /><div className="chaos-orbit chaos-orbit-inner" />
    <div className="chaos-shards">{Array.from({ length: 9 }, (_, i) => <i key={i} style={colors ? { background: colors[(i % 6) + 1].hex } : undefined} />)}</div>
    <span className="chaos-emblem-cross">+</span><span className="chaos-emblem-coord">06 / 02</span>
  </div>;
}
