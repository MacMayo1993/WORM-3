// CubeSizeSlider.jsx — cube size as one continuous choice instead of six cards.
//
// Size is the only setting in the wizard that changes the puzzle rather than its
// looks, and it is the one people fiddle with: a grid of cards makes you compare
// six static thumbnails, where a slider lets you sweep 2×2 → 7×7 and watch the
// hero cube grow under your thumb. Parked at 3×3, which is what most players want.
//
// The visible slider is drawn by hand; a transparent native range input sits on
// top of it, so dragging, tapping, arrow keys, Home/End, and screen-reader
// semantics all come for free rather than being reimplemented badly.

import React from 'react';
import { PAPER_TEXT, PAPER_TEXT_MUTED, PAPER_TEXT_FAINT, PAPER_CARD_SHADOW } from '../../../utils/uiTheme.js';
import { SIZE_TIERS, sizeTier } from './shared.jsx';

const KNOB = 30;
const DEFAULT_SIZE = 3;

// Where a stop sits along the rail. The knob's travel is inset by half its own
// width at each end so it never hangs off, and the detents and their labels have
// to use the same curve or they drift away from the knob they belong to.
const stopAt = (n, tiers) => {
  const index = Math.max(0, tiers.findIndex(tier => tier.n === n));
  const p = tiers.length > 1 ? index / (tiers.length - 1) : 0;
  return `calc(${p * 100}% + ${(0.5 - p) * KNOB}px)`;
};

export default function CubeSizeSlider({ value, onChange, accent, accentShadow, tiers = SIZE_TIERS }) {
  const tier = sizeTier(value, tiers);
  const knobLeft = stopAt(value, tiers);

  return (
    <div style={{ padding: '4px 2px 0' }}>
      <div style={{ position: 'relative', height: `${KNOB + 6}px`, display: 'flex', alignItems: 'center' }}>
        {/* Track — sunk into the paper, dark enough that the unfilled stretch
            still reads as a rail on the wizard's cream sheet. */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '10px', borderRadius: '6px',
          background: '#ddd6ca',
          boxShadow: 'inset 0 2px 5px rgba(83,72,56,0.30), 0 1px 0 rgba(255,255,255,0.65)',
          border: '1px solid #c9c1b5'
        }} />

        {/* Filled portion */}
        <div style={{
          position: 'absolute', left: 0, height: '10px', borderRadius: '6px',
          width: knobLeft,
          background: `linear-gradient(90deg, ${accent}bb, ${accent})`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25)`,
          transition: 'width 0.16s cubic-bezier(0.22,1,0.36,1)'
        }} />

        {/* Detents */}
        {tiers.map(({ n }) => (
          <div
            key={n}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: stopAt(n, tiers),
              transform: 'translateX(-50%)',
              width: '4px', height: '4px', borderRadius: '50%',
              background: n <= value ? 'rgba(255,255,255,0.75)' : '#a89f92',
              transition: 'background 0.16s ease'
            }}
          />
        ))}

        {/* Knob — carries the number, so the value is legible mid-drag */}
        <div style={{
          position: 'absolute',
          left: knobLeft,
          transform: 'translateX(-50%)',
          width: `${KNOB}px`, height: `${KNOB}px`, borderRadius: '50%',
          background: '#fffdf7',
          border: `2.5px solid ${accent}`,
          boxShadow: `0 3px 0 ${accentShadow}55, 0 5px 14px ${accent}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 800, color: accent,
          transition: 'left 0.16s cubic-bezier(0.22,1,0.36,1)',
          pointerEvents: 'none'
        }}>
          {value}
        </div>

        <input
          type="range"
          min={0}
          max={tiers.length - 1}
          step={1}
          value={Math.max(0, tiers.findIndex(option => option.n === value))}
          onChange={e => onChange(tiers[parseInt(e.target.value, 10)].n)}
          aria-label="Cube size"
          aria-valuetext={`${tier.name}, ${tier.tag}`}
          style={{
            position: 'absolute', left: 0, right: 0, width: '100%',
            height: `${KNOB + 6}px`, margin: 0, opacity: 0, cursor: 'pointer',
            WebkitAppearance: 'none', appearance: 'none', background: 'transparent'
          }}
        />
      </div>

      {/* Stops — tappable as well, for anyone who knows the size they want.
          Positioned on the same curve as the detents so each number sits under
          the notch it selects. */}
      <div style={{ position: 'relative', height: '30px', marginTop: '2px' }}>
        {tiers.map(({ n }) => {
          const selected = n === value;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              aria-label={`${n} by ${n}`}
              style={{
                position: 'absolute', left: stopAt(n, tiers), transform: 'translateX(-50%)',
                background: 'none', border: 'none', padding: '4px 8px 0',
                cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px'
              }}
            >
              <span style={{
                fontSize: '11px', fontWeight: selected ? 800 : 600,
                color: selected ? accent : PAPER_TEXT_FAINT,
                transition: 'color 0.16s ease'
              }}>
                {n}
              </span>
              {n === DEFAULT_SIZE && (
                <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PAPER_TEXT_FAINT }}>
                  Normal
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* What you just landed on */}
      <div style={{
        marginTop: '10px', padding: '12px 14px', borderRadius: '12px',
        background: 'rgba(255,255,255,0.55)', border: `1.5px solid ${accent}33`,
        boxShadow: `0 2px 0 ${PAPER_CARD_SHADOW}`,
        display: 'flex', alignItems: 'baseline', gap: '8px'
      }}>
        <span style={{ fontSize: '17px', fontWeight: 800, color: PAPER_TEXT, letterSpacing: '-0.4px' }}>{tier.name}</span>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent }}>{tier.tag}</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: PAPER_TEXT_MUTED, textAlign: 'right' }}>{tier.desc}</span>
      </div>
    </div>
  );
}
