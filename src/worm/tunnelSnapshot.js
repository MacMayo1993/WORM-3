// Shared derived state for committed cubes. Readers treat snapshots as immutable:
// publishing a new snapshot must never mutate a lookup retained by a renderer.
import { getManifoldMap } from '../game/manifoldMapStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { buildTunnelLookup, updateTunnelLookupIncremental } from './wormLogic.js';
import { FACE_NORMALS } from './healerWorm/constants.js';

let snapshots = new WeakMap();
let latest = null;
const surfaceBySize = new Map();

function surfaceCells(size) {
    if (surfaceBySize.has(size)) return surfaceBySize.get(size);
    const cells = [];
    // Enumerate exactly 6*size² stickers, including each distinct corner face.
    // Rest positions/normals depend on grid geometry, not on flip state.
    for (const dirKey of ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ']) {
        for (let a = 0; a < size; a++) {
            for (let b = 0; b < size; b++) {
                const edge = dirKey[0] === 'P' ? size - 1 : 0;
                const [x, y, z] = dirKey[1] === 'X' ? [edge, a, b]
                    : dirKey[1] === 'Y' ? [a, edge, b] : [a, b, edge];
                cells.push({ x, y, z, dirKey, key: `${x},${y},${z},${dirKey}`,
                    wp: getStickerWorldPos(x, y, z, dirKey, size, 0),
                    normal: FACE_NORMALS[dirKey] });
            }
        }
    }
    surfaceBySize.set(size, cells);
    return cells;
}

export function getWormTunnelSnapshot(cubies, size, epoch) {
    const cached = snapshots.get(cubies);
    if (cached && cached.size === size && cached.epoch === epoch) return cached;
    const geometry = getManifoldMap(cubies, size, epoch);
    // The geometry owner deliberately survives flips, so its embedded sticker
    // references can be old. Resolve payloads from this committed snapshot while
    // retaining its O(1) grid-ID lookup; never mutate the shared geometry map.
    const map = {
        get(id) {
            const loc = geometry.get(id);
            if (!loc) return undefined;
            const sticker = cubies[loc.x]?.[loc.y]?.[loc.z]?.stickers?.[loc.dirKey];
            return sticker ? { ...loc, sticker } : undefined;
        },
    };
    const canIncrement = latest && latest.size === size && latest.epoch === epoch;
    // Copy only the small endpoint map; the incremental updater mutates its input.
    const lookup = canIncrement
        ? updateTunnelLookupIncremental(new Map(latest.lookup), cubies, latest.cubies, size, map)
        : buildTunnelLookup(cubies, size, map);
    const tunnels = [];
    for (const hit of lookup.values()) if (!hit.reversed) tunnels.push(hit);
    const positions = [];
    for (const cell of surfaceCells(size)) {
        const sticker = cubies[cell.x]?.[cell.y]?.[cell.z]?.stickers?.[cell.dirKey];
        if (!sticker || sticker.curr === sticker.orig) continue;
        positions.push({ ...cell, faceId: sticker.curr,
            tunnelKey: lookup.get(cell.key)?.tunnelKey ?? null });
    }
    const snapshot = { size, epoch, lookup, tunnels, positions };
    snapshots.set(cubies, snapshot);
    latest = { ...snapshot, cubies };
    return snapshot;
}

// Useful on teardown/tests. Weak keys otherwise retire discarded cube snapshots.
export function resetWormTunnelSnapshots() {
    snapshots = new WeakMap();
    latest = null;
    surfaceBySize.clear();
}
