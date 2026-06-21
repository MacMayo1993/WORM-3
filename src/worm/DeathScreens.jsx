// src/worm/DeathScreens.jsx
// Full-screen death takeovers for Worm Healer mode — a distinct themed
// experience per death cause instead of one generic "you died" card.
import React from 'react';

// ─── Death-cause classification ───────────────────────────────────────────────
function classifyDeath(reason) {
    if (reason === 'voided' || reason === 'void-zone' || reason === 'void-tunnel-exhausted') return 'event-horizon';
    if (reason === 'slice-rotation') return 'sliced';
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

// ─── Shared shell pieces ───────────────────────────────────────────────────────
const OVERLAY_BASE_STYLE = {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    overflow: 'hidden',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
    textAlign: 'center',
    padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
    boxSizing: 'border-box',
};

const cardStyle = (borderColor) => ({
    position: 'relative',
    zIndex: 1,
    background: 'rgba(0,0,0,0.38)',
    border: `1px solid ${borderColor}`,
    borderRadius: 20,
    padding: '28px 26px',
    backdropFilter: 'blur(6px)',
    maxWidth: 'min(92vw, 420px)',
});

const NEW_GAME_BTN_STYLE = {
    minWidth: 120,
    borderRadius: 12,
    padding: '11px 18px',
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.85)',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
};

const retryBtnStyle = (gradFrom, gradTo, glowColor) => ({
    minWidth: 130,
    borderRadius: 12,
    padding: '11px 18px',
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 0.6,
    color: '#fff',
    background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
    border: `1px solid ${glowColor}`,
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: `0 4px 20px ${glowColor}`,
});

const EXAMINE_BTN_STYLE = {
    minWidth: 110,
    borderRadius: 12,
    padding: '11px 16px',
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

function StatsList({ accent, valueColor, stats }) {
    return (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: accent }}>
            {stats.map(([label, value]) => (
                <div key={label}>{label}: <b style={{ color: valueColor }}>{value}</b></div>
            ))}
        </div>
    );
}

function DetailBox({ borderColor, textColor, valueColor, lines }) {
    return (
        <div style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 10,
            border: `1px solid ${borderColor}`,
            background: 'rgba(0,0,0,0.25)',
            textAlign: 'left',
            fontSize: 11,
            color: textColor,
            fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
            lineHeight: 1.4,
        }}>
            {lines.map(([label, value]) => (
                <div key={label}>{label}: <b style={{ color: valueColor }}>{value}</b></div>
            ))}
        </div>
    );
}

function ButtonRow({ children }) {
    return <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>{children}</div>;
}

// ─── Tail Bite (self-collision) ────────────────────────────────────────────────
function TailBiteDeathScreen({ deathDetails, stats, onRetry, onNewGame, onExamine }) {
    return (
        <div style={{
            ...OVERLAY_BASE_STYLE,
            background: 'radial-gradient(ellipse at 50% 45%, #4a0a0a 0%, #1a0303 55%, #050000 100%)',
            animation: 'tb-shake 0.5s ease-out 1',
        }}>
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

            <div style={cardStyle('rgba(248,113,113,0.35)')}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: 'rgba(254,202,202,0.7)', textTransform: 'uppercase' }}>WORM COLLISION</div>
                <div style={{
                    fontFamily: "'Impact', 'Arial Black', sans-serif",
                    fontSize: 'clamp(40px, 9vw, 72px)', fontWeight: 900, letterSpacing: '-1px',
                    color: '#fecaca', marginTop: 4,
                    textShadow: '-3px -3px 0 #7f1d1d, 3px -3px 0 #7f1d1d, -3px 3px 0 #7f1d1d, 3px 3px 0 #7f1d1d, 0 0 36px rgba(248,113,113,0.6)',
                }}>TAIL BITE</div>
                <div style={{ fontSize: 13, color: 'rgba(254,202,202,0.7)', marginTop: 8 }}>You collided with your own body.</div>

                <StatsList accent="rgba(254,202,202,0.65)" valueColor="#fff" stats={[
                    ['Time alive', stats.timeAlive],
                    ['Tiles healed', stats.healed],
                    ['Wormholes used', stats.tunnels],
                    ['Orbs on worm', stats.bodyTiles],
                ]} />

                {deathDetails?.reason === 'self-collision' && (
                    <DetailBox
                        borderColor="rgba(248,113,113,0.35)"
                        textColor="rgba(254,202,202,0.7)"
                        valueColor="#fff"
                        lines={[
                            ['Head tile', deathDetails.headTile ?? 'n/a'],
                            ['Body tile hit', deathDetails.collisionTile ?? 'n/a'],
                            ['Impact progress', deathDetails.progress ?? 'n/a'],
                        ]}
                    />
                )}

                <ButtonRow>
                    {deathDetails?.reason === 'self-collision' && (
                        <button onPointerDown={onExamine} style={EXAMINE_BTN_STYLE}>Examine</button>
                    )}
                    <button onPointerDown={onRetry} style={retryBtnStyle('#dc2626', '#7f1d1d', 'rgba(248,113,113,0.5)')}>Retry</button>
                    <button onPointerDown={onNewGame} style={NEW_GAME_BTN_STYLE}>New Game</button>
                </ButtonRow>
            </div>
        </div>
    );
}

