import React, { useState } from 'react';
import { UI_FONT, DISPLAY_FONT, GLASS_TEXT, GLASS_TEXT_MUTED } from '../../utils/uiTheme.js';

const PAIRS = [
  { id: 'red-orange', label: 'Red ↔ Orange', colors: ['#ef4444', '#f97316'], faceIds: [1, 4] },
  { id: 'green-blue', label: 'Green ↔ Blue', colors: ['#22c55e', '#3b82f6'], faceIds: [2, 5] },
  { id: 'white-yellow', label: 'White ↔ Yellow', colors: ['#ffffff', '#eab308'], faceIds: [3, 6] },
];

export default function DemoForecastPicker({ onPick }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 11500,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(2,3,10,0.88)',
      backdropFilter: 'blur(16px)',
      fontFamily: UI_FONT, textAlign: 'center', padding: 24,
    }}>
      <p style={{
        color: GLASS_TEXT_MUTED, fontSize: 12, fontWeight: 700,
        letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 8px',
      }}>
        Chaos Forecast
      </p>
      <h2 style={{
        fontFamily: DISPLAY_FONT, fontSize: 28, color: '#fff',
        margin: '0 0 8px', letterSpacing: '0.04em',
      }}>
        Which pair survives?
      </h2>
      <p style={{
        color: GLASS_TEXT, fontSize: 14, margin: '0 0 28px', maxWidth: 320,
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
              background: selected === pair.id ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
              border: selected === pair.id ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.10)',
              borderRadius: 12, cursor: 'pointer', fontFamily: UI_FONT,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: pair.colors[0] }} />
              <div style={{ width: 20, height: 20, borderRadius: 4, background: pair.colors[1] }} />
            </div>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{pair.label}</span>
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
          background: selected ? '#3b82f6' : 'rgba(59,130,246,0.3)',
          color: '#fff', border: 'none', borderRadius: 10,
          fontFamily: UI_FONT, fontSize: 15, fontWeight: 600,
          cursor: selected ? 'pointer' : 'default',
          opacity: selected ? 1 : 0.5,
          letterSpacing: '0.04em',
          transition: 'all 0.2s ease',
        }}
      >
        Lock In
      </button>
    </div>
  );
}
