// src/worm/WormCrawlerHUD.jsx
// Mobile-first "Antipodal HUD" for WORM Chase-Cam Mode.
// Three-zone layout: Glance Strip (top, info-only) · Game Scene · Thumb Tray (bottom, all controls).
// Colors derived from the cube's face palette in antipodal pairs.

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { resolveColors } from '../utils/colorSchemes.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';
import OrbInventoryHUD from './OrbInventoryHUD.jsx';
import ParityWallet from '../components/overlays/ParityWallet.jsx';
import { callWormTurn } from './wormTurnBridge.js';
import { wormBuffs } from './wormBuffs.js';
import { getSpecialDef } from './healerWorm/specialDefs.js';
import { getElementalDef } from './healerWorm/elementalDefs.js';
import { wormClock } from './wormClock.js';
import { BOOST_COOLDOWN, WORM_SPEED_OPTIONS } from './healerWorm/constants.js';
import { isMobile } from '../utils/device.js';
import DeathScreen from './DeathScreens.jsx';
import {
    overlayScrimStyle, overlayCardStyle, Eyebrow, OverlayTitle, StatTiles,
    SETTING_ROW_STYLE, SETTING_LABEL_STYLE, togglePillStyle, segmentStyle,
    primaryBtnStyle, LIST_BTN_STYLE, ACTION_ROW_STYLE,
} from './wormOverlayUI.jsx';
import { UI_FONT, DISPLAY_FONT, NIGHT_BORDER, NIGHT_TEXT, NIGHT_TEXT_MUTED } from '../utils/uiTheme.js';

// ─── Worm Countdown Overlay ─────────────────────────────────────────────────
const WORM_COUNTDOWN_STYLE_ID = 'worm3-countdown-style';

