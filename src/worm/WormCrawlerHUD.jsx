// src/worm/WormCrawlerHUD.jsx
// Mobile-friendly HUD for WORM Chase-Cam Mode.
// Uses the same clean, pedagogical visual language as other overlays.

import React from 'react';
import { useGameStore } from '../hooks/useGameStore.js';

const PHASE_META = {
    crawling: { label: 'CRAWLING', accent: '#38bdf8' },
    entering: { label: 'ENTERING TUNNEL', accent: '#818cf8' },
    tunnel: { label: 'IN TUNNEL', accent: '#60a5fa' },
    exiting: { label: 'EXITING TUNNEL', accent: '#a78bfa' },
};

const palette = {
    text: '#e2e8f0',
    subText: '#94a3b8',
    panel: 'rgba(15, 23, 42, 0.78)',
    border: 'rgba(148, 163, 184, 0.35)',
    strongBorder: 'rgba(125, 211, 252, 0.55)',
    shadow: '0 8px 20px rgba(2, 6, 23, 0.35)',
    success: '#34d399',
    warning: '#fbbf24',
    fillA: '#60a5fa',
    fillB: '#a78bfa',
};

const buttonBase = {
    background: 'rgba(15, 23, 42, 0.75)',
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    width: 34,
    height: 34,
    color: palette.text,
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: palette.shadow,
};

