// src/worm/WormCrawlerHUD.jsx
// Mobile-friendly HUD for WORM Chase-Cam Mode.
// Speed slider, portal button, healed count, phase indicator.

import React, { useState, useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';

export default function WormCrawlerHUD({ phase, onFlippedTile, onEnterPortal }) {
    const wormSpeed = useGameStore(s => s.wormSpeed ?? 1.0);
    const wormHealedCount = useGameStore(s => s.wormHealedCount ?? 0);
    const setWormSpeed = useGameStore(s => s.setWormSpeed);

    const [showPortalPulse, setShowPortalPulse] = useState(false);

    // Pulse portal button when on a flipped tile
    useEffect(() => {
        setShowPortalPulse(onFlippedTile && phase === 'crawling');
    }, [onFlippedTile, phase]);

    const phaseLabel = {
        crawling: '🐍 CRAWLING',
        entering: '🌀 DIVING IN',
        tunnel: '⚡ TUNNEL',
        exiting: '✨ EMERGING',
    }[phase] || phase;

    const phaseColor = {
        crawling: '#00ff88',
        entering: '#ff00ff',
        tunnel: '#00f5ff',
        exiting: '#ffaa00',
    }[phase] || '#fff';

    return (
        <div style={{
            position: 'fixed', inset: 0,
            pointerEvents: 'none', zIndex: 600,
            fontFamily: "'Courier New', monospace",
        }}>
            {/* Top bar — phase + healed count */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 18px',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
                pointerEvents: 'none',
            }}>
                <div style={{
                    color: phaseColor, fontSize: 13, fontWeight: 800, letterSpacing: 2,
                    textShadow: `0 0 10px ${phaseColor}`
                }}>
                    {phaseLabel}
                </div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                    <span style={{ color: '#aaa', fontSize: 10, letterSpacing: 1 }}>HEALED </span>
                    <span style={{ color: '#00ff88', fontSize: 18, textShadow: '0 0 8px #00ff88' }}>
                        {wormHealedCount}
                    </span>
                </div>
            </div>

            {/* Speed control — bottom left */}
            <div style={{
                position: 'absolute', bottom: 140, left: 16,
                background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(0,245,255,0.3)',
                borderRadius: 12, padding: '8px 14px',
                backdropFilter: 'blur(10px)', pointerEvents: 'auto',
                minWidth: 120,
            }}>
                <div style={{ color: '#aaa', fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>
                    SPEED {wormSpeed.toFixed(1)}×
                </div>
                <input
                    type="range" min="0.3" max="3.0" step="0.1"
                    value={wormSpeed}
                    onChange={e => setWormSpeed(parseFloat(e.target.value))}
                    style={{
                        width: '100%', accentColor: '#00f5ff',
                        cursor: 'pointer',
                    }}
                />
            </div>

            {/* ENTER PORTAL button — center bottom, only shows on flipped tile */}
            {showPortalPulse && (
                <div style={{
                    position: 'absolute', bottom: 150, left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'auto',
                }}>
                    <button
                        onPointerDown={onEnterPortal}
                        style={{
                            background: 'linear-gradient(135deg, rgba(180,0,255,0.8), rgba(255,0,200,0.6))',
                            border: '2px solid #ff00ff',
                            borderRadius: 16, padding: '14px 32px',
                            color: '#fff', fontSize: 16, fontWeight: 900,
                            letterSpacing: 3, cursor: 'pointer',
                            textShadow: '0 0 12px #ff00ff',
                            boxShadow: '0 0 30px rgba(255,0,255,0.5)',
                            animation: 'portal-pulse 1s ease-in-out infinite',
                        }}
                    >
                        🌀 ENTER PORTAL
                    </button>
                </div>
            )}

            {/* D-pad arrows — bottom right (mobile) */}
            <div style={{
                position: 'absolute', bottom: 100, right: 16,
                display: 'grid', gridTemplateColumns: '44px 44px 44px',
                gridTemplateRows: '44px 44px 44px',
                gap: 4, pointerEvents: 'auto',
            }}>
                {[
                    ['↑', 'up', 1, 0],
                    ['←', 'left', 0, 1],
                    ['·', null, 1, 1],
                    ['→', 'right', 2, 1],
                    ['↓', 'down', 1, 2],
                ].map(([label, dir, col, row]) => (
                    dir ? (
                        <button
                            key={dir}
                            onPointerDown={() => useGameStore.getState()._wormTurn?.(dir)}
                            style={{
                                gridColumn: col + 1, gridRow: row + 1,
                                width: 44, height: 44, borderRadius: 10,
                                background: 'rgba(0,245,255,0.15)',
                                border: '1.5px solid rgba(0,245,255,0.4)',
                                color: '#00f5ff', fontSize: 18, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            {label}
                        </button>
                    ) : <div key="center" style={{ gridColumn: col + 1, gridRow: row + 1 }} />
                ))}
            </div>

            <style>{`
        @keyframes portal-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(255,0,255,0.5); }
          50% { transform: scale(1.04); box-shadow: 0 0 50px rgba(255,0,255,0.8); }
        }
      `}</style>
        </div>
    );
}