const ensureCountdownStyle = () => {
    if (typeof document === 'undefined' || document.getElementById(WORM_COUNTDOWN_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = WORM_COUNTDOWN_STYLE_ID;
    style.textContent = `
        @keyframes wormCountBeatIn {
            0% { transform: scale(2.5); opacity: 0; filter: blur(16px); }
            30% { transform: scale(0.9); opacity: 1; filter: blur(0); }
            50% { transform: scale(1.08); }
            100% { transform: scale(1); }
        }
        @keyframes wormCountPulse {
            0%, 100% { text-shadow: 0 0 40px rgba(139,92,246,0.9), 0 0 80px rgba(99,102,241,0.6), 0 4px 30px rgba(0,0,0,0.7); }
            50% { text-shadow: 0 0 60px rgba(139,92,246,1), 0 0 120px rgba(99,102,241,0.8), 0 0 180px rgba(59,130,246,0.4), 0 4px 30px rgba(0,0,0,0.7); }
        }
        @keyframes wormCountRingPulse {
            0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.7; border-width: 4px; }
            100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; border-width: 1px; }
        }
        @keyframes wormTitleSlam {
            0% { transform: scale(3) translateY(-20px); opacity: 0; filter: blur(12px); }
            25% { transform: scale(0.92) translateY(4px); opacity: 1; filter: blur(0); }
            40% { transform: scale(1.06) translateY(-2px); }
            100% { transform: scale(1) translateY(0); }
        }
        @keyframes wormLetterGlow {
            0%, 100% { filter: brightness(1) drop-shadow(0 0 8px currentColor); }
            50% { filter: brightness(1.3) drop-shadow(0 0 20px currentColor); }
        }
        @keyframes wormLetterDissipate {
            0% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
            40% { transform: translateY(-30px) scale(1.15); opacity: 0.7; filter: blur(2px); }
            100% { transform: translateY(-80px) scale(0.6); opacity: 0; filter: blur(12px); }
        }
        .worm-countdown-ring {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 200px;
            height: 200px;
            border-radius: 50%;
            border: 4px solid rgba(139,92,246,0.6);
            pointer-events: none;
            animation: wormCountRingPulse 0.85s ease-out forwards;
        }
        .worm-countdown-number {
            font-family: ${DISPLAY_FONT};
            font-size: clamp(120px, 28vw, 220px);
            font-weight: 900;
            line-height: 1;
            color: #fff;
            user-select: none;
            animation: wormCountBeatIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                       wormCountPulse 0.85s ease-in-out infinite 0.5s;
            text-shadow: 0 0 40px rgba(139,92,246,0.9), 0 0 80px rgba(99,102,241,0.6), 0 4px 30px rgba(0,0,0,0.7);
            -webkit-text-stroke: 2px rgba(139,92,246,0.5);
        }
        .worm-title-slam {
            display: flex;
            align-items: flex-start;
            justify-content: center;
            animation: wormTitleSlam 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .worm-title-slam .worm-cd-letter {
            font-family: ${DISPLAY_FONT};
            font-size: clamp(72px, 18vw, 140px);
            font-weight: 900;
            line-height: 1;
            display: inline-block;
            animation: wormLetterGlow 1.2s ease-in-out infinite;
        }
        .worm-title-dissipate .worm-cd-letter {
            font-family: ${DISPLAY_FONT};
            font-size: clamp(72px, 18vw, 140px);
            font-weight: 900;
            line-height: 1;
            display: inline-block;
            animation: wormLetterDissipate 0.8s ease-in forwards;
        }
    `;
    document.head.appendChild(style);
};

const WORM_LETTERS = [
    { ch: 'W', color: '#ef4444', delay: '0s' },
    { ch: 'O', color: '#f97316', delay: '0.08s' },
    { ch: 'R', color: '#22c55e', delay: '0.16s' },
    { ch: 'M', color: '#3b82f6', delay: '0.24s' },
];

const WormCountdownOverlay = ({ step }) => {
    ensureCountdownStyle();
    const isNumber = typeof step === 'number';
    const isGo = step === 'go';
    const isHold = step === 'hold';

    return (
        <div style={COUNTDOWN_OVERLAY_STYLE}>
            {/* Radial vignette */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)',
                pointerEvents: 'none',
            }} />

            {isNumber && (
                <>
                    <div key={`ring-${step}`} className="worm-countdown-ring" />
                    <div key={`num-${step}`} className="worm-countdown-number">{step}</div>
                </>
            )}

            {isGo && (
                <div className="worm-title-slam">
                    {WORM_LETTERS.map(({ ch, color, delay }) => (
                        <span
                            key={ch}
                            className="worm-cd-letter"
                            style={{ color, animationDelay: delay }}
                        >
                            {ch}
                        </span>
                    ))}
                </div>
            )}

            {isHold && (
                <div className="worm-title-dissipate" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                    {WORM_LETTERS.map(({ ch, color, delay }) => (
                        <span
                            key={ch}
                            className="worm-cd-letter"
                            style={{ color, animationDelay: delay }}
                        >
                            {ch}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

const PHASE_META = {
    crawling: { label: 'CRAWLING', faceId: 2 },
    entering: { label: 'ENTERING', faceId: 5 },
    tunnel: { label: 'IN TUNNEL', faceId: 5 },
    exiting: { label: 'EXITING', faceId: 4 },
};

const FACE_FALLBACKS = { 1: '#ef4444', 2: '#22c55e', 3: '#ffffff', 4: '#f97316', 5: '#3b82f6', 6: '#FFD500' };

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

// ─── Style constants ─────────────────────────────────────────────────────────
//
// The HUD sits on top of a live 3D scene that can be any colour — grass, lava,
// a white cube face — so it takes the shared NIGHT family (warm dark glass,
// cream type) rather than the light paper sheets used by modals. White panels
// were readable over the cube but disappeared over bright biomes and read as
// stickers pasted on the game rather than part of it.

const FONT = UI_FONT;
const SHADOW = '0 6px 22px rgba(10, 14, 8, 0.45)';
const BORDER = NIGHT_BORDER;
const HUD_SURFACE = 'rgba(24, 31, 18, 0.78)';
const HUD_SURFACE_SOFT = 'rgba(250, 247, 238, 0.07)';
const HUD_BLUR = 'blur(14px) saturate(1.05)';
const TEXT = NIGHT_TEXT;
const TEXT_MUTED = NIGHT_TEXT_MUTED;

// Paper token, still used by the pause card / overlays that own the screen.
const PANEL_BORDER = 'rgba(15, 23, 42, 0.12)';

const withAlpha = (color, alpha) => {
    const rgb = toRgb(color);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : color;
};

const ROOT_STYLE = {
    position: 'fixed', inset: 0,
    pointerEvents: 'none', zIndex: 600,
    fontFamily: FONT,
    color: TEXT,
};

// ─── Injected stylesheet ─────────────────────────────────────────────────────
// Press feedback has to come from CSS `:active`: the controls fire on
// pointerdown, so a React state round-trip would light up a frame after the
// worm has already turned. Colours come in as custom properties so the same
// rules serve whatever face palette is active.

const WORM_HUD_STYLE_ID = 'worm3-hud-style';

const ensureHudStyle = () => {
    if (typeof document === 'undefined' || document.getElementById(WORM_HUD_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = WORM_HUD_STYLE_ID;
    style.textContent = `
        /* Sizes live here rather than inline so the short-viewport rules below can
           actually win — a landscape phone has ~390px of height to spend and the
           portrait ramp eats half of it. */
        .worm-hud-bar {
            position: absolute;
            top: calc(env(safe-area-inset-top, 0px) + 6px);
            left: 8px; right: 8px;
            flex-direction: column; padding: 9px 10px 8px; gap: 7px;
        }
        /* On a wide screen a full-bleed bar leaves a dead gap in the middle; cap it
           and centre it so it reads as one panel rather than a stretched strip. */
        @media (min-width: 900px) {
            .worm-hud-bar {
                left: 50%; right: auto;
                width: min(880px, calc(100% - 32px));
                transform: translateX(-50%);
            }
        }
        .worm-hud-row { min-width: 0; }
        .worm-hud-reserve { padding-top: 7px; }
        .worm-hud-phase { padding: 4px 10px; font-size: 11px; letter-spacing: 0.9px; }
        .worm-hud-stats { gap: 10px; }
        /* Narrow phones: the phase chip gives up its generous tracking before the
           numbers give up any room. */
        @media (max-width: 380px) {
            .worm-hud-phase { padding: 3px 8px; font-size: 10px; letter-spacing: 0.4px; }
            .worm-hud-stats { gap: 8px; }
        }
        /* Landscape: fold the reserve onto the same line — height is the scarce axis. */
        @media (max-height: 520px) {
            .worm-hud-bar { flex-direction: row; align-items: center; gap: 12px; }
            .worm-hud-row { flex: 1 1 auto; }
            .worm-hud-reserve { order: -1; flex: 0 1 auto; min-width: 0; border-top: none; padding-top: 0; }
        }
        .worm-dpad {
            --cell: clamp(50px, 13.5vw, 60px);
            grid-template-columns: repeat(3, var(--cell));
            grid-template-rows: repeat(3, var(--cell));
        }
        .worm-action { --action: clamp(54px, 14.5vw, 64px); height: var(--action); }
        .worm-jump { min-width: clamp(104px, 30vw, 148px); font-size: clamp(15px, 4.2vw, 19px); }
        .worm-boost { width: var(--action); }
        @media (max-height: 520px) {
            .worm-hud-bar { padding: 6px 10px; gap: 4px; }
            .worm-hud-reserve { padding-top: 5px; }
            .worm-dpad { --cell: clamp(40px, 12.5vh, 52px); }
            .worm-action { --action: clamp(42px, 13vh, 54px); }
            .worm-jump { min-width: clamp(88px, 20vw, 124px); font-size: 15px; }
        }
        .worm-hud-key {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            cursor: pointer;
            user-select: none;
            font-family: ${UI_FONT};
            transition: transform 90ms ease, background 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
        }
        .worm-hud-key:active { transform: scale(0.93); }
        /* The key's own surface has to live here, not inline: an inline background
           outranks any :active rule, which is exactly how the press state silently
           did nothing the first time round. */
        .worm-dpad-key {
            width: 100%; height: 100%;
            border-radius: 15px;
            background: ${HUD_SURFACE_SOFT};
            border: 1px solid rgba(255,245,220,0.14);
            box-shadow: inset 0 1px 0 rgba(255,253,242,0.12);
            display: flex; align-items: center; justify-content: center;
            padding: 0;
        }
        .worm-dpad-key:active {
            background: var(--key-press, rgba(255,253,242,0.22));
            border-color: var(--key-edge, rgba(255,253,242,0.5));
            box-shadow: 0 0 18px var(--key-glow, rgba(255,253,242,0.35));
        }
        .worm-jump-ready {
            animation: wormJumpReady 1.5s ease-in-out infinite;
        }
        @keyframes wormJumpReady {
            0%, 100% { box-shadow: 0 6px 22px rgba(10,14,8,0.45), 0 0 0 0 var(--jump-glow, rgba(255,255,255,0.4)); }
            50%      { box-shadow: 0 6px 22px rgba(10,14,8,0.45), 0 0 24px 5px var(--jump-glow, rgba(255,255,255,0.4)); }
        }
        @media (prefers-reduced-motion: reduce) {
            .worm-hud-key { transition: none; }
            .worm-hud-key:active { transform: none; }
            .worm-jump-ready { animation: none; }
        }
    `;
    document.head.appendChild(style);
};

// ─── Icons ───────────────────────────────────────────────────────────────────
// Drawn, not typed. Arrow glyphs and ⚡/⏸ emoji pick up a different weight,
// colour and baseline on every platform — the same reason the special orbs
// already ship as paths.

// size may be any CSS length (the d-pad passes a clamp()), so it goes through
// style rather than the width/height attributes.
const Chevron = ({ dir = 'up', size = 22 }) => {
    const rotation = { up: 0, right: 90, down: 180, left: 270 }[dir] ?? 0;
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
            style={{ display: 'block', width: size, height: size, transform: `rotate(${rotation}deg)` }}>
            <polygon points="12,6.5 19,17 5,17" fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        </svg>
    );
};

const BoltIcon = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
        <path d="M13.2 2 4.6 13.4a.7.7 0 0 0 .56 1.12H9.4l-1 7.02a.5.5 0 0 0 .9.36l8.5-11.4a.7.7 0 0 0-.56-1.12h-4.3l1-6.98A.5.5 0 0 0 13.2 2Z" fill="currentColor" />
    </svg>
);

const PauseIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
        <rect x="6" y="4" width="4.4" height="16" rx="1.6" fill="currentColor" />
        <rect x="13.6" y="4" width="4.4" height="16" rx="1.6" fill="currentColor" />
    </svg>
);

const JumpIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
        <path d="M12 2.4 4.9 10.6a1 1 0 0 0 .76 1.65H9.1v3.9a1 1 0 0 0 1 1h3.8a1 1 0 0 0 1-1v-3.9h3.44a1 1 0 0 0 .76-1.65Z" fill="currentColor" />
        <rect x="4.6" y="19.2" width="14.8" height="2.6" rx="1.3" fill="currentColor" opacity="0.6" />
    </svg>
);

// ─── Zone 1: Status bar ──────────────────────────────────────────────────────
// One bar, two rows. The old layout stacked a second free-floating panel under
// the strip that repeated the orb total already shown above it; the reserve
// coins are now the second row of the same object.

// NOTE: placement, padding and gap come from the .worm-hud-bar rule, not from
// here, so the short- and wide-viewport media queries can compact/centre them.
const HUD_BAR_STYLE = {
    borderRadius: 16,
    background: HUD_SURFACE,
    backdropFilter: HUD_BLUR,
    WebkitBackdropFilter: HUD_BLUR,
    border: `1px solid ${BORDER}`,
    boxShadow: SHADOW,
    display: 'flex',
    overflow: 'hidden',
    pointerEvents: 'none',
};

const HUD_ROW_STYLE = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
};

// The phase chip is the one thing allowed to give up width on a 360px phone —
// everything to its right is a number the player is actually reading.
// Padding/size/tracking live in .worm-hud-phase so the narrow-phone rule applies.
const GLANCE_CHIP_STYLE = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    minWidth: 0,
    flexShrink: 1,
};

const GLANCE_LABEL_STYLE = {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.1,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    lineHeight: 1,
    marginBottom: 3,
};

const GLANCE_VALUE_STYLE = {
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
};

const STAT_DIVIDER_STYLE = {
    width: 1,
    height: 20,
    background: 'rgba(255,245,220,0.14)',
    flexShrink: 0,
};

const RESERVE_ROW_STYLE = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderTop: '1px solid rgba(255,245,220,0.12)',
};

// ─── Zone 3: Thumb Tray ──────────────────────────────────────────────────────

const THUMB_TRAY_STYLE = {
    position: 'absolute',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
    left: 0, right: 0,
    padding: '0 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
    pointerEvents: 'none',
};

const LEFT_CLUSTER_STYLE = {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    gap: 10,
    pointerEvents: 'auto',
};

const RIGHT_CLUSTER_STYLE = {
    pointerEvents: 'auto',
};

// Action keys share one size ramp with the d-pad (both live in the injected
// stylesheet as --action / --cell) so the tray reads as a single piece of
// hardware instead of four unrelated buttons.
const JUMP_BTN_BASE = {
    borderRadius: 18,
    padding: '0 clamp(14px, 4.5vw, 24px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontWeight: 800,
    letterSpacing: 1.2,
    color: TEXT,
    boxShadow: SHADOW,
};

const BOOST_BTN_BASE = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    color: TEXT,
    boxShadow: SHADOW,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const BOOST_FILL_STYLE = {
    position: 'absolute',
    left: 0, bottom: 0, width: '100%',
    pointerEvents: 'none',
};

// D-pad — four keys seated in one plate, so the cross reads as a control
// surface rather than four disconnected tiles floating over the scene.
const DPAD_STYLE = {
    position: 'relative',
    display: 'grid',
    gap: 2,
    padding: 6,
    borderRadius: 26,
    background: HUD_SURFACE,
    backdropFilter: HUD_BLUR,
    WebkitBackdropFilter: HUD_BLUR,
    border: `1px solid ${BORDER}`,
    boxShadow: `${SHADOW}, inset 0 1px 0 rgba(255,253,242,0.10)`,
};

const DPAD_DIRS = [
    ['up', 1, 0, 'Turn up'],
    ['left', 0, 1, 'Turn left'],
    ['right', 2, 1, 'Turn right'],
    ['down', 1, 2, 'Turn down'],
];

// Centre hub — a dead key that gives the cross its middle and carries the
// player's worm colour, tying the pad to the thing it drives.
const DPAD_HUB_STYLE = {
    gridColumn: 2,
    gridRow: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
};

// ─── Pause Menu ──────────────────────────────────────────────────────────────

// Pause lives in the status bar, not the thumb tray: it is a rare, deliberate
// action and it was the odd third button sitting between the movement keys.
const PAUSE_BTN_STYLE = {
    width: 34,
    height: 34,
    borderRadius: 11,
    background: HUD_SURFACE_SOFT,
    border: '1px solid rgba(255,245,220,0.16)',
    color: TEXT,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    pointerEvents: 'auto',
};


// ─── Portal hint, Examine, Countdown ─────────────────────────────────────────

// ─── Active buff strip (rocket / magnet) ─────────────────────────────────────
// Sits just under the status bar so it never collides with the thumb tray or the
// portal hint. Only rendered while something is actually active.
// The status bar is now a single two-row object roughly 84px tall (chips row +
// orb reserve row), so the pills clear it at 92px and the spawn notice stacks
// below them. Measured against the real layout, not guessed — an earlier version
// of this offset put the pills straight on top of the orb tracker.
const BUFF_STRIP_TOP = 92;
const SPECIAL_NOTICE_TOP = BUFF_STRIP_TOP + 36;

const BUFF_STRIP_STYLE = {
    position: 'absolute',
    top: `calc(env(safe-area-inset-top, 0px) + ${BUFF_STRIP_TOP}px)`,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 6,
    pointerEvents: 'none',
};

const BUFF_PILL_STYLE = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.0,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: SHADOW,
};

const BUFF_FILL_STYLE = {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    pointerEvents: 'none',
};

// Spawn/expiry notice — sits just under the buff strip, above the play area and
// clear of the thumb tray and the mobile safe-area insets.
const SPECIAL_NOTICE_STYLE = {
    position: 'absolute',
    top: `calc(env(safe-area-inset-top, 0px) + ${SPECIAL_NOTICE_TOP}px)`,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 999,
    background: 'rgba(15, 23, 42, 0.78)',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.0,
    boxShadow: SHADOW,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
};

// Anchored above the JUMP key it is telling the player to press, inside the left
// cluster. Centred on the screen it ran straight under the d-pad.
const PORTAL_HINT_STYLE = {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: 8,
    pointerEvents: 'none',
    fontSize: 11, letterSpacing: 1.2, fontWeight: 800,
    background: HUD_SURFACE,
    backdropFilter: HUD_BLUR,
    WebkitBackdropFilter: HUD_BLUR,
    border: `1px solid ${BORDER}`,
    boxShadow: SHADOW,
    borderRadius: 999,
    padding: '7px 14px',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
};

const EXAMINE_MINIMIZED_OUTER_STYLE = {
    position: 'absolute', inset: 0,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 60,
    zIndex: 10,
};

const EXAMINE_BAR_STYLE = {
    pointerEvents: 'auto',
    display: 'flex', alignItems: 'center', gap: 10,
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

const EXAMINE_LABEL_STYLE = { fontSize: 12, fontWeight: 800, letterSpacing: 0.7, color: '#991b1b' };

const EXAMINE_RESTORE_BTN_STYLE = {
    fontSize: 11, fontWeight: 700, color: '#1e293b',
    background: 'rgba(255,255,255,0.85)',
    border: `1px solid ${PANEL_BORDER}`,
    borderRadius: 8,
    padding: '4px 10px',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
};

const COUNTDOWN_OVERLAY_STYLE = {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', zIndex: 20,
};


// ─── Winner screen styles ────────────────────────────────────────────────────

const WINNER_SCREEN_STYLE = {
    position: 'fixed', inset: 0, zIndex: 200,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(ellipse at 50% 30%, #1a0a3d 0%, #08051a 60%, #000 100%)',
    pointerEvents: 'auto', overflow: 'hidden', fontFamily: FONT,
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
    fontFamily: DISPLAY_FONT,
    fontSize: 'clamp(52px, 11vw, 96px)', fontWeight: 900, letterSpacing: '-2px',
    color: '#ffdd00',
    textShadow: '-4px -4px 0 #cc2200, 4px -4px 0 #cc2200, -4px 4px 0 #cc2200, 4px 4px 0 #cc2200, 0 0 40px rgba(255,221,0,0.5)',
    userSelect: 'none', marginBottom: 4, lineHeight: 1, textAlign: 'center',
};

const WINNER_SUB_STYLE = {
    color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, letterSpacing: 2, marginBottom: 28, textAlign: 'center',
};

const WINNER_STATS_STYLE = {
    display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', justifyContent: 'center',
};

const WINNER_STAT_BOX_STYLE = {
    borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.10)',
    padding: '10px 16px', textAlign: 'center', minWidth: 90,
};

const WINNER_STAT_LABEL_STYLE = {
    fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,255,255,0.45)', marginBottom: 2,
};

const WINNER_STAT_VALUE_STYLE = { fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.1 };

const WINNER_PP_STYLE = {
    fontFamily: DISPLAY_FONT,
    fontSize: 'clamp(28px, 6vw, 44px)', color: '#c4b5fd', letterSpacing: '-1px',
    textShadow: '-2px -2px 0 #5b21b6, 2px -2px 0 #5b21b6, -2px 2px 0 #5b21b6, 2px 2px 0 #5b21b6',
    marginBottom: 6, textAlign: 'center',
};

const WINNER_PP_NOTE_STYLE = {
    fontSize: 11, color: 'rgba(196,181,253,0.65)', marginBottom: 22, textAlign: 'center',
};

const WINNER_BTN_ROW_STYLE = { display: 'flex', gap: 12, justifyContent: 'center' };

const WINNER_PLAY_AGAIN_STYLE = {
    minWidth: 140, borderRadius: 14, padding: '12px 20px',
    fontSize: 15, fontWeight: 800, letterSpacing: 0.6, color: '#fff',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: '2px solid rgba(139,92,246,0.6)', cursor: 'pointer',
    touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
};

const WINNER_NEW_GAME_STYLE = {
    minWidth: 120, borderRadius: 14, padding: '12px 20px',
    fontSize: 15, fontWeight: 800, letterSpacing: 0.6, color: 'rgba(255,255,255,0.8)',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
    cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
};

const PODIUM_WRAP_STYLE = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22, position: 'relative',
};

