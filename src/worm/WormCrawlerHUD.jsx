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
import { callWormTurn } from './wormTurnBridge.js';
import { MenuTitleCard } from '../components/menus/MainMenu.jsx';
import DeathScreen from './DeathScreens.jsx';

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

const COUNTDOWN_OVERLAY_STYLE = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 20,
};

const COUNTDOWN_NUMBER_STYLE = {
    fontSize: 'clamp(96px, 22vw, 180px)',
    fontWeight: 900,
    letterSpacing: -4,
    color: '#fff',
    textShadow: '0 0 40px rgba(99,102,241,0.9), 0 0 80px rgba(139,92,246,0.7), 0 4px 20px rgba(0,0,0,0.6)',
    WebkitTextStroke: '3px rgba(99,102,241,0.8)',
    lineHeight: 1,
    userSelect: 'none',
};

// ─── Winner screen styles ──────────────────────────────────────────────────────

const WINNER_SCREEN_STYLE = {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(ellipse at 50% 30%, #1a0a3d 0%, #08051a 60%, #000 100%)',
    pointerEvents: 'auto',
    overflow: 'hidden',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
};

const WINNER_STARS_STYLE = {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: `
        radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px) 12% 18%/200px 200px,
        radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px) 37% 44%/150px 150px,
        radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px) 68% 22%/180px 180px,
        radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px) 84% 67%/120px 120px,
        radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px) 22% 78%/160px 160px
    `,
};

const WINNER_TITLE_STYLE = {
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    fontSize: 'clamp(52px, 11vw, 96px)',
    fontWeight: 900,
    letterSpacing: '-2px',
    color: '#ffdd00',
    textShadow: '-4px -4px 0 #cc2200, 4px -4px 0 #cc2200, -4px 4px 0 #cc2200, 4px 4px 0 #cc2200, 0 0 40px rgba(255,221,0,0.5)',
    userSelect: 'none',
    marginBottom: 4,
    lineHeight: 1,
    textAlign: 'center',
};

const WINNER_SUB_STYLE = {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 2,
    marginBottom: 28,
    textAlign: 'center',
};

const PODIUM_WRAP_STYLE = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 22,
    position: 'relative',
};

const PODIUM_WORM_ROW_STYLE = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    flexWrap: 'nowrap',
    maxWidth: 'min(90vw, 520px)',
    overflow: 'hidden',
};

const PODIUM_BASE_STYLE = {
    width: 'min(90vw, 320px)',
    height: 44,
    borderRadius: '0 0 12px 12px',
    background: 'linear-gradient(180deg, #ffd700 0%, #b8860b 60%, #8B6914 100%)',
    boxShadow: '0 8px 32px rgba(255,215,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const PODIUM_LABEL_STYLE = {
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    fontSize: 18,
    fontWeight: 900,
    color: '#3d2000',
    letterSpacing: 2,
    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
};

const WINNER_STATS_STYLE = {
    display: 'flex',
    gap: 12,
    marginBottom: 18,
    flexWrap: 'wrap',
    justifyContent: 'center',
};

const WINNER_STAT_BOX_STYLE = {
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(8px)',
    padding: '10px 16px',
    textAlign: 'center',
    minWidth: 90,
};

const WINNER_STAT_LABEL_STYLE = {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 2,
};

const WINNER_STAT_VALUE_STYLE = {
    fontSize: 20,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.1,
};

const WINNER_PP_STYLE = {
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    fontSize: 'clamp(28px, 6vw, 44px)',
    color: '#c4b5fd',
    letterSpacing: '-1px',
    textShadow: '-2px -2px 0 #5b21b6, 2px -2px 0 #5b21b6, -2px 2px 0 #5b21b6, 2px 2px 0 #5b21b6',
    marginBottom: 6,
    textAlign: 'center',
};

const WINNER_PP_NOTE_STYLE = {
    fontSize: 11,
    color: 'rgba(196,181,253,0.65)',
    marginBottom: 22,
    textAlign: 'center',
};

const WINNER_BTN_ROW_STYLE = {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
};

const WINNER_PLAY_AGAIN_STYLE = {
    minWidth: 140,
    borderRadius: 14,
    padding: '12px 20px',
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.6,
    color: '#fff',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: '2px solid rgba(139,92,246,0.6)',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
};

const WINNER_NEW_GAME_STYLE = {
    minWidth: 120,
    borderRadius: 14,
    padding: '12px 20px',
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.8)',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
};

// ─── WinnerScreen ─────────────────────────────────────────────────────────────

