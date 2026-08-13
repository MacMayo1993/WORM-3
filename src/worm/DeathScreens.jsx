// src/worm/DeathScreens.jsx
// Full-screen death takeovers for Worm Healer mode — a distinct themed
// experience per death cause instead of one generic "you died" card.
//
// The four causes stay four identities, but they are one shell driven by a
// config table rather than four hand-copied screens that had drifted apart in
// spacing, button order and which stats they showed. The shell itself is shared
// with the pause menu (./wormOverlayUI.jsx), so both screens that stop the game
// look like the same game.
//
// Reading order:
//   eyebrow → title → one line of plain English → the run's headline number →
//   supporting stats → where it happened → what to do next
//
// Two things these deliberately no longer do:
//
// The background is not a black plate any more. Each cause used to paint an
// opaque wash and then rake nine full-screen glowing lines across it, straight
// through the stats — the FX fought the text, and throwing the board away meant
// the screen that ends your run was the one place you could not see it. It is
// now the shared NIGHT scrim: warm, translucent, blurred, with the cube still
// there behind it and only a soft tint of the cause's colour.
//
// And there is no monospace diagnostics block. It read "Head tile / Body tile
// hit / Impact progress: 0.55" — the two tile values name the same square so
// they were usually identical, and a 0-to-1 interpolation factor means nothing
// to anyone who has not read the collision code. One location chip replaces it.
import React from 'react';
import {
    overlayScrimStyle, overlayCardStyle,
    Eyebrow, OverlayTitle, OverlayBlurb,
    HeroStat, StatTiles, OverlayChip,
    primaryBtnStyle, SECONDARY_BTN_STYLE, TERTIARY_BTN_STYLE, ACTION_ROW_STYLE,
} from './wormOverlayUI.jsx';

// ─── Death-cause classification ───────────────────────────────────────────────
function classifyDeath(reason) {
    if (reason === 'voided' || reason === 'void-zone' || reason === 'void-tunnel-exhausted') return 'event-horizon';
    if (reason === 'slice-rotation') return 'sliced';
    if (reason === 'bomb') return 'blasted';
    return 'tail-bite'; // self-collision, plus any legacy/unknown reason
}

// ─── Per-cause identity ───────────────────────────────────────────────────────
// accent        — eyebrow, lit card edge, hero number, scrim tint
// deep          — dark end of the hue, for the title's outline
// btnFrom/btnTo — the primary button's gradient, separate from `accent` because
//   SLICED is steel-white and filling a button with it left white label text on
//   a near-white field. That screen borrows the red from the slice hazard.
const DEATHS = {
    'tail-bite': {
        eyebrow: 'Worm collision',
        title: 'TAIL BITE',
        blurb: 'You crossed your own body.',
        accent: '#f87171',
        accentSoft: 'rgba(248,113,113,0.45)',
        deep: '#7f1d1d',
        titleSize: 'clamp(32px, min(11vw, 10vh), 76px)',
    },
    'event-horizon': {
        eyebrow: 'Void breach',
        title: 'EVENT HORIZON',
        blurb: 'The tunnel collapsed with you inside it.',
        accent: '#a78bfa',
        accentSoft: 'rgba(167,139,250,0.45)',
        deep: '#312e81',
        titleSize: 'clamp(23px, min(8vw, 7vh), 58px)',
        titleAnim: 'eh-glitch 0.9s ease-out 1 forwards',
    },
    sliced: {
        eyebrow: 'Slice collision',
        title: 'SLICED',
        blurb: 'A rotating slice caught you mid-crawl.',
        accent: '#e2e8f0',
        accentSoft: 'rgba(226,232,240,0.40)',
        deep: '#7f1d1d',
        btnFrom: '#dc2626',
        btnTo: '#7f1d1d',
        titleSize: 'clamp(34px, min(12vw, 11vh), 84px)',
    },
    blasted: {
        eyebrow: 'Direct hit',
        title: 'DETONATED',
        blurb: 'The fuse ran out. Surround the next one to disarm it.',
        accent: '#fb923c',
        accentSoft: 'rgba(249,115,22,0.45)',
        deep: '#7c2d12',
        titleSize: 'clamp(30px, min(10vw, 9vh), 76px)',
    },
};

