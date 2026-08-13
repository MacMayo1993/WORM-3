// src/worm/DeathScreens.jsx
// Full-screen death takeovers for Worm Healer mode — a distinct themed
// experience per death cause instead of one generic "you died" card.
//
// The four causes stay four separate identities (that part always worked), but
// they are now one shell driven by a config table rather than four hand-copied
// screens that had drifted apart in spacing, button order and which stats they
// bothered to show. Everything below the title is shared, so a fix lands on all
// four at once.
//
// Structure, in the order the player reads it:
//   eyebrow → title → one line of plain English → the run's headline number →
//   supporting stats → where it happened → what to do next
//
// The old card led with the title and then dropped straight into a monospace
// block reading "Head tile / Body tile hit / Impact progress: 0.55". That is
// diagnostics, not a result screen: the two tile values were usually identical
// (they name the same square), and a 0-to-1 interpolation factor means nothing
// to anyone who has not read the collision code. It is replaced by a single
// location chip. The grid ID itself stays in MONO_FONT, which is what that face
// is reserved for.
import React from 'react';
import { UI_FONT, DISPLAY_FONT, MONO_FONT, NIGHT_TEXT_MUTED } from '../utils/uiTheme.js';

// ─── Death-cause classification ───────────────────────────────────────────────
function classifyDeath(reason) {
    if (reason === 'voided' || reason === 'void-zone' || reason === 'void-tunnel-exhausted') return 'event-horizon';
    if (reason === 'slice-rotation') return 'sliced';
    if (reason === 'bomb') return 'blasted';
    return 'tail-bite'; // self-collision, plus any legacy/unknown reason
}

// ─── Decorative geometry (deterministic, computed once at module load) ───────
const CRACK_COUNT = 9;
const TAIL_BITE_CRACKS = Array.from({ length: CRACK_COUNT }, (_, i) => ({
    angle: (360 / CRACK_COUNT) * i + (i % 2 === 0 ? 5 : -5),
    length: 36 + (i % 3) * 7,
    delay: (i % CRACK_COUNT) * 0.035,
}));

const PARTICLE_COUNT = 14;
const VOID_PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (360 / PARTICLE_COUNT) * i;
    const rad = (angle * Math.PI) / 180;
    const dist = 28 + (i % 4) * 9;
    return {
        x: Math.cos(rad) * dist,
        y: Math.sin(rad) * dist,
        delay: (i % 7) * 0.09,
        size: 3 + (i % 3),
    };
});

// ─── Per-cause identity ───────────────────────────────────────────────────────
// accent  — the cause's colour: eyebrow, lit card edge, hero number
// deep    — the dark end of that hue, for the title's outline
// btnFrom/btnTo — the primary button's gradient. Separate from `accent` because
//   the accent is not always a usable button ground: SLICED is steel-white, and
//   filling a button with it left white label text on a near-white field. That
//   screen borrows the red from its own slice FX instead.
// backdrop— full-bleed wash behind everything
const DEATHS = {
    'tail-bite': {
        eyebrow: 'Worm collision',
        title: 'TAIL BITE',
        blurb: 'You crossed your own body.',
        accent: '#f87171',
        accentSoft: 'rgba(248,113,113,0.55)',
        deep: '#7f1d1d',
        backdrop: 'radial-gradient(ellipse at 50% 42%, #4a0a0a 0%, #1a0303 55%, #050000 100%)',
        titleSize: 'clamp(32px, min(11vw, 10vh), 76px)',
    },
    'event-horizon': {
        eyebrow: 'Void breach',
        title: 'EVENT HORIZON',
        blurb: 'The tunnel collapsed with you inside it.',
        accent: '#a78bfa',
        accentSoft: 'rgba(167,139,250,0.55)',
        deep: '#312e81',
        backdrop: 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0b0a1f 55%, #000 100%)',
        titleSize: 'clamp(23px, min(8vw, 7vh), 58px)',
        titleAnim: 'eh-glitch 0.9s ease-out 1 forwards',
    },
    sliced: {
        eyebrow: 'Slice collision',
        title: 'SLICED',
        blurb: 'A rotating slice caught you mid-crawl.',
        accent: '#e2e8f0',
        accentSoft: 'rgba(226,232,240,0.5)',
        deep: '#7f1d1d',
        btnFrom: '#dc2626',
        btnTo: '#7f1d1d',
        backdrop: 'linear-gradient(160deg, #1f2937 0%, #0a0a0a 70%, #050505 100%)',
        titleSize: 'clamp(34px, min(12vw, 11vh), 84px)',
    },
    blasted: {
        eyebrow: 'Direct hit',
        title: 'DETONATED',
        blurb: 'The fuse ran out. Surround the next one to disarm it.',
        accent: '#fb923c',
        accentSoft: 'rgba(249,115,22,0.55)',
        deep: '#7c2d12',
        backdrop: 'radial-gradient(circle at 50% 42%, #7c2d12 0%, #1a0a05 55%, #050302 100%)',
        titleSize: 'clamp(30px, min(10vw, 9vh), 76px)',
    },
};

