// src/components/screens/DisparityWinnerScreen.jsx
// Results screen for Disparity Mode — the last antipodal pair standing.
// Deliberately restrained: a calm dark results card, flat color swatches, one
// gentle entrance. No neon glow, no spin, no scanlines/glitch/confetti.

import React, { useEffect, useState, useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { FACE_COLORS } from '../../utils/constants.js';
import {
  UI_FONT, MONO_FONT,
  NIGHT_SHEET, NIGHT_BORDER, NIGHT_TEXT, NIGHT_TEXT_MUTED, NIGHT_SHADOW, NIGHT_PANEL,
  RADIUS_MD, RADIUS_LG,
 Z } from '../../utils/uiTheme.js';

const faceNumFromGridId = (gridId) => {
  if (!gridId) return 1;
  const m = gridId.match(/^M(\d+)-/);
  return m ? parseInt(m[1], 10) : 1;
};

// A single winner tile: flat color swatch, small label + grid id. No glow.
const WinnerTile = ({ label, gridId, color }) => (
  <div
    style={{
      width: 116,
      height: 116,
      borderRadius: RADIUS_MD,
      background: color,
      border: '1px solid rgba(0,0,0,0.25)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      userSelect: 'none',
    }}
  >
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: 'rgba(0,0,0,0.5)', fontFamily: UI_FONT,
    }}>
      {label}
    </span>
    <span style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: MONO_FONT, color: '#111', letterSpacing: '0.02em' }}>
      {gridId}
    </span>
  </div>
);

