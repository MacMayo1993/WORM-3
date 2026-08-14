// src/worm/healerWorm/specialSpawn.js
//
// Pure spawn rules for the special power-ups: which type comes next, and which tile
// it lands on. Extracted from wormSim for the same reason economy.js was — these are
// the decisions that decide whether the feature feels fair, so they are worth being
// directly unit-testable without driving a whole simulation.
//
// Nothing here reads the store, mutates a sim, or calls Math.random() on its own:
// every random draw goes through an injected `rand`, so tests are deterministic.

import { collectManifoldRing } from '../wormLogic.js';
import { DIR_FORWARD } from './constants.js';
import { BUFF_TYPES } from './specialDefs.js';

export const tileKeyOf = (t) => `${t.x},${t.y},${t.z},${t.dirKey}`;

// ─── Fair type selection ─────────────────────────────────────────────────────
// A plain Math.random() pick produces visible streaks — four magnets in a row is a
// one-in-sixteen event, and players read that as broken. A shuffle bag holding one
// of each type instead spreads the draws evenly.
//
// Each bag holds the two worm buffs (rocket + magnet). Elemental orbs are NOT drawn
// here — they spawn on their own offering track (see spawnElementalOffering in
// wormSim), so this bag only balances how the protective buffs come up. The longest
// possible run of a type is two (tail of one bag, head of the next) and even that is
// suppressed below.

export const makeSpecialPicker = () => ({ bag: [], lastType: null, streak: 0 });

const refillBag = (picker, rand) => {
    const bag = BUFF_TYPES.slice();
    // Fisher-Yates with the injected RNG.
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    // Never let a refill extend a run to three: if the bag would repeat the type
    // that just came up twice, rotate a different type to the front.
    if (bag.length > 1 && picker.streak >= 2 && bag[0] === picker.lastType) {
        const alt = bag.findIndex(t => t !== picker.lastType);
        if (alt !== -1) [bag[0], bag[alt]] = [bag[alt], bag[0]];
    }
    picker.bag = bag;
};

/**
 * Draw the next special type, mutating the picker's bag/streak bookkeeping.
 *
 * @param {object} picker - from makeSpecialPicker()
 * @param {object} [opts]
 * @param {boolean} [opts.magnetUseful] - false when no parity orbs sit inside the
 *   magnet's useful reach, in which case a magnet draw is deferred in favour of
 *   another type (the magnet stays in the bag and comes up next time).
 * @param {() => number} [opts.rand]
 * @returns {string} the chosen type
 */
export function drawSpecialType(picker, { magnetUseful = true, rand = Math.random } = {}) {
    if (picker.bag.length === 0) refillBag(picker, rand);

    let idx = 0;
    if (picker.bag[idx] === 'magnet' && !magnetUseful) {
        const alt = picker.bag.findIndex(t => t !== 'magnet');
        if (alt !== -1) idx = alt;
    }
    // A hard streak cap, independent of the bag: three of the same in a row never ships.
    if (picker.bag[idx] === picker.lastType && picker.streak >= 2) {
        const alt = picker.bag.findIndex(t => t !== picker.lastType);
        if (alt !== -1) idx = alt;
    }

    const [type] = picker.bag.splice(idx, 1);
    picker.streak = type === picker.lastType ? picker.streak + 1 : 1;
    picker.lastType = type;
    return type;
}

/** How many parity orbs sit within `radius` manifold steps of a tile. */
export function countOrbsWithin(powerups, head, size, radius) {
    if (!powerups || powerups.length === 0) return 0;
    const ring = collectManifoldRing(head.x, head.y, head.z, head.dirKey, size, radius);
    let n = 0;
    for (const p of powerups) if (ring.has(tileKeyOf(p))) n++;
    return n;
}

// ─── Spawn placement ─────────────────────────────────────────────────────────

// Score weights. Distance dominates: an orb one step away is claimed before the
// player registers it, and one five steps away is usually behind the camera.
const SCORE_DISTANCE_BAND = 3;   // 2–4 steps from the head — far enough to see, near enough to reach
const SCORE_SAME_FACE = 2;       // on the face the player is currently looking at
const SCORE_AHEAD = 2;           // in front of the worm
const SCORE_SIDE = 1;            // beside it — a turn away
const SCORE_UNFLIPPED = 1;       // not a wormhole mouth
const AHEAD_DOT = 0.3;

