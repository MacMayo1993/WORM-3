// src/worm/OrbInventoryHUD.jsx
// The orb reserve — one coin per face colour, with the count the worm is
// carrying. Renders as a bare row (no panel of its own): it is the second row
// of the worm HUD's status bar, so the surface, blur and border belong to that
// bar. It used to draw its own white card, which stacked a second floating
// panel under the top strip and repeated the total already shown there.

import React from 'react';
import { UI_FONT, NIGHT_TEXT, NIGHT_TEXT_MUTED } from '../utils/uiTheme.js';

const FACE_ORDER = [1, 2, 3, 4, 5, 6];
const FONT = UI_FONT;

const OrbCoin = ({ color, count, coinSize, fontSize }) => (
  <div
    style={{
      position: 'relative',
      width: coinSize,
      height: coinSize,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 48%), ${color}`,
      border: '1.5px solid rgba(255, 253, 242, 0.55)',
      boxShadow: '0 2px 6px rgba(10, 14, 8, 0.45), inset 0 -2px 4px rgba(0, 0, 0, 0.28)',
    }}
  >
    <span
      style={{
        fontSize,
        fontWeight: 800,
        fontFamily: FONT,
        fontVariantNumeric: 'tabular-nums',
        color: '#ffffff',
        lineHeight: 1,
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)',
      }}
    >
      {count}
    </span>
  </div>
);

export default function OrbInventoryHUD({ orbInventory, faceColors, mobile = false }) {
  if (!orbInventory || !faceColors) return null;

  const activeEntries = FACE_ORDER.filter((faceId) => (orbInventory[faceId] ?? 0) > 0);
  const total = FACE_ORDER.reduce((sum, faceId) => sum + (orbInventory[faceId] ?? 0), 0);

  const coinSize = mobile ? 26 : 30;
  const coinFont = mobile ? 11 : 13;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 10, minWidth: 0, flex: '1 1 auto' }}>
      <span
        style={{
          fontSize: 8,
          color: NIGHT_TEXT_MUTED,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontFamily: FONT,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        Reserve
      </span>

      {total === 0 ? (
        <span style={{ fontSize: 10.5, color: NIGHT_TEXT_MUTED, fontFamily: FONT, letterSpacing: 0.3 }}>
          collect orbs to heal tunnels
        </span>
      ) : (
        // Overflowing palettes scroll rather than squeeze the coins out of the bar.
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: mobile ? 6 : 8,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            color: NIGHT_TEXT,
          }}
        >
          {activeEntries.map((faceId) => (
            <OrbCoin
              key={faceId}
              color={faceColors[faceId] ?? '#888888'}
              count={orbInventory[faceId]}
              coinSize={coinSize}
              fontSize={coinFont}
            />
          ))}
        </div>
      )}
    </div>
  );
}
