import React, { useState } from 'react';
import {
  UI_FONT, DISPLAY_FONT, UI_CREAM, UI_GOLD, UI_MOSS, UI_MOSS_LIGHT, UI_ACTION_SHADOW,
} from '../../utils/uiTheme.js';

const PAIRS = [
  { id: 'red-orange', label: 'Red ↔ Orange', colors: ['#ef4444', '#f97316'], faceIds: [1, 4] },
  { id: 'green-blue', label: 'Green ↔ Blue', colors: ['#22c55e', '#3b82f6'], faceIds: [2, 5] },
  { id: 'white-yellow', label: 'White ↔ Yellow', colors: ['#ffffff', '#eab308'], faceIds: [3, 6] },
];

export default function DemoForecastPicker({ onPick, onSkip }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 11500,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, rgba(24,31,18,0.34), rgba(24,31,18,0.62))',
      backdropFilter: 'blur(9px) saturate(1.03)',
      fontFamily: UI_FONT, textAlign: 'center', padding: 24,
    }}>
      <p style={{
        color: UI_GOLD, fontSize: 12, fontWeight: 800,
        letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 8px',
      }}>
        Chaos Forecast
      </p>
      <h2 style={{
        fontFamily: DISPLAY_FONT, fontSize: 28, color: UI_CREAM,
        margin: '0 0 8px', letterSpacing: '0.04em',
      }}>
        Which pair survives?
      </h2>
      <p style={{
        color: 'rgba(255,253,242,0.86)', fontSize: 14, margin: '0 0 28px', maxWidth: 320,
      }}>
        Chaos will flip tiles at random. One antipodal pair will be the last standing.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 280 }}>
        {PAIRS.map((pair) => (
          <button
            key={pair.id}
            type="button"
            onClick={() => setSelected(pair.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 20px',
              background: selected === pair.id ? 'rgba(95,127,74,0.30)' : 'rgba(255,255,255,0.06)',
              border: selected === pair.id ? `2px solid ${UI_MOSS_LIGHT}` : '1px solid rgba(255,245,220,0.18)',
              borderRadius: 12, cursor: 'pointer', fontFamily: UI_FONT,
              boxShadow: selected === pair.id ? UI_ACTION_SHADOW : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: pair.colors[0] }} />
              <div style={{ width: 20, height: 20, borderRadius: 4, background: pair.colors[1] }} />
            </div>
            <span style={{ color: UI_CREAM, fontSize: 15, fontWeight: 700, letterSpacing: '0.03em' }}>{pair.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!selected}
        onClick={() => {
          const pair = PAIRS.find((p) => p.id === selected);
          if (pair) onPick(pair);
        }}
        style={{
          marginTop: 28, padding: '12px 44px',
          background: selected ? UI_MOSS : 'rgba(95,127,74,0.30)',
          color: UI_CREAM, border: selected ? '1px solid rgba(159,219,122,0.55)' : '1px solid transparent', borderRadius: 999,
          fontFamily: UI_FONT, fontSize: 13, fontWeight: 800,
          cursor: selected ? 'pointer' : 'default',
          opacity: selected ? 1 : 0.5,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          transition: 'all 0.2s ease',
        }}
      >
        Lock In
      </button>

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          style={{
            marginTop: 14, padding: '10px 32px',
            background: 'transparent',
            color: 'rgba(255,253,242,0.72)', border: 'none', borderRadius: 10,
            fontFamily: UI_FONT, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', letterSpacing: '0.04em',
          }}
        >
          Skip ▶
        </button>
      )}
    </div>
  );
}
