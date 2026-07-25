// src/components/SolveMode.jsx
// Compact floating solve panel — positioned bottom-right so the cube stays visible.
// Shows Kociemba solution + animated layer highlights, plus a mini CFOP progress strip.
//
// Styled to match the demo step screens (the warm "paper" family): cream sheet,
// sage-green + gold accents, UI_FONT chrome / DISPLAY_FONT title, MONO_FONT only
// for the algorithm notation on the move chips.

import React, { useMemo, useRef, useEffect } from 'react';
import { checkSolveProgress } from '../game/solveDetection.js';
import { useKociembaSolver } from '../teach/useKociembaSolver.js';
import { useAntipodalEngine } from '../hooks/useAntipodalEngine.js';
import { UI_FONT, DISPLAY_FONT, MONO_FONT, GLASS_PANEL_BORDER } from '../utils/uiTheme.js';

// ── Demo-screen palette (warm paper / sage / gold) ─────────────────────────────
const CARD_BG      = 'rgba(250, 247, 238, 0.97)';
const CARD_BORDER  = 'rgba(111, 126, 86, 0.28)';
const DIVIDER      = 'rgba(92, 111, 76, 0.20)';
const INK_TITLE    = '#24331e'; // dark green display text
const INK_BODY     = '#43513a'; // body copy
const GOLD         = '#7b6f45'; // eyebrow / step labels
const OLIVE_MUTED  = '#657156'; // muted olive
const OLIVE_FAINT  = 'rgba(101, 113, 86, 0.5)';
const SAGE         = '#5f7f4a'; // primary accent (buttons, done)
const GOLD_ACCENT  = '#b88f4a'; // secondary accent (active step)
const TERRACOTTA   = '#b0492f'; // muted error (replaces neon red)
const CARD_SHADOW  = '0 14px 34px rgba(40, 48, 32, 0.20)';

// ── CFOP mini progress strip ──────────────────────────────────────────────────

const STEPS = [
  { id: 'whiteCross', label: 'Cross' },
  { id: 'f2l',        label: 'F2L'   },
  { id: 'oll',        label: 'OLL'   },
  { id: 'pll',        label: 'PLL'   },
];

function CfopStrip({ progress }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: `1px solid ${DIVIDER}` }}>
      {STEPS.map((s) => {
        const st = progress[s.id] || {};
        const done = st.complete;
        const active = progress.currentStep === s.id && !progress.solved;
        const color = done ? SAGE : active ? GOLD_ACCENT : OLIVE_FAINT;
        return (
          <div key={s.id} style={{
            flex: 1, textAlign: 'center', fontSize: 9.5,
            fontFamily: UI_FONT,
            color,
            paddingBottom: 3,
            borderBottom: `2px solid ${done ? SAGE : active ? GOLD_ACCENT : 'transparent'}`,
            transition: 'all 0.3s',
          }}>
            <div style={{ fontWeight: done || active ? 800 : 600, letterSpacing: '0.04em' }}>{s.label}</div>
            <div style={{ opacity: 0.75, fontSize: 9 }}>{st.solvedCount ?? 0}/{st.total ?? '?'}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Move chip (one notation token) ──────────────────────────────────────────

function MoveChip({ notation, state }) {
  // state: 'done' | 'next' | 'upcoming'
  const bg = state === 'done'     ? 'rgba(92, 111, 76, 0.08)'
           : state === 'next'     ? 'rgba(95, 127, 74, 0.16)'
           :                        'rgba(92, 111, 76, 0.04)';
  const border = state === 'next' ? `1px solid ${SAGE}` : `1px solid ${CARD_BORDER}`;
  const color  = state === 'done' ? 'rgba(101, 113, 86, 0.55)'
               : state === 'next' ? '#35452a'
               :                    INK_BODY;
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 7px',
      borderRadius: 7,
      background: bg,
      border,
      color,
      fontSize: 11,
      fontFamily: MONO_FONT,
      fontWeight: state === 'next' ? 800 : 500,
      whiteSpace: 'nowrap',
      animation: state === 'next' ? 'kociemba-pulse 1.4s ease-in-out infinite' : 'none',
      flexShrink: 0,
    }}>
      {notation}
    </span>
  );
}

// ── Antipodal fibre strip (Phase 2: paired-flip / heal repair) ───────────────
//
// Drives the central-quotient engine (game/antipodalEngine.js): after — or
// independently of — the positional solve, clears residual wormhole-flip parity
// toward the nearer quotient representative (all-home Z₀ or all-flipped Z₁).

function FibreStrip({ fibre, disabled }) {
  const { status, plan, costs, stepIndex, totalSteps, play, pause, stepForward } = fibre;
  if (!plan || !costs) return null;

  const playing = status === 'playing';
  const done = status === 'done' || totalSteps === 0;
  const summary = done
    ? '✓ fibre clear'
    : `${costs.dirtyPairs}/${costs.totalPairs} pairs dirty` +
      (costs.asymmetricPairs ? ` · ${costs.asymmetricPairs} asym` : '') +
      ` · →Z${plan.target === 1 ? '₁' : '₀'} in ${plan.totalCost}`;

  return (
    <div style={{ borderTop: `1px solid ${GLASS_PANEL_BORDER}` }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px',
      }}>
        <span style={{ fontSize: 9, letterSpacing: '0.12em', opacity: 0.6, fontFamily: UI_FONT }}>
          ANTIPODAL PAIRS
        </span>
        <span style={{ fontSize: 10, fontFamily: MONO_FONT, color: done ? '#00ff88' : '#c084fc' }}>
          {playing ? `op ${stepIndex} / ${totalSteps}` : summary}
        </span>
      </div>
      {!done && (
        <div style={{ display: 'flex', gap: 6, padding: '0 10px 8px' }}>
          <button
            onClick={playing ? pause : play}
            disabled={disabled}
            style={ctrlBtn(playing ? '#00d9ff' : '#c084fc', disabled)}
          >
            {playing ? '⏸ PAUSE' : '▶ REPAIR'}
          </button>
          <button
            onClick={stepForward}
            disabled={disabled || playing}
            style={ctrlBtn('#fbbf24', disabled || playing)}
          >
            ⏭ STEP
          </button>
        </div>
      )}
    </div>
  );
}