const PODIUM_WORM_ROW_STYLE = {
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 6, flexWrap: 'nowrap', maxWidth: 'min(90vw, 520px)', overflow: 'hidden',
};

const PODIUM_BASE_STYLE = {
    width: 'min(90vw, 320px)', height: 44, borderRadius: '0 0 12px 12px',
    background: 'linear-gradient(180deg, #ffd700 0%, #b8860b 60%, #8B6914 100%)',
    boxShadow: '0 8px 32px rgba(255,215,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const PODIUM_LABEL_STYLE = {
    fontFamily: DISPLAY_FONT,
    fontSize: 18, fontWeight: 900, color: '#3d2000', letterSpacing: 2,
    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
};

// ─── WinnerScreen ────────────────────────────────────────────────────────────

const MAX_WORM_DISPLAY = 28;

function WinnerScreen({ wormBodyTiles, wormSessionOrbs, parityPoints, wormTimeAlive, wormHealedCount, wormColor, formatTime, onRetry, onNewGame }) {
    const ppEarned = wormBodyTiles * 10;
    const displayCount = Math.min(wormBodyTiles, MAX_WORM_DISPLAY);
    const overflow = wormBodyTiles > MAX_WORM_DISPLAY ? wormBodyTiles - MAX_WORM_DISPLAY : 0;

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
            <div style={WINNER_STARS_STYLE} />
            <div style={WINNER_TITLE_STYLE}>WINNER WORM!</div>
            <div style={WINNER_SUB_STYLE}>CUBE SOLVED · ALL TUNNELS HEALED</div>
            <div style={PODIUM_WRAP_STYLE}>
                <div style={PODIUM_WORM_ROW_STYLE}>
                    {segments.map((seg, i) => (
                        <div key={i} style={{
                            width: seg.size, height: seg.size, borderRadius: '50%',
                            background: wormColor, opacity: seg.alpha, flexShrink: 0,
                            boxShadow: i === 0 ? `0 0 12px 4px ${wormColor}` : 'none',
                            border: i === 0 ? '2px solid rgba(255,255,255,0.5)' : 'none',
                        }} />
                    ))}
                    {overflow > 0 && (
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.6)', flexShrink: 0, marginLeft: 4 }}>+{overflow}</div>
                    )}
                    {wormBodyTiles === 0 && (
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>no orbs</div>
                    )}
                </div>
                <div style={PODIUM_BASE_STYLE}>
                    <span style={PODIUM_LABEL_STYLE}>FINAL LENGTH: {wormBodyTiles}</span>
                </div>
            </div>
            <div style={WINNER_PP_STYLE}>+{ppEarned} PARITY POINTS</div>
            <div style={WINNER_PP_NOTE_STYLE}>{wormBodyTiles} orbs x 5 PP x 2x WIN BONUS</div>
            <div style={WINNER_STATS_STYLE}>
                {[
                    ['TIME', formatTime(wormTimeAlive)],
                    ['COLLECTED', wormSessionOrbs],
                    ['HEALED', wormHealedCount],
                    ['TOTAL PPs', parityPoints],
                ].map(([label, value]) => (
                    <div key={label} style={WINNER_STAT_BOX_STYLE}>
                        <div style={WINNER_STAT_LABEL_STYLE}>{label}</div>
                        <div style={{ ...WINNER_STAT_VALUE_STYLE, ...(label === 'TOTAL PPs' ? { color: '#c4b5fd' } : {}) }}>{value}</div>
                    </div>
                ))}
            </div>
            <div style={WINNER_BTN_ROW_STYLE}>
                <button onPointerDown={onRetry} style={WINNER_PLAY_AGAIN_STYLE}>Play Again</button>
                <button onPointerDown={onNewGame} style={WINNER_NEW_GAME_STYLE}>New Game</button>
            </div>
        </div>
    );
}

