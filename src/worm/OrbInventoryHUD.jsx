// src/worm/OrbInventoryHUD.jsx
// Orb inventory display with two modes:
//   compact=true  — popover card (6 color coins), rendered inside the glance strip's orb chip
//   compact=false — standalone floating panel (legacy, used on desktop)

import React from 'react';
import { UI_FONT } from '../utils/uiTheme.js';

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
      background: `radial-gradient(circle at 35% 30%, ${color} 0%, ${color} 55%, rgba(0,0,0,0.45) 140%)`,
      border: `2px solid ${color}`,
      boxShadow: `0 0 8px ${color}, 0 0 14px ${color}66, inset 0 1px 3px rgba(255,255,255,0.35)`,
    }}
  >
    <span
      style={{
        fontSize,
        fontWeight: 800,
        fontFamily: FONT,
        color: '#ffffff',
        lineHeight: 1,
        textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8)',
      }}
    >
      {count}
    </span>
  </div>
);

export default function OrbInventoryHUD({ orbInventory, faceColors, compact = false }) {
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
            background: 'rgba(15, 20, 40, 0.94)',
            borderRadius: 14,
            border: '1px solid rgba(150, 180, 255, 0.3)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 8px 28px rgba(0, 0, 0, 0.45)',
            whiteSpace: 'nowrap',
          }}
        >
          {isEmpty ? (
            <span style={{ fontSize: 11, color: 'rgba(190, 210, 255, 0.5)', fontFamily: FONT, fontStyle: 'italic' }}>
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

  // Legacy standalone mode (desktop)
  const coinSize = 38;
  const coinFont = 17;
  const totalFont = 32;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '22px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        pointerEvents: 'none',
        zIndex: 101,
        opacity: isEmpty ? 0.55 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 18px',
          background: 'linear-gradient(180deg, rgba(16,20,40,0.94) 0%, rgba(8,10,24,0.94) 100%)',
          borderRadius: '16px',
          border: '1.5px solid rgba(150,180,255,0.35)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: 9, color: 'rgba(190,210,255,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: FONT, marginBottom: 3 }}>
            Orb Reserve
          </span>
          <span style={{ fontSize: totalFont, fontWeight: 800, fontFamily: FONT, color: '#ffffff', textShadow: '0 0 12px rgba(150,180,255,0.6)' }}>
            {total}
          </span>
        </div>
        {!isEmpty && (
          <div style={{ width: 1.5, alignSelf: 'stretch', background: 'rgba(150,180,255,0.22)', margin: '2px 0' }} />
        )}
        {isEmpty ? (
          <span style={{ fontSize: 11, color: 'rgba(190,210,255,0.5)', fontFamily: FONT, fontStyle: 'italic' }}>
            collect orbs to heal tunnels
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
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
    </div>
  );
}
