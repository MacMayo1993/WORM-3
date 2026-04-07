// src/worm/WormCrawlerHUD.jsx
// Mobile-friendly HUD for WORM Chase-Cam Mode.
// Uses the same clean, pedagogical visual language as other overlays.

import React, { useMemo, useState, useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { resolveColors } from '../utils/colorSchemes.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import OrbInventoryHUD from './OrbInventoryHUD.jsx';
import ParityWallet from '../components/overlays/ParityWallet.jsx';

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


const toRgb = (color) => {
    if (!color || typeof color !== 'string') return null;
    const hex = color.trim();
    const fullHex = /^#([0-9a-f]{3})$/i.test(hex)
        ? `#${hex.slice(1).split('').map(ch => ch + ch).join('')}`
        : hex;
    const match = /^#([0-9a-f]{6})$/i.exec(fullHex);
    if (!match) return null;
    const value = parseInt(match[1], 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
};

const colorDistance = (a, b) => {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return dr * dr + dg * dg + db * db;
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
const TOP_BAR_RIGHT_STYLE = { display: 'flex', alignItems: 'center', gap: 12 };

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

const SPEED_BAR_STYLE = {
    position: 'absolute',
    top: 134,
    left: 12,
    right: 12,
    borderRadius: 12,
    padding: '8px 12px',
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    backdropFilter: 'blur(18px)',
    boxShadow: palette.shadow,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    pointerEvents: 'auto',
};

const SPEED_BAR_LABEL_STYLE = {
    minWidth: 82,
    color: palette.subText,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: 700,
};

const SPEED_BAR_INPUT_WRAP_STYLE = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
};

const SPEED_BAR_INPUT_STYLE = {
    width: '100%',
    accentColor: '#60a5fa',
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
    position: 'absolute', top: 76, left: 12,
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

const PORTAL_HINT_STYLE = {
    position: 'absolute', bottom: 238, left: '50%', transform: 'translateX(-50%)',
    pointerEvents: 'none',
    fontSize: 11, letterSpacing: 1.0, fontWeight: 700,
    color: '#c4b5fd',
    background: 'rgba(255, 255, 255, 0.86)',
    border: `1px solid ${palette.border}`,
    borderRadius: 999,
    padding: '6px 12px',
};

const JUMP_WRAP_STYLE = {
    position: 'absolute',
    bottom: 'calc(4px + env(safe-area-inset-bottom, 0px))',
    left: 4,
    pointerEvents: 'auto'
};

const JUMP_BTN_BASE = {
    minWidth: 198,
    borderRadius: 18,
    padding: '22px 38px',
    fontSize: 22,
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
    position: 'absolute', bottom: 'calc(4px + env(safe-area-inset-bottom, 0px))', right: 4,
    display: 'grid',
    gridTemplateColumns: '68px 68px 68px',
    gridTemplateRows: '68px 68px 68px',
    gap: 8,
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
    width: 68,
    height: 68,
    borderRadius: 14,
    background: 'rgba(255, 255, 255, 0.86)',
    border: `1px solid ${palette.border}`,
    color: '#1e40af',
    fontSize: 28,
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

const EXAMINE_BTN_STYLE = {
    minWidth: 100,
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: '#fff',
    background: 'linear-gradient(135deg, #dc2626, #991b1b)',
    border: '1px solid rgba(220,38,38,0.5)',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
};

// Minimised examine mode — no full-screen backdrop so the cube is rotatable
const EXAMINE_MINIMIZED_OUTER_STYLE = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none', // lets Canvas events through
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 70,
    zIndex: 10,
};

const EXAMINE_BAR_STYLE = {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(255,255,255,0.92)',
    border: '1px solid rgba(220,38,38,0.35)',
    borderRadius: 999,
    padding: '8px 16px',
    boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
};

const EXAMINE_DOT_STYLE = {
    width: 10, height: 10, borderRadius: '50%',
    background: '#ef4444',
    boxShadow: '0 0 6px 2px rgba(239,68,68,0.6)',
    flexShrink: 0,
};

const EXAMINE_LABEL_STYLE = {
    fontSize: 12, fontWeight: 800, letterSpacing: 0.7,
    color: '#991b1b',
};

const EXAMINE_RESTORE_BTN_STYLE = {
    fontSize: 11, fontWeight: 700,
    color: '#1e293b',
    background: 'rgba(255,255,255,0.85)',
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    padding: '4px 10px',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WormCrawlerHUD({ phase, onFlippedTile, cubeSize: _cubeSize = 3, onHome, onSettings, wormAlive = true, showDeathMenu = false, deathDetails = null, onRetry, onNewGame }) {
    const [isMinimized, setIsMinimized] = useState(false);

    // Reset minimize whenever a fresh death menu appears
    useEffect(() => {
        if (showDeathMenu) setIsMinimized(false);
    }, [showDeathMenu]);
    const { wormSpeed, wormHealedCount, wormBodyTiles, wormholeCountdown, wormControlMode, wormTimeAlive, wormTunnelCount, wormColor, wormOrbInventory, settings, setWormSpeed, toggleWormControlMode } = useGameStore(
        useShallow(s => ({
            wormSpeed: s.wormSpeed ?? 1.0,
            wormHealedCount: s.wormHealedCount ?? 0,
            wormBodyTiles: s.wormBodyTiles ?? 0,
            wormholeCountdown: s.wormholeCountdown ?? 0,
            wormControlMode: s.wormControlMode ?? 'non-oriented',
            wormTimeAlive: s.wormTimeAlive ?? 0,
            wormTunnelCount: s.wormTunnelCount ?? 0,
            wormColor: s.wormColor ?? '#33ff66',
            wormOrbInventory: s.wormOrbInventory ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
            settings: s.settings,
            setWormSpeed: s.setWormSpeed,
            toggleWormControlMode: s.toggleWormControlMode,
        }))
    );

    const resolvedFaceColors = useMemo(() => {
        const safeSettings = settings && typeof settings === 'object'
            ? settings
            : { colorScheme: 'standard', customColors: {} };
        return resolveColors(safeSettings, safeSettings?.biomeMode?.faceAssignment) || {};
    }, [settings]);

    const jumpEdgeColor = useMemo(() => {
        const wormRgb = toRgb(wormColor);
        let nearestFaceId = 2;
        let nearestDistance = Number.POSITIVE_INFINITY;

        [1, 2, 3, 4, 5, 6].forEach(faceId => {
            const faceRgb = toRgb(resolvedFaceColors[faceId]);
            const dist = colorDistance(wormRgb, faceRgb);
            if (dist < nearestDistance) {
                nearestDistance = dist;
                nearestFaceId = faceId;
            }
        });

        const antipodalFace = ANTIPODAL_COLOR[nearestFaceId] ?? 5;
        const antipodalColor = resolvedFaceColors[antipodalFace];
        return toRgb(antipodalColor) ? antipodalColor : '#8b5cf6';
    }, [resolvedFaceColors, wormColor]);


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

    const jumpBtnStyle = {
        ...(isPortalReady ? JUMP_BTN_READY : JUMP_BTN_IDLE),
        border: `1px solid ${jumpEdgeColor}`,
        boxShadow: `${palette.shadow}, 0 0 14px ${jumpEdgeColor}, 0 0 28px ${jumpEdgeColor}`,
    };

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
                    <ParityWallet dark={false} />
                    <button
                        onPointerDown={() => toggleWormControlMode()}
                        style={CONTROL_MODE_BTN_STYLE}
                        title="Toggle worm control mode"
                    >
                        {wormControlMode === 'oriented' ? 'ORIENTED' : 'NON-ORIENTED'}
                    </button>
                    <div style={HEALED_COL_STYLE}>
                        <div style={HEALED_LABEL_STYLE}>ORBS</div>
                        <div style={{ ...HEALED_VALUE_STYLE, color: '#c4b5fd' }}>{wormBodyTiles}</div>
                    </div>
                    <div style={SPEED_BAR_INPUT_WRAP_STYLE}>
                        <div style={SPEED_BAR_LABEL_STYLE}>SPEED {wormSpeed.toFixed(1)}×</div>
                        <input
                            type="range"
                            min="0.3"
                            max="3.0"
                            step="0.1"
                            value={wormSpeed}
                            onChange={e => wormAlive && setWormSpeed(parseFloat(e.target.value))}
                            style={SPEED_BAR_INPUT_STYLE}
                        />
                    </div>
                    <div style={HEALED_COL_STYLE}>
                        <div style={HEALED_LABEL_STYLE}>HEALED</div>
                        <div style={HEALED_VALUE_STYLE}>{wormHealedCount}</div>
                    </div>
                    <div style={WORMHOLE_COL_STYLE}>
                        <div style={WORMHOLE_LABEL_STYLE}>NEXT WORMHOLE</div>
                        <div style={WORMHOLE_VALUE_STYLE}>{wormholeCountdown.toFixed(1)}s</div>
                    </div>
                </div>
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


            {wormAlive && <OrbInventoryHUD orbInventory={wormOrbInventory} faceColors={resolvedFaceColors} />}

            {showDeathMenu && isMinimized && (
                // Minimised: no backdrop — canvas is fully interactive for cube inspection.
                // A small floating bar lets the player restore the card.
                <div style={EXAMINE_MINIMIZED_OUTER_STYLE}>
                    <div style={EXAMINE_BAR_STYLE}>
                        <div style={EXAMINE_DOT_STYLE} />
                        <span style={EXAMINE_LABEL_STYLE}>EXAMINE MODE</span>
                        <button onPointerDown={() => setIsMinimized(false)} style={EXAMINE_RESTORE_BTN_STYLE}>
                            View Card
                        </button>
                    </div>
                </div>
            )}

            {showDeathMenu && !isMinimized && (
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
                            {deathDetails?.reason === 'self-collision' && (
                                <button onPointerDown={() => setIsMinimized(true)} style={EXAMINE_BTN_STYLE}>
                                    Examine
                                </button>
                            )}
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