// ─── Orb pickup flash ────────────────────────────────────────────────────────
// Collecting an orb had no on-screen confirmation for any character except the Glow
// Worm (which gets a 3D bloom at the orb) — the feedback was audio, haptics, a small
// camera nudge and the body growing. This adds a brief tint of the orb's colour at
// the screen edges.
//
// Deliberately a vignette rather than a full wash: it never sits over the cube, and
// it stays faint (peak ≈ 0.14–0.26 alpha) because pickups can come a second apart —
// or several at once under a magnet. prefers-reduced-motion softens it further.

const ORB_FLASH_MS = 380;

function OrbPickupFlash() {
    const flash = useGameStore(s => s.wormOrbFlash);
    const [shown, setShown] = useState(null);
    const timer = useRef(null);

    useEffect(() => {
        if (!flash?.color) return;
        setShown(flash);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setShown(null), ORB_FLASH_MS + 60);
        return () => clearTimeout(timer.current);
    }, [flash]);

    if (!shown) return null;

    // Escalates with the pickup combo, mirroring the rising pitch of the pickup sound.
    const peak = Math.min(0.14 + Math.min(shown.combo ?? 0, 6) * 0.02, 0.26);

    return (
        <>
            <style>{`
                @keyframes wormOrbFlash {
                    0%   { opacity: 0; }
                    18%  { opacity: calc(var(--orb-flash-peak) * var(--orb-flash-scale, 1)); }
                    100% { opacity: 0; }
                }
                .worm-orb-flash {
                    animation: wormOrbFlash var(--orb-flash-dur, ${ORB_FLASH_MS}ms) ease-out forwards;
                }
                @media (prefers-reduced-motion: reduce) {
                    .worm-orb-flash { --orb-flash-scale: 0.45; --orb-flash-dur: 520ms; }
                }
            `}</style>
            <div
                key={shown.seq}
                className="worm-orb-flash"
                style={{
                    position: 'fixed', inset: 0,
                    pointerEvents: 'none',
                    opacity: 0,
                    background: `radial-gradient(ellipse at center, transparent 38%, ${shown.color} 135%)`,
                    '--orb-flash-peak': peak,
                }}
            />
        </>
    );
}