export default function WormCrawlerHUD({ phase, onFlippedTile, cubeSize: _cubeSize = 3, onHome, onSettings, wormAlive = true, showDeathMenu = false, onRetry, onNewGame }) {
    const wormSpeed = useGameStore(s => s.wormSpeed ?? 1.0);
    const wormHealedCount = useGameStore(s => s.wormHealedCount ?? 0);
    const wormBodyTiles = useGameStore(s => s.wormBodyTiles ?? 0);
    const wormholeCountdown = useGameStore(s => s.wormholeCountdown ?? 0);
    const wormControlMode = useGameStore(s => s.wormControlMode ?? 'non-oriented');
    const setWormSpeed = useGameStore(s => s.setWormSpeed);
    const toggleWormControlMode = useGameStore(s => s.toggleWormControlMode);

    const handleJumpAction = () => {
        if (!wormAlive) return;
        useGameStore.getState()._wormTurn?.('jump');
    };

    const phaseMeta = PHASE_META[phase] || { label: phase || 'CRAWLING', accent: '#93c5fd' };
    const isPortalReady = wormAlive && onFlippedTile && phase === 'crawling';

    return (
        <div style={{
            position: 'fixed', inset: 0,
            pointerEvents: 'none', zIndex: 600,
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            color: palette.text,
        }}>
            {/* Top info bar */}
            <div style={{
                position: 'absolute', top: 12, left: 12, right: 12,
                borderRadius: 14,
                padding: '10px 12px',
                border: `1px solid ${palette.border}`,
                background: palette.panel,
                backdropFilter: 'blur(10px)',
                boxShadow: palette.shadow,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pointerEvents: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {onHome && <button onPointerDown={onHome} style={buttonBase} aria-label="Home">⌂</button>}
                    {onSettings && <button onPointerDown={onSettings} style={buttonBase} aria-label="Settings">⚙</button>}
                    <div style={{ lineHeight: 1.1 }}>
                        <div style={{ fontSize: 10, color: palette.subText, letterSpacing: 0.9, fontWeight: 700 }}>WORM STATUS</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: phaseMeta.accent }}>{phaseMeta.label}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onPointerDown={() => toggleWormControlMode()}
                        style={{
                            borderRadius: 999,
                            border: `1px solid ${palette.border}`,
                            background: 'rgba(30, 41, 59, 0.82)',
                            color: '#cbd5e1',
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: 0.6,
                            padding: '6px 10px',
                            cursor: 'pointer',
                        }}
                        title="Toggle worm control mode"
                    >
                        {wormControlMode === 'oriented' ? 'ORIENTED' : 'NON-ORIENTED'}
                    </button>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: palette.subText, letterSpacing: 0.8, fontWeight: 700 }}>HEALED</div>
                        <div style={{ color: palette.success, fontSize: 18, fontWeight: 800 }}>{wormHealedCount}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: palette.subText, letterSpacing: 0.8, fontWeight: 700 }}>NEXT WORMHOLE</div>
                        <div style={{ color: palette.warning, fontSize: 13, fontWeight: 700 }}>{wormholeCountdown.toFixed(1)}s</div>
                    </div>
                </div>
            </div>

            {/* Progress + speed */}
            <div style={{
                position: 'absolute', left: 12, bottom: 122,
                width: 210,
                borderRadius: 14,
                border: `1px solid ${palette.border}`,
                background: palette.panel,
                backdropFilter: 'blur(10px)',
                boxShadow: palette.shadow,
                padding: 12,
                pointerEvents: 'auto',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: palette.subText, fontSize: 10, letterSpacing: 0.8, fontWeight: 700 }}>ORBS ON WORM</span>
                    <span style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 800 }}>{wormBodyTiles}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.25)', overflow: 'hidden' }}>
                    <div
                        style={{
                            height: '100%',
                            width: `${Math.min(100, wormBodyTiles * 6)}%`,
                            background: `linear-gradient(90deg, ${palette.fillA}, ${palette.fillB})`,
                            transition: 'width 0.35s ease',
                        }}
                    />
                </div>

                <div style={{ marginTop: 12, marginBottom: 6, color: palette.subText, fontSize: 10, letterSpacing: 0.8, fontWeight: 700 }}>
                    SPEED {wormSpeed.toFixed(1)}×
                </div>
                <input
                    type="range"
                    min="0.3"
                    max="3.0"
                    step="0.1"
                    value={wormSpeed}
                    onChange={e => wormAlive && setWormSpeed(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#60a5fa', cursor: 'pointer' }}
                />
            </div>

            {/* Portal instruction */}
            {isPortalReady && (
                <div style={{
                    position: 'absolute', bottom: 186, left: '50%', transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    fontSize: 11, letterSpacing: 1.0, fontWeight: 700,
                    color: '#c4b5fd',
                    background: 'rgba(30, 41, 59, 0.78)',
                    border: `1px solid ${palette.border}`,
                    borderRadius: 999,
                    padding: '6px 12px',
                }}>
                    Jump over wormhole
                </div>
            )}

            {/* Jump button */}
            <div style={{ position: 'absolute', bottom: 122, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto' }}>
                <button
                    onPointerDown={handleJumpAction}
                    onTouchStart={e => { e.preventDefault(); handleJumpAction(); }}
                    style={{
                        minWidth: 120,
                        borderRadius: 12,
                        padding: '10px 18px',
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: 0.7,
                        color: '#f8fafc',
                        background: isPortalReady
                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                            : 'linear-gradient(135deg, #334155, #475569)',
                        border: isPortalReady
                            ? `1px solid ${palette.strongBorder}`
                            : `1px solid ${palette.border}`,
                        boxShadow: palette.shadow,
                        cursor: 'pointer',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                    }}
                >
                    ⤴ JUMP
                </button>
            </div>

            {/* D-pad */}
            <div style={{
                position: 'absolute', bottom: 92, right: 12,
                display: 'grid',
                gridTemplateColumns: '44px 44px 44px',
                gridTemplateRows: '44px 44px 44px',
                gap: 4,
                pointerEvents: 'auto',
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
                            onPointerDown={() => wormAlive && useGameStore.getState()._wormTurn?.(dir)}
                            style={{
                                gridColumn: col + 1,
                                gridRow: row + 1,
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                background: 'rgba(30, 41, 59, 0.78)',
                                border: `1px solid ${palette.border}`,
                                color: '#bfdbfe',
                                fontSize: 18,
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: palette.shadow,
                            }}
                        >
                            {label}
                        </button>
                    ) : <div key="center" style={{ gridColumn: col + 1, gridRow: row + 1 }} />
                ))}
            </div>

            {showDeathMenu && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(2, 6, 23, 0.55)',
                    backdropFilter: 'blur(4px)',
                    pointerEvents: 'auto',
                }}>
                    <div style={{
                        width: 'min(92vw, 380px)',
                        borderRadius: 16,
                        border: `1px solid ${palette.border}`,
                        background: 'rgba(15, 23, 42, 0.92)',
                        boxShadow: palette.shadow,
                        padding: 18,
                        textAlign: 'center',
                    }}>
                        <div style={{ color: palette.subText, fontSize: 12, fontWeight: 700, letterSpacing: 1.0 }}>WORM COLLISION</div>
                        <div style={{ color: '#f8fafc', fontSize: 24, fontWeight: 800, marginTop: 4 }}>You hit your tail.</div>
                        <div style={{ color: palette.subText, fontSize: 13, marginTop: 8 }}>Retry this run or start a new game mode.</div>
                        <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button
                                onPointerDown={onRetry}
                                style={{
                                    minWidth: 120,
                                    borderRadius: 12,
                                    padding: '10px 16px',
                                    fontSize: 14,
                                    fontWeight: 800,
                                    letterSpacing: 0.7,
                                    color: '#f8fafc',
                                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                                    border: `1px solid ${palette.strongBorder}`,
                                    cursor: 'pointer',
                                }}
                            >
                                Retry
                            </button>
                            <button
                                onPointerDown={onNewGame}
                                style={{
                                    minWidth: 120,
                                    borderRadius: 12,
                                    padding: '10px 16px',
                                    fontSize: 14,
                                    fontWeight: 800,
                                    letterSpacing: 0.7,
                                    color: '#f8fafc',
                                    background: 'linear-gradient(135deg, #334155, #1e293b)',
                                    border: `1px solid ${palette.border}`,
                                    cursor: 'pointer',
                                }}
                            >
                                New Game
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
