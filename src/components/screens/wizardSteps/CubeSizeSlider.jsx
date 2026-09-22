// CubeSizeSlider.jsx — cube size as one continuous choice.
//
// Size is the only setting in the wizard that changes the puzzle rather than its
// looks, and it is the one people fiddle with: a grid of cards makes you compare
// static thumbnails, where a slider lets you sweep the supported sizes and watch the
// hero cube grow under your thumb. Parked at 3×3, which is what most players want.
//
// The visible slider is drawn by hand; a transparent native range input sits on
// top of it, so dragging, tapping, arrow keys, Home/End, and screen-reader
// semantics all come for free rather than being reimplemented badly.

import React, { useEffect, useRef } from 'react';
import { WIZ_BORDER_SOFT, WIZ_CARD_SHADOW, WIZ_SURFACE, WIZ_TEXT, WIZ_TEXT_FAINT, WIZ_TEXT_MUTED } from '../WizardChrome.jsx';
import { SIZE_TIERS, sizeTier } from './shared.jsx';

const KNOB = 30;

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
  const choicesRef = useRef(null);
  useEffect(() => {
    const row = choicesRef.current;
    const selected = row?.querySelector('[aria-pressed="true"]');
    if (!selected) return;
    // Reveal changes from the range/preview arrows without scrolling the page.
    const left = selected.offsetLeft;
    const right = left + selected.offsetWidth;
    if (left < row.scrollLeft) row.scrollLeft = left;
    else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth;
  }, [value, tiers]);

  return (
    <div style={{ padding: '4px 2px 0' }}>
      <div style={{ position: 'relative', height: '48px', display: 'flex', alignItems: 'center' }}>
        {/* Track — a shallow channel in the shared paper surface. */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '10px', borderRadius: '6px',
          background: WIZ_BORDER_SOFT,
          boxShadow: 'inset 0 1px 3px rgba(30,22,18,0.12)',
          border: `1px solid ${WIZ_BORDER_SOFT}`
        }} />

        {/* Filled portion */}
        <div style={{
          position: 'absolute', left: 0, height: '10px', borderRadius: '6px',
          width: knobLeft,
          background: `linear-gradient(90deg, ${accentShadow}, ${accent})`,
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
              background: n <= value ? 'rgba(255,255,255,0.85)' : WIZ_TEXT_MUTED,
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
          background: WIZ_SURFACE,
          border: `2.5px solid ${accent}`,
          boxShadow: `0 2px 0 ${WIZ_CARD_SHADOW}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 800, color: WIZ_TEXT,
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
          aria-valuetext={tier.name}
          style={{
            position: 'absolute', left: 0, right: 0, width: '100%',
            height: '48px', margin: 0, opacity: 0, cursor: 'pointer',
            WebkitAppearance: 'none', appearance: 'none', background: 'transparent'
          }}
        />
      </div>

      {/* One row in every mode; smaller screens can swipe to the larger sizes. */}
      <div ref={choicesRef} role="group" aria-label="Size choices" style={{ position: 'relative', display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', overscrollBehaviorX: 'contain', gap: '4px', marginTop: '4px', padding: '2px 0 6px' }}>
        {tiers.map(({ n }) => {
          const selected = n === value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${n} by ${n}`}
              aria-pressed={selected}
              style={{
                flex: '1 0 48px', minWidth: 48, minHeight: 48, boxSizing: 'border-box', borderRadius: 8,
                background: selected ? WIZ_SURFACE : 'none', border: `1px solid ${selected ? accent : WIZ_BORDER_SOFT}`, padding: '4px',
                cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px'
              }}
            >
              <span style={{
                fontSize: '11px', fontWeight: selected ? 800 : 600,
                color: selected ? accent : WIZ_TEXT_FAINT,
                transition: 'color 0.16s ease'
              }}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
}
