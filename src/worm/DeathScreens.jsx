import { XpRunSummary } from '../progression/ProgressWidgets.jsx';
import WormMissionCard from './WormMissionCard.jsx';
// src/worm/DeathScreens.jsx
// Full-screen death takeovers for Worm Healer mode — a distinct themed
// experience per death cause instead of one generic "you died" card.
//
// The causes keep distinct identities, but they are one shell driven by a
// config table rather than four hand-copied screens that had drifted apart in
// spacing, button order and which stats they showed. The shell itself is shared
// with the pause menu (./wormOverlayUI.jsx), so both screens that stop the game
// look like the same game.
//
// Reading order, kept to one phone screen with room to spare:
//   badge beside eyebrow and title → one line of plain English → one strip of
//   numbers led by the orbs collected → what to do next
//
// It is compact on purpose: the card covers the board you just died on, and the
// player's next move is almost always Try again. The run's tile length is not on
// it (the HUD shows that while you play); the headline is the orbs you collected
// this run (wormSessionOrbs, which a recovered dropped orb does not add to).
//
// Two things these deliberately no longer do:
//
// The background is not a black plate any more. Each cause used to paint an
// opaque wash and then rake nine full-screen glowing lines across it, straight
// through the stats — the FX fought the text, and throwing the board away meant
// the screen that ends your run was the one place you could not see it. It is
// now the mode carousel's graph paper, translucent and blurred, with the cube
// still there behind it. The cause lives on the card itself (deathScreen.css):
// caution tape in its colour, a glossy badge holding its animated emblem
// (DeathEmblem.jsx), sticker lettering that arrives the way the cause hit (SLICED
// in two halves, the blast shaking), and the orbs collected counting up. Rays
// turn in the paper behind; none of it
// crosses the text, and all of it stops under reduced motion.
//
// And there is no monospace diagnostics block. It read "Head tile / Body tile
// hit / Impact progress: 0.55" — the two tile values name the same square so
// they were usually identical, and a 0-to-1 interpolation factor means nothing
// to anyone who has not read the collision code. One location chip replaces it.
import React, { useEffect, useRef, useState } from 'react';
import { useDialogBehavior } from '../components/ui/Panel.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { prefersReducedMotion } from '../utils/device.js';
import DeathEmblem from './DeathEmblem.jsx';
import {
    overlayScrimStyle, overlayCardStyle, OVERLAY_CARD_CLASS,
    OverlayChip,
    primaryBtnStyle, SECONDARY_BTN_STYLE, TERTIARY_BTN_STYLE, ACTION_ROW_STYLE,
} from './wormOverlayUI.jsx';
import './deathScreen.css';
import NewBestTag from './NewBestTag.jsx';
import { useRunBestsBeaten, useNewBestChime } from './runBests.js';

// ─── Death-cause classification ───────────────────────────────────────────────
function classifyDeath(reason) {
    if (reason === 'caution-fall') return 'fallen';
    if (reason === 'story-timeout') return 'time-up';
    if (reason === 'voided' || reason === 'void-zone' || reason === 'void-tunnel-exhausted' || reason === 'pit') return 'event-horizon';
    if (reason === 'slice-rotation') return 'sliced';
    if (reason === 'bomb') return 'blasted';
    if (reason === 'lightning') return 'struck';
    if (reason === 'portal-crawler') return 'overrun';
    if (reason === 'self-collision') return 'tail-bite';
    return 'unknown';
}

