// src/worm/DeathEmblem.jsx
// The picture on a death screen's badge: one bold, outlined emblem per cause,
// drawn like a sticker (white face, ink outline, the cause's deep shade for
// detail) so it reads on the badge's saturated colour at any size. Each one has a
// small looping motion of its own (deathScreen.css): the tile halves slide along
// the cut, the blast throbs, the bolt flickers, the head sinks into the hole.
// Motion is CSS only and stops under reduced motion.
import React, { useId } from 'react';

const INK = '#17201b';

/** A worm head knocked out: white bead, ink outline, crossed-out eyes. */
function DeadHead({ cx, cy, r }) {
    const e = r * 0.36, s = r * 0.17;
    const cross = (x, y) => `M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}`;
    return (
        <g>
            <circle className="de-w" cx={cx} cy={cy} r={r} />
            <path className="de-line de-thin" d={`${cross(cx - e, cy - r * 0.12)}${cross(cx + e, cy - r * 0.12)}`} />
            <path className="de-line de-thin" d={`M${cx - r * 0.3} ${cy + r * 0.42}Q${cx} ${cy + r * 0.22} ${cx + r * 0.3} ${cy + r * 0.42}`} />
        </g>
    );
}

function star(cx, cy, points, outer, inner, twist = 0) {
    let d = '';
    for (let i = 0; i < points * 2; i++) {
        const a = twist + (i * Math.PI) / points;
        const r = i % 2 ? inner : outer;
        d += `${i ? 'L' : 'M'}${(cx + Math.sin(a) * r).toFixed(1)} ${(cy - Math.cos(a) * r).toFixed(1)}`;
    }
    return `${d}Z`;
}

function Sliced({ uid }) {
    // A 3×3 face cut along a diagonal; the halves slide apart along the cut.
    const top = '26,26 94,26 94,46.7 26,73.3', bottom = '26,73.3 94,46.7 94,94 26,94';
    const grid = 'M48.7 26V94M71.3 26V94M26 48.7H94M26 71.3H94';
    return (
        <>
            <defs>
                <clipPath id={`${uid}-t`}><polygon points={top} /></clipPath>
                <clipPath id={`${uid}-b`}><polygon points={bottom} /></clipPath>
            </defs>
            <g className="de-sl-top">
                <polygon className="de-w" points={top} />
                <path className="de-grid" d={grid} clipPath={`url(#${uid}-t)`} />
                <polygon className="de-line" points={top} />
            </g>
            <g className="de-sl-bot">
                <polygon className="de-d" points={bottom} />
                <path className="de-grid de-grid-light" d={grid} clipPath={`url(#${uid}-b)`} />
                <polygon className="de-line" points={bottom} />
            </g>
            <path className="de-slash" d="M8 80 112 40" />
        </>
    );
}

function Blasted() {
    return (
        <g className="de-burst">
            <path className="de-hot" d={star(60, 60, 11, 54, 33)} />
            <path className="de-w" d={star(60, 60, 8, 32, 19, 0.3)} />
            <circle className="de-k" cx="60" cy="60" r="9" />
            <circle className="de-k de-debris" cx="18" cy="20" r="4" />
            <circle className="de-k de-debris" cx="104" cy="98" r="5" />
            <circle className="de-k de-debris" cx="104" cy="22" r="3" />
        </g>
    );
}

function Fallen({ uid }) {
    return (
        <>
            <defs><clipPath id={`${uid}-hole`}><rect x="0" y="0" width="120" height="92" /></clipPath></defs>
            <g className="de-tape">
                <path className="de-tape-band" d="M-6 40 126 18 126 34-6 56Z" />
                <path className="de-tape-stripe" d="M10 37 22 35 14 51 2 53ZM38 33 50 31 42 47 30 49ZM66 28 78 26 70 42 58 44ZM94 23 106 21 98 37 86 39Z" />
            </g>
            <ellipse className="de-k" cx="60" cy="94" rx="40" ry="12" />
            <g clipPath={`url(#${uid}-hole)`}>
                <g className="de-sink"><DeadHead cx={60} cy={72} r={22} /></g>
            </g>
            <path className="de-line" d="M20 94a40 12 0 0 0 80 0" />
        </>
    );
}

function TimeUp() {
    return (
        <g className="de-ring">
            <rect className="de-d" x="51" y="8" width="18" height="12" rx="4" />
            <path className="de-line" d="M88 30 96 22" />
            <circle className="de-w" cx="60" cy="66" r="42" />
            <path className="de-d" d="M60 66V32A34 34 0 0 1 94 66Z" />
            <path className="de-line de-thin" d="M60 28v6M98 66h-6M60 104v-6M22 66h6" />
            <path className="de-hand" d="M60 66V36" />
            <circle className="de-k" cx="60" cy="66" r="6" />
        </g>
    );
}

function Struck() {
    return (
        <>
            <path className="de-spark" d="M20 30 32 40M100 86 110 96M16 92 30 86M102 30 92 40" />
            <path className="de-bolt" d="M70 6 26 66H56L44 114 96 48H66L84 6Z" />
        </>
    );
}

// The worm curled round in a ring of beads, its head clamped on its own tail.
const TAIL_RING = Array.from({ length: 12 }, (_, i) => {
    const a = (-48 - i * 26.5) * (Math.PI / 180);
    return { x: 60 + Math.cos(a) * 36, y: 60 + Math.sin(a) * 36, r: 12.5 - i * 0.7 };
}).reverse();

function TailBite() {
    return (
        <g className="de-spin">
            {TAIL_RING.map((b, i) => <circle key={i} className="de-w" cx={b.x.toFixed(1)} cy={b.y.toFixed(1)} r={b.r} />)}
            <DeadHead cx={60 + Math.cos(-0.35) * 36} cy={60 + Math.sin(-0.35) * 36} r={17} />
        </g>
    );
}

function EventHorizon() {
    return (
        <>
            <circle className="de-k" cx="60" cy="60" r="48" />
            <g className="de-spin de-spin-fast">
                <path className="de-swirl" d="M60 60c0-8 10-10 14-4 6 9-4 22-16 21-16-1-24-18-16-32 10-17 36-17 47 1 12 20 0 46-24 50" />
            </g>
            <circle className="de-w" cx="60" cy="60" r="6" />
        </>
    );
}

function Overrun() {
    return (
        <g className="de-shake">
            <path className="de-w" d="M60 10 98 24V58C98 84 80 102 60 112 40 102 22 84 22 58V24Z" />
            <path className="de-d" d="M60 10V112C40 102 22 84 22 58V24Z" />
            <path className="de-line" d="M60 10 98 24V58C98 84 80 102 60 112 40 102 22 84 22 58V24Z" />
            <path className="de-crack" d="M66 8 52 40 70 52 48 80 62 114" />
        </g>
    );
}

function Unknown() {
    return <g className="de-bob"><DeadHead cx={60} cy={62} r={40} /></g>;
}

const EMBLEMS = {
    sliced: Sliced, blasted: Blasted, fallen: Fallen, 'time-up': TimeUp, struck: Struck,
    'tail-bite': TailBite, 'event-horizon': EventHorizon, overrun: Overrun, unknown: Unknown,
};

export default function DeathEmblem({ kind }) {
    const uid = `de${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    const Emblem = EMBLEMS[kind] ?? Unknown;
    return (
        <svg className={`worm-death-emblem is-${kind}`} viewBox="0 0 120 120" aria-hidden="true" focusable="false" style={{ '--de-ink': INK }}>
            <Emblem uid={uid} />
        </svg>
    );
}
