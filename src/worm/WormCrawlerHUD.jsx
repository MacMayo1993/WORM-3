import { EXPLODE_DURATION } from './wormExpansion.js';
import { ScreenHeading } from '../components/ui/ModeArtwork.jsx';
import { storyLevel, storyChapterId, storyChapterIndex, STORY_CHAPTER_SIZE } from './story/levels.js';
import { StoryObjectiveCard, StoryStartButton, StoryResult } from './story/StoryCards.jsx';
import { AmbientCombatActions, CombatCard, CombatFireButton } from './combat/CombatControls.jsx';
import { combatBridge } from './combat/portalCombat.js';
import WormDemoLessonCard from '../components/screens/WormDemoLessonCard.jsx';
import { wormDemoLesson } from '../game/wormDemoLessons.js';
import './wormHudLayout.css';
import RotationCountdownHUD from './RotationCountdownHUD.jsx';
import TunnelNeedsCard from './TunnelNeedsCard.jsx';
import SignatureButton from './SignatureButton.jsx';
import { SIGNATURES } from './healerWorm/signatures.js';
import JumpRescueCue from './JumpRescueCue.jsx';
import { XpRunSummary } from '../progression/ProgressWidgets.jsx';
import WormMissionCard, { WormReplayLabel } from './WormMissionCard.jsx';
import { elementalFeedback } from './healerWorm/elementalFeedback.js';
// src/worm/WormCrawlerHUD.jsx
// Mobile-first "Antipodal HUD" for WORM Chase-Cam Mode.
// Three-zone layout: Glance Strip (top, info-only) · Game Scene · Thumb Tray (bottom, all controls).
// Neutral instruments keep face colours on the cube and inventory samples.