// ─── Special icons ───────────────────────────────────────────────────────────
// The same silhouettes the 3D orbs use, drawn from the shared definitions. Emoji
// were the first cut and are wrong for a HUD: they render differently on every
// platform, can't take the item's colour, and carry no accessible name.

function SpecialIcon({ type, size = 14 }) {
    const def = getSpecialDef(type);
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: 'block', flexShrink: 0 }}>
            <path d={def.iconPath} fill="currentColor" />
            {def.iconAccent && <path d={def.iconAccent} fill={def.accent} />}
        </svg>
    );
}

// ─── Active buff strip ───────────────────────────────────────────────────────
// Mount/unmount is driven by store transitions; the countdown itself is read from
// the wormBuffs bridge, which the crawler tick mirrors from the authoritative sim
// clocks. One rAF loop writes the fill width and seconds text straight to the DOM,
// so an active buff costs zero React renders per frame — and because the bridge only
// advances when the sim does, the readout freezes during a pause or a tunnel transit
// instead of draining against a wall clock.

function BuffStrip() {
    const rocketActive = useGameStore(s => s.wormRocketActive ?? false);
    const magnetActive = useGameStore(s => s.wormMagnetActive ?? false);
    const magnetSeq = useGameStore(s => s.wormMagnetSeq ?? 0);
    const elementalTheme = useGameStore(s => s.wormElementalTheme ?? null);
    const fillRef = useRef(null);
    const secondsRef = useRef(null);
    const elemFillRef = useRef(null);
    const elemSecondsRef = useRef(null);

    useEffect(() => {
        if (!magnetActive) return;
        let raf = 0;
        const paint = () => {
            const { magnetT, magnetMaxT } = wormBuffs;
            const pct = magnetMaxT > 0 ? Math.max(0, Math.min(1, magnetT / magnetMaxT)) * 100 : 0;
            if (fillRef.current) fillRef.current.style.width = `${pct}%`;
            if (secondsRef.current) secondsRef.current.textContent = `${Math.max(0, magnetT).toFixed(1)}s`;
            raf = requestAnimationFrame(paint);
        };
        paint();
        return () => cancelAnimationFrame(raf);
        // magnetSeq re-runs the loop on a refresh so the fill rescales to the new max.
    }, [magnetActive, magnetSeq]);

    // Same rAF-to-DOM pattern as the magnet fill, reading the elemental clock the
    // sim mirrors onto the wormBuffs bridge so it freezes with the simulation.
    useEffect(() => {
        if (!elementalTheme) return;
        let raf = 0;
        const paint = () => {
            const { elementalT, elementalMaxT } = wormBuffs;
            const pct = elementalMaxT > 0 ? Math.max(0, Math.min(1, elementalT / elementalMaxT)) * 100 : 0;
            if (elemFillRef.current) elemFillRef.current.style.width = `${pct}%`;
            if (elemSecondsRef.current) elemSecondsRef.current.textContent = `${Math.max(0, elementalT).toFixed(0)}s`;
            raf = requestAnimationFrame(paint);
        };
        paint();
        return () => cancelAnimationFrame(raf);
    }, [elementalTheme]);

    if (!rocketActive && !magnetActive && !elementalTheme) return null;

    const rocketDef = getSpecialDef('rocket');
    const magnetDef = getSpecialDef('magnet');
    const elemDef = elementalTheme ? getElementalDef(elementalTheme) : null;

    return (
        <div style={BUFF_STRIP_STYLE} role="status" aria-live="polite">
            {rocketActive && (
                <div
                    style={{
                        ...BUFF_PILL_STYLE,
                        background: 'linear-gradient(135deg, #ff9d2e, #f4501e)',
                        border: `1px solid ${rocketDef.accent}`,
                        color: '#fff',
                    }}
                    aria-label="Rocket active"
                >
                    <SpecialIcon type="rocket" />
                    <span>{rocketDef.label}</span>
                </div>
            )}
            {magnetActive && (
                <div
                    style={{
                        ...BUFF_PILL_STYLE,
                        background: 'rgba(15, 23, 42, 0.78)',
                        border: `1px solid ${magnetDef.color}`,
                        color: '#fff',
                    }}
                    aria-label="Magnet active"
                >
                    <div ref={fillRef} style={{ ...BUFF_FILL_STYLE, width: '100%', background: 'rgba(56, 224, 255, 0.38)' }} />
                    <span style={{ position: 'relative', zIndex: 1, display: 'flex', color: magnetDef.color }}>
                        <SpecialIcon type="magnet" />
                    </span>
                    <span style={{ position: 'relative', zIndex: 1 }}>{magnetDef.label}</span>
                    <span ref={secondsRef} style={{ position: 'relative', zIndex: 1, opacity: 0.85, minWidth: 30, textAlign: 'right' }} />
                </div>
            )}
            {elemDef && (
                <div
                    style={{
                        ...BUFF_PILL_STYLE,
                        position: 'relative',
                        overflow: 'hidden',
                        background: 'rgba(15, 23, 42, 0.78)',
                        border: `1px solid ${elemDef.color}`,
                        color: '#fff',
                    }}
                    aria-label={`${elemDef.label} element active`}
                >
                    <div ref={elemFillRef} style={{ ...BUFF_FILL_STYLE, width: '100%', background: `${elemDef.color}40` }} />
                    <span style={{ position: 'relative', zIndex: 1, display: 'flex', color: elemDef.color }}>
                        <SpecialIcon type={elementalTheme} />
                    </span>
                    <span style={{ position: 'relative', zIndex: 1 }}>{elemDef.label}</span>
                    <span ref={elemSecondsRef} style={{ position: 'relative', zIndex: 1, opacity: 0.85, minWidth: 24, textAlign: 'right' }} />
                </div>
            )}
        </div>
    );
}

