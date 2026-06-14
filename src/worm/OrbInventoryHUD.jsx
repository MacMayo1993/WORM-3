// src/worm/OrbInventoryHUD.jsx
// 2D HUD showing the worm's color-orb inventory (used for tunnel healing).
// Möbius-strip dot aesthetic to match the RP² manifold theme.

import React from 'react';
import { isMobile } from '../utils/device.js';

const FACE_ORDER  = [1, 2, 3, 4, 5, 6];
const FONT        = "'Courier New', monospace";
const isSmall     = typeof window !== 'undefined' && window.innerWidth < 380;

// Möbius strip icon — figure-8 with a visible crossing (front strand over back)
const MobiusIcon = ({ color, size = 18 }) => {
  const h = Math.round(size * 0.62);
  return (
    <svg width={size} height={h} viewBox="-15 -9.5 30 19" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      {/* Left lobe — back half, dimmed */}
      <path
        d="M 0,0 C -1.5,-7 -13,-7 -13,0 C -13,7 -1.5,7 0,0"
        stroke={color} strokeWidth="2.2" strokeOpacity="0.48" strokeLinecap="round"
      />
      {/* Right lobe — back half, dimmed */}
      <path
        d="M 0,0 C 1.5,7 13,7 13,0 C 13,-7 1.5,-7 0,0"
        stroke={color} strokeWidth="2.2" strokeOpacity="0.48" strokeLinecap="round"
      />
      {/* Crossing mask — punches out behind the front strand */}
      <path d="M -3.5,-3 L 3.5,3" stroke="rgba(10,12,28,0.95)" strokeWidth="5" strokeLinecap="round" />
      {/* Front crossing strand */}
      <path d="M -3.5,3 L 3.5,-3" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      {/* Soft glow on front strand */}
      <path d="M -3.5,3 L 3.5,-3" stroke={color} strokeWidth="5.5" strokeOpacity="0.18" strokeLinecap="round" />
      {/* Outer glow ring around entire icon */}
      <ellipse cx="0" cy="0" rx="13.5" ry="8" stroke={color} strokeWidth="0.7" strokeOpacity="0.22" />
    </svg>
  );
};

export default function OrbInventoryHUD({ orbInventory, faceColors }) {
  if (!orbInventory || !faceColors) return null;

  const activeEntries = FACE_ORDER.filter(faceId => (orbInventory[faceId] ?? 0) > 0);
  if (activeEntries.length === 0) return null;

  const iconSize  = isSmall ? 16 : isMobile ? 18 : 22;
  const fontSize  = isSmall ? 12 : isMobile ? 13 : 15;

  return (
    <div style={{
      position: 'absolute',
      ...(isMobile
        ? { top: '76px', right: '12px', alignItems: 'flex-end' }
        : { bottom: '22px', left: '50%', transform: 'translateX(-50%)', alignItems: 'center' }
      ),
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      pointerEvents: 'none',
      zIndex: 101,
    }}>

      {/* Label */}
      <div style={{
        fontSize: isSmall ? 7 : isMobile ? 8 : 9,
        color: 'rgba(200,220,255,0.45)',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontFamily: FONT,
        textAlign: isMobile ? 'right' : 'center',
      }}>
        Orbs
      </div>

      {/* Orb row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isSmall ? 7 : isMobile ? 9 : 12,
        padding: isMobile ? '5px 12px' : '6px 16px',
        background: 'rgba(10,12,28,0.82)',
        borderRadius: '100px',
        border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.45)',
      }}>
        {activeEntries.map(faceId => {
          const count = orbInventory[faceId];
          const color = faceColors[faceId] ?? '#888888';

          return (
            <div key={faceId} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {/* Möbius strip icon */}
              <MobiusIcon color={color} size={iconSize} />

              {/* Count */}
              <span style={{
                fontSize,
                fontWeight: 700,
                color,
                fontFamily: FONT,
                textShadow: `0 0 8px ${color}`,
                minWidth: 14,
                lineHeight: 1,
              }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