import React, { useMemo, useState, useLayoutEffect, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { resolveColors } from '../utils/colorSchemes.js';
import { FACE_COLORS } from '../utils/constants.js';
import OrbInventoryHUD from './OrbInventoryHUD.jsx';
import ParityWallet from '../components/overlays/ParityWallet.jsx';
import { callWormTurn } from './wormTurnBridge.js';
import { wormBuffs } from './wormBuffs.js';
import { getSpecialDef } from './healerWorm/specialDefs.js';
import { getElementalDef } from './healerWorm/elementalDefs.js';
import { wormClock } from './wormClock.js';
import { feel, resumeFeel } from '../utils/feel.js';
import { BOOST_COOLDOWN, WORM_SPEED_OPTIONS } from './healerWorm/constants.js';
import { isMobile } from '../utils/device.js';
import DeathScreen from './DeathScreens.jsx';
import {
    overlayScrimStyle, overlayCardStyle, OVERLAY_CARD_CLASS, StatTiles,
    SETTING_ROW_STYLE, SETTING_LABEL_STYLE, togglePillStyle, segmentStyle,
    primaryBtnStyle, SECONDARY_BTN_STYLE, LIST_BTN_STYLE, ACTION_ROW_STYLE,
} from './wormOverlayUI.jsx';
import ModeArtwork from '../components/ui/ModeArtwork.jsx';
import { arcadeModeVars } from '../utils/arcadeTheme.js';
import { useDialogBehavior } from '../components/ui/Panel.jsx';
import { UI_FONT, DISPLAY_FONT, HEADING_FONT, UI_MOSS_LIGHT, UI_GOLD, NIGHT_SHEET, NIGHT_TEXT_MUTED, GAME_HUD, GAME_HUD_VARS, Z,
    ARCADE_INK, ARCADE_INK_STRONG, ARCADE_MUTED, ARCADE_LINE_SOFT } from '../utils/uiTheme.js';

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

// The standard scheme, straight from constants.js — this was a verbatim
// copy of FACE_COLORS and would have silently disagreed if that ever moved.
const FACE_FALLBACKS = FACE_COLORS;

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

// ─── Style constants ─────────────────────────────────────────────────────────
//
// The HUD sits on top of a live 3D scene that can be any colour — grass, lava,
// a white cube face — so it takes the shared NIGHT family (warm dark glass,
// cream type) rather than the light paper sheets used by modals. White panels
// were readable over the cube but disappeared over bright biomes and read as
// stickers pasted on the game rather than part of it.

const FONT = UI_FONT;
const SHADOW = `0 4px 0 ${GAME_HUD.border}, 0 8px 18px rgba(38,55,45,0.14)`;
const BORDER = GAME_HUD.border;
const HUD_SURFACE = GAME_HUD.surface;
const HUD_SURFACE_SOFT = GAME_HUD.raised;
const HUD_BLUR = 'blur(14px) saturate(1.05)';
const TEXT = GAME_HUD.text;
const TEXT_MUTED = GAME_HUD.muted;
const HUD_ACCENT = GAME_HUD.accent;

// Paper token, still used by the pause card / overlays that own the screen.
const PANEL_BORDER = 'rgba(15, 23, 42, 0.12)';

const withAlpha = (color, alpha) => {
    const rgb = toRgb(color);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : color;
};

const ROOT_STYLE = {
    ...GAME_HUD_VARS,
    position: 'fixed', inset: 0,
    pointerEvents: 'none', zIndex: Z.PANEL,
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
        /* Compact corner keys leave the lower scene visible while keeping
           comfortable touch targets. */
        .worm-steer {
            --steer: clamp(56px, 17vw, 76px);
            width: var(--steer);
            height: clamp(76px, 12vh, 100px);
        }
        .worm-action { --action: clamp(50px, 13.5vw, 60px); height: var(--action); }
        .worm-jump { min-width: clamp(96px, 26vw, 132px); font-size: clamp(15px, 4vw, 18px); }
        .worm-boost { width: var(--action); }
        /* Landscape: height is the scarce axis, so the keys size off it instead —
           and the steering keys shrink hardest, since a landscape grip has the
           whole side of the screen to reach into. */
        @media (max-height: 520px) {
            /* Landscape keys retain a 56px minimum width. */
            .worm-steer { --steer: clamp(56px, 17vh, 76px); height: clamp(64px, 19vh, 80px); }
            .worm-action { --action: clamp(44px, 13vh, 54px); }
            .worm-jump { min-width: clamp(88px, 20vw, 124px); font-size: 15px; }
        }
        .worm-hud-key {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
            cursor: pointer;
            user-select: none;
            font-family: ${UI_FONT};
            /* Release eases back over 130ms; the press itself is cut to 40ms below.
               A key that takes as long to go down as it does to come up feels like
               a slider, not a switch. */
            transition: transform 130ms cubic-bezier(0.2, 0.8, 0.3, 1),
                        background 140ms ease, box-shadow 130ms ease, border-color 140ms ease;
        }
        .worm-hud-key:active { transform: scale(0.93); transition-duration: 40ms; }

        /* ── Tray keys travel instead of shrinking ─────────────────────────────
           A scale reads as the key getting smaller; a real key goes DOWN onto its
           base. Each tray key sits on a hard offset shadow — its side wall — and
           on press it drops onto it, the wall collapsing to almost nothing while
           the inner shading flips from a lit top edge to a shadowed one. That is
           the whole trick: the light says raised, then it says sunk. */
        .worm-steer-key, .worm-action {
            box-shadow: 0 4px 0 ${GAME_HUD.ink}, 0 8px 18px rgba(38,55,45,0.16), inset 0 2px 0 #fff;
        }
        .worm-steer-key:active, .worm-action:active {
            transform: translateY(3px);
            box-shadow: 0 1px 0 ${GAME_HUD.ink}, inset 0 2px 4px rgba(38,55,45,0.18);
        }
        /* The key's own surface has to live here, not inline: an inline background
           outranks any :active rule, which is exactly how the press state silently
           did nothing the first time round. */
        /* The key's surface lives here for the same reason: an inline background
           outranks :active, which is how the press state silently did nothing the
           first time round. */
        /* No width/height here: .worm-steer (same element) owns the size, and a
           100% would resolve against the shrink-to-fit wrapper and collapse it. */
        .worm-steer-key {
            border-radius: 16px;
            flex-direction: column;
            gap: 10px;
            /* A quiet neutral face matches the action pair. */
            background: ${GAME_HUD.surface};
            backdrop-filter: ${HUD_BLUR};
            -webkit-backdrop-filter: ${HUD_BLUR};
            border: 2px solid ${GAME_HUD.ink};
            color: ${GAME_HUD.text};
            display: flex; align-items: center; justify-content: center;
            padding: 0;
        }
        /* Sunk: the lighting inverts. The top edge falls into shadow instead of
           catching the light, which is what a key face looks like below its own
           bezel — without it the pressed key is a flat coloured slab. */
        .worm-steer-key:active {
            background:
                linear-gradient(180deg,
                    rgba(38, 55, 45, 0.16) 0%,
                    rgba(38, 55, 45, 0.04) 35%,
                    rgba(255, 253, 242, 0.05) 100%),
                var(--key-press, #efe9d6);
            border-color: var(--key-edge, ${GAME_HUD.ink});
        }
        /* The glyph rides the cap down with it and dims a touch, the way ink on a
           key face falls into its own shadow when the key bottoms out. */
        .worm-steer-key:active .worm-key-face { opacity: 0.82; }
        .worm-jump-ready {
            outline: 1px solid ${HUD_ACCENT}; outline-offset: 3px;
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
// Inventory, length and pause share one row above the slim rotation clock.
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

const GLANCE_LABEL_STYLE = {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.4,
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

// ─── Zone 3: Thumb Tray ──────────────────────────────────────────────────────

// Thumb tray: steering in the two bottom corners, actions in the middle between
// them. A phone is held at its corners, so that is where the key you press every
// few seconds belongs — the old four-key d-pad sat entirely under the right thumb
// and spent half its area on up and down, which relative steering never needed
// (up is a no-op and down is a 180 into your own neck).
//
// Bottom offset clears the Pixel's gesture bar: the safe-area inset plus a margin,
// so the keys sit above the swipe strip rather than fighting it for the same pixels.
const THUMB_TRAY_STYLE = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
    pointerEvents: 'none',
};

// The action pair rides a little above the steering keys' bottom edge: dropping
// Jump to the same line put it where the hand rests, and it was getting palmed.
const ACTION_CLUSTER_STYLE = {
    position: 'relative',
    // Takes the space between the two steering keys and centres inside it, so the
    // pair stays on the screen's midline whatever the steering keys measure.
    flex: '1 1 auto',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 6,
    pointerEvents: 'auto',
    minWidth: 0,
};

const STEER_CLUSTER_STYLE = {
    pointerEvents: 'auto',
    flexShrink: 0,
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

// Steering keys. `turnLeft`/`turnRight` rather than `left`/`right`: the tray has
// two buttons and no way to name a compass point, so it asks the sim for a quarter
// turn from the current heading — which is what relative steering already did, and
// what keeps oriented mode steerable from a two-key tray (see wormSim's
// relativeTurn). The worm's own colour rides the glyph, tying the key to the thing
// it drives, the way the old pad's centre hub did.
const STEER_KEYS = [
    ['left', 'turnLeft', 'Turn left'],
    ['right', 'turnRight', 'Turn right'],
];

/** One steering key. Both corners are the same key mirrored. */
function SteerKey({ side, wormAlive, wormColor: _wormColor, vars }) {
    const [dir, intent, label] = STEER_KEYS.find(([d]) => d === side);
    return (
        <div style={STEER_CLUSTER_STYLE}>
            <button
                onPointerDown={() => {
                    if (!wormAlive) return;
                    // The click and the tick are the other half of the key: the turn
                    // itself lands on the next tile commit, so without them the press
                    // has no acknowledgement at the moment the thumb makes it. Routed
                    // through feel() so both the SFX and haptics settings gate it.
                    feel('uiKey');
                    callWormTurn(intent);
                }}
                onClick={e => { if (e.detail === 0 && wormAlive) { feel('uiKey'); callWormTurn(intent); } }}
                disabled={!wormAlive}
                className="worm-hud-key worm-steer worm-steer-key"
                style={{ ...vars, color: TEXT }}
                aria-label={label}
            >
                <span className="worm-key-face" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Chevron dir={dir} size={'clamp(30px, 8vw, 38px)'} />
                {/* The worm's own colour on the key, the way the old pad's dead
                    centre hub carried it — it ties the control to the thing it drives.
                    Directly under the glyph, not pinned to the foot of the bar: the
                    bar is a third of the screen tall and the two would read as
                    unrelated marks at opposite ends of it. */}
                <span style={{
                    width: 18, height: 3, borderRadius: 2,
                    background: HUD_ACCENT,
                    opacity: wormAlive ? 0.85 : 0.3,
                    boxShadow: 'none',
                    pointerEvents: 'none',
                }} />
                </span>
            </button>
        </div>
    );
}

// ─── Pause Menu ──────────────────────────────────────────────────────────────

// Pause lives in the status bar, not the thumb tray: it is a rare, deliberate
// action and it was the odd third button sitting between the movement keys.
const PAUSE_BTN_STYLE = {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: HUD_SURFACE_SOFT,
    border: `2px solid ${GAME_HUD.border}`,
    boxShadow: `0 3px 0 ${GAME_HUD.border}`,
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
// The context stack owns placement for active buffs and brief pickup notices.

// Elemental chip: the active wash reads as a mini enamel medal (the same badge the
// pickup wears) with a radial countdown ring, rather than a flat pill — it is a
// scene-wide transformation, so it gets the richer treatment. Ring geometry: r=9
// in a 22×22 box, so the circumference the rAF loop animates is 2π·9.
const ELEM_RING_R = 9;
const ELEM_RING_CIRC = 2 * Math.PI * ELEM_RING_R;

// Spawn/expiry notice — sits just under the buff strip, above the play area and
// clear of the thumb tray and the mobile safe-area insets.
const SPECIAL_NOTICE_STYLE = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 12,
    background: HUD_SURFACE,
    border: `2px solid ${GAME_HUD.border}`,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.0,
    boxShadow: SHADOW,
    pointerEvents: 'none',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
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

// A full-screen celebration beat that must clear the HUD and mobile controls
// beneath it — the CELEBRATION band, not the HUD-notification band it used to sit in.
const WINNER_SCREEN_STYLE = {
    position: 'fixed', inset: 0, zIndex: Z.CELEBRATION,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'safe center',
    pointerEvents: 'auto', overflowY: 'auto', fontFamily: FONT, boxSizing: 'border-box',
    padding: 'max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))',
};

// The celebration is the mode carousel's paper with one ivory card on it.
const WINNER_CARD_STYLE = {
    width: 'min(94vw, 540px)', padding: 'clamp(18px, 3.4vh, 28px) 20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
};

const WINNER_TITLE_STYLE = {
    fontFamily: DISPLAY_FONT,
    fontSize: 'clamp(30px, 8vw, 54px)', fontWeight: 400, letterSpacing: '0.01em', textTransform: 'uppercase',
    color: ARCADE_INK,
    userSelect: 'none', marginBottom: 6, lineHeight: 1.02, textAlign: 'center',
};

const WINNER_SUB_STYLE = {
    color: ARCADE_MUTED, font: `800 11px/1.3 ${HEADING_FONT}`, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 22, textAlign: 'center',
};

const WINNER_STATS_STYLE = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: 8, width: '100%', marginBottom: 18,
};

const WINNER_STAT_BOX_STYLE = {
    borderRadius: 14, border: `2px solid ${ARCADE_LINE_SOFT}`,
    background: '#f7f2e3',
    padding: '10px 12px', textAlign: 'center',
};

const WINNER_STAT_LABEL_STYLE = {
    font: `800 10px/1.3 ${HEADING_FONT}`, letterSpacing: '0.07em', textTransform: 'uppercase', color: ARCADE_MUTED, marginBottom: 3,
};

const WINNER_STAT_VALUE_STYLE = { font: `800 20px/1.1 ${HEADING_FONT}`, color: ARCADE_INK, fontVariantNumeric: 'tabular-nums' };

const WINNER_PP_STYLE = {
    fontFamily: DISPLAY_FONT,
    fontSize: 'clamp(24px, 6vw, 36px)', color: ARCADE_INK_STRONG, textTransform: 'uppercase',
    marginBottom: 4, textAlign: 'center',
};

const WINNER_PP_NOTE_STYLE = {
    fontSize: 12, color: ARCADE_MUTED, marginBottom: 20, textAlign: 'center',
};

const WINNER_BTN_ROW_STYLE = { display: 'flex', gap: 12, justifyContent: 'safe center', width: '100%', marginTop: 8 };

const WINNER_PLAY_AGAIN_STYLE = { ...primaryBtnStyle(), minWidth: 140 };
const WINNER_NEW_GAME_STYLE = { ...SECONDARY_BTN_STYLE, minWidth: 120 };

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
        <div style={WINNER_SCREEN_STYLE} className="arcade-paper">
          <div className={`run-result ${OVERLAY_CARD_CLASS}`} style={WINNER_CARD_STYLE}>
            <ModeArtwork mode="success" className="screen-results-art" />
            <div style={WINNER_TITLE_STYLE}>Cube healed!</div>
            <div style={WINNER_SUB_STYLE}>All tunnels healed</div>
            <div style={PODIUM_WRAP_STYLE}>
                <div style={PODIUM_WORM_ROW_STYLE}>
                    {segments.map((seg, i) => (
                        <div key={i} style={{
                            width: seg.size, height: seg.size, borderRadius: '50%',
                            background: wormColor, opacity: seg.alpha, flexShrink: 0,
                            boxShadow: i === 0 ? `0 0 10px 2px ${wormColor}88` : 'none',
                            border: i === 0 ? `2px solid ${ARCADE_INK_STRONG}` : `1px solid ${ARCADE_INK_STRONG}55`,
                        }} />
                    ))}
                    {overflow > 0 && (
                        <div style={{ fontSize: 13, fontWeight: 800, color: ARCADE_MUTED, flexShrink: 0, marginLeft: 4 }}>+{overflow}</div>
                    )}
                    {wormBodyTiles === 0 && (
                        <div style={{ fontSize: 13, color: ARCADE_MUTED }}>No orbs yet</div>
                    )}
                </div>
                <div style={PODIUM_BASE_STYLE}>
                    <span style={PODIUM_LABEL_STYLE}>Final length: {wormBodyTiles}</span>
                </div>
            </div>
            <div style={WINNER_PP_STYLE}>+{ppEarned} Parity Points</div>
            <div style={WINNER_PP_NOTE_STYLE}>{wormBodyTiles} {wormBodyTiles === 1 ? 'orb' : 'orbs'} × 5 PP × 2 win bonus</div>
            <div style={WINNER_STATS_STYLE}>
                {[
                    ['Time', formatTime(wormTimeAlive)],
                    ['Collected', wormSessionOrbs],
                    ['Healed', wormHealedCount],
                    ['Total PP', parityPoints],
                ].map(([label, value]) => (
                    <div key={label} style={WINNER_STAT_BOX_STYLE}>
                        <div style={WINNER_STAT_LABEL_STYLE}>{label}</div>
                        <div style={WINNER_STAT_VALUE_STYLE}>{value}</div>
                    </div>
                ))}
            </div>
            <WormMissionCard summary />
            <XpRunSummary mode="worm" />
            <div style={WINNER_BTN_ROW_STYLE}>
                <button onClick={onRetry} style={WINNER_PLAY_AGAIN_STYLE}><WormReplayLabel /></button>
                <button onClick={onNewGame} style={WINNER_NEW_GAME_STYLE}>New game</button>
            </div>
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
// Its stronger color stays at the edges so the route remains readable, even
// during magnet pickups. prefers-reduced-motion softens it further.

const ORB_FLASH_MS = 480;

function OrbPickupFlash() {
    const flash = useGameStore(s => s.wormOrbFlash);
    const [shown, setShown] = useState(null);
    const timer = useRef(null);

    useEffect(() => {
        if (!flash?.color) return;
        setShown(flash);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setShown(null), Math.max(ORB_FLASH_MS, 520) + 60);
        return () => clearTimeout(timer.current);
    }, [flash]);

    if (!shown) return null;

    // Escalates with the pickup combo, mirroring the rising pitch of the pickup sound.
    const peak = Math.min(0.28 + Math.min(shown.combo ?? 0, 6) * 0.03, 0.46);

    return (
        <>
            <style>{`
                @keyframes wormOrbFlash {
                    0%   { opacity: 0; }
                    14%  { opacity: calc(var(--orb-flash-peak) * var(--orb-flash-scale, 1)); }
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
                    background: `radial-gradient(ellipse at center, transparent 38%, ${shown.color} 100%)`,
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

function BuffStrip({ detailed = false, onInspect }) {
    const explodeActive = useGameStore(s => s.wormExplodeActive ?? false);
    const explodeSeconds = useRef(null);
    const explodeFill = useRef(null);
    const rocketActive = useGameStore(s => s.wormRocketActive ?? false);
    const magnetActive = useGameStore(s => s.wormMagnetActive ?? false);
    const magnetSeq = useGameStore(s => s.wormMagnetSeq ?? 0);
    const elementalTheme = useGameStore(s => s.wormElementalTheme ?? null);
    const fillRef = useRef(null);
    const secondsRef = useRef(null);
    const elemFillRef = useRef(null);
    const elemSecondsRef = useRef(null);
    const feedbackRef = useRef(null);
    const momentumRef = useRef(null);

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
    // sim mirrors onto the wormBuffs bridge so it freezes with the simulation. The
    // elemental readout is a radial countdown ring (see the medal below): drive its
    // stroke-dashoffset from full circumference (empty) down to 0 (full) so it
    // drains as the wash expires.
    useEffect(() => {
        if (!elementalTheme) return;
        let raf = 0;
        const paint = () => {
            const { elementalT, elementalMaxT } = wormBuffs;
            const frac = elementalMaxT > 0 ? Math.max(0, Math.min(1, elementalT / elementalMaxT)) : 0;
            if (elemFillRef.current) elemFillRef.current.style.strokeDashoffset = `${ELEM_RING_CIRC * (1 - frac)}`;
            if (elemSecondsRef.current) elemSecondsRef.current.textContent = `${Math.max(0, elementalT).toFixed(0)}s`;
            const feedback = elementalFeedback(elementalTheme, wormBuffs);
            if (feedbackRef.current && feedbackRef.current.textContent !== feedback.text) feedbackRef.current.textContent = feedback.text;
            if (momentumRef.current) momentumRef.current.style.transform = `scaleX(${feedback.fraction})`;
            raf = requestAnimationFrame(paint);
        };
        paint();
        return () => cancelAnimationFrame(raf);
    }, [elementalTheme, detailed]);

    useEffect(() => {
        if (!explodeActive) return;
        let raf;
        const paint = () => {
            if (explodeSeconds.current) explodeSeconds.current.textContent = `${Math.max(0, wormBuffs.explodeT).toFixed(1)}s`;
            if (explodeFill.current) explodeFill.current.style.width = `${100 * Math.max(0, wormBuffs.explodeT) / EXPLODE_DURATION}%`;
            raf = requestAnimationFrame(paint);
        };
        paint();
        return () => cancelAnimationFrame(raf);
    }, [explodeActive]);
    if (!rocketActive && !magnetActive && !elementalTheme && !explodeActive) return null;

    const rocketDef = getSpecialDef('rocket');
    const magnetDef = getSpecialDef('magnet');
    const elemDef = elementalTheme ? getElementalDef(elementalTheme) : null;

    return <div className={`worm-buffs${detailed ? ' worm-buffs-detailed' : ''}`} aria-label="Active powers">
        {explodeActive && <div className="worm-buff-item">
            <button type="button" className="worm-hud-chip worm-buff-chip" onClick={onInspect} disabled={detailed}
                style={{ '--power-color': getSpecialDef('explode').color }} aria-label="Explode active" aria-haspopup={detailed ? undefined : 'dialog'}>
                <span ref={explodeFill} className="worm-buff-meter" aria-hidden="true" style={{ width: '100%' }} />
                <SpecialIcon type="explode" /><span>Explode</span><span ref={explodeSeconds} aria-hidden="true" />
            </button>
            {detailed && <p>{getSpecialDef('explode').description}</p>}
        </div>}
        {rocketActive && <div className="worm-buff-item">
            <button type="button" className="worm-hud-chip worm-buff-chip" onClick={onInspect} disabled={detailed}
                style={{ '--power-color': rocketDef.color }} aria-label="Rocket active" aria-haspopup={detailed ? undefined : 'dialog'}>
                <SpecialIcon type="rocket" /><span>Rocket</span>
            </button>
            {detailed && <p>{rocketDef.description}</p>}
        </div>}
        {magnetActive && <div className="worm-buff-item">
            <button type="button" className="worm-hud-chip worm-buff-chip" onClick={onInspect} disabled={detailed}
                style={{ '--power-color': magnetDef.color }} aria-label="Magnet active" aria-haspopup={detailed ? undefined : 'dialog'}>
                <span ref={fillRef} className="worm-buff-meter" aria-hidden="true" style={{ width: '100%' }} />
                <SpecialIcon type="magnet" /><span className="worm-buff-name">Magnet</span>
                <span ref={secondsRef} aria-hidden="true" />
            </button>
            {detailed && <p>{magnetDef.description}</p>}
        </div>}
        {elemDef && <div className="worm-buff-item">
            <button type="button" className="worm-hud-chip worm-buff-chip" onClick={onInspect} disabled={detailed}
                style={{ '--power-color': elemDef.color }} aria-label={`${elemDef.label} element active`} aria-haspopup={detailed ? undefined : 'dialog'}>
                <span className="worm-element-medal" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 22 22">
                        <circle cx="11" cy="11" r={ELEM_RING_R} fill="none" stroke="#26372d22" strokeWidth="2" />
                        <circle ref={elemFillRef} cx="11" cy="11" r={ELEM_RING_R} fill="none" stroke={elemDef.color} strokeWidth="2.4"
                            strokeLinecap="round" strokeDasharray={ELEM_RING_CIRC} strokeDashoffset={0} transform="rotate(-90 11 11)" />
                    </svg>
                    <SpecialIcon type={elementalTheme} size={12} />
                </span>
                <span className="worm-buff-name">{elemDef.label}</span>
                <span ref={elemSecondsRef} aria-hidden="true" />
                {elementalTheme === 'water' && <span className="worm-buff-meter worm-momentum-meter" ref={momentumRef} aria-hidden="true" />}
            </button>
            {detailed && <div className="worm-power-detail"><p>{elemDef.description}</p><p ref={feedbackRef} /></div>}
        </div>}
    </div>;
}

// ─── Special spawn / expiry notice ───────────────────────────────────────────
// A special can appear on a face the camera is not pointed at. This is the cue that
// something is out there worth turning for — and, when it lapses, that it is gone.

const NOTICE_MS = 2200;

function SpecialNotice({ suppressed = false }) {
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

    if (!shown || suppressed) return null;
    const def = getSpecialDef(shown.type);
    const expired = shown.kind === 'expire';

    return (
        <div
            key={shown.seq}
            className="worm-special-notice"
            style={{
                ...SPECIAL_NOTICE_STYLE,
                color: expired ? GAME_HUD.muted : def.color,
                border: `2px solid ${expired ? GAME_HUD.border : def.color}`,
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

function BoostButton({ wormAlive }) {
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

    const readyStyle = {
        ...BOOST_BTN_BASE, background: GAME_HUD.raised,
        border: `1px solid ${HUD_ACCENT}`, color: TEXT,
    };
    const activeStyle = {
        ...BOOST_BTN_BASE, background: GAME_HUD.active,
        border: `1px solid ${HUD_ACCENT}`, color: HUD_ACCENT,
    };
    const cooldownStyle = {
        ...BOOST_BTN_BASE, background: HUD_SURFACE,
        border: `1px solid ${BORDER}`, cursor: 'default', color: TEXT_MUTED,
    };

    const style = boostState === 'active' ? activeStyle
        : boostState === 'cooldown' ? cooldownStyle
        : readyStyle;

    return (
        <button
            onPointerDown={handleBoost}
            onClick={e => { if (e.detail === 0) handleBoost(); }}
            className={`worm-action worm-boost${boostState === 'cooldown' ? '' : ' worm-hud-key'}`}
            style={style}
            aria-label="Boost"
            aria-disabled={!wormAlive || boostState !== 'ready'}
            title={boostState === 'cooldown' ? 'Boost recharging' : 'Boost'}
        >
            {boostState === 'cooldown' && (
                <div style={{ ...BOOST_FILL_STYLE, height: `${fillPct}%`, background: withAlpha(HUD_ACCENT, 0.18) }} />
            )}
            <span style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><BoltIcon size={20} /><span style={{ fontSize: 10 }}>Boost</span></span>
        </button>
    );
}

// ─── Pause Menu Overlay ──────────────────────────────────────────────────────

function SignatureGuide() {
    const character = useGameStore(s => s.wormCharacter);
    const def = SIGNATURES[character];
    return def && !def.passive ? <section className="worm-signature-guide"><strong>{def.name}</strong><p>{def.hint}</p></section> : null;
}

function PauseMenu({ onResume, onHome, onSettings, onToggleAntipodal, antipodalActive, wormControlMode, toggleWormControlMode, wormSpeed, setWormSpeed, wormAlive, wormHealedCount, wormSessionOrbs, wormTimeAlive, wormGamePhase, formatTime, fc: _fc }) {
    const storyId = useGameStore(s => s.wormStoryLevel);
    const green = UI_MOSS_LIGHT;
    const blue = UI_MOSS_LIGHT;
    const dialogRef = useRef(null);
    const onDialogKeyDown = useDialogBehavior(dialogRef, onResume);
    const cameraHorizon = useGameStore(s => s.wormCameraHorizon ?? 'face');
    const toggleCameraHorizon = useGameStore(s => s.toggleWormCameraHorizon);
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
        <div style={overlayScrimStyle({ tint: green, fixed: false, zIndex: 10 })} onClick={onResume}>
            <div ref={dialogRef} onKeyDown={onDialogKeyDown} tabIndex={-1} className={`worm-pause-card ${OVERLAY_CARD_CLASS}`} role="dialog" aria-modal="true" aria-label="Game paused" style={{ ...overlayCardStyle(green, { width: 420 }), ...arcadeModeVars('worm') }} onClick={e => e.stopPropagation()}>
                <ScreenHeading mode="pause" title="Paused" />
                <button type="button" className="worm-pause-resume arcade-primary" onClick={onResume}>Resume <span aria-hidden="true">→</span></button>
                {storyId && <StoryObjectiveCard />}
                <WormMissionCard summary />
                <details className="screen-disclosure"><summary>Abilities & tunnels</summary>
                  <BuffStrip detailed /><TunnelNeedsCard /><SignatureGuide />
                </details>
                <details className="screen-disclosure"><summary>Run rewards</summary>
                  <ParityWallet /><XpRunSummary mode="worm" />
                </details>

                <StatTiles columns={2} stats={[
                    ['Time', formatTime(wormTimeAlive)],
                    ['Healed', wormHealedCount],
                    ['Collected', wormSessionOrbs],
                    storyId ? [`Chapter ${storyChapterId(storyId)}`, `Level ${storyChapterIndex(storyId)} / ${STORY_CHAPTER_SIZE}`] : ['Next tunnel', wormGamePhase === 'finalHealing' ? 'Final' : `${wormholeCountdown.toFixed(1)}s`],
                ]} />

                <details className="screen-disclosure"><summary>Controls & sound</summary>
                {/* Named speed presets — keep the underlying multipliers out of the UI. */}
                <div style={{ ...SETTING_ROW_STYLE, marginTop: 'clamp(10px, 2vh, 16px)' }}>
                    <span style={SETTING_LABEL_STYLE}>{storyId ? 'Level speed' : 'Speed'}</span>
                    <div style={{ display: 'flex', gap: 5, flex: 1 }}>
                        {storyId ? <span style={{ ...SETTING_LABEL_STYLE, padding: '10px 0' }}>Story pace · fixed for this level</span> : WORM_SPEED_OPTIONS.map(option => (
                            <button
                                key={option.label}
                                type="button"
                                disabled={!wormAlive || !!storyId}
                                onClick={() => wormAlive && setWormSpeed(option.value)}
                                style={segmentStyle(wormSpeed === option.value, blue, wormAlive && !storyId)}
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
                        onClick={() => toggleWormControlMode()}
                        style={togglePillStyle(wormControlMode === 'oriented', blue)}
                    >
                        {wormControlMode === 'oriented' ? 'Relative turns' : 'Fixed turns'}
                    </button>
                </div>

                {/* Which way is up while crawling. A feel call rather than a right
                    answer, and one you can only judge in motion, so it is here in
                    the run rather than buried in setup: FACE rolls the horizon with
                    the cube face you are on, Keep level keeps it world-up. */}
                <div style={SETTING_ROW_STYLE}>
                    <span style={SETTING_LABEL_STYLE}>Horizon</span>
                    <button
                        onClick={() => toggleCameraHorizon?.()}
                        style={togglePillStyle(cameraHorizon === 'face', blue)}
                    >
                        {cameraHorizon === 'face' ? 'Follow the face' : 'Keep level'}
                    </button>
                </div>

                <div style={SETTING_ROW_STYLE}>
                    <span style={SETTING_LABEL_STYLE}>Feel</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            onClick={() => setSettings?.(s => ({ ...s, sfx: !(s.sfx ?? true) }))}
                            style={togglePillStyle(sfxOn, green)}
                        >
                            {sfxOn ? 'Sound on' : 'Sound off'}
                        </button>
                        <button
                            onClick={() => setSettings?.(s => ({ ...s, haptics: !(s.haptics ?? true) }))}
                            style={togglePillStyle(hapticsOn, green)}
                        >
                            {hapticsOn ? 'Vibration on' : 'Vibration off'}
                        </button>
                    </div>
                </div>

                </details>
                {/* Secondary navigation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'clamp(10px, 2vh, 14px)' }}>
                    {onToggleAntipodal && (
                        <button
                            onClick={onToggleAntipodal}
                            style={{
                                ...LIST_BTN_STYLE,
                                ...(antipodalActive ? { background: `${blue}33`, borderColor: ARCADE_INK_STRONG, color: ARCADE_INK, boxShadow: `0 2px 0 ${ARCADE_INK_STRONG}`, transform: 'translateY(2px)' } : {}),
                            }}
                        >
                            <span aria-hidden="true">⊕</span>
                            <span>Antipodal Camera {antipodalActive ? '(On)' : '(Off)'}</span>
                        </button>
                    )}
                    {onSettings && (
                        <button onClick={onSettings} style={LIST_BTN_STYLE}>
                            <span aria-hidden="true">⚙</span>
                            <span>Settings</span>
                        </button>
                    )}
                    {onHome && (
                        <button onClick={onHome} style={LIST_BTN_STYLE}>
                            <span aria-hidden="true">⌂</span>
                            <span>Main menu</span>
                        </button>
                    )}
                </div>


            </div>
        </div>
    );
}

function HudContext({ surface, demo, onInspect }) {
    const hasBuff = useGameStore(s => s.wormExplodeActive || s.wormRocketActive || s.wormMagnetActive || !!s.wormElementalTheme);
    const [hasTunnel, setHasTunnel] = useState(!!wormBuffs.tunnelNeeds);
    useEffect(() => {
        const id = setInterval(() => setHasTunnel(!!wormBuffs.tunnelNeeds), 100);
        return () => clearInterval(id);
    }, []);
    const healing = hasTunnel && !demo;
    return <div className="worm-hud-context">
        {healing ? <TunnelNeedsCard compact onInspect={onInspect} /> : surface && hasBuff ? <BuffStrip onInspect={onInspect} /> : null}
        {/* Keep the notice clock mounted while hidden so old spawns cannot replay. */}
        <SpecialNotice suppressed={healing || hasBuff || !surface} />
    </div>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function WormCrawlerHUD({ phase, onFlippedTile, cubeSize: _cubeSize = 3, onHome, onSettings, onToggleAntipodal, antipodalActive = false, wormAlive = true, showDeathMenu = false, deathDetails = null, onRetry, onNewGame, onStoryNext }) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const captureMode = useGameStore(s => s.captureMode);

    ensureHudStyle();
    const combatMode = useGameStore(s => s.wormCombatMode);
    const jumpRescue = useGameStore(s => s.wormJumpRescueActive && !s.wormPaused && s.wormAlive);
    const enemiesEnabled = useGameStore(s => s.wormEnemiesEnabled);
    const runId = useGameStore(s => s.wormRunId);
    const demoLesson = useGameStore(s => s.demoMode && s.demoStep === 'worm-traversal');
    const lessonIndex = useGameStore(s => s.demoWormLessonIndex);
    const practiceRunning = useGameStore(s => s.demoWormStarted && !s.demoWormComplete);
    const storyId = useGameStore(s => s.wormStoryLevel);
    const storyStarted = useGameStore(s => s.wormStoryStarted);
    const controlsEnabled = wormAlive && (!demoLesson || practiceRunning) && (!storyId || storyStarted);
    const lesson = wormDemoLesson({ demoWormLessonIndex: lessonIndex });
    const trayRef = useRef(null);
    useLayoutEffect(() => {
        useGameStore.setState({ wormPauseMenuOpen: isPaused });
        return () => useGameStore.setState({ wormPauseMenuOpen: false });
    }, [isPaused]);
    useEffect(() => { setIsPaused(false); }, [runId]);
    useLayoutEffect(() => {
        const tray = trayRef.current;
        if (!tray || captureMode) return;
        const measure = () => {
            const clearance = `${Math.max(0, window.innerHeight - tray.getBoundingClientRect().top) + 10}px`;
            document.documentElement.style.setProperty('--worm-tray-clearance', clearance);
            if (demoLesson) document.documentElement.style.setProperty('--demo-tray-clearance', clearance);
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(tray); window.addEventListener('resize', measure);
        return () => { observer?.disconnect(); window.removeEventListener('resize', measure); document.documentElement.style.removeProperty('--demo-tray-clearance'); document.documentElement.style.removeProperty('--worm-tray-clearance'); };
    }, [demoLesson, phase, captureMode]);

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
        resumeFeel(); feel('uiKey');
        setIsPaused(true);
        setWormPaused(true);
    }, [canPause, setWormPaused]);
    const handleResume = useCallback(() => {
        resumeFeel(); feel('uiKey');
        setIsPaused(false);
        setWormPaused((storyId && !useGameStore.getState().wormStoryStarted) || (demoLesson && (!useGameStore.getState().demoWormStarted || useGameStore.getState().demoWormComplete)) || (combatMode && (!combatBridge.current?.started || combatBridge.current.won)));
    }, [setWormPaused, demoLesson, combatMode, storyId]);

    useEffect(() => {
        // Settings can be opened from Pause. Start Capture must resume that
        // user pause, while retaining story/demo/combat readiness gates.
        if (captureMode && isPaused) handleResume();
    }, [captureMode, isPaused, handleResume]);

    const isPortalReady = wormAlive && onFlippedTile && phase === 'crawling';

    const jumpReadyStyle = {
        ...JUMP_BTN_BASE, background: GAME_HUD.active,
        border: `1px solid ${HUD_ACCENT}`, color: TEXT,
    };

    const jumpIdleStyle = {
        ...JUMP_BTN_BASE,
        background: HUD_SURFACE,
        backdropFilter: HUD_BLUR,
        WebkitBackdropFilter: HUD_BLUR,
        border: `1px solid ${BORDER}`,
        color: TEXT,
    };

    const steerVars = {
        position: 'relative',
        '--key-press': GAME_HUD.active,
        '--key-edge': HUD_ACCENT,
        '--key-glow': 'transparent',
    };

    return (
        <div className="worm-instrument" data-combat={combatMode || undefined} data-lesson={demoLesson ? lesson.id : undefined} style={ROOT_STYLE}>

            {/* ── Orb pickup confirmation (behind every panel — first child) ── */}
            {wormAlive && <OrbPickupFlash />}

            {/* ── Zone 1: Status bar — glance info + pause, one object ── */}
            <div className="worm-hud-top" aria-hidden={isPaused || undefined} inert={isPaused ? '' : undefined}>
                <div className="worm-hud-bar" style={HUD_BAR_STYLE}>
                    <div className="worm-hud-row" style={HUD_ROW_STYLE}>
                        {wormAlive && phase === 'crawling' && (!demoLesson || ['orbs', 'heal'].includes(lesson.id)) && (
                            <div className="worm-hud-reserve">
                                <OrbInventoryHUD orbInventory={wormOrbInventory} faceColors={fc} tileStyles={settings?.manifoldStyles} mobile={isMobile} />
                            </div>
                        )}

                        {/* Length and pause stay visible throughout transit. */}
                        <div className="worm-hud-stats" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={GLANCE_LABEL_STYLE} aria-label="Length">LEN</span>
                                <span style={{ ...GLANCE_VALUE_STYLE, color: TEXT }}>{wormBodyTiles}</span>
                            </div>

                            <button
                                onPointerDown={handlePause}
                                onClick={e => { if (e.detail === 0) handlePause(); }}
                                disabled={!canPause}
                                className="worm-hud-key"
                                style={PAUSE_BTN_STYLE}
                                aria-label="Pause"
                            >
                                <PauseIcon />
                            </button>
                        </div>
                    </div>

                    {!combatMode && (!storyId || storyLevel(storyId)?.rotateEvery) && (!demoLesson || lesson.id === 'rotation') && <RotationCountdownHUD />}
                </div>

                <div className="worm-hud-status-row">
                    {!combatMode && !demoLesson && storyId && storyStarted && <StoryObjectiveCard compact />}
                    {!combatMode && !demoLesson && !storyId && phase === 'crawling' && <WormMissionCard onInspect={handlePause} />}
                    {wormAlive && (!demoLesson || ['tunnel', 'heal'].includes(lesson.id)) && <HudContext surface={phase === 'crawling'} demo={false} onInspect={handlePause} />}
                </div>
            </div>

            {/* ── Zone 3: Thumb Tray — steer in the corners, act in the middle ── */}
            {(phase === 'crawling' || demoLesson || combatMode) && <div className="worm-hud-bottom" ref={trayRef} aria-hidden={isPaused || undefined} inert={isPaused ? '' : undefined}>
                {!combatMode && !demoLesson && storyId && !storyStarted && <div className="worm-story-briefing">
                    <StoryObjectiveCard /><StoryStartButton />
                </div>}
                {combatMode ? <CombatCard onRetry={onRetry} onHome={onHome} /> : demoLesson ? <WormDemoLessonCard /> : null}
                {phase === 'crawling' && (!storyId || storyStarted) && <div style={THUMB_TRAY_STYLE}>
                    <SteerKey side="left" wormAlive={controlsEnabled && !jumpRescue} wormColor={wormColor} vars={steerVars} />

                    {/* Middle: signature and primary actions share the measured dock */}
                    <div className="worm-action-center" style={ACTION_CLUSTER_STYLE}>
                        {combatMode ? <CombatFireButton /> : demoLesson ? lesson.id === 'signature' && <SignatureButton /> : enemiesEnabled ? <AmbientCombatActions /> : <SignatureButton />}
                        <div className="worm-primary-actions">
                            <div className="worm-jump-slot">
                                {jumpRescue && <JumpRescueCue />}
                                <button
                                    onPointerDown={handleJumpAction}
                                    onClick={e => { if (e.detail === 0) handleJumpAction(); }}

                                    className={`worm-hud-key worm-action worm-jump${jumpRescue ? ' worm-jump-rescue' : isPortalReady ? ' worm-jump-ready' : ''}`}
                                    style={isPortalReady ? jumpReadyStyle : jumpIdleStyle}
                                    aria-label={jumpRescue ? 'Jump now to clear your body' : isPortalReady ? "Dive through wormhole" : "Jump over body or vault an edge"}
                                    disabled={!controlsEnabled}
                                >
                                    <JumpIcon size={19} />
                                    {jumpRescue ? 'Jump now' : isPortalReady ? 'Dive' : 'Jump'}
                                </button>
                            </div>
                            <BoostButton wormAlive={controlsEnabled && !jumpRescue} />
                        </div>
                    </div>

                    <SteerKey side="right" wormAlive={controlsEnabled && !jumpRescue} wormColor={wormColor} vars={steerVars} />
                </div>}

            </div>}

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
            {!combatMode && showDeathMenu && isMinimized && (
                <div style={EXAMINE_MINIMIZED_OUTER_STYLE}>
                    <div style={EXAMINE_BAR_STYLE}>
                        <div style={EXAMINE_DOT_STYLE} />
                        <span style={EXAMINE_LABEL_STYLE}>Look around</span>
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
            {wormGamePhase === 'solved' && !storyId && (
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

            {wormGamePhase === 'solved' && storyId && <StoryResult onNext={onStoryNext} onRetry={onRetry} onLevels={onNewGame} />}

            {/* ── Death screen ── */}
            {!combatMode && showDeathMenu && !isMinimized && (
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