// ─── Shell ────────────────────────────────────────────────────────────────────
const OVERLAY_BASE_STYLE = {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    overflow: 'hidden',
    fontFamily: UI_FONT,
    textAlign: 'center',
    padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
    boxSizing: 'border-box',
};

// The decoration used to run straight across the card — nine full-screen crack
// lines through the middle of the stats. They now sit under a vignette that
// darkens hard toward the centre, so the FX reads at the edges of the screen and
// the card always has clean ground beneath it.
const VIGNETTE_STYLE = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.58) 48%, rgba(0,0,0,0) 100%)',
};

const cardStyle = (accent) => ({
    position: 'relative',
    zIndex: 1,
    width: 'min(94vw, 460px)',
    maxHeight: '92vh',
    overflowY: 'auto',
    background: 'linear-gradient(180deg, rgba(18,16,15,0.92) 0%, rgba(10,9,8,0.95) 100%)',
    backdropFilter: 'blur(12px) saturate(1.05)',
    WebkitBackdropFilter: 'blur(12px) saturate(1.05)',
    border: '1px solid rgba(255,245,220,0.14)',
    // The cause's colour reads as a lit top edge rather than a full outline, so
    // four very different hues all sit on the same neutral card.
    borderTop: `2px solid ${accent}`,
    borderRadius: 22,
    padding: 'clamp(15px, 3.2vh, 26px) 22px clamp(14px, 2.6vh, 22px)',
    boxShadow: '0 28px 80px rgba(0,0,0,0.65)',
    boxSizing: 'border-box',
});

// ─── Content pieces ───────────────────────────────────────────────────────────
function Eyebrow({ accent, children }) {
    return (
        <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 3.2,
            color: accent, textTransform: 'uppercase', opacity: 0.9,
        }}>{children}</div>
    );
}

function Title({ config }) {
    return (
        <div style={{
            fontFamily: DISPLAY_FONT,
            fontSize: config.titleSize,
            lineHeight: 1.02,
            letterSpacing: '-1px',
            color: '#fff',
            marginTop: 6,
            // One soft drop plus a tight outline in the cause's dark tone. The old
            // screens stacked four hard offsets in every direction, which at phone
            // sizes closed up the counters and turned the word into a blob.
            textShadow: `0 2px 0 ${config.deep}, 0 0 42px ${config.accentSoft}`,
            animation: config.titleAnim,
        }}>{config.title}</div>
    );
}

/**
 * The run's headline number. `wormBodyTiles` is the worm's final length and the
 * thing a player is actually chasing, and it used to be the last of four
 * identical grey lines ("Orbs on worm: 39"). A 39-orb run should not read like a
 * footnote on the screen that ends it.
 */
function HeroStat({ accent, value }) {
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
                letterSpacing: 2.4, textTransform: 'uppercase',
                color: NIGHT_TEXT_MUTED,
            }}>Final length</div>
        </div>
    );
}

const STAT_ROW_STYLE = {
    marginTop: 'clamp(6px, 1.2vh, 10px)',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
};

function StatRow({ stats }) {
    return (
        <div style={STAT_ROW_STYLE}>
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
                        letterSpacing: 1.4, textTransform: 'uppercase',
                        color: NIGHT_TEXT_MUTED,
                    }}>{label}</div>
                </div>
            ))}
        </div>
    );
}

/**
 * Where it happened — one line, not a diagnostics dump.
 *
 * Only rendered when there is a real location to name. The grid ID keeps
 * MONO_FONT (the face this project reserves for manifold grid IDs and algorithm
 * notation); the label around it is ordinary UI text so the line reads as a
 * caption rather than as console output.
 */