// Compact control-button style used by the antipodal fibre strip.
function ctrlBtn(accent, disabled) {
  return {
    flex: 1, padding: '6px 0', borderRadius: 6,
    background: disabled ? 'rgba(255,255,255,0.04)' : `rgba(${hexToRgb(accent)},0.14)`,
    border: `1px solid ${disabled ? GLASS_PANEL_BORDER : accent}`,
    color: disabled ? 'rgba(255,255,255,0.25)' : accent,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 11, fontFamily: MONO_FONT, fontWeight: 600,
    transition: 'all 0.15s',
  };
}

function hexToRgb(hex) {
  // accepts #rrggbb or rgb(...) strings
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (m) return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
  const r = hex.match(/\d+/g);
  return r ? r.slice(0, 3).join(',') : '255,255,255';
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SolveMode({ cubies, size, onClose }) {
  const progress = useMemo(() => checkSolveProgress(cubies, size), [cubies, size]);
  const { status, moves, moveIndex, error, play, pause, stepForward } =
    useKociembaSolver(cubies, size);
  const fibre = useAntipodalEngine(cubies, size);

  const scrollRef = useRef(null);

  // Keep the current (next) move chip visible in the scroll container
  useEffect(() => {
    if (!scrollRef.current || !moves.length) return;
    const chips = scrollRef.current.querySelectorAll('[data-move-idx]');
    const chip = chips[moveIndex];
    if (chip) chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [moveIndex, moves]);

  const isPlaying = status === 'playing';
  const isDone    = status === 'done';
  const hasMoves  = moves.length > 0;
  const canPlay   = hasMoves && (status === 'ready' || isDone);
  const alreadySolved = progress.solved && size === 3;

  const statusLabel = {
    idle:    'Analyzing…',
    solving: 'Solving…',
    // Once the player has performed some of the plan by hand, show their place
    // in it — otherwise the header reads "26 moves" no matter how far they get.
    ready:   moveIndex > 0 ? `Move ${moveIndex} / ${moves.length}` : `${moves.length} moves`,
    playing: `Move ${moveIndex} / ${moves.length}`,
    done:    alreadySolved ? 'Solved!' : 'Cube solved!',
    error:   'Error',
  }[status] ?? '';

  const statusColor = isDone ? SAGE : status === 'error' ? TERRACOTTA : OLIVE_MUTED;

  return (
    <>
      <style>{`
        @keyframes kociemba-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(95,127,74,0.0); }
          50%      { box-shadow: 0 0 0 3px rgba(95,127,74,0.16); }
        }
      `}</style>

      <div style={{
        position: 'fixed',
        right: 16,
        bottom: 72,          /* sits just above the bottom nav bar */
        width: 274,
        background: CARD_BG,
        backdropFilter: 'blur(14px) saturate(1.05)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.05)',
        borderRadius: 18,
        border: `1px solid ${CARD_BORDER}`,
        color: INK_BODY,
        zIndex: 1000,
        overflow: 'hidden',
        fontFamily: UI_FONT,
        userSelect: 'none',
        boxShadow: CARD_SHADOW,
      }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px 9px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{
              fontSize: 10, letterSpacing: '0.14em', fontWeight: 900,
              textTransform: 'uppercase', color: GOLD, fontFamily: UI_FONT,
            }}>
              Kociemba
            </span>
            <span style={{
              fontFamily: DISPLAY_FONT, fontSize: 16, lineHeight: 1, color: INK_TITLE,
              letterSpacing: '0.01em',
            }}>
              Solver
            </span>
          </div>
          <span style={{ fontSize: 12, color: statusColor, fontWeight: 800, whiteSpace: 'nowrap' }}>
            {statusLabel}
          </span>
          <button onClick={onClose} aria-label="Close solver" style={{
            background: 'none', border: 'none', color: OLIVE_MUTED,
            cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', marginLeft: 4,
          }}>✕</button>
        </div>

        {/* ── CFOP mini strip ────────────────────────────── */}
        {size === 3 && <CfopStrip progress={progress} />}

        {/* ── Solution tokens ────────────────────────────── */}
        {hasMoves && (
          <div
            ref={scrollRef}
            style={{
              display: 'flex', gap: 5, padding: '10px 12px',
              overflowX: 'auto', scrollbarWidth: 'none',
            }}
          >
            {moves.map((m, i) => (
              <MoveChip
                key={i}
                notation={m.notation ?? `M${i}`}
                state={i < moveIndex ? 'done' : i === moveIndex ? 'next' : 'upcoming'}
                data-move-idx={i}
              />
            ))}
          </div>
        )}

        {/* ── Status messages ────────────────────────────── */}
        {status === 'idle' && size !== 3 && (
          <div style={{ padding: '11px 14px', fontSize: 12, color: OLIVE_MUTED, textAlign: 'center' }}>
            3×3 only
          </div>
        )}
        {status === 'idle' && size === 3 && !hasMoves && (
          <div style={{ padding: '9px 14px', fontSize: 12, color: OLIVE_MUTED, textAlign: 'center' }}>
            Waiting for cube state…
          </div>
        )}
        {status === 'solving' && (
          <div style={{ padding: '9px 14px', fontSize: 12, color: GOLD_ACCENT, textAlign: 'center', fontWeight: 700 }}>
            Computing optimal solution…
          </div>
        )}
        {status === 'error' && (
          <div style={{ padding: '9px 14px', fontSize: 12, color: TERRACOTTA, lineHeight: 1.4 }}>
            {error}
          </div>
        )}
        {isDone && (
          <div style={{ padding: '8px 14px', fontSize: 12.5, color: SAGE, textAlign: 'center', fontWeight: 800 }}>
            {alreadySolved ? '✓ Already solved!' : '✓ Cube solved!'}
          </div>
        )}

        {/* ── Controls ───────────────────────────────────── */}
        {size === 3 && (hasMoves || isPlaying) && (
          <div style={{
            display: 'flex', gap: 8, padding: '10px 12px 12px',
            borderTop: `1px solid ${DIVIDER}`,
          }}>
            <button
              onClick={isPlaying ? pause : play}
              disabled={!isPlaying && !canPlay}
              style={primaryBtn(isPlaying ? GOLD_ACCENT : SAGE, !isPlaying && !canPlay)}
            >
              {isPlaying ? '⏸ Pause' : isDone ? '↺ Replay' : '▶ Play'}
            </button>
            <button
              onClick={stepForward}
              disabled={isPlaying || moveIndex >= moves.length}
              style={ghostBtn(isPlaying || moveIndex >= moves.length)}
            >
              ⏭ Step
            </button>
          </div>
        )}

        {/* ── Antipodal fibre phase ──────────────────────── */}
        <FibreStrip fibre={fibre} disabled={isPlaying} />
      </div>
    </>
  );
}

// Filled pill button (primary action) — matches the demo's sage CTA.
function primaryBtn(accent, disabled) {
  return {
    flex: 1, padding: '9px 0', borderRadius: 999,
    background: disabled ? 'rgba(92, 111, 76, 0.12)' : accent,
    border: 'none',
    color: disabled ? 'rgba(101, 113, 86, 0.5)' : '#fffdf5',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 12.5, fontFamily: UI_FONT, fontWeight: 800, letterSpacing: '0.02em',
    boxShadow: disabled ? 'none' : '0 6px 14px rgba(95, 127, 74, 0.26)',
    transition: 'all 0.15s',
  };
}

// Ghost / outline pill button (secondary action).
function ghostBtn(disabled) {
  return {
    flex: 1, padding: '9px 0', borderRadius: 999,
    background: 'transparent',
    border: `1px solid ${disabled ? 'rgba(92, 111, 76, 0.18)' : GOLD_ACCENT}`,
    color: disabled ? 'rgba(101, 113, 86, 0.45)' : GOLD_ACCENT,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 12.5, fontFamily: UI_FONT, fontWeight: 800, letterSpacing: '0.02em',
    transition: 'all 0.15s',
  };
}

// Compact toggle used by BottomNavBar (restyled off neon green).
export function SolveModeButton({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`btn-compact text ${active ? 'active' : ''}`}
      style={{ color: active ? SAGE : undefined, borderColor: active ? SAGE : undefined }}
    >
      SOLVE
    </button>
  );
}
