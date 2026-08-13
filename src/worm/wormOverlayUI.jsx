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
// Both sit over the live 3D scene, which per the uiTheme guidance is the NIGHT
// family's job: a warm dark scrim with the cube still legible (blurred) behind
// it, rather than a flat black plate that throws the scene away. The death
// screens additionally tint that scrim toward their cause's colour.
import React from 'react';
import {
    UI_FONT, DISPLAY_FONT, MONO_FONT,
    NIGHT_BACKDROP_BLUR, NIGHT_TEXT, NIGHT_TEXT_MUTED,
} from '../utils/uiTheme.js';

// ─── Scrim ────────────────────────────────────────────────────────────────────
/**
 * The wash behind the card.
 *
 * `tint` is an optional accent the scrim leans toward at its centre — enough to
 * colour the moment without hiding the board. Left out, this is the neutral
 * NIGHT backdrop the rest of the game uses over the 3D scene.
 *
 * `fixed` positions against the viewport (death screens, which own the screen);
 * the pause menu passes false because it lives inside the HUD's own stacking
 * context and must not escape it.
 */
export function overlayScrimStyle({ tint, fixed = true, zIndex = 200 } = {}) {
    const centre = tint ? `${tint}1f` : 'rgba(28,35,22,0.55)';
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
        textAlign: 'center',
        // Warm dark, and translucent on purpose: the cube stays visible behind the
        // blur so the overlay reads as sitting on top of the run rather than
        // replacing it with a black rectangle.
        background: `radial-gradient(ellipse at 50% 45%, ${centre} 0%, rgba(16,20,13,0.80) 52%, rgba(9,11,7,0.92) 100%)`,
        backdropFilter: NIGHT_BACKDROP_BLUR,
        WebkitBackdropFilter: NIGHT_BACKDROP_BLUR,
        padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
        boxSizing: 'border-box',
    };
}

// ─── Card ─────────────────────────────────────────────────────────────────────
/**
 * The sheet itself. The accent shows only as a lit top edge, so several very
 * different hues (four death causes plus the pause menu's own) all sit on one
 * consistent neutral surface instead of each restyling the whole card.
 *
 * Vertical rhythm keys off viewport height as well as width, so a short
 * landscape phone shrinks the padding instead of pushing the buttons off screen.
 */
export function overlayCardStyle(accent, { width = 460 } = {}) {
    return {
        position: 'relative',
        zIndex: 1,
        width: `min(94vw, ${width}px)`,
        maxHeight: '92vh',
        overflowY: 'auto',
        background: 'linear-gradient(180deg, rgba(24,27,20,0.94) 0%, rgba(14,16,12,0.96) 100%)',
        border: '1px solid rgba(255,245,220,0.14)',
        borderTop: `2px solid ${accent}`,
        borderRadius: 22,
        padding: 'clamp(15px, 3.2vh, 26px) 22px clamp(14px, 2.6vh, 22px)',
        boxShadow: '0 28px 80px rgba(0,0,0,0.6)',
        boxSizing: 'border-box',
        textAlign: 'center',
    };
}

// ─── Type ─────────────────────────────────────────────────────────────────────
export function Eyebrow({ accent, children }) {
    return (
        <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 3.2,
            color: accent, textTransform: 'uppercase', opacity: 0.9,
        }}>{children}</div>
    );
}

export function OverlayTitle({ children, size, outline, glow, animation }) {
    return (
        <div style={{
            fontFamily: DISPLAY_FONT,
            fontSize: size,
            lineHeight: 1.02,
            letterSpacing: '-1px',
            color: '#fff',
            marginTop: 6,
            textShadow: `0 2px 0 ${outline}, 0 0 42px ${glow}`,
            animation,
        }}>{children}</div>
    );
}

export function OverlayBlurb({ children }) {
    return (
        <div style={{
            fontSize: 13.5, lineHeight: 1.45,
            color: NIGHT_TEXT_MUTED,
            marginTop: 'clamp(5px, 1.4vh, 10px)',
        }}>{children}</div>
    );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
/** The one number the screen is about, in the accent colour. */
export function HeroStat({ accent, value, label }) {
    return (
        <div style={{
            marginTop: 'clamp(10px, 2.2vh, 20px)',
            padding: 'clamp(8px, 1.8vh, 14px) 12px clamp(7px, 1.6vh, 12px)',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.045)',
            border: '1px solid rgba(255,245,220,0.10)',
        }}>
            <div style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 'clamp(30px, min(12vw, 8vh), 56px)',
                lineHeight: 1,
                color: accent,
                textShadow: `0 0 30px ${accent}55`,
            }}>{value}</div>
            <div style={{
                marginTop: 'clamp(4px, 1vh, 8px)', fontSize: 10.5, fontWeight: 800,
                letterSpacing: 2.4, textTransform: 'uppercase', color: NIGHT_TEXT_MUTED,
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
                <div key={label} style={{
                    padding: 'clamp(6px, 1.4vh, 10px) 6px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,245,220,0.08)',
                }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{value}</div>
                    <div style={{
                        marginTop: 5, fontSize: 9.5, fontWeight: 700,
                        letterSpacing: 1.4, textTransform: 'uppercase', color: NIGHT_TEXT_MUTED,
                    }}>{label}</div>
                </div>
            ))}
        </div>
    );
}

