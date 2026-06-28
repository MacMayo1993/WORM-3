import * as THREE from 'three';

// ─── Step History Circular Buffer ────────────────────────────────────────────
// Pre-allocated ring of {pos, normal} objects — eliminates per-step Vector3
// allocations and O(N) unshift that grows to 60 000 elements at MAX_TAIL.
// Each slot also carries the grid cell (tx,ty,tz) the point sits in, so the body
// can ride a mid-rotation slice (and bake the turn at commit) without snapping.
export function makeStepHistory(capacity) {
    return {
        buf: Array.from({ length: capacity }, () => ({ pos: new THREE.Vector3(), normal: new THREE.Vector3(), tx: -1, ty: -1, tz: -1 })),
        head: 0,   // next write slot; newest entry is at (head-1+capacity)%capacity
        count: 0,
        capacity,
    };
}
export function shPush(sh, pos, normal, tx, ty, tz) {
    const slot = sh.buf[sh.head];
    slot.pos.copy(pos);
    slot.normal.copy(normal);
    slot.tx = tx;
    slot.ty = ty;
    slot.tz = tz;
    sh.head = (sh.head + 1) % sh.capacity;
    if (sh.count < sh.capacity) sh.count++;
}
// i=0 → newest, i=count-1 → oldest
export function shAt(sh, i) {
    return sh.buf[(sh.head - 1 - i + sh.capacity) % sh.capacity];
}
export function shTrimTo(sh, maxCount) {
    if (maxCount < sh.count) sh.count = maxCount;
}
export function shReset(sh) { sh.head = 0; sh.count = 0; }

// ─── Tile Trail Circular Buffer ───────────────────────────────────────────────
// O(1) push replaces the O(N) unshift on a 1 200-entry string array.
export function makeTileTrail(capacity) {
    return {
        buf: new Array(capacity).fill(''),
        seq: new Float64Array(capacity), // monotonic lay-down order per slot — anchors the painted trail wave in place
        nextSeq: 0,
        head: 0,   // head is the slot of index-0 (newest entry)
        count: 0,
        capacity,
    };
}
// Push new key as newest (index 0). Ring automatically evicts oldest when full.
export function ttPush(tt, key) {
    tt.head = (tt.head - 1 + tt.capacity) % tt.capacity;
    tt.buf[tt.head] = key;
    tt.seq[tt.head] = tt.nextSeq++;
    if (tt.count < tt.capacity) tt.count++;
}
// i=0 → newest (current tile), i=count-1 → oldest
export function ttAt(tt, i) { return tt.buf[(tt.head + i) % tt.capacity]; }
export function ttTrimTo(tt, maxCount) { if (maxCount < tt.count) tt.count = maxCount; }
export function ttReset(tt, initialKey) { tt.head = 0; tt.buf[0] = initialKey; tt.seq[0] = 0; tt.nextSeq = 1; tt.count = 1; }
// Transform every key in place (used when cube rotates to re-encode tile coords).
export function ttMapInPlace(tt, fn) {
    for (let i = 0; i < tt.count; i++) {
        const idx = (tt.head + i) % tt.capacity;
        tt.buf[idx] = fn(tt.buf[idx]);
    }
}
// Keep only entries matching predicate, compacting the ring (rare: tunnel entry).
export function ttFilterInPlace(tt, fn) {
    let keep = 0;
    for (let i = 0; i < tt.count; i++) {
        const src = (tt.head + i) % tt.capacity;
        if (fn(tt.buf[src])) {
            const dst = (tt.head + keep) % tt.capacity;
            if (dst !== src) { tt.buf[dst] = tt.buf[src]; tt.seq[dst] = tt.seq[src]; }
            keep++;
        }
    }
    tt.count = keep;
}