// ─── Event Horizon (voided in a tunnel) ────────────────────────────────────────
function EventHorizonDeathScreen({ deathDetails, stats, onRetry, onNewGame }) {
    return (
        <div style={{
            ...OVERLAY_BASE_STYLE,
            background: 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0b0a1f 55%, #000 100%)',
        }}>
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

            <div style={cardStyle('rgba(167,139,250,0.35)')}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: 'rgba(196,181,253,0.7)', textTransform: 'uppercase' }}>VOID BREACH</div>
                <div style={{
                    fontFamily: "'Impact', 'Arial Black', sans-serif",
                    fontSize: 'clamp(30px, 7vw, 56px)', fontWeight: 900, letterSpacing: '-1px',
                    color: '#ddd6fe', marginTop: 4,
                    animation: 'eh-glitch 0.9s ease-out 1 forwards',
                }}>EVENT HORIZON</div>
                <div style={{ fontSize: 13, color: 'rgba(221,214,254,0.7)', marginTop: 8 }}>Consumed by the void.</div>

                <StatsList accent="rgba(221,214,254,0.65)" valueColor="#fff" stats={[
                    ['Time alive', stats.timeAlive],
                    ['Tiles healed', stats.healed],
                    ['Wormholes used', stats.tunnels],
                    ['Orbs on worm', stats.bodyTiles],
                ]} />

                <DetailBox
                    borderColor="rgba(167,139,250,0.35)"
                    textColor="rgba(221,214,254,0.7)"
                    valueColor="#fff"
                    lines={[
                        ['Head tile', deathDetails?.headTile ?? 'n/a'],
                        ['Tunnel key', deathDetails?.tunnelKey ?? 'n/a'],
                    ]}
                />

                <ButtonRow>
                    <button onPointerDown={onRetry} style={retryBtnStyle('#6366f1', '#312e81', 'rgba(167,139,250,0.5)')}>Retry</button>
                    <button onPointerDown={onNewGame} style={NEW_GAME_BTN_STYLE}>New Game</button>
                </ButtonRow>
            </div>
        </div>
    );
}

// ─── Sliced (clipped by a rotating slice) ──────────────────────────────────────
function SlicedDeathScreen({ deathDetails, stats, onRetry, onNewGame }) {
    return (
        <div style={{
            ...OVERLAY_BASE_STYLE,
            background: 'linear-gradient(160deg, #1f2937 0%, #0a0a0a 70%, #050505 100%)',
        }}>
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

            <div style={cardStyle('rgba(226,232,240,0.3)')}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: 'rgba(226,232,240,0.65)', textTransform: 'uppercase' }}>SLICE COLLISION</div>
                <div style={{
                    fontFamily: "'Impact', 'Arial Black', sans-serif",
                    fontSize: 'clamp(44px, 10vw, 80px)', fontWeight: 900, letterSpacing: '-1px',
                    color: '#f1f5f9', marginTop: 4,
                    textShadow: '-3px -3px 0 #7f1d1d, 3px -3px 0 #7f1d1d, -3px 3px 0 #7f1d1d, 3px 3px 0 #7f1d1d, 0 0 30px rgba(248,113,113,0.5)',
                }}>SLICED</div>
                <div style={{ fontSize: 13, color: 'rgba(226,232,240,0.65)', marginTop: 8 }}>Caught in the rotation.</div>

                <StatsList accent="rgba(226,232,240,0.6)" valueColor="#fff" stats={[
                    ['Time alive', stats.timeAlive],
                    ['Tiles healed', stats.healed],
                    ['Wormholes used', stats.tunnels],
                    ['Orbs on worm', stats.bodyTiles],
                ]} />

                <DetailBox
                    borderColor="rgba(226,232,240,0.3)"
                    textColor="rgba(226,232,240,0.6)"
                    valueColor="#fff"
                    lines={[
                        ['Axis', deathDetails?.axis ?? 'n/a'],
                        ['Slice index', deathDetails?.sliceIndex ?? 'n/a'],
                    ]}
                />

                <ButtonRow>
                    <button onPointerDown={onRetry} style={retryBtnStyle('#dc2626', '#1e293b', 'rgba(248,113,113,0.45)')}>Retry</button>
                    <button onPointerDown={onNewGame} style={NEW_GAME_BTN_STYLE}>New Game</button>
                </ButtonRow>
            </div>
        </div>
    );
}

// ─── Entry point ────────────────────────────────────────────────────────────────
export default function DeathScreen({
    deathDetails, wormTimeAlive, wormHealedCount, wormTunnelCount, wormBodyTiles,
    formatTime, onRetry, onNewGame, onExamine,
}) {
    const kind = classifyDeath(deathDetails?.reason);
    const stats = {
        timeAlive: formatTime(wormTimeAlive),
        healed: wormHealedCount,
        tunnels: wormTunnelCount,
        bodyTiles: wormBodyTiles,
    };

    return (
        <>
            {kind === 'tail-bite' && (
                <TailBiteDeathScreen deathDetails={deathDetails} stats={stats} onRetry={onRetry} onNewGame={onNewGame} onExamine={onExamine} />
            )}
            {kind === 'event-horizon' && (
                <EventHorizonDeathScreen deathDetails={deathDetails} stats={stats} onRetry={onRetry} onNewGame={onNewGame} />
            )}
            {kind === 'sliced' && (
                <SlicedDeathScreen deathDetails={deathDetails} stats={stats} onRetry={onRetry} onNewGame={onNewGame} />
            )}
            <style>{`
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
