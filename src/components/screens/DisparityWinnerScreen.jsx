// src/components/screens/DisparityWinnerScreen.jsx
// Cinematic winner celebration screen for Disparity Mode.
// Phases: intro (0-400ms) → reveal (400ms-1.2s) → celebrate (1.2-2.4s) → done (2.4s+)

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { FACE_COLORS } from '../../utils/constants.js';
import { UI_FONT } from '../../utils/uiTheme.js';

const FONT = UI_FONT;

// Extract face number from a gridId like "M3-007" → 3
const faceNumFromGridId = (gridId) => {
  if (!gridId) return 1;
  const m = gridId.match(/^M(\d+)-/);
  return m ? parseInt(m[1], 10) : 1;
};

// Generate confetti particles once
const makeParticles = (count, winnerColor) => {
  const palette = [winnerColor, '#ffffff', '#ffd700'];
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.random() * Math.PI * 2);
    const speed = 120 + Math.random() * 220;
    return {
      id: i,
      x: 50,
      y: 50,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 720,
      isCircle: Math.random() > 0.5,
    };
  });
};

export default function DisparityWinnerScreen({ onDismiss }) {
  const disparityWinner = useGameStore((s) => s.disparityWinner);
  const disparityDeaths = useGameStore((s) => s.disparityDeaths);
  const clearDisparityGame = useGameStore((s) => s.clearDisparityGame);
  const lastBetResult = useGameStore((s) => s.lastBetResult);

  const [phase, setPhase] = useState('intro'); // intro | reveal | celebrate | done
  const [glitch, setGlitch] = useState(false);
  const rafRef = useRef(null);

  // Support both old { gridId } shape and new { pair: [id1, id2] } shape
  const winnerPair = disparityWinner?.pair ?? (disparityWinner?.gridId ? [disparityWinner.gridId] : []);
  const winnerGridId = winnerPair[0] ?? '';
  const faceNum = faceNumFromGridId(winnerGridId);
  const winnerColor = FACE_COLORS[faceNum] ?? '#ffffff';
  // Second tile in the pair (the antipodal)
  const antipodalGridId = winnerPair[1] ?? '';
  const antipodalFaceNum = faceNumFromGridId(antipodalGridId);
  const antipodalColor = FACE_COLORS[antipodalFaceNum] ?? '#aaaacc';

  // Observations = number of tiles that died before the winner
  const observations = disparityDeaths.length;

  // Death log in reverse elimination order (most recent death = runner-up first)
  const deathLog = useMemo(() => [...disparityDeaths].reverse(), [disparityDeaths]);

  // Phase sequencer
  useEffect(() => {
    const t0 = performance.now();

    const tick = (now) => {
      const elapsed = now - t0;
      if (elapsed < 400) {
        setPhase('intro');
      } else if (elapsed < 1200) {
        setPhase('reveal');
      } else if (elapsed < 2400) {
        setPhase('celebrate');
      } else {
        setPhase('done');
        return; // stop ticking
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Glitch flicker during reveal.
  // Uses a `cancelled` flag so orphaned timer callbacks from the previous
  // render cycle cannot set glitch=true after the reveal phase ends.
  useEffect(() => {
    if (phase !== 'reveal') return;
    let cancelled = false;
    let timer;

    const flicker = () => {
      if (cancelled) return;
      setGlitch(true);
      timer = setTimeout(() => {
        if (cancelled) return;
        setGlitch(false);
        timer = setTimeout(flicker, 80 + Math.random() * 200);
      }, 30 + Math.random() * 60);
    };

    flicker();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setGlitch(false);
    };
  }, [phase]);

  const particles = useMemo(() => makeParticles(60, winnerColor), [winnerColor]);

  // Particle DOM refs — updated directly via RAF to avoid 3,600 React re-renders/sec.
  const particleElemsRef = useRef([]);
  const particleRafRef = useRef(null);

  // Drive particle positions with direct DOM mutation; triggers once on 'celebrate'.
  useEffect(() => {
    if (phase !== 'celebrate') return;
    const startTime = performance.now();
    const gravity = 60;

    const animate = (now) => {
      const t = Math.min(1, (now - startTime) / 1200);
      particleElemsRef.current.forEach((el, i) => {
        if (!el) return;
        const p = particles[i];
        const px = p.x + (p.vx * t) / 100;
        const py = p.y + (p.vy * t) / 100 + (gravity * t * t) / 2;
        const rot = p.rotation + p.rotationSpeed * t;
        el.style.left = `${px}%`;
        el.style.top = `${py}%`;
        el.style.transform = `rotate(${rot}deg)`;
        el.style.opacity = Math.max(0, 1 - t * 0.8);
      });
      if (t < 1) {
        particleRafRef.current = requestAnimationFrame(animate);
      }
    };

    particleRafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(particleRafRef.current);
  }, [phase, particles]);

  const handleDismiss = () => {
    clearDisparityGame();
    onDismiss();
  };

  const isClickable = phase === 'done';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(ellipse at center, ${winnerColor}22 0%, #050510 70%)`,
        animation: phase === 'intro' ? 'dws-fadein 0.4s ease-out forwards' : 'none',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes dws-fadein { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dws-scanline {
          0% { top: -10%; }
          100% { top: 110%; }
        }
        @keyframes dws-ring-pulse {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
        }
        @keyframes dws-crown-drop {
          0%   { transform: translateY(-60px); opacity: 0; }
          60%  { transform: translateY(8px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes dws-tagline-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dws-tile-spin {
          0%   { transform: perspective(400px) rotateY(0deg); }
          100% { transform: perspective(400px) rotateY(360deg); }
        }
        @keyframes dws-tile-in {
          from { opacity: 0; transform: perspective(400px) rotateY(90deg) scale(0.6); }
          to   { opacity: 1; transform: perspective(400px) rotateY(0deg) scale(1); }
        }
      `}</style>

      {/* Scanline sweep */}
      {(phase === 'reveal' || phase === 'celebrate' || phase === 'done') && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '3px',
            background: `${winnerColor}44`,
            animation: 'dws-scanline 2.4s linear infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Ring pulses */}
      {(phase === 'celebrate' || phase === 'done') && [0, 0.3, 0.6].map((delay, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '38%',
            width: 160,
            height: 160,
            borderRadius: '50%',
            border: `2px solid ${winnerColor}`,
            animation: `dws-ring-pulse 1.2s ease-out ${delay}s infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Confetti particles — rendered once, animated via direct DOM updates in RAF */}
      {(phase === 'celebrate' || phase === 'done') && particles.map((p, i) => (
        <div
          key={p.id}
          ref={(el) => { particleElemsRef.current[i] = el; }}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Spinning winner tile cards */}
      {(phase === 'reveal' || phase === 'celebrate' || phase === 'done') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            marginBottom: '0.5rem',
            filter: glitch ? 'hue-rotate(60deg) brightness(1.6) blur(1px)' : 'none',
          }}
        >
          {/* Primary winner tile */}
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 16,
              background: winnerColor,
              boxShadow: `0 0 40px ${winnerColor}, 0 0 80px ${winnerColor}55`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              animation: phase === 'reveal'
                ? 'dws-tile-in 0.5s cubic-bezier(0.22,1,0.36,1) forwards'
                : 'dws-tile-spin 2.4s linear infinite',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.5)', fontFamily: 'monospace', letterSpacing: '0.05em', marginBottom: 4 }}>
              WINNER
            </span>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'monospace', color: '#000', letterSpacing: '0.03em' }}>
              {winnerGridId}
            </span>
          </div>

          {/* Antipodal connector */}
          {antipodalGridId && (
            <span style={{ color: '#666', fontSize: '2rem', fontWeight: 300, lineHeight: 1 }}>↔</span>
          )}

          {/* Antipodal winner tile */}
          {antipodalGridId && (
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 16,
                background: antipodalColor,
                boxShadow: `0 0 40px ${antipodalColor}, 0 0 80px ${antipodalColor}55`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                animation: phase === 'reveal'
                  ? 'dws-tile-in 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s forwards'
                  : 'dws-tile-spin 2.4s linear 0.2s infinite',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.5)', fontFamily: 'monospace', letterSpacing: '0.05em', marginBottom: 4 }}>
                ANTIPODAL
              </span>
              <span style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'monospace', color: '#000', letterSpacing: '0.03em' }}>
                {antipodalGridId}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Crown — drops in during celebrate */}
      {(phase === 'celebrate' || phase === 'done') && (
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 800,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            animation: 'dws-crown-drop 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
            marginBottom: '0.5rem',
          }}
        >
          WINNER
        </div>
      )}

      {/* Tagline */}
      {phase === 'done' && (
        <div
          style={{
            fontSize: '1.1rem',
            color: '#aaaacc',
            marginBottom: '1.5rem',
            animation: 'dws-tagline-in 0.5s ease-out forwards',
            textAlign: 'center',
          }}
        >
          Last antipodal pair alive — outlasted {observations} fallen tile{observations !== 1 ? 's' : ''}.
        </div>
      )}

      {/* Bet result banner */}
      {phase === 'done' && lastBetResult && (
        <div
          style={{
            width: 'min(420px, 90vw)',
            marginBottom: '1rem',
            padding: '14px 18px',
            borderRadius: '14px',
            background: lastBetResult.won ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)',
            border: `1.5px solid ${lastBetResult.won ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.35)'}`,
            boxShadow: lastBetResult.won ? '0 0 24px rgba(34,197,94,0.15)' : 'none',
            animation: 'dws-tagline-in 0.4s ease-out 0.05s both',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1, flexShrink: 0, color: lastBetResult.won ? '#4ade80' : '#f87171' }}>
            {lastBetResult.won ? '+' : '−'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: lastBetResult.won ? '#4ade80' : '#f87171',
              fontFamily: FONT, marginBottom: '3px',
            }}>
              {lastBetResult.won ? `Won +${lastBetResult.payout} PP` : `Lost ${lastBetResult.wager} PP`}
            </div>
            <div style={{
              fontSize: '12px', color: 'rgba(180,210,255,0.65)',
              fontFamily: FONT, lineHeight: 1.4,
            }}>
              {lastBetResult.description}
            </div>
          </div>
        </div>
      )}

      {/* Death log */}
      {phase === 'done' && deathLog.length > 0 && (
        <div
          style={{
            maxHeight: '30vh',
            overflowY: 'auto',
            width: 'min(420px, 90vw)',
            background: '#0a0a1a',
            border: '1px solid #222244',
            borderRadius: 8,
            padding: '0.5rem',
            marginBottom: '1.5rem',
            animation: 'dws-tagline-in 0.5s ease-out 0.1s both',
          }}
        >
          {/* Winner row at top */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.5rem',
              borderRadius: 4,
              background: `${winnerColor}22`,
              marginBottom: '0.25rem',
            }}
          >
            <span style={{ color: '#888', fontSize: '0.75rem', minWidth: 28 }}>1st</span>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: winnerColor,
                flexShrink: 0,
                boxShadow: `0 0 6px ${winnerColor}`,
              }}
            />
            <span style={{ color: winnerColor, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
              {winnerGridId}
            </span>
            {antipodalGridId && (
              <>
                <span style={{ color: '#555', fontSize: '0.75rem' }}>↔</span>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: antipodalColor,
                    flexShrink: 0,
                    boxShadow: `0 0 4px ${antipodalColor}`,
                  }}
                />
                <span style={{ color: antipodalColor, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                  {antipodalGridId}
                </span>
              </>
            )}
            <span style={{ color: '#667', fontSize: '0.75rem', marginLeft: 'auto' }}>LAST ALIVE</span>
          </div>

          {deathLog.map((entry) => {
            const eFaceNum = faceNumFromGridId(entry.gridId);
            const eColor = FACE_COLORS[eFaceNum] ?? '#888';
            const rank = entry.rank;
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 4,
                }}
              >
                <span style={{ color: '#555', fontSize: '0.7rem', minWidth: 28, textAlign: 'right' }}>
                  #{rank}
                </span>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: eColor,
                    flexShrink: 0,
                    opacity: 0.8,
                  }}
                />
                <span style={{ color: '#8888aa', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {entry.gridId}
                  {entry.endGridId && entry.endGridId !== entry.gridId && (
                    <span style={{ color: '#555' }}> → {entry.endGridId}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Play Again button */}
      <button
        onClick={isClickable ? handleDismiss : undefined}
        style={{
          padding: '0.75rem 2.5rem',
          fontSize: '1rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          borderRadius: 8,
          border: `2px solid ${isClickable ? winnerColor : '#333'}`,
          background: isClickable ? `${winnerColor}22` : 'transparent',
          color: isClickable ? winnerColor : '#444',
          cursor: isClickable ? 'pointer' : 'default',
          transition: 'all 0.3s',
          textTransform: 'uppercase',
          opacity: isClickable ? 1 : 0.3,
        }}
      >
        Play Again
      </button>
    </div>
  );
}
