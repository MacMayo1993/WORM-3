// src/worm/OrbInventoryHUD.jsx
// Orb inventory display with two modes:
//   compact=true  — popover card (6 color coins), rendered inside the glance strip's orb chip
//   compact=false — persistent tracker card; the parent positions it (WormCrawlerHUD
//                   mounts it centered below the glance strip)
// Styled to match the worm HUD's light paper panels, not the old neon glass.

import React from 'react';
import { UI_FONT } from '../utils/uiTheme.js';

const FACE_ORDER = [1, 2, 3, 4, 5, 6];
const FONT = UI_FONT;

// Match WormCrawlerHUD's paper panel constants
const PANEL_BG = 'rgba(255, 255, 255, 0.92)';
const PANEL_BORDER = 'rgba(15, 23, 42, 0.12)';
const PANEL_SHADOW = '0 4px 16px rgba(15, 23, 42, 0.18)';
const TEXT_DARK = '#0f172a';
const TEXT_MUTED = 'rgba(15, 23, 42, 0.55)';

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
      background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 45%), ${color}`,
      border: '2px solid rgba(255, 255, 255, 0.9)',
      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.28), inset 0 -2px 3px rgba(0, 0, 0, 0.18)',
    }}
  >
    <span
      style={{
        fontSize,
        fontWeight: 800,
        fontFamily: FONT,
        color: '#ffffff',
        lineHeight: 1,
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.55)',
      }}
    >
      {count}
    </span>
  </div>
);

export default function OrbInventoryHUD({ orbInventory, faceColors, compact = false, mobile = false }) {
  if (!orbInventory || !faceColors) return null;

  const activeEntries = FACE_ORDER.filter((faceId) => (orbInventory[faceId] ?? 0) > 0);
  const total = FACE_ORDER.reduce((sum, faceId) => sum + (orbInventory[faceId] ?? 0), 0);
  const isEmpty = total === 0;

  if (compact) {
    return (
      <div
        style={{
          position: 'absolute',
          top: '100%',
          right: -8,
          marginTop: 6,
          zIndex: 200,
          pointerEvents: 'auto',
        }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: PANEL_BG,
            borderRadius: 14,
            border: `1px solid ${PANEL_BORDER}`,
            boxShadow: PANEL_SHADOW,
            whiteSpace: 'nowrap',
          }}
        >
          {isEmpty ? (
            <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: FONT, fontStyle: 'italic' }}>
              no orbs yet
            </span>
          ) : (
            activeEntries.map((faceId) => (
              <OrbCoin
                key={faceId}
                color={faceColors[faceId] ?? '#888'}
                count={orbInventory[faceId]}
                coinSize={30}
                fontSize={13}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // Persistent tracker card — parent handles positioning
  const coinSize = mobile ? 26 : 32;
  const coinFont = mobile ? 12 : 14;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: mobile ? 7 : 12,
        padding: mobile ? '6px 10px' : '8px 14px',
        background: PANEL_BG,
        borderRadius: 14,
        border: `1px solid ${PANEL_BORDER}`,
        boxShadow: PANEL_SHADOW,
        opacity: isEmpty ? 0.75 : 1,
        transition: 'opacity 0.3s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontSize: 9, color: TEXT_MUTED, letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: FONT, fontWeight: 700, marginBottom: 3 }}>
          Orb Reserve
        </span>
        <span style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, fontFamily: FONT, color: TEXT_DARK }}>
          {total}
        </span>
      </div>
      {!isEmpty && (
        <div style={{ width: 1, alignSelf: 'stretch', background: PANEL_BORDER, margin: '2px 0' }} />
      )}
      {isEmpty ? (
        <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: FONT, fontStyle: 'italic' }}>
          collect orbs to heal tunnels
        </span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 4 : 8 }}>
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