export default function DisparityWinnerScreen({ onDismiss, primaryLabel = 'Play Again', onSecondary, secondaryLabel }) {
  const disparityWinner = useGameStore((s) => s.disparityWinner);
  const disparityDeaths = useGameStore((s) => s.disparityDeaths);
  const lastBetResult = useGameStore((s) => s.lastBetResult);

  // Small mount delay before the screen accepts a dismiss tap, so the reveal
  // isn't instantly clicked through.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, []);

  const winnerPair = disparityWinner?.pair ?? (disparityWinner?.gridId ? [disparityWinner.gridId] : []);
  const winnerGridId = winnerPair[0] ?? '';
  const winnerColor = FACE_COLORS[faceNumFromGridId(winnerGridId)] ?? '#cccccc';
  const antipodalGridId = winnerPair[1] ?? '';
  const antipodalColor = FACE_COLORS[faceNumFromGridId(antipodalGridId)] ?? '#cccccc';

  const observations = disparityDeaths.length;
  const deathLog = useMemo(() => [...disparityDeaths].reverse(), [disparityDeaths]);

  const handleDismiss = () => {
    if (!ready) return;
    onDismiss();
  };

  const handleSecondary = () => {
    if (!ready) return;
    onSecondary?.();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z.FULLSCREEN,
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: UI_FONT,
        // Calm dark wash — a whisper of the winner hue at the top, no glow.
        background: `radial-gradient(120% 85% at 50% 22%, ${winnerColor}18 0%, rgba(24,31,18,0.94) 62%)`,
        backdropFilter: 'blur(10px)',
        animation: 'dws-fade 0.45s ease-out both',
      }}
    >
      <style>{`
        @keyframes dws-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dws-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div
        style={{
          width: 'min(440px, 100%)',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: NIGHT_SHEET,
          border: `1px solid ${NIGHT_BORDER}`,
          borderRadius: RADIUS_LG,
          boxShadow: NIGHT_SHADOW,
          padding: '28px 26px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'dws-rise 0.5s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* Eyebrow */}
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: NIGHT_TEXT_MUTED, marginBottom: 18,
        }}>
          Last Pair Standing
        </div>

        {/* Winner tiles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <WinnerTile label="Winner" gridId={winnerGridId} color={winnerColor} />
          {antipodalGridId && (
            <>
              <span style={{ color: NIGHT_TEXT_MUTED, fontSize: '1.4rem', fontWeight: 300 }}>↔</span>
              <WinnerTile label="Antipodal" gridId={antipodalGridId} color={antipodalColor} />
            </>
          )}
        </div>

        {/* Survival stat */}
        <div style={{
          fontSize: 14, color: NIGHT_TEXT, textAlign: 'center', lineHeight: 1.5,
          marginBottom: lastBetResult || deathLog.length ? 20 : 24, maxWidth: 320,
        }}>
          Outlasted {observations} fallen tile{observations !== 1 ? 's' : ''}.
        </div>

        {/* Bet result */}
        {lastBetResult && (
          <div
            style={{
              width: '100%',
              marginBottom: deathLog.length ? 16 : 24,
              padding: '12px 16px',
              borderRadius: RADIUS_MD,
              background: lastBetResult.push ? 'rgba(148,163,184,0.10)'
                : lastBetResult.won ? 'rgba(52,168,110,0.14)' : 'rgba(200,72,72,0.12)',
              border: `1px solid ${lastBetResult.push ? 'rgba(148,163,184,0.28)'
                : lastBetResult.won ? 'rgba(52,168,110,0.4)' : 'rgba(200,72,72,0.34)'}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <div style={{
              fontSize: '1.05rem', fontWeight: 800, lineHeight: 1, flexShrink: 0,
              color: lastBetResult.push ? '#94a3b8' : lastBetResult.won ? '#4caf7d' : '#d06767',
            }}>
              {lastBetResult.push ? '=' : lastBetResult.won ? '+' : '–'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                color: lastBetResult.push ? '#94a3b8' : lastBetResult.won ? '#4caf7d' : '#d06767',
                marginBottom: 2,
              }}>
                {lastBetResult.push
                  ? `Push — ${lastBetResult.wager} PP returned`
                  : lastBetResult.won
                    ? `Won +${lastBetResult.net ?? lastBetResult.payout} PP`
                    : `Lost ${lastBetResult.wager} PP`}
              </div>
              <div style={{ fontSize: 12, color: NIGHT_TEXT_MUTED, lineHeight: 1.4 }}>
                {lastBetResult.description}
              </div>
            </div>
          </div>
        )}

        {/* Death ledger */}
        {deathLog.length > 0 && (
          <div
            style={{
              width: '100%',
              maxHeight: '30vh',
              overflowY: 'auto',
              background: 'rgba(250,247,238,0.03)',
              border: `1px solid ${NIGHT_BORDER}`,
              borderRadius: RADIUS_MD,
              padding: 6,
              marginBottom: 24,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 6,
              background: NIGHT_PANEL, marginBottom: 4,
            }}>
              <span style={{ color: NIGHT_TEXT_MUTED, fontSize: 11, minWidth: 26, fontWeight: 600 }}>1st</span>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: winnerColor, flexShrink: 0 }} />
              <span style={{ color: NIGHT_TEXT, fontFamily: MONO_FONT, fontWeight: 600, fontSize: 13 }}>{winnerGridId}</span>
              {antipodalGridId && (
                <>
                  <span style={{ color: NIGHT_TEXT_MUTED, fontSize: 12 }}>↔</span>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: antipodalColor, flexShrink: 0 }} />
                  <span style={{ color: NIGHT_TEXT, fontFamily: MONO_FONT, fontWeight: 600, fontSize: 13 }}>{antipodalGridId}</span>
                </>
              )}
              <span style={{ color: NIGHT_TEXT_MUTED, fontSize: 10, letterSpacing: '0.1em', marginLeft: 'auto' }}>SURVIVED</span>
            </div>

            {deathLog.map((entry) => {
              const eColor = FACE_COLORS[faceNumFromGridId(entry.gridId)] ?? '#888';
              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px' }}>
                  <span style={{ color: 'rgba(255,253,242,0.34)', fontSize: 11, minWidth: 26, textAlign: 'right' }}>
                    #{entry.rank}
                  </span>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: eColor, flexShrink: 0, opacity: 0.55 }} />
                  <span style={{ color: NIGHT_TEXT_MUTED, fontFamily: MONO_FONT, fontSize: 12.5 }}>
                    {entry.gridId}
                    {entry.endGridId && entry.endGridId !== entry.gridId && (
                      <span style={{ color: 'rgba(255,253,242,0.30)' }}> → {entry.endGridId}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Primary action (Play Again / Continue) */}
        <button
          onClick={handleDismiss}
          style={{
            width: '100%',
            padding: '13px 0',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.03em',
            borderRadius: RADIUS_MD,
            border: 'none',
            background: ready ? winnerColor : NIGHT_PANEL,
            color: ready ? '#181f12' : 'rgba(255,253,242,0.40)',
            cursor: ready ? 'pointer' : 'default',
            transition: 'background 0.3s, color 0.3s',
            fontFamily: UI_FONT,
          }}
        >
          {primaryLabel}
        </button>

        {/* Secondary action (e.g. Main Menu) — a calm ghost button */}
        {onSecondary && (
          <button
            onClick={handleSecondary}
            style={{
              width: '100%',
              marginTop: 10,
              padding: '12px 0',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.03em',
              borderRadius: RADIUS_MD,
              border: `1px solid ${NIGHT_BORDER}`,
              background: 'transparent',
              color: ready ? NIGHT_TEXT : 'rgba(255,253,242,0.35)',
              cursor: ready ? 'pointer' : 'default',
              transition: 'color 0.3s',
              fontFamily: UI_FONT,
            }}
          >
            {secondaryLabel ?? 'Main Menu'}
          </button>
        )}
      </div>
    </div>
  );
}
