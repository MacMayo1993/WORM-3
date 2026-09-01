// ParityWallet — compact PP balance chip.
// Reads parityPoints from the store directly.
// Flashes green on earn, red on spend, and floats the amount above the chip.
//
// The chip used to flash a colour and nothing else, so the player saw that
// *something* changed but never what — and Parity Points are now earned from
// every mode in the game, mostly while the player is looking at the cube rather
// than at a chip in the corner. The floating delta is what makes an earn
// legible: it names the amount, and it moves, which is what actually pulls the
// eye to a corner.
//
// Bursts are COALESCED rather than queued. Worm mode pays +1 every five seconds
// and +5 per orb, so a good run would otherwise stack a column of tiny numbers;
// deltas arriving while a popup is still alive add into it and restart its
// clock, so a flurry reads as one growing "+18" instead of six overlapping ones.
//
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

const POPUP_MS = 1400;

/**
 * Fold a new balance delta into whatever popup is currently on screen.
 *
 * Exported and pure so the rule is testable without a render harness — the
 * interesting cases (a burst of small earns, a spend interrupting an earn) are
 * arithmetic, not layout.
 *
 * @param {{amount:number}|null} live  the popup still showing, if any
 * @param {number} delta               signed change in the balance
 * @param {number} seq                 monotonic id; changing it replays the animation
 */
export function coalescePopup(live, delta, seq) {
  // Signs are kept apart deliberately: a spend landing during an earn burst
  // should not net against it and leave the player reading a number that
  // matches neither event. The newer event wins the popup outright.
  const sameSign = live && Math.sign(live.amount) === Math.sign(delta);
  return { amount: sameSign ? live.amount + delta : delta, seq };
}

export default function ParityWallet({ dark = false, neutral = false }) {
  const parityPoints = useGameStore((s) => s.parityPoints);
  const prevRef = useRef(parityPoints);
  const [flash, setFlash] = useState(null); // 'up' | 'down' | null
  // { amount, seq } — seq restarts the CSS animation when a burst coalesces,
  // since re-rendering the same node with the same animation would not replay it.
  const [popup, setPopup] = useState(null);
  const timerRef = useRef(null);
  const popupTimerRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (parityPoints === prevRef.current) return;
    const delta = parityPoints - prevRef.current;
    const dir = delta > 0 ? 'up' : 'down';
    prevRef.current = parityPoints;

    setFlash(dir);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlash(null), 900);

    seqRef.current += 1;
    setPopup((live) => coalescePopup(live, delta, seqRef.current));
    clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => setPopup(null), POPUP_MS);
  }, [parityPoints]);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    clearTimeout(popupTimerRef.current);
  }, []);

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
        // Anchors the floating delta. The popup itself is pointer-events:none
        // and absolutely positioned, so it never changes this chip's layout —
        // the chip sits in a top bar whose siblings must not shift when a
        // number appears above it.
        position: 'relative',
      }}
    >
      {popup && (
        <span
          key={popup.seq}
          className="pp-float"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            // BELOW the chip, not above it. Both mount sites (the top menu bar
            // and the worm HUD's status row) sit flush against the top of the
            // viewport, so a delta rising out of the top of the chip animates
            // straight off-screen and is never seen. It still drifts upward —
            // the rising read is the reward cue — just within the space under
            // the chip, where there is room for it.
            top: 'calc(100% + 3px)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            fontFamily: FONT,
            fontSize: '13px',
            fontWeight: 900,
            letterSpacing: '0.01em',
            fontVariantNumeric: 'tabular-nums',
            color: popup.amount > 0 ? upColor : downColor,
            textShadow: '0 1px 3px rgba(0,0,0,0.45)',
          }}
        >
          {popup.amount > 0 ? '+' : '−'}{Math.abs(popup.amount).toLocaleString()}
        </span>
      )}
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
