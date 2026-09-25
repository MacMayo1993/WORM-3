// src/worm/wormOverlayUI.jsx
// Shared chrome for WORM mode's full-screen takeovers — the death screens and
// the pause menu.
//
// These two used to belong to different design systems: the death card was a
// dark sheet on an opaque black wash, the pause card was a white paper sheet
// with near-black text. Pausing a run and dying in one both stop the game and
// ask "what now?", so they now draw from one kit and differ only in content and
// accent colour.
//
// Both wear the mode carousel's ARCADE look (uiTheme.js): translucent graph
// paper over the live run, an ivory card, ivory keys and one chunky primary key
// in WORM's face colour. The death screens tint the paper toward their cause.
import React from 'react';
import '../components/ui/arcadeTheme.css';
import {
    UI_FONT, HEADING_FONT, DISPLAY_FONT, MONO_FONT,
    ARCADE_INK, ARCADE_INK_STRONG, ARCADE_MUTED, ARCADE_CARD, ARCADE_LINE, ARCADE_LINE_SOFT,
    ARCADE_GRID, ARCADE_GRID_SIZE, ARCADE_KEY_SHADOW, ARCADE_PRIMARY_SHADOW, ARCADE_CARD_SHADOW,
} from '../utils/uiTheme.js';
import { arcadeModeColors } from '../utils/arcadeTheme.js';

// Class for cards built from these helpers: it repaints nested widgets that were
// written for dark sheets (disclosures, stat rows, HUD-token cards). See
// components/ui/arcadeTheme.css.
export const OVERLAY_CARD_CLASS = 'arcade-card';

// ─── Scrim ────────────────────────────────────────────────────────────────────
/**
 * The wash behind the card: the mode carousel's graph paper, translucent and
 * blurred so the run stays visible behind it.
 *
 * `tint` is an optional accent the scrim leans toward at its centre. `fixed`
 * positions against the viewport (death screens, which own the screen); the
 * pause menu passes false because it lives inside the HUD's own stacking
 * context and must not escape it.
 */
export function overlayScrimStyle({ tint, fixed = true, zIndex = 200 } = {}) {
    const centre = tint ? `${tint}24` : 'transparent';
    return {
        position: fixed ? 'fixed' : 'absolute',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        overflow: 'hidden',
        fontFamily: UI_FONT,
        color: ARCADE_INK,
        textAlign: 'center',
        backgroundColor: 'rgba(248,244,232,0.80)',
        backgroundImage: `radial-gradient(ellipse at 50% 45%, ${centre} 0%, transparent 60%), ${ARCADE_GRID}`,
        backgroundSize: `100% 100%, ${ARCADE_GRID_SIZE}`,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
        boxSizing: 'border-box',
    };
}

// ─── Card ─────────────────────────────────────────────────────────────────────
/**
 * The sheet itself: an ivory card on the same 6px ledge as the carousel's keys.
 * The accent shows only as a band along the top edge, so several very different
 * hues (the death causes plus the pause menu's own) share one surface.
 *
 * Vertical rhythm keys off viewport height as well as width, so a short
 * landscape phone shrinks the padding instead of pushing the buttons off screen.
 */
export function overlayCardStyle(accent, { width = 460 } = {}) {
    return {
        position: 'relative',
        zIndex: 1,
        width: `min(94vw, ${width}px)`,
        maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 30px)',
        overflowY: 'auto',
        color: ARCADE_INK,
        background: ARCADE_CARD,
        border: `2px solid ${ARCADE_LINE}`,
        borderRadius: 24,
        padding: 'clamp(15px, 3.2vh, 26px) 22px clamp(14px, 2.6vh, 22px)',
        boxShadow: `inset 0 6px 0 ${accent}, ${ARCADE_CARD_SHADOW}`,
        boxSizing: 'border-box',
        textAlign: 'center',
    };
}

// ─── Type ─────────────────────────────────────────────────────────────────────
export function Eyebrow({ accent, children }) {
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            font: `800 11px/1.3 ${HEADING_FONT}`, letterSpacing: '0.08em',
            color: ARCADE_MUTED, textTransform: 'uppercase',
        }}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, background: accent, outline: `1px solid ${ARCADE_INK}44` }} />{children}</div>
    );
}