const MAX_WORM_DISPLAY = 28; // max segments to draw in the worm graphic

function WinnerScreen({ wormBodyTiles, wormSessionOrbs, parityPoints, wormTimeAlive, wormHealedCount, wormColor, formatTime, onRetry, onNewGame }) {
    const ppEarned = wormBodyTiles * 10; // EARN_ORB_COLLECT(5) × 2 multiplier
    const displayCount = Math.min(wormBodyTiles, MAX_WORM_DISPLAY);
    const overflow = wormBodyTiles > MAX_WORM_DISPLAY ? wormBodyTiles - MAX_WORM_DISPLAY : 0;

    // Build worm segment colors: head is slightly lighter, tail fades
    const segments = useMemo(() => {
        if (displayCount === 0) return [];
        return Array.from({ length: displayCount }, (_, i) => {
            const t = i / Math.max(1, displayCount - 1);
            const alpha = 0.35 + 0.65 * (1 - t * 0.5);
            return { size: i === 0 ? 28 : 20 - t * 6, alpha };
        });
    }, [displayCount]);

    return (
        <div style={WINNER_SCREEN_STYLE}>
            {/* starfield */}
            <div style={WINNER_STARS_STYLE} />

            {/* Title */}
            <div style={WINNER_TITLE_STYLE}>WINNER WORM!</div>
            <div style={WINNER_SUB_STYLE}>CUBE SOLVED · ALL TUNNELS HEALED</div>

            {/* Worm on podium */}
            <div style={PODIUM_WRAP_STYLE}>
                <div style={PODIUM_WORM_ROW_STYLE}>
                    {segments.map((seg, i) => (
                        <div
                            key={i}
                            style={{
                                width: seg.size,
                                height: seg.size,
                                borderRadius: '50%',
                                background: wormColor,
                                opacity: seg.alpha,
                                flexShrink: 0,
                                boxShadow: i === 0 ? `0 0 12px 4px ${wormColor}` : 'none',
                                border: i === 0 ? '2px solid rgba(255,255,255,0.5)' : 'none',
                            }}
                        />
                    ))}
                    {overflow > 0 && (
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.6)', flexShrink: 0, marginLeft: 4 }}>
                            +{overflow}
                        </div>
                    )}
                    {wormBodyTiles === 0 && (
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>no orbs</div>
                    )}
                </div>
                <div style={PODIUM_BASE_STYLE}>
                    <span style={PODIUM_LABEL_STYLE}>🏆 FINAL LENGTH: {wormBodyTiles}</span>
                </div>
            </div>

            {/* PP earned */}
            <div style={WINNER_PP_STYLE}>+{ppEarned} PARITY POINTS</div>
            <div style={WINNER_PP_NOTE_STYLE}>{wormBodyTiles} orbs × 5 PP × 2× WIN BONUS</div>

            {/* Stats row */}
            <div style={WINNER_STATS_STYLE}>
                <div style={WINNER_STAT_BOX_STYLE}>
                    <div style={WINNER_STAT_LABEL_STYLE}>TIME</div>
                    <div style={WINNER_STAT_VALUE_STYLE}>{formatTime(wormTimeAlive)}</div>
                </div>
                <div style={WINNER_STAT_BOX_STYLE}>
                    <div style={WINNER_STAT_LABEL_STYLE}>COLLECTED</div>
                    <div style={WINNER_STAT_VALUE_STYLE}>{wormSessionOrbs}</div>
                </div>
                <div style={WINNER_STAT_BOX_STYLE}>
                    <div style={WINNER_STAT_LABEL_STYLE}>HEALED</div>
                    <div style={WINNER_STAT_VALUE_STYLE}>{wormHealedCount}</div>
                </div>
                <div style={WINNER_STAT_BOX_STYLE}>
                    <div style={WINNER_STAT_LABEL_STYLE}>TOTAL PPs</div>
                    <div style={{ ...WINNER_STAT_VALUE_STYLE, color: '#c4b5fd' }}>{parityPoints}</div>
                </div>
            </div>

            {/* Buttons */}
            <div style={WINNER_BTN_ROW_STYLE}>
                <button onPointerDown={onRetry} style={WINNER_PLAY_AGAIN_STYLE}>
                    Play Again
                </button>
                <button onPointerDown={onNewGame} style={WINNER_NEW_GAME_STYLE}>
                    New Game
                </button>
            </div>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WormCrawlerHUD({ phase, onFlippedTile, cubeSize: _cubeSize = 3, onHome, onSettings, onToggleAntipodal, antipodalActive = false, wormAlive = true, showDeathMenu = false, deathDetails = null, onRetry, onNewGame }) {
    const [isMinimized, setIsMinimized] = useState(false);

    // Reset minimize whenever a fresh death menu appears
    useEffect(() => {
        if (showDeathMenu) setIsMinimized(false);
    }, [showDeathMenu]);
    const { wormSpeed, wormHealedCount, wormBodyTiles, wormholeCountdown, wormControlMode, wormTimeAlive, wormTunnelCount, wormColor, wormOrbInventory, settings, setWormSpeed, toggleWormControlMode, wormGamePhase, wormCountdownStep, wormSessionOrbs, parityPoints } = useGameStore(
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
            wormGamePhase: s.wormGamePhase ?? 'active',
            wormCountdownStep: s.wormCountdownStep ?? null,
            wormSessionOrbs: s.wormSessionOrbs ?? 0,
            parityPoints: s.parityPoints ?? 0,
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
        callWormTurn('jump');
    };

    const phaseMeta = PHASE_META[phase] || { label: phase || 'CRAWLING', accent: '#93c5fd' };
    const isPortalReady = wormAlive && onFlippedTile && phase === 'crawling';

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
                    {onToggleAntipodal && (
                      <button
                        onPointerDown={onToggleAntipodal}
                        style={{ ...buttonBase, opacity: antipodalActive ? 1 : 0.45, fontSize: 15 }}
                        aria-label="Toggle Antipodal Camera"
                        title="Antipodal Camera"
                      >⊕</button>
                    )}
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
                        <div style={HEALED_LABEL_STYLE}>ON WORM</div>
                        <div style={{ ...HEALED_VALUE_STYLE, color: '#c4b5fd' }}>{wormBodyTiles}</div>
                    </div>
                    <div style={HEALED_COL_STYLE}>
                        <div style={HEALED_LABEL_STYLE}>COLLECTED</div>
                        <div style={{ ...HEALED_VALUE_STYLE, color: '#fbbf24' }}>{wormSessionOrbs}</div>
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
                    {wormGamePhase === 'finalHealing' ? (
                        <div style={{ ...WORMHOLE_COL_STYLE, textAlign: 'center' }}>
                            <div style={{ ...WORMHOLE_LABEL_STYLE, color: '#f97316' }}>FINAL PHASE</div>
                            <div style={{ ...WORMHOLE_VALUE_STYLE, color: '#f97316', fontSize: 11 }}>HEAL ALL TUNNELS</div>
                        </div>
                    ) : (
                        <div style={WORMHOLE_COL_STYLE}>
                            <div style={WORMHOLE_LABEL_STYLE}>NEXT WORMHOLE</div>
                            <div style={WORMHOLE_VALUE_STYLE}>{wormholeCountdown.toFixed(1)}s</div>
                        </div>
                    )}
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
                            onPointerDown={() => wormAlive && callWormTurn(dir)}
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

            {/* Scramble-solve countdown overlay — 3, 2, 1, WORM^3 */}
            {wormGamePhase === 'countdown' && wormCountdownStep !== null && (
                <div style={COUNTDOWN_OVERLAY_STYLE}>
                    {wormCountdownStep === 'go' ? (
                        <MenuTitleCard visible />
                    ) : (
                        <div style={COUNTDOWN_NUMBER_STYLE}>
                            {wormCountdownStep}
                        </div>
                    )}
                </div>
            )}

            {/* ── Full-screen winner takeover ── */}
            {wormGamePhase === 'solved' && (
                <WinnerScreen
                    wormBodyTiles={wormBodyTiles}
                    wormSessionOrbs={wormSessionOrbs}
                    parityPoints={parityPoints}
                    wormTimeAlive={wormTimeAlive}
                    wormHealedCount={wormHealedCount}
                    wormColor={wormColor}
                    formatTime={formatTime}
                    onRetry={onRetry}
                    onNewGame={onNewGame}
                />
            )}

            {showDeathMenu && !isMinimized && (
                <DeathScreen
                    deathDetails={deathDetails}
                    wormTimeAlive={wormTimeAlive}
                    wormHealedCount={wormHealedCount}
                    wormTunnelCount={wormTunnelCount}
                    wormBodyTiles={wormBodyTiles}
                    formatTime={formatTime}
                    onRetry={onRetry}
                    onNewGame={onNewGame}
                    onExamine={() => setIsMinimized(true)}
                />
            )}

        </div>
    );
}
