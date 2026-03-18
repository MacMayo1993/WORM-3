// Module-level cache: cube sizes only range 2–5, so this is at most 4 entries.
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

export function randomFreeTile(size, exclude) {
    const all = getAllSurfaceTiles(size);
    const excludeKeys = new Set(exclude.map((e) => `${e.x},${e.y},${e.z},${e.dirKey}`));
    const free = all.filter((t) => !excludeKeys.has(`${t.x},${t.y},${t.z},${t.dirKey}`));
    const pool = free.length > 0 ? free : all;
    return pool[Math.floor(Math.random() * pool.length)];
}

export function randomUnflippedTile(cubies, size, exclude = []) {
    const all = getAllSurfaceTiles(size);
    const excludeKeys = new Set(exclude.map((e) => `${e.x},${e.y},${e.z},${e.dirKey}`));
    const pool = all.filter((t) => {
        if (excludeKeys.has(`${t.x},${t.y},${t.z},${t.dirKey}`)) return false;
        const st = cubies?.[t.x]?.[t.y]?.[t.z]?.stickers?.[t.dirKey];
        return !!st && st.curr === st.orig;
    });
    const pickFrom = pool.length > 0 ? pool : all;
    return pickFrom[Math.floor(Math.random() * pickFrom.length)];
}