function LocationChip({ accent, label, value }) {
    if (!value) return null;
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
                fontFamily: MONO_FONT, fontSize: 12, color: accent,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{value}</span>
        </div>
    );
}

// ─── Actions ──────────────────────────────────────────────────────────────────
// Retry is the only primary. The old row put Examine in the same saturated red
// as Retry and sat it first, so the three buttons read as equals and the eye
// landed on the wrong one — on a phone Examine was the left-most thumb target.
const BTN_BASE = {
    borderRadius: 13,
    fontWeight: 800,
    letterSpacing: 0.6,
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    border: '1px solid transparent',
};

const primaryBtnStyle = (config) => {
    const from = config.btnFrom ?? config.accent;
    const to = config.btnTo ?? config.deep;
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
};

const SECONDARY_BTN_STYLE = {
    ...BTN_BASE,
    flex: '1 1 0',
    minHeight: 44,
    padding: 'clamp(10px, 1.9vh, 13px) 18px',
    fontSize: 15,
    color: 'rgba(255,253,242,0.88)',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,245,220,0.18)',
};

// Tertiary: a text button on its own line. Examine hides this overlay so the
// board underneath can be read, which is a detour from the two real choices.
const TERTIARY_BTN_STYLE = {
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
    border: '1px solid transparent',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    textDecorationColor: 'rgba(255,245,220,0.25)',
};

