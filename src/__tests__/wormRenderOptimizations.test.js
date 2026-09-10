import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeStepHistory, shPush, shAt, makeStepPathCursor, resetStepPathCursor, advanceStepPathCursor, shTrimTo, shReset } from '../worm/circularBuffers.js';
import { makeCubies, healSticker, isSurfaceSticker } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { resetManifoldMap } from '../game/manifoldMapStore.js';
import { buildTunnelLookup } from '../worm/wormLogic.js';
import { getWormTunnelSnapshot, resetWormTunnelSnapshots } from '../worm/tunnelSnapshot.js';

beforeEach(() => {
    resetManifoldMap();
    resetWormTunnelSnapshots();
});

describe('direct body path reads', () => {
    it('preserves the old head-plus-history sequence through wrap, trim and reset', () => {
        const history = makeStepHistory(7);
        const head = { pos: new THREE.Vector3(99, 1, 0) };
        const cursor = makeStepPathCursor();
        const normal = new THREE.Vector3(0, 0, 1);
        for (let n = 0; n < 20; n++) {
            shPush(history, new THREE.Vector3(n, 0, 0), normal, n, 0, 0);
            for (let reach = 0; reach <= history.count; reach++) {
                const oldPath = [head];
                for (let i = 0; i < reach; i++) oldPath.push(shAt(history, i));
                resetStepPathCursor(cursor, history, head);
                for (let i = 0; i < oldPath.length; i++) {
                    expect(cursor.a).toBe(oldPath[i]);
                    if (i < reach) expect(cursor.b).toBe(oldPath[i + 1]);
                    advanceStepPathCursor(cursor);
                }
            }
        }
        shTrimTo(history, 3);
        resetStepPathCursor(cursor, history, head);
        for (let i = 0; i < 3; i++) advanceStepPathCursor(cursor);
        expect(cursor.a.pos.x).toBe(17);
        expect(cursor.b).toBeNull();
        // Rotation bakes mutate history records; direct reads must see that mutation.
        shAt(history, 0).pos.set(5, 6, 7);
        resetStepPathCursor(cursor, history, head);
        expect(cursor.b.pos.toArray()).toEqual([5, 6, 7]);
        shReset(history);
        resetStepPathCursor(cursor, history, head);
        expect(cursor.a).toBe(head);
        expect(cursor.b).toBeNull();
        shPush(history, head.pos, normal, -1, -1, -1);
        resetStepPathCursor(cursor, history, head);
        expect(cursor.b.tx).toBe(-1);
    });
});

function sortedEntries(map) {
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function expectedPositions(cubies, size, lookup) {
    const positions = [];
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) {
        for (const [dirKey, st] of Object.entries(cubies[x][y][z].stickers)) {
            if (st.curr !== st.orig && isSurfaceSticker(x, y, z, dirKey, size)) {
                const key = `${x},${y},${z},${dirKey}`;
                positions.push([key, st.curr, lookup.get(key)?.tunnelKey ?? null]);
            }
        }
    }
    return positions.sort(([a], [b]) => a.localeCompare(b));
}

function checkSnapshot(cubies, size, epoch) {
    const snapshot = getWormTunnelSnapshot(cubies, size, epoch);
    const full = buildTunnelLookup(cubies, size, buildManifoldGridMap(cubies, size));
    expect(sortedEntries(snapshot.lookup)).toEqual(sortedEntries(full));
    expect(snapshot.positions.map(p => [p.key, p.faceId, p.tunnelKey])
        .sort(([a], [b]) => a.localeCompare(b))).toEqual(expectedPositions(cubies, size, full));
    expect(snapshot.tunnels).toEqual([...snapshot.lookup.values()].filter(hit => !hit.reversed));
    expect(getWormTunnelSnapshot(cubies, size, epoch)).toBe(snapshot);
    return snapshot;
}

