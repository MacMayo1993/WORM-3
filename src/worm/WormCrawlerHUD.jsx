// src/worm/WormCrawlerHUD.jsx
// Mobile-friendly HUD for WORM Chase-Cam Mode.
// Uses the same clean, pedagogical visual language as other overlays.

import React, { useMemo, useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';

const PHASE_META = {
    crawling: { label: 'CRAWLING', accent: '#38bdf8' },
    entering: { label: 'ENTERING TUNNEL', accent: '#818cf8' },
    tunnel: { label: 'IN TUNNEL', accent: '#60a5fa' },
    exiting: { label: 'EXITING TUNNEL', accent: '#a78bfa' },
};

const palette = {
    text: '#0f172a',
    subText: 'rgba(15, 23, 42, 0.62)',
    panel: 'rgba(255, 255, 255, 0.9)',
    border: 'rgba(15, 23, 42, 0.14)',
    strongBorder: 'rgba(59, 130, 246, 0.45)',
    shadow: '0 10px 28px rgba(15, 23, 42, 0.18)',
    success: '#34d399',
    warning: '#fbbf24',
    fillA: '#60a5fa',
    fillB: '#a78bfa',
};

// ─── Module-level style constants ─────────────────────────────────────────────

const buttonBase = {
    background: 'rgba(255, 255, 255, 0.86)',
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

const ROOT_STYLE = {
    position: 'fixed', inset: 0,
    pointerEvents: 'none', zIndex: 600,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
    color: palette.text,
};

const TOP_BAR_STYLE = {
    position: 'absolute', top: 12, left: 12, right: 12,
    borderRadius: 14,
    padding: '10px 12px',
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    backdropFilter: 'blur(18px)',
    boxShadow: palette.shadow,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'auto',
};

const TOP_BAR_LEFT_STYLE = { display: 'flex', alignItems: 'center', gap: 8 };
const TOP_BAR_RIGHT_STYLE = { display: 'flex', alignItems: 'center', gap: 16 };

const STATUS_LABEL_STYLE = { fontSize: 10, color: palette.subText, letterSpacing: 0.9, fontWeight: 700 };

const CONTROL_MODE_BTN_STYLE = {
    borderRadius: 999,
    border: `1px solid ${palette.border}`,
    background: 'rgba(255,255,255,0.84)',
    color: palette.text,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.6,
    padding: '6px 10px',
    cursor: 'pointer',
};

const HEALED_COL_STYLE = { textAlign: 'right' };
const HEALED_LABEL_STYLE = { fontSize: 10, color: palette.subText, letterSpacing: 0.8, fontWeight: 700 };
const HEALED_VALUE_STYLE = { color: palette.success, fontSize: 18, fontWeight: 800 };

const WORMHOLE_COL_STYLE = { textAlign: 'right' };
const WORMHOLE_LABEL_STYLE = { fontSize: 10, color: palette.subText, letterSpacing: 0.8, fontWeight: 700 };
const WORMHOLE_VALUE_STYLE = { color: palette.warning, fontSize: 13, fontWeight: 700 };

const PAUSE_BTN_STYLE = {
    background: 'rgba(255, 255, 255, 0.86)',
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
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
};

const PAUSE_OVERLAY_STYLE = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(2, 6, 23, 0.55)',
    backdropFilter: 'blur(4px)',
    pointerEvents: 'auto',
    zIndex: 10,
};

const PAUSE_CARD_STYLE = {
    width: 'min(92vw, 340px)',
    borderRadius: 16,
    border: `1px solid ${palette.border}`,
    background: 'rgba(255, 255, 255, 0.94)',
    boxShadow: palette.shadow,
    padding: 20,
    textAlign: 'center',
};

const PAUSE_TITLE_STYLE = { color: palette.subText, fontSize: 11, fontWeight: 700, letterSpacing: 1.0 };
const PAUSE_HEADING_STYLE = { color: palette.text, fontSize: 26, fontWeight: 800, marginTop: 4, marginBottom: 14 };

const PAUSE_STATS_STYLE = {
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${palette.border}`,
    background: 'rgba(255,255,255,0.78)',
    textAlign: 'left',
    fontSize: 12,
    color: palette.subText,
    lineHeight: 1.8,
    marginBottom: 16,
};

const PAUSE_STAT_VALUE_STYLE = { color: palette.text, fontWeight: 700 };

const RESUME_BTN_STYLE = {
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
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
};

const PROGRESS_PANEL_STYLE = {
    position: 'absolute', left: 12, bottom: 150,
    width: 210,
    borderRadius: 14,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    backdropFilter: 'blur(18px)',
    boxShadow: palette.shadow,
    padding: 12,
    pointerEvents: 'auto',
};

const PROGRESS_ROW_STYLE = { display: 'flex', justifyContent: 'space-between', marginBottom: 6 };
const PROGRESS_LABEL_STYLE = { color: palette.subText, fontSize: 10, letterSpacing: 0.8, fontWeight: 700 };
const PROGRESS_VALUE_STYLE = { color: '#c4b5fd', fontSize: 12, fontWeight: 800 };
const PROGRESS_TRACK_STYLE = { height: 8, borderRadius: 999, background: 'rgba(100,116,139,0.2)', overflow: 'hidden' };
const SPEED_LABEL_STYLE = { marginTop: 12, marginBottom: 6, color: palette.subText, fontSize: 10, letterSpacing: 0.8, fontWeight: 700 };
const SPEED_INPUT_STYLE = { width: '100%', accentColor: '#60a5fa', cursor: 'pointer' };

const PORTAL_HINT_STYLE = {
    position: 'absolute', bottom: 230, left: '50%', transform: 'translateX(-50%)',
    pointerEvents: 'none',
    fontSize: 11, letterSpacing: 1.0, fontWeight: 700,
    color: '#c4b5fd',
    background: 'rgba(255, 255, 255, 0.86)',
    border: `1px solid ${palette.border}`,
    borderRadius: 999,
    padding: '6px 12px',
};

const JUMP_WRAP_STYLE = { position: 'absolute', bottom: 150, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto' };

const JUMP_BTN_BASE = {
    minWidth: 150,
    borderRadius: 16,
    padding: '16px 28px',
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 0.7,
    color: '#f8fafc',
    boxShadow: palette.shadow,
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
};

const JUMP_BTN_READY = {
    ...JUMP_BTN_BASE,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: `1px solid ${palette.strongBorder}`,
};

const JUMP_BTN_IDLE = {
    ...JUMP_BTN_BASE,
    background: 'linear-gradient(135deg, #64748b, #475569)',
    border: `1px solid ${palette.border}`,
};

const DPAD_STYLE = {
    position: 'absolute', bottom: 24, right: 12,
    display: 'grid',
    gridTemplateColumns: '54px 54px 54px',
    gridTemplateRows: '54px 54px 54px',
    gap: 6,
    pointerEvents: 'auto',
};

const DPAD_DIRS = [
    ['↑', 'up', 1, 0],
    ['←', 'left', 0, 1],
    ['·', null, 1, 1],
    ['→', 'right', 2, 1],
    ['↓', 'down', 1, 2],
];

const DPAD_BTN_STYLE = {
    width: 54,
    height: 54,
    borderRadius: 12,
    background: 'rgba(255, 255, 255, 0.86)',
    border: `1px solid ${palette.border}`,
    color: '#1e40af',
    fontSize: 22,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: palette.shadow,
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
};

const DEATH_OVERLAY_STYLE = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(2, 6, 23, 0.55)',
    backdropFilter: 'blur(4px)',
    pointerEvents: 'auto',
};

const DEATH_CARD_STYLE = {
    width: 'min(92vw, 380px)',
    borderRadius: 16,
    border: `1px solid ${palette.border}`,
    background: 'rgba(255, 255, 255, 0.94)',
    boxShadow: palette.shadow,
    padding: 18,
    textAlign: 'center',
};

const DEATH_TITLE_STYLE = { color: palette.subText, fontSize: 12, fontWeight: 700, letterSpacing: 1.0 };
const DEATH_HEADING_STYLE = { color: palette.text, fontSize: 24, fontWeight: 800, marginTop: 4 };
const DEATH_SUBTITLE_STYLE = { color: palette.subText, fontSize: 13, marginTop: 8 };

const DEATH_DETAILS_STYLE = {
    marginTop: 10,
    padding: '8px 10px',
    borderRadius: 10,
    border: `1px solid ${palette.border}`,
    background: 'rgba(255,255,255,0.78)',
    textAlign: 'left',
    fontSize: 11,
    color: palette.subText,
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    lineHeight: 1.35,
};

const DEATH_DETAIL_VALUE_STYLE = { color: palette.text };

const DEATH_BTN_ROW_STYLE = { marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' };

const RETRY_BTN_STYLE = {
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
};

const NEW_GAME_BTN_STYLE = {
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
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WormCrawlerHUD({ phase, onFlippedTile, cubeSize: _cubeSize = 3, onHome, onSettings, wormAlive = true, showDeathMenu = false, deathDetails = null, onRetry, onNewGame }) {
    const { wormSpeed, wormHealedCount, wormBodyTiles, wormholeCountdown, wormControlMode, wormPaused, wormTimeAlive, wormTunnelCount, setWormSpeed, toggleWormControlMode, setWormPaused } = useGameStore(
        useShallow(s => ({
            wormSpeed: s.wormSpeed ?? 1.0,
            wormHealedCount: s.wormHealedCount ?? 0,
            wormBodyTiles: s.wormBodyTiles ?? 0,
            wormholeCountdown: s.wormholeCountdown ?? 0,
            wormControlMode: s.wormControlMode ?? 'non-oriented',
            wormPaused: s.wormPaused ?? false,
            wormTimeAlive: s.wormTimeAlive ?? 0,
            wormTunnelCount: s.wormTunnelCount ?? 0,
            setWormSpeed: s.setWormSpeed,
            toggleWormControlMode: s.toggleWormControlMode,
            setWormPaused: s.setWormPaused,
        }))
    );

    const togglePause = () => {
        if (!wormAlive) return;
        setWormPaused(!wormPaused);
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.code === 'Escape') {
                e.preventDefault();
                if (wormAlive) setWormPaused(!useGameStore.getState().wormPaused);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [wormAlive, setWormPaused]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const handleJumpAction = () => {
        if (!wormAlive) return;
        useGameStore.getState()._wormTurn?.('jump');
    };

    const phaseMeta = PHASE_META[phase] || { label: phase || 'CRAWLING', accent: '#93c5fd' };
    const isPortalReady = wormAlive && onFlippedTile && phase === 'crawling';

    const isVoidedDeath = deathDetails?.reason === 'voided' || deathDetails?.reason === 'void-zone' || deathDetails?.reason === 'void-tunnel-exhausted';
    const deathTitle = isVoidedDeath ? 'VOID BREACH' : 'WORM COLLISION';
    const deathHeading = isVoidedDeath ? 'You have been VOIDED!' : 'You hit your tail.';

    const phaseNameStyle = useMemo(
        () => ({ fontSize: 13, fontWeight: 700, color: phaseMeta.accent }),
        [phaseMeta.accent]
    );

    const progressFillStyle = useMemo(
        () => ({
            height: '100%',
            width: `${Math.min(100, wormBodyTiles * 6)}%`,
            background: `linear-gradient(90deg, ${palette.fillA}, ${palette.fillB})`,
            transition: 'width 0.35s ease',
        }),
        [wormBodyTiles]
    );

    const jumpBtnStyle = isPortalReady ? JUMP_BTN_READY : JUMP_BTN_IDLE;

    return (
        <div style={ROOT_STYLE}>
            {/* Top info bar */}
            <div style={TOP_BAR_STYLE}>
                <div style={TOP_BAR_LEFT_STYLE}>
                    {onHome && <button onPointerDown={onHome} style={buttonBase} aria-label="Home">⌂</button>}
                    {onSettings && <button onPointerDown={onSettings} style={buttonBase} aria-label="Settings">⚙</button>}
                    <div style={{ lineHeight: 1.1 }}>
                        <div style={STATUS_LABEL_STYLE}>WORM STATUS</div>
                        <div style={phaseNameStyle}>{phaseMeta.label}</div>
                    </div>
                </div>

                <div style={TOP_BAR_RIGHT_STYLE}>
                    <button
                        onPointerDown={() => toggleWormControlMode()}
                        style={CONTROL_MODE_BTN_STYLE}
                        title="Toggle worm control mode"
                    >
                        {wormControlMode === 'oriented' ? 'ORIENTED' : 'NON-ORIENTED'}
                    </button>
                    <div style={HEALED_COL_STYLE}>
                        <div style={HEALED_LABEL_STYLE}>HEALED</div>
                        <div style={HEALED_VALUE_STYLE}>{wormHealedCount}</div>
                    </div>
                    <div style={WORMHOLE_COL_STYLE}>
                        <div style={WORMHOLE_LABEL_STYLE}>NEXT WORMHOLE</div>
                        <div style={WORMHOLE_VALUE_STYLE}>{wormholeCountdown.toFixed(1)}s</div>
                    </div>
                    {wormAlive && (
                        <button onPointerDown={togglePause} tabIndex={-1} style={PAUSE_BTN_STYLE} aria-label={wormPaused ? 'Resume' : 'Pause'}>
                            {wormPaused ? '▶' : '⏸'}
                        </button>
                    )}
                </div>
            </div>

            {/* Progress + speed */}
            <div style={PROGRESS_PANEL_STYLE}>
                <div style={PROGRESS_ROW_STYLE}>
                    <span style={PROGRESS_LABEL_STYLE}>ORBS ON WORM</span>
                    <span style={PROGRESS_VALUE_STYLE}>{wormBodyTiles}</span>
                </div>
                <div style={PROGRESS_TRACK_STYLE}>
                    <div style={progressFillStyle} />
                </div>

                <div style={SPEED_LABEL_STYLE}>
                    SPEED {wormSpeed.toFixed(1)}×
                </div>
                <input
                    type="range"
                    min="0.3"
                    max="3.0"
                    step="0.1"
                    value={wormSpeed}
                    onChange={e => wormAlive && setWormSpeed(parseFloat(e.target.value))}
                    style={SPEED_INPUT_STYLE}
                />
            </div>

            {/* Portal instruction */}
            {isPortalReady && (
                <div style={PORTAL_HINT_STYLE}>
                    Jump over wormhole
                </div>
            )}

            {/* Jump button */}
            <div style={JUMP_WRAP_STYLE}>
                <button
                    onPointerDown={handleJumpAction}
                    onTouchStart={e => { e.preventDefault(); handleJumpAction(); }}
                    style={jumpBtnStyle}
                >
                    ⤴ JUMP
                </button>
            </div>

            {/* D-pad */}
            <div style={DPAD_STYLE}>
                {DPAD_DIRS.map(([label, dir, col, row]) => (
                    dir ? (
                        <button
                            key={dir}
                            onPointerDown={() => wormAlive && useGameStore.getState()._wormTurn?.(dir)}
                            style={{ ...DPAD_BTN_STYLE, gridColumn: col + 1, gridRow: row + 1 }}
                        >
                            {label}
                        </button>
                    ) : <div key="center" style={{ gridColumn: col + 1, gridRow: row + 1 }} />
                ))}
            </div>

            {wormPaused && wormAlive && (
                <div style={PAUSE_OVERLAY_STYLE}>
                    <div style={PAUSE_CARD_STYLE}>
                        <div style={PAUSE_TITLE_STYLE}>WORM MODE</div>
                        <div style={PAUSE_HEADING_STYLE}>PAUSED</div>
                        <div style={PAUSE_STATS_STYLE}>
                            <div>Time alive: <b style={PAUSE_STAT_VALUE_STYLE}>{formatTime(wormTimeAlive)}</b></div>
                            <div>Tiles healed: <b style={PAUSE_STAT_VALUE_STYLE}>{wormHealedCount}</b></div>
                            <div>Wormholes used: <b style={PAUSE_STAT_VALUE_STYLE}>{wormTunnelCount}</b></div>
                            <div>Orbs on worm: <b style={PAUSE_STAT_VALUE_STYLE}>{wormBodyTiles}</b></div>
                        </div>
                        <button onPointerDown={togglePause} tabIndex={-1} style={RESUME_BTN_STYLE}>
                            ▶ RESUME
                        </button>
                    </div>
                </div>
            )}

            {showDeathMenu && (
                <div style={DEATH_OVERLAY_STYLE}>
                    <div style={DEATH_CARD_STYLE}>
                        <div style={DEATH_TITLE_STYLE}>{deathTitle}</div>
                        <div style={DEATH_HEADING_STYLE}>{deathHeading}</div>
                        <div style={PAUSE_STATS_STYLE}>
                            <div>Time alive: <b style={PAUSE_STAT_VALUE_STYLE}>{formatTime(wormTimeAlive)}</b></div>
                            <div>Tiles healed: <b style={PAUSE_STAT_VALUE_STYLE}>{wormHealedCount}</b></div>
                            <div>Wormholes used: <b style={PAUSE_STAT_VALUE_STYLE}>{wormTunnelCount}</b></div>
                            <div>Orbs on worm: <b style={PAUSE_STAT_VALUE_STYLE}>{wormBodyTiles}</b></div>
                        </div>
                        {isVoidedDeath && (
                            <div style={DEATH_DETAILS_STYLE}>
                                <div>Reason: <b style={DEATH_DETAIL_VALUE_STYLE}>Void breach</b></div>
                                <div>Head tile: <b style={DEATH_DETAIL_VALUE_STYLE}>{deathDetails?.headTile ?? 'n/a'}</b></div>
                                <div>Tunnel key: <b style={DEATH_DETAIL_VALUE_STYLE}>{deathDetails?.tunnelKey ?? 'n/a'}</b></div>
                            </div>
                        )}
                        {deathDetails?.reason === 'self-collision' && (
                            <div style={DEATH_DETAILS_STYLE}>
                                <div>Reason: <b style={DEATH_DETAIL_VALUE_STYLE}>Self-collision</b></div>
                                <div>Head tile: <b style={DEATH_DETAIL_VALUE_STYLE}>{deathDetails.headTile ?? 'n/a'}</b></div>
                                <div>Body tile hit: <b style={DEATH_DETAIL_VALUE_STYLE}>{deathDetails.collisionTile ?? 'n/a'}</b></div>
                                <div>Impact progress: <b style={DEATH_DETAIL_VALUE_STYLE}>{deathDetails.progress ?? 'n/a'}</b></div>
                            </div>
                        )}
                        <div style={DEATH_BTN_ROW_STYLE}>
                            <button onPointerDown={onRetry} style={RETRY_BTN_STYLE}>
                                Retry
                            </button>
                            <button onPointerDown={onNewGame} style={NEW_GAME_BTN_STYLE}>
                                New Game
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