export function OverlayTitle({ children, size, outline: _outline, glow: _glow, animation }) {
    return (
        <div style={{
            fontFamily: DISPLAY_FONT, fontWeight: 400, textTransform: 'uppercase',
            fontSize: size,
            lineHeight: 1.05,
            letterSpacing: '0.01em',
            color: ARCADE_INK,
            marginTop: 6,
            animation,
        }}>{children}</div>
    );
}

export function OverlayBlurb({ children }) {
    return (
        <div style={{
            fontSize: 14, lineHeight: 1.5,
            color: ARCADE_MUTED,
            marginTop: 'clamp(5px, 1.4vh, 10px)',
        }}>{children}</div>
    );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
/** The one number the screen is about, on an inset tile edged in the accent. */
export function HeroStat({ accent, value, label }) {
    return (
        <div style={{
            marginTop: 'clamp(10px, 2.2vh, 20px)',
            padding: 'clamp(8px, 1.8vh, 14px) 12px clamp(7px, 1.6vh, 12px)',
            borderRadius: 16,
            background: '#f7f2e3',
            border: `2px solid ${ARCADE_LINE_SOFT}`,
            boxShadow: `inset 0 -4px 0 ${accent}`,
        }}>
            <div style={{
                fontFamily: HEADING_FONT, fontWeight: 800,
                fontSize: 'clamp(30px, min(12vw, 8vh), 56px)',
                lineHeight: 1,
                color: ARCADE_INK,
                fontVariantNumeric: 'tabular-nums',
            }}>{value}</div>
            <div style={{
                marginTop: 'clamp(4px, 1vh, 8px)', font: `800 10.5px/1.3 ${HEADING_FONT}`,
                letterSpacing: '0.07em', textTransform: 'uppercase', color: ARCADE_MUTED,
            }}>{label}</div>
        </div>
    );
}

/** Supporting numbers — `stats` is [[label, value], …]. */
export function StatTiles({ stats, columns }) {
    return (
        <div style={{
            marginTop: 'clamp(6px, 1.2vh, 10px)',
            display: 'grid',
            gridTemplateColumns: `repeat(${columns ?? stats.length}, 1fr)`,
            gap: 8,
        }}>
            {stats.map(([label, value]) => (
                <div key={label} style={{ padding: 'clamp(6px, 1.4vh, 10px) 6px', borderRadius: 12 }}>
                    <div style={{ font: `800 18px/1.1 ${HEADING_FONT}`, color: ARCADE_INK, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                    <div style={{
                        marginTop: 5, font: `800 10px/1.3 ${HEADING_FONT}`,
                        letterSpacing: '0.07em', textTransform: 'uppercase', color: ARCADE_MUTED,
                    }}>{label}</div>
                </div>
            ))}
        </div>
    );
}

/**
 * A single fact on one line, drawn as the carousel's fact chip. The value keeps
 * MONO_FONT when it is a manifold grid ID or similar notation — the face this
 * project reserves for those — while the label stays ordinary UI text.
 */
export function OverlayChip({ accent, label, value, mono = true }) {
    if (value == null || value === '') return null;
    return (
        <div style={{
            marginTop: 'clamp(7px, 1.4vh, 12px)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: '100%',
            padding: '7px 12px',
            borderRadius: 8,
            background: ARCADE_CARD,
            border: `1px solid ${ARCADE_LINE_SOFT}`,
            boxShadow: `inset 3px 0 0 ${accent}`,
        }}>
            <span style={{
                font: `800 10px/1.3 ${HEADING_FONT}`, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: ARCADE_MUTED, flexShrink: 0,
            }}>{label}</span>
            <span style={{
                fontFamily: mono ? MONO_FONT : UI_FONT, fontSize: 12, color: ARCADE_INK,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{value}</span>
        </div>
    );
}

// ─── Settings rows (pause menu) ───────────────────────────────────────────────
export const SETTING_ROW_STYLE = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 'clamp(7px, 1.4vh, 10px) 0',
    borderBottom: `1px solid ${ARCADE_LINE_SOFT}`,
};

export const SETTING_LABEL_STYLE = {
    font: `800 11px/1.3 ${HEADING_FONT}`,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: ARCADE_INK_STRONG,
    flexShrink: 0,
};

// ─── Keys ─────────────────────────────────────────────────────────────────────
// Ivory keys on a hard ledge; the chosen option sinks and takes the accent.
const KEY_BASE = {
    boxSizing: 'border-box',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
};
const keyFace = (selected, accent) => selected
    ? { border: `2px solid ${ARCADE_INK_STRONG}`, background: `${accent}40`, color: ARCADE_INK, boxShadow: `0 2px 0 ${ARCADE_INK_STRONG}`, transform: 'translateY(2px)' }
    : { border: `2px solid ${ARCADE_LINE}`, background: ARCADE_CARD, color: ARCADE_INK_STRONG, boxShadow: ARCADE_KEY_SHADOW };

/** Pill toggle used for the control-mode and feel switches. */
export function togglePillStyle(on, accent) {
    return {
        ...KEY_BASE,
        ...keyFace(on, accent),
        borderRadius: 14,
        padding: '6px 12px', minHeight: 48,
        font: `800 11px/1.2 ${HEADING_FONT}`,
        letterSpacing: '0.04em',
    };
}

/** Segmented option button (speed presets). */
export function segmentStyle(selected, accent, enabled = true) {
    return {
        ...KEY_BASE,
        ...keyFace(selected, accent),
        flex: 1,
        padding: '7px 4px', minHeight: 48,
        borderRadius: 12,
        font: `800 11px/1.2 ${HEADING_FONT}`,
        letterSpacing: '0.04em',
        cursor: enabled ? 'pointer' : 'default',
        opacity: enabled ? 1 : 0.5,
    };
}

// ─── Buttons ──────────────────────────────────────────────────────────────────
/**
 * The one affirmative key, in WORM's carousel face colour — the same key as
 * "PLAY WORM". Cause colours stay on the art and the card's top band.
 */
export function primaryBtnStyle() {
    const { fill, ink } = arcadeModeColors('worm');
    return {
        ...KEY_BASE,
        flex: '1 1 0',
        minHeight: 56,
        padding: 'clamp(10px, 1.9vh, 13px) 18px',
        font: `400 clamp(15px, 4vw, 18px)/1.2 ${DISPLAY_FONT}`,
        textTransform: 'uppercase',
        color: ink,
        background: fill,
        border: `2px solid ${ARCADE_INK_STRONG}`,
        borderRadius: 18,
        boxShadow: ARCADE_PRIMARY_SHADOW,
    };
}

export const SECONDARY_BTN_STYLE = {
    ...KEY_BASE,
    ...keyFace(false),
    flex: '1 1 0',
    minHeight: 56,
    padding: 'clamp(10px, 1.9vh, 13px) 18px',
    borderRadius: 18,
    font: `800 13px/1.2 ${HEADING_FONT}`,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
};

/** A text link, for the one action that is a detour rather than a choice. */
export const TERTIARY_BTN_STYLE = {
    ...KEY_BASE,
    marginTop: 'clamp(7px, 1.4vh, 12px)',
    width: '100%',
    minHeight: 48,
    padding: '9px 12px',
    border: 0,
    font: `800 11px/1.3 ${HEADING_FONT}`,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: ARCADE_INK_STRONG,
    background: 'transparent',
    textDecoration: 'underline',
    textUnderlineOffset: 4,
    textDecorationColor: ARCADE_LINE,
};

/** Full-width left-aligned row button (pause menu's navigation list). */
export const LIST_BTN_STYLE = {
    ...KEY_BASE,
    ...keyFace(false),
    width: '100%',
    minHeight: 48,
    padding: '10px 14px',
    borderRadius: 16,
    font: `800 12px/1.2 ${HEADING_FONT}`,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 9,
};

export const ACTION_ROW_STYLE = {
    marginTop: 'clamp(14px, 2.6vh, 22px)',
    display: 'flex',
    gap: 10,
};