describe('shared committed tunnel snapshots', () => {
    for (const size of [3, 5, 15]) {
        it(`matches full rebuilds across flips, heals and rotations at size ${size}`, () => {
            let cube = makeCubies(size);
            let epoch = 0;
            const empty = checkSnapshot(cube, size, epoch);
            expect(empty.positions).toHaveLength(0);
            for (let i = 0; i < 12; i++) {
                const before = getWormTunnelSnapshot(cube, size, epoch);
                const savedEntries = sortedEntries(before.lookup);
                const x = i % size, y = Math.floor(i / size) % size;
                // Flip then restore parity: no timers, and every snapshot is current.
                for (let flip = 0; flip < 2; flip++) {
                    cube = flipStickerPair(cube, size, x, y, size - 1, 'PZ', buildManifoldGridMap(cube, size));
                    checkSnapshot(cube, size, epoch);
                }
                expect(sortedEntries(before.lookup)).toEqual(savedEntries);
                if (i % 3 === 0) {
                    cube = rotateSliceCubies(cube, size, 'row', y, i % 2 ? 1 : -1);
                    checkSnapshot(cube, size, ++epoch);
                }
            }
            expect(empty.lookup.size).toBe(0);
            expect(empty.positions).toHaveLength(0);
        });
    }

    it('keeps orphan flipped stickers visible without inventing a tunnel', () => {
        const cube = makeCubies(3);
        const sticker = cube[0][0][2].stickers.PZ;
        sticker.curr = 4;
        const snapshot = checkSnapshot(cube, 3, 0);
        expect(snapshot.positions.some(p => p.key === '0,0,2,PZ')).toBe(true);
    });

    it('reuses geometry between snapshots and handles size changes', () => {
        let cube = makeCubies(3);
        cube = flipStickerPair(cube, 3, 0, 0, 2, 'PZ', buildManifoldGridMap(cube, 3));
        const first = checkSnapshot(cube, 3, 0);
        cube = flipStickerPair(cube, 3, 1, 1, 2, 'PZ', buildManifoldGridMap(cube, 3));
        const second = checkSnapshot(cube, 3, 0);
        const key = first.positions[0].key;
        expect(second.positions.find(p => p.key === key).wp).toBe(first.positions[0].wp);
        checkSnapshot(makeCubies(5), 5, 1);
    });
});


describe('one-sided tunnel invalidation', () => {
    for (const endpoint of ['entry', 'exit']) {
        it(`rebuilds both endpoints when only ${endpoint} is healed`, () => {
            let cube = makeCubies(3);
            cube = flipStickerPair(cube, 3, 0, 0, 2, 'PZ', buildManifoldGridMap(cube, 3));
            const before = checkSnapshot(cube, 3, 0);
            const previousEntries = sortedEntries(before.lookup);
            const tunnel = before.tunnels[0].tunnel;
            const a = tunnel[endpoint];
            const b = tunnel[endpoint === 'entry' ? 'exit' : 'entry'];
            const healedA = healSticker(cube, 3, a.x, a.y, a.z, a.dirKey);
            expect(healedA[b.x][b.y][b.z]).toBe(cube[b.x][b.y][b.z]);
            const partial = checkSnapshot(healedA, 3, 0);
            // Full rebuild still resolves a pair from the remaining flipped mouth.
            expect(partial.lookup.size).toBe(2);
            expect(partial.positions).toHaveLength(1);
            expect(sortedEntries(before.lookup)).toEqual(previousEntries);
            const healedB = healSticker(healedA, 3, b.x, b.y, b.z, b.dirKey);
            const cleared = checkSnapshot(healedB, 3, 0);
            expect(cleared.lookup.size).toBe(0);
            expect(cleared.positions).toHaveLength(0);
            expect(partial.lookup.size).toBe(2);
        });
    }

    it('preserves other pairs sharing a cubie during successive one-sided heals', () => {
        let cube = makeCubies(3);
        for (const dir of ['PX', 'PY', 'PZ']) {
            cube = flipStickerPair(cube, 3, 2, 2, 2, dir, buildManifoldGridMap(cube, 3));
        }
        const initial = checkSnapshot(cube, 3, 0);
        const mouths = initial.tunnels.flatMap(hit => [hit.tunnel.entry, hit.tunnel.exit]);
        // Heal every mouth independently, checking the entire lookup each time.
        for (const mouth of mouths) {
            cube = healSticker(cube, 3, mouth.x, mouth.y, mouth.z, mouth.dirKey);
            checkSnapshot(cube, 3, 0);
        }
        expect(getWormTunnelSnapshot(cube, 3, 0).lookup.size).toBe(0);
        expect(initial.lookup.size).toBe(6);
    });
});
