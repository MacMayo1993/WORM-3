// src/worm/OrbInventoryHUD.jsx
// In-game orb tracker — shows how many color orbs the worm is carrying (spent on
// tunnel healing). Redesigned for legibility: a bold "ORB RESERVE" panel with a
// prominent running total plus large, high-contrast color coins, each showing its
// count centered inside. Keeps the RP² Möbius motif as the panel crest.

import React from 'react';
import { isMobile } from '../utils/device.js';

const FACE_ORDER = [1, 2, 3, 4, 5, 6];
const FONT = "'Courier New', monospace";
const isSmall = typeof window !== 'undefined' && window.innerWidth < 380;

// Small Möbius crest used as the panel's leading glyph — keeps the manifold theme.
const MobiusCrest = ({ size = 22 }) => {
  const h = Math.round(size * 0.62);
  const c = 'rgba(190,210,255,0.85)';
  return (
    <svg width={size} height={h} viewBox="-15 -9.5 30 19" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M 0,0 C -1.5,-7 -13,-7 -13,0 C -13,7 -1.5,7 0,0" stroke={c} strokeWidth="2.2" strokeOpacity="0.5" strokeLinecap="round" />
      <path d="M 0,0 C 1.5,7 13,7 13,0 C 13,-7 1.5,-7 0,0" stroke={c} strokeWidth="2.2" strokeOpacity="0.5" strokeLinecap="round" />
      <path d="M -3.5,-3 L 3.5,3" stroke="rgba(10,12,28,0.95)" strokeWidth="5" strokeLinecap="round" />
      <path d="M -3.5,3 L 3.5,-3" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
};

// A single color coin: a glowing disc filled with the face color, the count
// rendered bold in its center. Sized so 1–3 digit counts stay readable.
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
      boxShadow: `0 0 10px ${color}, 0 0 18px ${color}66, inset 0 1px 4px rgba(255,255,255,0.35)`
    }}
  >
    <span
      style={{
        fontSize,
        fontWeight: 800,
        fontFamily: FONT,
        color: '#ffffff',
        lineHeight: 1,
        textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8)'
      }}
    >
      {count}
    </span>
  </div>
);

export default function OrbInventoryHUD({ orbInventory, faceColors }) {
  if (!orbInventory || !faceColors) return null;

  const activeEntries = FACE_ORDER.filter((faceId) => (orbInventory[faceId] ?? 0) > 0);
  const total = FACE_ORDER.reduce((sum, faceId) => sum + (orbInventory[faceId] ?? 0), 0);
  const isEmpty = total === 0;

  const coinSize = isSmall ? 28 : isMobile ? 32 : 38;
  const coinFont = isSmall ? 13 : isMobile ? 15 : 17;
  const totalFont = isSmall ? 22 : isMobile ? 26 : 32;

  return (
    <div
      style={{
        position: 'absolute',
        ...(isMobile
          ? { top: '76px', right: '12px', alignItems: 'flex-end' }
          : { bottom: '22px', left: '50%', transform: 'translateX(-50%)', alignItems: 'center' }),
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        pointerEvents: 'none',
        zIndex: 101,
        opacity: isEmpty ? 0.55 : 1,
        transition: 'opacity 0.3s ease'
      }}
    >
      {/* Panel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isSmall ? 10 : 14,
          padding: isMobile ? '8px 14px' : '10px 18px',
          background: 'linear-gradient(180deg, rgba(16,20,40,0.94) 0%, rgba(8,10,24,0.94) 100%)',
          borderRadius: '16px',
          border: '1.5px solid rgba(150,180,255,0.35)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset'
        }}
      >
        {/* Crest + total */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 8 : 11 }}>
          <MobiusCrest size={isSmall ? 20 : isMobile ? 22 : 26} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span
              style={{
                fontSize: isSmall ? 8 : 9,
                color: 'rgba(190,210,255,0.7)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontFamily: FONT,
                marginBottom: 3
              }}
            >
              Orb Reserve
            </span>
            <span
              style={{
                fontSize: totalFont,
                fontWeight: 800,
                fontFamily: FONT,
                color: '#ffffff',
                textShadow: '0 0 12px rgba(150,180,255,0.6)'
              }}
            >
              {total}
            </span>
          </div>
        </div>

        {/* Divider */}
        {!isEmpty && (
          <div style={{ width: 1.5, alignSelf: 'stretch', background: 'rgba(150,180,255,0.22)', margin: '2px 0' }} />
        )}

        {/* Per-color coins */}
        {isEmpty ? (
          <span
            style={{
              fontSize: isSmall ? 10 : 11,
              color: 'rgba(190,210,255,0.5)',
              fontFamily: FONT,
              fontStyle: 'italic'
            }}
          >
            collect orbs to heal tunnels
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 7 : 9 }}>
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
