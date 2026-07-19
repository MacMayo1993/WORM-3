// src/components/SolveMode.jsx
// Compact floating solve panel — positioned bottom-right so the cube stays visible.
// Shows Kociemba solution + animated layer highlights, plus a mini CFOP progress strip.

import React, { useMemo, useRef, useEffect } from 'react';
import { checkSolveProgress } from '../game/solveDetection.js';
import { useKociembaSolver } from '../teach/useKociembaSolver.js';
import { useAntipodalEngine } from '../hooks/useAntipodalEngine.js';
import { UI_FONT, MONO_FONT, GLASS_PANEL, GLASS_PANEL_BORDER, GLASS_TEXT, GLASS_TEXT_MUTED } from '../utils/uiTheme.js';

// ── CFOP mini progress strip ──────────────────────────────────────────────────

const STEPS = [
  { id: 'whiteCross', label: 'Cross' },
  { id: 'f2l',        label: 'F2L'   },
  { id: 'oll',        label: 'OLL'   },
  { id: 'pll',        label: 'PLL'   },
];

function CfopStrip({ progress }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '6px 12px', borderBottom: `1px solid ${GLASS_PANEL_BORDER}` }}>
      {STEPS.map((s) => {
        const st = progress[s.id] || {};
        const done = st.complete;
        const active = progress.currentStep === s.id && !progress.solved;
        return (
          <div key={s.id} style={{
            flex: 1, textAlign: 'center', fontSize: 9,
            fontFamily: MONO_FONT,
            color: done ? '#00ff88' : active ? '#fefae0' : 'rgba(255,255,255,0.35)',
            paddingBottom: 2,
            borderBottom: `2px solid ${done ? '#00ff88' : active ? '#fefae0' : 'transparent'}`,
            transition: 'all 0.3s',
          }}>
            <div style={{ fontWeight: done || active ? 700 : 400 }}>{s.label}</div>
            <div style={{ opacity: 0.7 }}>{st.solvedCount ?? 0}/{st.total ?? '?'}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Move chip (one notation token) ──────────────────────────────────────────

function MoveChip({ notation, state }) {
  // state: 'done' | 'next' | 'upcoming'
  const bg = state === 'done'     ? 'rgba(255,255,255,0.07)'
           : state === 'next'     ? 'rgba(0,217,255,0.20)'
           :                        'rgba(255,255,255,0.04)';
  const border = state === 'next' ? '1px solid rgba(0,217,255,0.7)' : `1px solid ${GLASS_PANEL_BORDER}`;
  const color  = state === 'done' ? 'rgba(255,255,255,0.35)'
               : state === 'next' ? '#00d9ff'
               :                    'rgba(255,255,255,0.75)';
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 6px',
      borderRadius: 4,
      background: bg,
      border,
      color,
      fontSize: 11,
      fontFamily: MONO_FONT,
      fontWeight: state === 'next' ? 700 : 400,
      whiteSpace: 'nowrap',
      animation: state === 'next' ? 'kociemba-pulse 1s ease-in-out infinite' : 'none',
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
    ready:   `${moves.length} moves`,
    playing: `Move ${moveIndex} / ${moves.length}`,
    done:    alreadySolved ? 'Solved!' : 'Cube solved!',
    error:   'Error',
  }[status] ?? '';

  const statusColor = isDone ? '#00ff88' : status === 'error' ? '#f87171' : GLASS_TEXT_MUTED;

  return (
    <>
      <style>{`
        @keyframes kociemba-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(0,217,255,0.6); }
          50%      { box-shadow: 0 0 8px 3px rgba(0,217,255,0.35); }
        }
      `}</style>

      <div style={{
        position: 'fixed',
        right: 16,
        bottom: 72,          /* sits just above the bottom nav bar */
        width: 272,
        background: GLASS_PANEL,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderRadius: 12,
        border: `1px solid ${GLASS_PANEL_BORDER}`,
        color: GLASS_TEXT,
        zIndex: 1000,
        overflow: 'hidden',
        fontFamily: MONO_FONT,
        userSelect: 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
        }}>
          <span style={{ fontSize: 10, letterSpacing: '0.12em', opacity: 0.6, fontFamily: UI_FONT }}>
            KOCIEMBA SOLVER
          </span>
          <span style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>
            {statusLabel}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px',
          }}>✕</button>
        </div>

        {/* ── CFOP mini strip ────────────────────────────── */}
        {size === 3 && <CfopStrip progress={progress} />}

        {/* ── Solution tokens ────────────────────────────── */}
        {hasMoves && (
          <div
            ref={scrollRef}
            style={{
              display: 'flex', gap: 4, padding: '8px 10px',
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
          <div style={{ padding: '10px 12px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
            3×3 only
          </div>
        )}
        {status === 'idle' && size === 3 && !hasMoves && (
          <div style={{ padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            Waiting for cube state…
          </div>
        )}
        {status === 'solving' && (
          <div style={{ padding: '8px 12px', fontSize: 11, color: '#fefae0', textAlign: 'center' }}>
            Computing optimal solution…
          </div>
        )}
        {status === 'error' && (
          <div style={{ padding: '8px 12px', fontSize: 11, color: '#f87171' }}>
            {error}
          </div>
        )}
        {isDone && (
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#00ff88', textAlign: 'center', fontWeight: 600 }}>
            {alreadySolved ? '✓ Already solved!' : '✓ Cube solved!'}
          </div>
        )}

        {/* ── Controls ───────────────────────────────────── */}
        {size === 3 && (hasMoves || isPlaying) && (
          <div style={{
            display: 'flex', gap: 6, padding: '8px 10px',
            borderTop: `1px solid ${GLASS_PANEL_BORDER}`,
          }}>
            <button
              onClick={isPlaying ? pause : play}
              disabled={!isPlaying && !canPlay}
              style={ctrlBtn(isPlaying ? '#00d9ff' : '#00ff88', !isPlaying && !canPlay)}
            >
              {isPlaying ? '⏸ PAUSE' : isDone ? '↺ REPLAY' : '▶ PLAY'}
            </button>
            <button
              onClick={stepForward}
              disabled={isPlaying || moveIndex >= moves.length}
              style={ctrlBtn('#fbbf24', isPlaying || moveIndex >= moves.length)}
            >
              ⏭ STEP
            </button>
          </div>
        )}

        {/* ── Antipodal fibre phase ──────────────────────── */}
        <FibreStrip fibre={fibre} disabled={isPlaying} />
      </div>
    </>
  );
}

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
  if (m) return `${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}`;
  const r = hex.match(/\d+/g);
  return r ? r.slice(0,3).join(',') : '255,255,255';
}

// Compact toggle used by BottomNavBar (unchanged)
export function SolveModeButton({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`btn-compact text ${active ? 'active' : ''}`}
      style={{ color: active ? '#00ff88' : undefined, borderColor: active ? '#00ff88' : undefined }}
    >
      SOLVE
    </button>
  );
}