// ─── Special spawn / expiry notice ───────────────────────────────────────────
// A special can appear on a face the camera is not pointed at. This is the cue that
// something is out there worth turning for — and, when it lapses, that it is gone.

const NOTICE_MS = 2200;

function SpecialNotice() {
    const notice = useGameStore(s => s.wormSpecialNotice);
    const [shown, setShown] = useState(null);
    const timer = useRef(null);

    useEffect(() => {
        if (!notice) { setShown(null); return; }
        setShown(notice);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setShown(null), NOTICE_MS);
        return () => clearTimeout(timer.current);
    }, [notice]);

    if (!shown) return null;
    const def = getSpecialDef(shown.type);
    const expired = shown.kind === 'expire';

    return (
        <div
            key={shown.seq}
            style={{
                ...SPECIAL_NOTICE_STYLE,
                color: expired ? 'rgba(255,255,255,0.72)' : def.color,
                border: `1px solid ${expired ? 'rgba(255,255,255,0.22)' : def.color}`,
                opacity: expired ? 0.75 : 1,
            }}
            role="status"
            aria-live="polite"
        >
            <SpecialIcon type={shown.type} size={13} />
            <span>{expired ? `${def.label} GONE` : `${def.label} NEARBY`}</span>
        </div>
    );
}

// ─── Boost button ────────────────────────────────────────────────────────────

function BoostButton({ wormAlive, fc }) {
    const boostState = useGameStore(s => s.wormBoostState ?? 'ready');
    const [fillPct, setFillPct] = useState(100);

    useEffect(() => {
        if (boostState !== 'cooldown') {
            setFillPct(boostState === 'ready' ? 100 : 0);
            return;
        }
        setFillPct(0);
        const start = Date.now();
        const id = setInterval(() => {
            const p = Math.min(1, (Date.now() - start) / (BOOST_COOLDOWN * 1000));
            setFillPct(p * 100);
            if (p >= 1) clearInterval(id);
        }, 60);
        return () => clearInterval(id);
    }, [boostState]);

    const handleBoost = () => {
        if (!wormAlive || boostState !== 'ready') return;
        callWormTurn('boost');
    };

    const yellow = fc[6] || FACE_FALLBACKS[6];
    const white = fc[3] || FACE_FALLBACKS[3];

    const readyStyle = {
        ...BOOST_BTN_BASE,
        background: `linear-gradient(160deg, ${yellow}, ${fc[4] || FACE_FALLBACKS[4]})`,
        border: `1px solid ${withAlpha(yellow, 0.85)}`,
        color: '#2a1c05',
        boxShadow: `${SHADOW}, 0 0 16px ${withAlpha(yellow, 0.55)}`,
    };

    const activeStyle = {
        ...BOOST_BTN_BASE,
        background: `linear-gradient(160deg, ${white}, ${yellow})`,
        border: `1px solid ${withAlpha(white, 0.9)}`,
        color: '#2a1c05',
        boxShadow: `${SHADOW}, 0 0 22px ${withAlpha(white, 0.7)}, 0 0 44px ${withAlpha(yellow, 0.5)}`,
    };

    // Cooldown keeps the dark-glass shell of the tray and refills with the boost
    // colour, so the button reads as "recharging" instead of "broken".
    const cooldownStyle = {
        ...BOOST_BTN_BASE,
        background: HUD_SURFACE,
        backdropFilter: HUD_BLUR,
        WebkitBackdropFilter: HUD_BLUR,
        border: `1px solid ${BORDER}`,
        cursor: 'default',
        color: withAlpha(yellow, 0.45),
    };

    const style = boostState === 'active' ? activeStyle
        : boostState === 'cooldown' ? cooldownStyle
        : readyStyle;

    return (
        <button
            onPointerDown={handleBoost}
            onTouchStart={e => { e.preventDefault(); handleBoost(); }}
            className={`worm-action worm-boost${boostState === 'cooldown' ? '' : ' worm-hud-key'}`}
            style={style}
            aria-label="Boost"
            aria-disabled={boostState === 'cooldown'}
        >
            {boostState === 'cooldown' && (
                <div style={{ ...BOOST_FILL_STYLE, height: `${fillPct}%`, background: withAlpha(yellow, 0.42) }} />
            )}
            <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}><BoltIcon size={26} /></span>
        </button>
    );
}

// ─── Pause Menu Overlay ──────────────────────────────────────────────────────

