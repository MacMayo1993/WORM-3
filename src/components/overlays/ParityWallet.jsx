// ParityWallet — compact PP balance chip.
// Reads parityPoints from the store directly.
// Flashes green on earn, red on spend.
// Props:
//   dark    — true for dark-background contexts (main menu, betting screen)
//             false (default) for light panels (TopMenuBar, WormHUD)
//   neutral — drop the cyan family for white + green. The worm HUD's status bar
//             is white text with one green accent (matching the thumb tray), and a
//             cyan chip sitting in it read as a fifth unrelated colour.

import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { UI_FONT, TEXT_XS } from '../../utils/uiTheme.js';

const FONT = UI_FONT;

export default function ParityWallet({ dark = false, neutral = false }) {
  const parityPoints = useGameStore((s) => s.parityPoints);
  const prevRef = useRef(parityPoints);
  const [flash, setFlash] = useState(null); // 'up' | 'down' | null
  const timerRef = useRef(null);

  useEffect(() => {
    if (parityPoints === prevRef.current) return;
    const dir = parityPoints > prevRef.current ? 'up' : 'down';
    prevRef.current = parityPoints;
    setFlash(dir);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlash(null), 900);
  }, [parityPoints]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const upColor   = '#4ade80';
  const downColor = '#f87171';
  const baseColor = neutral ? upColor : dark ? '#22d3ee' : '#0e7490';
  const numColor  = neutral ? 'rgba(255,253,242,0.86)' : dark ? '#22d3ee' : '#0891B2';
  const subColor  = neutral ? 'rgba(255,253,242,0.55)' : dark ? 'rgba(34,211,238,0.55)' : 'rgba(8,145,178,0.55)';
  const borderBase = neutral ? 'rgba(255,245,220,0.18)' : dark ? 'rgba(8,145,178,0.30)' : 'rgba(8,145,178,0.22)';
  const bgBase     = neutral ? 'rgba(250,247,238,0.07)' : dark ? 'rgba(8,145,178,0.12)' : 'rgba(8,145,178,0.07)';

  const flashColor  = flash === 'up' ? upColor : flash === 'down' ? downColor : null;
  const borderColor = flashColor ? `${flashColor}45` : borderBase;
  const bgColor     = flash === 'up'
    ? 'rgba(74,222,128,0.13)'
    : flash === 'down'
      ? 'rgba(248,113,113,0.11)'
      : bgBase;

  return (
    <div
      title="Parity Points balance"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '4px 10px',
        borderRadius: '100px',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        transition: 'background 0.35s ease, border-color 0.35s ease',
        cursor: 'default',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Diamond icon */}
      <span style={{
        fontSize: TEXT_XS,
        color: flashColor ?? baseColor,
        fontWeight: 900,
        lineHeight: 1,
        transition: 'color 0.35s ease',
      }}>◈</span>

      {/* Number */}
      <span style={{
        fontSize: '12px',
        fontWeight: 800,
        color: flashColor ?? numColor,
        fontFamily: FONT,
        letterSpacing: '0.02em',
        lineHeight: 1,
        transition: 'color 0.35s ease',
      }}>{parityPoints.toLocaleString()}</span>

      {/* Unit */}
      <span style={{
        fontSize: TEXT_XS,
        fontWeight: 600,
        color: subColor,
        fontFamily: FONT,
        lineHeight: 1,
      }}>PP</span>
    </div>
  );
}
