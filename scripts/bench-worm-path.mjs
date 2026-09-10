// CPU microbenchmark for the copied vs direct body-history path. This isolates
// history access; it does not measure Three.js rendering or gameplay frame rate.
import { performance } from 'node:perf_hooks';
import { strict as assert } from 'node:assert';
import { Vector3 } from 'three';
import { makeStepHistory, shPush, shAt, makeStepPathCursor, resetStepPathCursor, advanceStepPathCursor } from '../src/worm/circularBuffers.js';

const history = makeStepHistory(60000);
const point = new Vector3();
const normal = new Vector3(0, 0, 1);
for (let i = 0; i < history.capacity + 37; i++) {
    point.set(i * 0.02, 0, 0);
    shPush(history, point, normal, 0, 0, 0);
}
const head = { pos: point.clone().addScalar(0.001) };
const buffer = [];
const cursor = makeStepPathCursor();
let sink = 0;
function frame(tailLength, direct) {
    const count = Math.min(history.count, Math.ceil(tailLength * 0.09 * 50 * 2) + 100);
    if (!direct) {
        buffer.length = count + 1;
        buffer[0] = head;
        for (let i = 0; i < count; i++) buffer[i + 1] = shAt(history, i);
    }
    if (direct) resetStepPathCursor(cursor, history, head);
    let walk = 0, cumulative = 0, checksum = 0;
    for (let segment = 1; segment < tailLength; segment++) {
        const lod = segment < 200 ? 1 : segment < 600 ? 2 : 4;
        if (segment % lod !== 0) continue;
        const target = segment * 0.09;
        while (walk < count) {
            const a = direct ? cursor.a : buffer[walk];
            const b = direct ? cursor.b : buffer[walk + 1];
            const distance = a.pos.distanceTo(b.pos);
            if (cumulative + distance >= target) {
                checksum += a.pos.x + (b.pos.x - a.pos.x) * ((target - cumulative) / distance);
                break;
            }
            cumulative += distance;
            walk++;
            if (direct) advanceStepPathCursor(cursor);
        }
    }
    return checksum;
}
function measure(length, direct) {
    const start = performance.now();
    for (let i = 0; i < 1500; i++) sink += frame(length, direct);
    return (performance.now() - start) / 1500;
}
for (const length of [4, 200, 1200]) {
    assert.equal(frame(length, true), frame(length, false));
    for (let i = 0; i < 500; i++) { frame(length, false); frame(length, true); }
    const copied = [], direct = [];
    for (let i = 0; i < 7; i++) {
        // Alternate order to reduce warmup/order bias.
        if (i % 2) { direct.push(measure(length, true)); copied.push(measure(length, false)); }
        else { copied.push(measure(length, false)); direct.push(measure(length, true)); }
    }
    const median = values => values.sort((a, b) => a - b)[3];
    const a = median(copied), b = median(direct);
    console.log(`${length} segments: copied=${a.toFixed(4)} ms, direct=${b.toFixed(4)} ms, ratio=${(b / a).toFixed(2)}`);
}
assert.ok(Number.isFinite(sink));