/**
 * The one line naming where the run ended, per cause. Returns null when the sim
 * did not record a location — better nothing than a chip reading "n/a", which is
 * what the old detail box printed on every field it could not fill.
 */
function locationFor(kind, deathDetails) {
    if (!deathDetails) return null;
    if (kind === 'tail-bite') {
        const tile = deathDetails.collisionTile ?? deathDetails.headTile;
        return tile ? { label: 'Bitten at', value: tile } : null;
    }
    if (kind === 'event-horizon') {
        return deathDetails.tunnelKey ? { label: 'Tunnel', value: deathDetails.tunnelKey } : null;
    }
    if (kind === 'sliced') {
        const { axis, sliceIndex } = deathDetails;
        if (axis == null && sliceIndex == null) return null;
        return { label: 'Slice', value: `${String(axis ?? '?').toUpperCase()} · ${sliceIndex ?? '?'}` };
    }
    return null;
}

// ─── Entry point ────────────────────────────────────────────────────────────────
export default function DeathScreen({
    deathDetails, wormTimeAlive, wormHealedCount, wormTunnelCount, wormBodyTiles,
    formatTime, onRetry, onNewGame, onExamine,
}) {
    const kind = classifyDeath(deathDetails?.reason);
    const config = DEATHS[kind];
    const location = locationFor(kind, deathDetails);
    // Examine hides the overlay to show the board behind it, which is only worth
    // offering when there is a spot on the board to go and look at.
    const canExamine = !!onExamine && kind === 'tail-bite' && !!location;

    return (
        <>
            <div style={overlayScrimStyle({ tint: config.accent })}>
                <div style={overlayCardStyle(config.accent)}>
                    <Eyebrow accent={config.accent}>{config.eyebrow}</Eyebrow>
                    <OverlayTitle
                        size={config.titleSize}
                        outline={config.deep}
                        glow={config.accentSoft}
                        animation={config.titleAnim}
                    >{config.title}</OverlayTitle>
                    <OverlayBlurb>{config.blurb}</OverlayBlurb>

                    <HeroStat accent={config.accent} value={wormBodyTiles} label="Final length" />
                    <StatTiles stats={[
                        ['Time', formatTime(wormTimeAlive)],
                        ['Healed', wormHealedCount],
                        ['Tunnels', wormTunnelCount],
                    ]} />

                    {location && (
                        <OverlayChip accent={config.accent} label={location.label} value={location.value} />
                    )}

                    <div style={ACTION_ROW_STYLE}>
                        <button
                            onPointerDown={onRetry}
                            style={primaryBtnStyle(config.btnFrom ?? config.accent, config.btnTo ?? config.deep)}
                        >Retry</button>
                        <button onPointerDown={onNewGame} style={SECONDARY_BTN_STYLE}>New Game</button>
                    </div>
                    {canExamine && (
                        <button onPointerDown={onExamine} style={TERTIARY_BTN_STYLE}>Examine the board</button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes eh-glitch {
                    0% { text-shadow: 0 0 24px rgba(167,139,250,0.7); }
                    20% { text-shadow: -3px 0 #f87171, 3px 0 #22d3ee, 0 0 24px rgba(167,139,250,0.7); }
                    40% { text-shadow: 3px 0 #f87171, -3px 0 #22d3ee, 0 0 24px rgba(167,139,250,0.7); }
                    60%, 100% { text-shadow: 0 0 24px rgba(167,139,250,0.7); }
                }
                @media (prefers-reduced-motion: reduce) {
                    @keyframes eh-glitch { from {} to {} }
                }
            `}</style>
        </>
    );
}
