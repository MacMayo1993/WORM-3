// src/worm/OrbInventoryHUD.jsx
// 2D HUD showing the worm's color-orb inventory (used for tunnel healing).
// Crystal-gem dot aesthetic to match the 3D orb visual design.

import React from 'react';
import { isMobile } from '../utils/device.js';

const FACE_ORDER  = [1, 2, 3, 4, 5, 6];
const FONT        = "'Courier New', monospace";
const isSmall     = typeof window !== 'undefined' && window.innerWidth < 380;

// Luminance check — returns true for near-white face colors
const isLightColor = (hex) => {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.82;
};

// Hexagon clip-path — gives each orb dot a crystal/gem silhouette
const HEX_CLIP = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)';

export default function OrbInventoryHUD({ orbInventory, faceColors }) {
  if (!orbInventory || !faceColors) return null;

  const activeEntries = FACE_ORDER.filter(faceId => (orbInventory[faceId] ?? 0) > 0);
  if (activeEntries.length === 0) return null;

  const gemSize  = isSmall ? 9  : isMobile ? 11 : 14;
  const fontSize = isSmall ? 12 : isMobile ? 13 : 15;

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

      {/* Gem row */}
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
          const light = isLightColor(color);

          return (
            <div key={faceId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Crystal-gem dot */}
              <div style={{
                width:  gemSize,
                height: gemSize,
                background: color,
                clipPath: HEX_CLIP,
                flexShrink: 0,
                boxShadow: `0 0 6px ${color}, 0 0 14px ${color}55`,
                outline: light ? '1px solid rgba(255,255,255,0.30)' : 'none',
              }} />

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