// ─── Per-cause background FX ──────────────────────────────────────────────────
function Decor({ kind }) {
    if (kind === 'tail-bite') {
        return (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {TAIL_BITE_CRACKS.map((c, i) => (
                    <div key={i} style={{
                        position: 'absolute', top: '50%', left: '50%',
                        width: `${c.length}vmax`, height: 2,
                        transform: `rotate(${c.angle}deg)`, transformOrigin: '0 50%',
                    }}>
                        <div style={{
                            width: '100%', height: '100%', transformOrigin: '0 50%',
                            background: 'linear-gradient(90deg, #fca5a5 0%, #f87171 35%, rgba(239,68,68,0) 100%)',
                            boxShadow: '0 0 8px 1px rgba(248,113,113,0.6)',
                            animation: `tb-crack-grow 0.45s ease-out ${c.delay}s 1 both`,
                        }} />
                    </div>
                ))}
            </div>
        );
    }
    if (kind === 'event-horizon') {
        return (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', width: 0, height: 0,
                    borderRadius: '50%', transform: 'translate(-50%, -50%)',
                    animation: 'eh-ring 1.8s ease-out infinite',
                }} />
                {VOID_PARTICLES.map((p, i) => (
                    <div key={i} style={{
                        position: 'absolute', top: '50%', left: '50%',
                        width: p.size, height: p.size, borderRadius: '50%',
                        background: '#c4b5fd', boxShadow: '0 0 6px 2px rgba(167,139,250,0.7)',
                        transform: `translate(${p.x}vmax, ${p.y}vmax)`,
                        animation: `eh-pull 1.1s ease-in ${p.delay}s 1 both`,
                    }} />
                ))}
            </div>
        );
    }
    if (kind === 'sliced') {
        return (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
                    background: 'linear-gradient(180deg, rgba(248,113,113,0.12), transparent)',
                    animation: 'sl-split-top 0.7s ease-out 1',
                }} />
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
                    background: 'linear-gradient(0deg, rgba(248,113,113,0.12), transparent)',
                    animation: 'sl-split-bottom 0.7s ease-out 1',
                }} />
                <div style={{
                    position: 'absolute', top: '50%', left: 0, right: 0, height: 3,
                    background: 'linear-gradient(90deg, transparent, #f1f5f9 20%, #fff 50%, #f1f5f9 80%, transparent)',
                    boxShadow: '0 0 24px 4px rgba(241,245,249,0.8)',
                    animation: 'sl-flash 0.7s ease-out 1 forwards',
                }} />
            </div>
        );
    }
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{
                position: 'absolute', top: '42%', left: '50%', width: 40, height: 40,
                marginLeft: -20, marginTop: -20, borderRadius: '50%',
                background: 'radial-gradient(circle, #fff 0%, #fde68a 30%, #f97316 60%, transparent 72%)',
                animation: 'bm-flash 0.7s ease-out 1 forwards',
            }} />
        </div>
    );
}

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
        const tunnel = deathDetails.tunnelKey;
        return tunnel ? { label: 'Tunnel', value: tunnel } : null;
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
            <div style={{
                ...OVERLAY_BASE_STYLE,
                background: config.backdrop,
                animation: kind === 'tail-bite' ? 'tb-shake 0.5s ease-out 1' : undefined,
            }}>
                <Decor kind={kind} />
                <div style={VIGNETTE_STYLE} />

                <div style={cardStyle(config.accent)}>
                    <Eyebrow accent={config.accent}>{config.eyebrow}</Eyebrow>
                    <Title config={config} />
                    <div style={{ fontSize: 13.5, lineHeight: 1.45, color: NIGHT_TEXT_MUTED, marginTop: 'clamp(5px, 1.4vh, 10px)' }}>
                        {config.blurb}
                    </div>

                    <HeroStat accent={config.accent} value={wormBodyTiles} />
                    <StatRow stats={[
                        ['Time', formatTime(wormTimeAlive)],
                        ['Healed', wormHealedCount],
                        ['Tunnels', wormTunnelCount],
                    ]} />

                    {location && (
                        <LocationChip accent={config.accent} label={location.label} value={location.value} />
                    )}

                    <div style={{ marginTop: 'clamp(12px, 2.4vh, 20px)', display: 'flex', gap: 10 }}>
                        <button onPointerDown={onRetry} style={primaryBtnStyle(config)}>Retry</button>
                        <button onPointerDown={onNewGame} style={SECONDARY_BTN_STYLE}>New Game</button>
                    </div>
                    {canExamine && (
                        <button onPointerDown={onExamine} style={TERTIARY_BTN_STYLE}>Examine the board</button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes bm-flash {
                    0% { transform: scale(0.3); opacity: 1; }
                    60% { transform: scale(26); opacity: 0.85; }
                    100% { transform: scale(40); opacity: 0; }
                }
                @keyframes tb-shake {
                    0% { transform: translate(0,0); }
                    10% { transform: translate(-6px,3px); }
                    20% { transform: translate(5px,-4px); }
                    30% { transform: translate(-4px,5px); }
                    40% { transform: translate(6px,-2px); }
                    50% { transform: translate(-3px,3px); }
                    60% { transform: translate(2px,-2px); }
                    100% { transform: translate(0,0); }
                }
                @keyframes tb-crack-grow {
                    0% { transform: scaleX(0); opacity: 0; }
                    100% { transform: scaleX(1); opacity: 1; }
                }
                @keyframes eh-pull {
                    0% { opacity: 0.9; }
                    100% { transform: translate(0,0) scale(0.2); opacity: 0; }
                }
                @keyframes eh-ring {
                    0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.45); }
                    100% { box-shadow: 0 0 0 60vmax rgba(99,102,241,0); }
                }
                @keyframes eh-glitch {
                    0% { text-shadow: 0 0 24px rgba(167,139,250,0.7); }
                    20% { text-shadow: -3px 0 #f87171, 3px 0 #22d3ee, 0 0 24px rgba(167,139,250,0.7); }
                    40% { text-shadow: 3px 0 #f87171, -3px 0 #22d3ee, 0 0 24px rgba(167,139,250,0.7); }
                    60%, 100% { text-shadow: 0 0 24px rgba(167,139,250,0.7); }
                }
                @keyframes sl-split-top {
                    0% { transform: translateY(0); }
                    25% { transform: translateY(-18px); }
                    60% { transform: translateY(-4px); }
                    100% { transform: translateY(0); }
                }
                @keyframes sl-split-bottom {
                    0% { transform: translateY(0); }
                    25% { transform: translateY(18px); }
                    60% { transform: translateY(4px); }
                    100% { transform: translateY(0); }
                }
                @keyframes sl-flash {
                    0% { opacity: 0; }
                    8% { opacity: 1; }
                    18% { opacity: 0.15; }
                    30% { opacity: 0.9; }
                    100% { opacity: 0; }
                }
                @media (prefers-reduced-motion: reduce) {
                    @keyframes tb-shake        { from {} to {} }
                    @keyframes tb-crack-grow   { from {} to {} }
                    @keyframes eh-pull         { from {} to {} }
                    @keyframes eh-ring         { from {} to {} }
                    @keyframes eh-glitch       { from {} to {} }
                    @keyframes sl-split-top    { from {} to {} }
                    @keyframes sl-split-bottom { from {} to {} }
                    @keyframes sl-flash        { from {} to {} }
                }
            `}</style>
        </>
    );
}