/**
 * A single fact on one line. The value keeps MONO_FONT when it is a manifold
 * grid ID or similar notation — the face this project reserves for those — while
 * the label around it stays ordinary UI text so the line reads as a caption
 * rather than as console output.
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
            borderRadius: 999,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,245,220,0.10)',
        }}>
            <span style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: 1.4,
                textTransform: 'uppercase', color: NIGHT_TEXT_MUTED, flexShrink: 0,
            }}>{label}</span>
            <span style={{
                fontFamily: mono ? MONO_FONT : UI_FONT, fontSize: 12, color: accent,
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
    borderBottom: '1px solid rgba(255,245,220,0.08)',
};

export const SETTING_LABEL_STYLE = {
    fontSize: 12.5,
    fontWeight: 700,
    color: NIGHT_TEXT,
    flexShrink: 0,
};

/** Pill toggle used for the control-mode and feel switches. */
export function togglePillStyle(on, accent) {
    return {
        borderRadius: 999,
        border: `1px solid ${on ? `${accent}88` : 'rgba(255,245,220,0.16)'}`,
        background: on ? `${accent}26` : 'rgba(255,255,255,0.05)',
        padding: '6px 12px',
        fontSize: 11.5,
        fontWeight: 700,
        color: on ? '#fff' : NIGHT_TEXT_MUTED,
        cursor: 'pointer',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
    };
}

/** Segmented option button (speed presets). */
export function segmentStyle(selected, accent, enabled = true) {
    return {
        flex: 1,
        padding: '7px 4px',
        borderRadius: 9,
        border: `1px solid ${selected ? accent : 'rgba(255,245,220,0.14)'}`,
        background: selected ? `${accent}2e` : 'rgba(255,255,255,0.04)',
        color: selected ? '#fff' : NIGHT_TEXT_MUTED,
        font: 'inherit',
        fontSize: 10.5,
        fontWeight: selected ? 800 : 600,
        cursor: enabled ? 'pointer' : 'default',
        opacity: enabled ? 1 : 0.5,
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
    };
}

// ─── Buttons ──────────────────────────────────────────────────────────────────
const BTN_BASE = {
    borderRadius: 13,
    fontWeight: 800,
    letterSpacing: 0.6,
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    border: '1px solid transparent',
};

/**
 * The single primary action. `from`/`to` are passed rather than derived from the
 * accent because an accent is not always a usable button ground — a near-white
 * accent leaves white label text on a near-white field.
 */
export function primaryBtnStyle(from, to) {
    return {
        ...BTN_BASE,
        flex: '1 1 0',
        minHeight: 44,
        padding: 'clamp(10px, 1.9vh, 13px) 18px',
        fontSize: 15,
        color: '#fff',
        background: `linear-gradient(135deg, ${from}, ${to})`,
        border: `1px solid ${from}`,
        boxShadow: `0 6px 24px ${from}44`,
    };
}

export const SECONDARY_BTN_STYLE = {
    ...BTN_BASE,
    flex: '1 1 0',
    minHeight: 44,
    padding: 'clamp(10px, 1.9vh, 13px) 18px',
    fontSize: 15,
    color: 'rgba(255,253,242,0.88)',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,245,220,0.18)',
};

/** A text link, for the one action that is a detour rather than a choice. */
export const TERTIARY_BTN_STYLE = {
    ...BTN_BASE,
    marginTop: 'clamp(7px, 1.4vh, 12px)',
    width: '100%',
    minHeight: 40,
    padding: '9px 12px',
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: 0.8,
    color: NIGHT_TEXT_MUTED,
    background: 'transparent',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    textDecorationColor: 'rgba(255,245,220,0.25)',
};

/** Full-width left-aligned row button (pause menu's navigation list). */
export const LIST_BTN_STYLE = {
    ...BTN_BASE,
    width: '100%',
    minHeight: 42,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.3,
    color: NIGHT_TEXT,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,245,220,0.12)',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 9,
};

export const ACTION_ROW_STYLE = {
    marginTop: 'clamp(12px, 2.4vh, 20px)',
    display: 'flex',
    gap: 10,
};