// ─── Per-cause identity ───────────────────────────────────────────────────────
// color — the cause's sticker colour: badge, tape, title lettering, rays
// deep  — its dark end: the title's glow, the emblem's detail, the stat icons
// ink   — text laid on `color` (the eyebrow tape); deep green on the yellows
// Saturated on purpose: the old pastel accents (SLICED was steel-white) vanished
// into the ivory card and left every cause looking like the same blank sheet.
const DEATHS = {
    fallen: {
        eyebrow: 'Missed the ledge', title: 'Fell into the cube',
        blurb: 'At the caution tape, press left, right or jump before time runs out.',
        color: '#ffc61a', deep: '#8a6100', ink: '#26372d', long: true,
    },
    unknown: {
        eyebrow: 'Game over', title: 'Run ended', blurb: 'Try again for another run.',
        color: '#e8343a', deep: '#8c1218', ink: '#fff',
    },
    'time-up': {
        eyebrow: 'Story challenge', title: 'Time’s up',
        blurb: 'Try a shorter route.',
        color: '#ffb703', deep: '#7d5200', ink: '#26372d',
    },
    overrun: {
        eyebrow: 'Portal encounter', title: 'Shields down',
        blurb: 'Jump to dodge. Heal a tunnel to restore a shield.',
        color: '#b44dfd', deep: '#4f1577', ink: '#fff',
    },
    'tail-bite': {
        eyebrow: 'Worm collision', title: 'Tail bite',
        blurb: 'Jump over your tail to keep going.',
        color: '#ff4d6d', deep: '#8a1530', ink: '#fff',
    },
    'event-horizon': {
        eyebrow: 'Void breach', title: 'Lost in the void',
        blurb: 'The tunnel collapsed with you inside it.',
        color: '#5b4cff', deep: '#1e1670', ink: '#fff', long: true,
    },
    sliced: {
        eyebrow: 'Slice collision', title: 'Sliced',
        blurb: 'You crossed a layer while it was turning. Riding one only costs your tail.',
        color: '#e8343a', deep: '#8c1218', ink: '#fff',
    },
    struck: {
        eyebrow: 'Marked tile', title: 'Struck by lightning',
        blurb: 'The storm marks a tile before it strikes. Get off it, or jump.',
        color: '#8b5cf6', deep: '#3b1a8c', ink: '#fff', long: true,
    },
    blasted: {
        eyebrow: 'Direct hit', title: 'Caught in the blast',
        blurb: 'The fuse ran out. Surround the next one to disarm it.',
        color: '#ff7a1a', deep: '#8a3300', ink: '#fff', long: true,
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

// ─── Pieces ─────────────────────────────────────────────────────────────────────
/** Count a number up from zero as the card lands; the final value at once without motion. */
function useCountUp(target, still, ms = 900) {
    const animate = !still && target > 0 && typeof requestAnimationFrame === 'function';
    const [shown, setShown] = useState(animate ? 0 : target);
    useEffect(() => {
        if (!animate) { setShown(target); return undefined; }
        let raf = 0, start = null;
        const step = (now) => {
            start ??= now;
            const t = Math.min(1, (now - start) / ms);
            setShown(Math.round(target * (1 - (1 - t) ** 3)));
            if (t < 1) raf = requestAnimationFrame(step);
        };
        // Let the card land before the number starts to climb.
        const delay = setTimeout(() => { raf = requestAnimationFrame(step); }, 350);
        return () => { clearTimeout(delay); cancelAnimationFrame(raf); };
    }, [animate, target, ms]);
    return shown;
}

const STAT_ICONS = {
    Orbs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="8.5" /><circle cx="9" cy="9" r="2.4" fill="currentColor" stroke="none" /></svg>,
    Time: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M10 3h4" /></svg>,
    Healed: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" strokeLinecap="round" /></svg>,
    Tunnels: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><ellipse cx="12" cy="12" rx="9" ry="6" /><ellipse cx="12" cy="12" rx="4" ry="2.4" fill="currentColor" /></svg>,
};

const RETRY_ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></svg>;

/** The title as sticker lettering; SLICED is drawn as two halves that meet along the cut. */
function DeathTitle({ kind, long, children }) {
    const cls = `worm-death-title is-${kind}${long ? ' is-long' : ''}`;
    if (kind !== 'sliced') return <h2 className={cls}><span>{children}</span></h2>;
    return (
        <h2 className={cls}>
            <span className="is-top">{children}</span>
            <span className="is-bottom" aria-hidden="true">{children}</span>
        </h2>
    );
}

// ─── Entry point ────────────────────────────────────────────────────────────────
export default function DeathScreen({
    deathDetails, wormTimeAlive, wormHealedCount, wormTunnelCount, wormSessionOrbs = 0,
    formatTime, onRetry, onNewGame, onExamine,
}) {
    const dialogRef = useRef(null);
    const onDialogKeyDown = useDialogBehavior(dialogRef);
    const [still] = useState(() => !!useGameStore.getState().settings?.reducedMotion || prefersReducedMotion());
    const kind = classifyDeath(deathDetails?.reason);
    const config = DEATHS[kind];
    const blurb = deathDetails?.reason === 'pit' ? 'You fell into a collapsed tunnel. Turn away or jump clear at its rim.'
        : deathDetails?.reason === 'voided' || deathDetails?.reason === 'void-zone'
        ? 'You entered a collapsed tunnel. Take another route.' : config.blurb;
    const location = locationFor(kind, deathDetails);
    // Examine hides the overlay to show the board behind it, which is only worth
    // offering when there is a spot on the board to go and look at.
    const canExamine = !!onExamine && kind === 'tail-bite' && !!location;
    const bestCombo = useGameStore(s => s.wormRunBestCombo ?? 0);
    // Personal bests (progression/wormBests.js): death is still progress.
    const beaten = useRunBestsBeaten();
    useNewBestChime(beaten);
    const orbs = wormSessionOrbs ?? 0;
    const shownOrbs = useCountUp(orbs, still);
    const stats = [
        ['Time', formatTime(wormTimeAlive), 'time'],
        ['Healed', wormHealedCount, 'heals'],
        ['Tunnels', wormTunnelCount, null],
    ];

    return (
        <>
            <div className={`worm-death${still ? ' is-still' : ''}`}
                style={{ ...overlayScrimStyle({ tint: config.color }), '--death': config.color, '--death-deep': config.deep, '--death-ink': config.ink }}>
                <div className="worm-death-rays" aria-hidden="true" />
                <div ref={dialogRef} onKeyDown={onDialogKeyDown} tabIndex={-1} role="dialog" aria-modal="true" aria-label={config.title}
                    className={`run-result worm-death-card ${OVERLAY_CARD_CLASS}`}
                    style={{ ...overlayCardStyle(config.color, { width: 400 }), padding: '14px 16px 12px', boxShadow: '0 6px 0 #17201b, 0 22px 50px rgba(23,32,27,0.28)', border: '2px solid #17201b', '--mode-accent': config.color }}>
                    <div className="worm-death-tape" aria-hidden="true" />
                    <div className="worm-death-head">
                        <div className="worm-death-badge" aria-hidden="true">
                            <div className="worm-death-badge-face"><DeathEmblem kind={kind} /></div>
                        </div>
                        <div className="worm-death-heading">
                            <div className="worm-death-eyebrow">{config.eyebrow}</div>
                            <DeathTitle kind={kind} long={config.long}>{config.title}</DeathTitle>
                        </div>
                    </div>
                    <p className="worm-death-blurb">{blurb}</p>

                    <div className="worm-death-body">
                    {/* One strip: the orbs collected lead, then the run's other numbers. */}
                    <div className="worm-death-stats">
                        <div className="worm-death-stat is-hero" style={{ '--i': 0 }}>
                            {beaten.includes('orbs') && <NewBestTag />}
                            {STAT_ICONS.Orbs}
                            <strong aria-hidden="true">{shownOrbs}</strong>
                            <span>Orbs<span className="worm-death-sr">: {orbs}{beaten.includes('orbs') ? ', a new best' : ''}</span></span>
                        </div>
                        {stats.map(([label, value, metric], i) => (
                            <div key={label} className="worm-death-stat" style={{ '--i': i + 1 }}>
                                {metric && beaten.includes(metric) && <NewBestTag />}
                                {STAT_ICONS[label]}
                                <strong>{value}</strong>
                                <span>{label}{metric && beaten.includes(metric) && <span className="worm-death-sr">, a new best</span>}</span>
                            </div>
                        ))}
                    </div>

                    <div className="worm-death-actions" style={{ ...ACTION_ROW_STYLE, marginTop: 12 }}>
                        <button onClick={onRetry} className="worm-death-retry" style={{ ...primaryBtnStyle(), minHeight: 48 }}>{RETRY_ICON}Try again</button>
                        <button onClick={onNewGame} style={{ ...SECONDARY_BTN_STYLE, minHeight: 48 }}>New game</button>
                    </div>
                    {canExamine && (
                        <button onClick={onExamine} style={TERTIARY_BTN_STYLE}>Examine the board</button>
                    )}
                    <details className="screen-disclosure"><summary>Run details</summary>
                      <WormMissionCard summary /><XpRunSummary mode="worm" />
                      {location && <OverlayChip accent={config.color} label={location.label} value={location.value} />}
                      {bestCombo >= 2 && <OverlayChip accent={config.color} label="Best orb chain"
                        value={`×${bestCombo}${beaten.includes('chain') ? ' · new best' : ''}`} />}
                    </details>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes eh-glitch {
                    0%, 60%, 100% { text-shadow: 0 4px 0 #17201b; }
                    20% { text-shadow: -4px 0 #f87171, 4px 0 #22d3ee, 0 4px 0 #17201b; }
                    40% { text-shadow: 4px 0 #f87171, -4px 0 #22d3ee, 0 4px 0 #17201b; }
                }
            `}</style>
        </>
    );
}
