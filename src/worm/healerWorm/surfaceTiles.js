// Module-level cache: cube sizes range 2–7, so this is at most 6 entries.
// Both callers (randomFreeTile, randomUnflippedTile) immediately call .filter() on
// the result, which creates a new array — the cached reference is never mutated.
const _tileCache = new Map();

export function getAllSurfaceTiles(size) {
    if (_tileCache.has(size)) return _tileCache.get(size);
    const tiles = [];
    const faces = [
        ['PX', 'x', size - 1], ['NX', 'x', 0],
        ['PY', 'y', size - 1], ['NY', 'y', 0],
        ['PZ', 'z', size - 1], ['NZ', 'z', 0],
    ];

    for (const [dirKey, axis, val] of faces) {
        for (let a = 0; a < size; a++) {
            for (let b = 0; b < size; b++) {
                const p = { x: 0, y: 0, z: 0 };
                if (axis === 'x') {
                    p.x = val;
                    p.y = a;
                    p.z = b;
                } else if (axis === 'y') {
                    p.x = a;
                    p.y = val;
                    p.z = b;
                } else {
                    p.x = a;
                    p.y = b;
                    p.z = val;
                }
                tiles.push({ ...p, dirKey });
            }
        }
    }

    _tileCache.set(size, tiles);
    return tiles;
}

export function isSurfaceTilePos(p, size) {
    if (!p) return false;
    return p.x === 0 || p.x === size - 1 || p.y === 0 || p.y === size - 1 || p.z === 0 || p.z === size - 1;
}

/**
 * A free surface tile to drop something on.
 *
 * `prefer` biases — never restricts — where it lands. When given a predicate and a
 * bias in [0,1], that fraction of picks come from the free tiles the predicate
 * accepts, and the rest from the whole free pool. The safe lane uses this so orbs
 * accumulate where the next turn cannot reach them without ever making the rest of
 * the board barren, and it degrades to the old uniform pick whenever the preferred
 * subset is empty (no lane armed, or the lane is already full of orbs).
 */
export function randomFreeTile(size, exclude, prefer = null, bias = 0) {
    const all = getAllSurfaceTiles(size);
    const excludeKeys = new Set(exclude.map((e) => `${e.x},${e.y},${e.z},${e.dirKey}`));
    const free = all.filter((t) => !excludeKeys.has(`${t.x},${t.y},${t.z},${t.dirKey}`));
    const pool = free.length > 0 ? free : all;
    if (prefer && bias > 0 && Math.random() < bias) {
        const preferred = pool.filter(prefer);
        if (preferred.length > 0) return preferred[Math.floor(Math.random() * preferred.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Pick a tile to open a new wormhole on: one that is showing its own colour AND
 * has never been flipped.
 *
 * `curr === orig` alone is not enough, and the difference is what put permanently
 * dead tiles on the board. A flip toggles the colour, so a tile that has been
 * flipped an EVEN number of times is showing its original colour again while
 * carrying a flip count — and at FLIP_CAP flips it is dead: flipStickerPair
 * refuses to touch it, so choosing it here spends the spawn interval producing no
 * wormhole at all, silently. Requiring a pristine tile keeps every spawn a real
 * one, and means worm mode can never walk a tile up to the cap in the first place
 * (which is what initWormMode's flipCap of 9999 was always asking for).
 *
 * Returns null when the board has no pristine tile left — the caller simply does
 * not spawn this interval rather than flipping something it should not.
 */
export function randomUnflippedTile(cubies, size, exclude = []) {
    const all = getAllSurfaceTiles(size);
    const excludeKeys = new Set(exclude.map((e) => `${e.x},${e.y},${e.z},${e.dirKey}`));
    const pool = all.filter((t) => {
        if (excludeKeys.has(`${t.x},${t.y},${t.z},${t.dirKey}`)) return false;
        const st = cubies?.[t.x]?.[t.y]?.[t.z]?.stickers?.[t.dirKey];
        return !!st && st.curr === st.orig && (st.flips ?? 0) === 0;
    });
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}