/**
 * Score and sort candidate spawn tiles, best first. Pure: no sim, no store.
 *
 * Excluded outright (never returned):
 *   • the head tile, parity orbs, other specials  → `occupiedKeys`
 *   • active wormhole mouths                      → `tunnelKeys`
 *   • tiles the body is currently lying on        → `trailKeys`
 *   • anything inside the worm's live claim reach → `claimRadius`, since an orb
 *     spawned there is swallowed on the same tick it appears
 *
 * @param {object} args
 * @param {Array<{tile: object, dist: number}>} args.candidates - tiles with their
 *   manifold distance from the anchor
 * @param {object} args.head - the worm's head tile
 * @param {string} args.moveDir - the worm's heading ('up'|'down'|'left'|'right')
 * @param {number} args.size
 * @param {Set<string>} [args.occupiedKeys]
 * @param {Set<string>} [args.trailKeys]
 * @param {Set<string>} [args.tunnelKeys]
 * @param {Set<string>} [args.flippedKeys]
 * @param {number} [args.claimRadius] - current pickup reach, in manifold steps
 * @returns {Array<{tile: object, dist: number, score: number}>} sorted best-first
 */
export function rankSpecialSpawnCandidates({
    candidates,
    head,
    moveDir,
    size,
    occupiedKeys = new Set(),
    trailKeys = new Set(),
    tunnelKeys = new Set(),
    flippedKeys = new Set(),
    claimRadius = 0,
}) {
    const k = (size - 1) / 2;
    const fwd = DIR_FORWARD[head?.dirKey]?.[moveDir] ?? null;
    const scored = [];

    for (const { tile, dist } of candidates) {
        const key = tileKeyOf(tile);
        if (occupiedKeys.has(key) || trailKeys.has(key) || tunnelKeys.has(key)) continue;
        if (dist <= claimRadius) continue;

        let score = 0;
        if (dist >= 2 && dist <= 4) score += SCORE_DISTANCE_BAND;
        if (tile.dirKey === head?.dirKey) score += SCORE_SAME_FACE;
        if (!flippedKeys.has(key)) score += SCORE_UNFLIPPED;

        // Ahead / beside / behind, measured against the worm's world heading.
        if (fwd) {
            const dx = tile.x - head.x, dy = tile.y - head.y, dz = tile.z - head.z;
            const len = Math.hypot(dx, dy, dz) || 1;
            const dot = (dx * fwd[0] + dy * fwd[1] + dz * fwd[2]) / len;
            if (dot > AHEAD_DOT) score += SCORE_AHEAD;
            else if (dot >= -AHEAD_DOT) score += SCORE_SIDE;
        }
        // (k is unused for scoring today but keeps the tile-centre maths obvious if
        // a future weight needs true world positions.)
        void k;

        scored.push({ tile, dist, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
}

/**
 * Build the candidate list around `anchor` out to `radius`, recording each tile's
 * manifold distance. Uses expanding rings so distance is exact rather than assumed.
 */
export function buildSpawnCandidates(anchor, size, radius) {
    const candidates = [];
    const seen = collectManifoldRing(anchor.x, anchor.y, anchor.z, anchor.dirKey, size, 0);
    let prev = new Set(seen);
    for (let d = 1; d <= radius; d++) {
        const ring = collectManifoldRing(anchor.x, anchor.y, anchor.z, anchor.dirKey, size, d);
        for (const key of ring) {
            if (prev.has(key)) continue;
            const c1 = key.indexOf(','), c2 = key.indexOf(',', c1 + 1), c3 = key.indexOf(',', c2 + 1);
            candidates.push({
                tile: {
                    x: parseInt(key, 10),
                    y: parseInt(key.substring(c1 + 1), 10),
                    z: parseInt(key.substring(c2 + 1), 10),
                    dirKey: key.substring(c3 + 1),
                },
                dist: d,
            });
        }
        prev = new Set(ring);
    }
    return candidates;
}

/**
 * Choose a spawn tile: rank the neighbourhood, then pick at random among the tiles
 * tied for the best score, so placement stays varied without ever being unfair.
 *
 * Returns null when nothing local is acceptable — callers must defer the spawn
 * rather than falling back to an arbitrary tile, which is what made early specials
 * appear on faces the player could not see.
 */
export function pickSpawnTile(args, rand = Math.random) {
    const ranked = rankSpecialSpawnCandidates(args);
    if (ranked.length === 0) return null;
    const best = ranked[0].score;
    const tied = ranked.filter(r => r.score === best);
    return tied[Math.floor(rand() * tied.length)].tile;
}