function PauseMenu({ onResume, onHome, onSettings, onToggleAntipodal, antipodalActive, wormControlMode, toggleWormControlMode, wormSpeed, setWormSpeed, wormAlive, wormHealedCount, wormSessionOrbs, wormTimeAlive, wormGamePhase, formatTime, fc }) {
    const green = fc[2] || FACE_FALLBACKS[2];
    const blue = fc[5] || FACE_FALLBACKS[5];
    const sfxOn = useGameStore(s => s.settings?.sfx ?? true);
    const hapticsOn = useGameStore(s => s.settings?.haptics ?? true);
    const setSettings = useGameStore(s => s.setSettings);
    // Read from the wormClock bridge (not the store) on purpose: the countdown changes
    // every frame while crawling but the crawler tick is frozen while paused, so a
    // mount-time snapshot is exact for as long as this menu is visible. Keeping it out
    // of the store removes a 10 Hz set() whose only effect was selector churn app-wide.
    const wormholeCountdown = wormClock.countdown;

    return (
        // Not fixed: the pause menu lives inside the HUD's stacking context and must
        // not escape it, so the scrim is absolute against that instead of the viewport.
        <div style={overlayScrimStyle({ tint: green, fixed: false, zIndex: 10 })} onPointerDown={onResume}>
            <div style={overlayCardStyle(green, { width: 380 })} onPointerDown={e => e.stopPropagation()}>
                <Eyebrow accent={green}>Paused</Eyebrow>
                <OverlayTitle size="clamp(26px, min(9vw, 8vh), 44px)" outline="#14310f" glow={`${green}55`}>
                    WORM MODE
                </OverlayTitle>

                <StatTiles columns={2} stats={[
                    ['Time', formatTime(wormTimeAlive)],
                    ['Healed', wormHealedCount],
                    ['Collected', wormSessionOrbs],
                    ['Next hole', wormGamePhase === 'finalHealing' ? 'FINAL' : `${wormholeCountdown.toFixed(1)}s`],
                ]} />

                {/* Named speed presets — keep the underlying multipliers out of the UI. */}
                <div style={{ ...SETTING_ROW_STYLE, marginTop: 'clamp(10px, 2vh, 16px)' }}>
                    <span style={SETTING_LABEL_STYLE}>Speed</span>
                    <div style={{ display: 'flex', gap: 5, flex: 1 }}>
                        {WORM_SPEED_OPTIONS.map(option => (
                            <button
                                key={option.label}
                                type="button"
                                disabled={!wormAlive}
                                onPointerDown={() => wormAlive && setWormSpeed(option.value)}
                                style={segmentStyle(wormSpeed === option.value, blue, wormAlive)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Control mode toggle */}
                <div style={SETTING_ROW_STYLE}>
                    <span style={SETTING_LABEL_STYLE}>Controls</span>
                    <button
                        onPointerDown={() => toggleWormControlMode()}
                        style={togglePillStyle(wormControlMode === 'oriented', blue)}
                    >
                        {wormControlMode === 'oriented' ? 'ORIENTED' : 'NON-ORIENTED'}
                    </button>
                </div>

                <div style={SETTING_ROW_STYLE}>
                    <span style={SETTING_LABEL_STYLE}>Feel</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            onPointerDown={() => setSettings?.(s => ({ ...s, sfx: !(s.sfx ?? true) }))}
                            style={togglePillStyle(sfxOn, green)}
                        >
                            {sfxOn ? 'SFX ON' : 'SFX OFF'}
                        </button>
                        <button
                            onPointerDown={() => setSettings?.(s => ({ ...s, haptics: !(s.haptics ?? true) }))}
                            style={togglePillStyle(hapticsOn, green)}
                        >
                            {hapticsOn ? 'HAPTICS ON' : 'HAPTICS OFF'}
                        </button>
                    </div>
                </div>

                {/* Secondary navigation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'clamp(10px, 2vh, 14px)' }}>
                    {onToggleAntipodal && (
                        <button
                            onPointerDown={onToggleAntipodal}
                            style={{
                                ...LIST_BTN_STYLE,
                                ...(antipodalActive ? { background: `${blue}26`, borderColor: `${blue}66`, color: '#fff' } : {}),
                            }}
                        >
                            <span aria-hidden="true">⊕</span>
                            <span>Antipodal Camera {antipodalActive ? '(On)' : '(Off)'}</span>
                        </button>
                    )}
                    {onSettings && (
                        <button onPointerDown={onSettings} style={LIST_BTN_STYLE}>
                            <span aria-hidden="true">⚙</span>
                            <span>Settings</span>
                        </button>
                    )}
                    {onHome && (
                        <button onPointerDown={onHome} style={LIST_BTN_STYLE}>
                            <span aria-hidden="true">⌂</span>
                            <span>Main Menu</span>
                        </button>
                    )}
                </div>

                {/* Resume is the only primary — the reason the player opened this. */}
                <div style={ACTION_ROW_STYLE}>
                    <button onPointerDown={onResume} style={primaryBtnStyle(green, blue)}>RESUME</button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WormCrawlerHUD({ phase, onFlippedTile, cubeSize: _cubeSize = 3, onHome, onSettings, onToggleAntipodal, antipodalActive = false, wormAlive = true, showDeathMenu = false, deathDetails = null, onRetry, onNewGame }) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    ensureHudStyle();

    useEffect(() => {
        if (showDeathMenu) setIsMinimized(false);
    }, [showDeathMenu]);

    const { wormSpeed, wormHealedCount, wormBodyTiles, wormControlMode, wormTimeAlive, wormTunnelCount, wormColor, wormOrbInventory, settings, setWormSpeed, toggleWormControlMode, setWormPaused, wormGamePhase, wormCountdownStep, wormSessionOrbs, parityPoints } = useGameStore(
        useShallow(s => ({
            wormSpeed: s.wormSpeed ?? WORM_SPEED_OPTIONS[0].value,
            wormHealedCount: s.wormHealedCount ?? 0,
            wormBodyTiles: s.wormBodyTiles ?? 0,
            // NOTE: the wormhole countdown lives in the wormClock bridge (not the store) —
            // it changes every frame and is only shown inside PauseMenu, which snapshots it.
            wormControlMode: s.wormControlMode ?? 'non-oriented',
            wormTimeAlive: s.wormTimeAlive ?? 0,
            wormTunnelCount: s.wormTunnelCount ?? 0,
            wormColor: s.wormColor ?? '#33ff66',
            wormOrbInventory: s.wormOrbInventory ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
            settings: s.settings,
            setWormSpeed: s.setWormSpeed,
            toggleWormControlMode: s.toggleWormControlMode,
            setWormPaused: s.setWormPaused,
            wormGamePhase: s.wormGamePhase ?? 'active',
            wormCountdownStep: s.wormCountdownStep ?? null,
            wormSessionOrbs: s.wormSessionOrbs ?? 0,
            parityPoints: s.parityPoints ?? 0,
        }))
    );

    const fc = useMemo(() => {
        const safeSettings = settings && typeof settings === 'object'
            ? settings
            : { colorScheme: 'standard', customColors: {} };
        return resolveColors(safeSettings, safeSettings?.biomeMode?.faceAssignment) || FACE_FALLBACKS;
    }, [settings]);

    const jumpEdgeColor = useMemo(() => {
        const wormRgb = toRgb(wormColor);
        let nearestFaceId = 2;
        let nearestDistance = Number.POSITIVE_INFINITY;
        [1, 2, 3, 4, 5, 6].forEach(faceId => {
            const faceRgb = toRgb(fc[faceId]);
            const dist = colorDistance(wormRgb, faceRgb);
            if (dist < nearestDistance) {
                nearestDistance = dist;
                nearestFaceId = faceId;
            }
        });
        const antipodalFace = ANTIPODAL_COLOR[nearestFaceId] ?? 5;
        const antipodalColor = fc[antipodalFace];
        return toRgb(antipodalColor) ? antipodalColor : '#8b5cf6';
    }, [fc, wormColor]);

    const formatTime = useCallback((secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }, []);

    const handleJumpAction = useCallback(() => {
        if (!wormAlive) return;
        callWormTurn('jump');
    }, [wormAlive]);

    // The pause menu must freeze the live simulation, not just overlay it. wormPaused is the
    // flag the crawler tick and rotation hazard check, but it's also owned by the game-phase
    // machine during scramble/countdown/solved — so only drive it here during actual gameplay,
    // otherwise resuming could release the worm mid-countdown.
    const canPause = wormAlive && (wormGamePhase === 'active' || wormGamePhase === 'finalHealing');
    const handlePause = useCallback(() => {
        if (!canPause) return;
        setIsPaused(true);
        setWormPaused(true);
    }, [canPause, setWormPaused]);
    const handleResume = useCallback(() => {
        setIsPaused(false);
        setWormPaused(false);
    }, [setWormPaused]);

    const phaseMeta = PHASE_META[phase] || { label: phase || 'CRAWLING', faceId: 2 };
    const phaseColor = fc[phaseMeta.faceId] || FACE_FALLBACKS[phaseMeta.faceId];
    const isPortalReady = wormAlive && onFlippedTile && phase === 'crawling';

    const orbTotal = useMemo(() =>
        [1, 2, 3, 4, 5, 6].reduce((sum, id) => sum + (wormOrbInventory[id] ?? 0), 0),
        [wormOrbInventory]
    );

    // Antipodal-paired colors for action buttons
    const red = fc[1] || FACE_FALLBACKS[1];
    const orange = fc[4] || FACE_FALLBACKS[4];
    const blue = fc[5] || FACE_FALLBACKS[5];
    const green = fc[2] || FACE_FALLBACKS[2];

    // Jump button — Red→Orange antipodal gradient once a wormhole is under the
    // worm; otherwise it sits in the tray's own dark glass so the lit state is
    // unmistakable at a glance.
    const jumpReadyStyle = {
        ...JUMP_BTN_BASE,
        background: `linear-gradient(150deg, ${red}, ${orange})`,
        border: `1px solid ${withAlpha(jumpEdgeColor, 0.9)}`,
        color: '#fff8ec',
        textShadow: '0 1px 3px rgba(0,0,0,0.35)',
        '--jump-glow': withAlpha(jumpEdgeColor, 0.75),
    };

    const jumpIdleStyle = {
        ...JUMP_BTN_BASE,
        background: HUD_SURFACE,
        backdropFilter: HUD_BLUR,
        WebkitBackdropFilter: HUD_BLUR,
        border: `1px solid ${BORDER}`,
        color: TEXT,
    };

    // 6-color gradient for the status bar's accent hairline
    const gradientBorder = `linear-gradient(90deg, ${fc[1] || FACE_FALLBACKS[1]}, ${fc[2] || FACE_FALLBACKS[2]}, ${fc[3] || FACE_FALLBACKS[3]}, ${fc[4] || FACE_FALLBACKS[4]}, ${fc[5] || FACE_FALLBACKS[5]}, ${fc[6] || FACE_FALLBACKS[6]})`;

    const dpadVars = {
        '--key-press': withAlpha(blue, 0.34),
        '--key-edge': withAlpha(blue, 0.75),
        '--key-glow': withAlpha(blue, 0.5),
    };

    return (
        <div style={ROOT_STYLE}>

            {/* ── Orb pickup confirmation (behind every panel — first child) ── */}
            {wormAlive && <OrbPickupFlash />}

            {/* ── Zone 1: Status bar — glance info + pause, one object ── */}
            <div className="worm-hud-bar" style={HUD_BAR_STYLE}>
                {/* Face-palette hairline along the top edge */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: gradientBorder, opacity: 0.9, pointerEvents: 'none' }} />

                <div className="worm-hud-row" style={HUD_ROW_STYLE}>
                    {/* Phase label */}
                    <div className="worm-hud-phase" style={{
                        ...GLANCE_CHIP_STYLE,
                        background: withAlpha(phaseColor, 0.16),
                        border: `1px solid ${withAlpha(phaseColor, 0.4)}`,
                        color: phaseColor,
                    }}>
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: phaseColor,
                            boxShadow: `0 0 6px ${phaseColor}`,
                        }} />
                        {phaseMeta.label}
                    </div>

                    {/* Stat group — length, orbs, PP, pause */}
                    <div className="worm-hud-stats" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={GLANCE_LABEL_STYLE}>Worm</span>
                            <span style={{ ...GLANCE_VALUE_STYLE, color: green }}>{wormBodyTiles}</span>
                        </div>

                        <div style={STAT_DIVIDER_STYLE} />

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={GLANCE_LABEL_STYLE}>Orbs</span>
                            <span style={{ ...GLANCE_VALUE_STYLE, color: blue }}>{orbTotal}</span>
                        </div>

                        <div style={STAT_DIVIDER_STYLE} />

                        <ParityWallet dark />

                        <button
                            onPointerDown={handlePause}
                            className="worm-hud-key"
                            style={PAUSE_BTN_STYLE}
                            aria-label="Pause"
                        >
                            <PauseIcon />
                        </button>
                    </div>
                </div>

                {/* Reserve row — the coins that used to float in a second panel */}
                {wormAlive && (
                    <div className="worm-hud-reserve" style={RESERVE_ROW_STYLE}>
                        <OrbInventoryHUD orbInventory={wormOrbInventory} faceColors={fc} mobile={isMobile} />
                    </div>
                )}
            </div>

            {/* ── Active buff pills (rocket / magnet) ── */}
            {wormAlive && <BuffStrip />}

            {/* ── Special spawned / expired notice ── */}
            {wormAlive && <SpecialNotice />}

            {/* ── Zone 3: Thumb Tray ── */}
            <div style={THUMB_TRAY_STYLE}>
                {/* Left cluster: Jump + Boost, with the contextual portal hint above them */}
                <div style={LEFT_CLUSTER_STYLE}>
                    {isPortalReady && (
                        <div style={{ ...PORTAL_HINT_STYLE, color: phaseColor }}>
                            <JumpIcon size={13} />
                            WORMHOLE BELOW
                        </div>
                    )}
                    <button
                        onPointerDown={handleJumpAction}
                        onTouchStart={e => { e.preventDefault(); handleJumpAction(); }}
                        className={`worm-hud-key worm-action worm-jump${isPortalReady ? ' worm-jump-ready' : ''}`}
                        style={isPortalReady ? jumpReadyStyle : jumpIdleStyle}
                        aria-label="Jump"
                    >
                        <JumpIcon size={19} />
                        JUMP
                    </button>
                    <BoostButton wormAlive={wormAlive} fc={fc} />
                </div>

                {/* Right cluster: D-pad */}
                <div style={RIGHT_CLUSTER_STYLE}>
                    <div className="worm-dpad" style={{ ...DPAD_STYLE, ...dpadVars }} role="group" aria-label="Steering">
                        {DPAD_DIRS.map(([dir, col, row, label]) => (
                            <button
                                key={dir}
                                onPointerDown={() => wormAlive && callWormTurn(dir)}
                                className="worm-hud-key worm-dpad-key"
                                style={{ gridColumn: col + 1, gridRow: row + 1, color: TEXT }}
                                aria-label={label}
                            >
                                <Chevron dir={dir} size={'clamp(20px, 5.5vw, 24px)'} />
                            </button>
                        ))}
                        <div style={DPAD_HUB_STYLE}>
                            <div style={{
                                width: 12, height: 12, borderRadius: '50%',
                                background: wormColor,
                                opacity: wormAlive ? 0.9 : 0.35,
                                boxShadow: `0 0 10px ${withAlpha(wormColor, 0.7)}`,
                            }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Pause Menu Overlay ── */}
            {isPaused && (
                <PauseMenu
                    onResume={handleResume}
                    onHome={onHome}
                    onSettings={onSettings}
                    onToggleAntipodal={onToggleAntipodal}
                    antipodalActive={antipodalActive}
                    wormControlMode={wormControlMode}
                    toggleWormControlMode={toggleWormControlMode}
                    wormSpeed={wormSpeed}
                    setWormSpeed={setWormSpeed}
                    wormAlive={wormAlive}
                    wormHealedCount={wormHealedCount}
                    wormSessionOrbs={wormSessionOrbs}
                    wormTimeAlive={wormTimeAlive}
                    wormGamePhase={wormGamePhase}
                    formatTime={formatTime}
                    fc={fc}
                />
            )}

            {/* ── Examine mode minimized bar ── */}
            {showDeathMenu && isMinimized && (
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

            {/* ── Countdown overlay ── */}
            {wormGamePhase === 'countdown' && wormCountdownStep !== null && (
                <WormCountdownOverlay step={wormCountdownStep} />
            )}

            {/* ── Winner screen ── */}
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

            {/* ── Death screen ── */}
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
