import { Vector3 } from 'three';
import { shAt } from '../circularBuffers.js';
import { BODY_BALL_SPACING, DIR_FORWARD, FACE_NORMALS, WORM_LIFT } from './constants.js';

export const WIGGLE_DURATION = 2.4;
// Equal speed legs, eased at each reversal: center, left, right, left, right, center.
const TIMES = [0, 1 / 8, 3 / 8, 5 / 8, 7 / 8, 1];
const OFFSETS = [0, -3, 3, -3, 3, 0];
export function wiggleOffset(elapsed) {
    const t = Math.max(0, Math.min(1, elapsed / WIGGLE_DURATION));
    let leg = 0;
    while (leg < 4 && t > TIMES[leg + 1]) leg++;
    const u = (t - TIMES[leg]) / (TIMES[leg + 1] - TIMES[leg]);
    return OFFSETS[leg] + (OFFSETS[leg + 1] - OFFSETS[leg]) * (1 - Math.cos(Math.PI * u)) / 2;
}
export function makeWiggleSweep(sim) {
    const normal = FACE_NORMALS[sim.pos.dirKey].clone();
    const forward = new Vector3().fromArray(DIR_FORWARD[sim.pos.dirKey][sim.moveDir]);
    const right = new Vector3().crossVectors(forward, normal).normalize();
    const points = [sim.headInterpPos.clone().addScaledVector(normal, WORM_LIFT)];
    const reach = Math.max(BODY_BALL_SPACING, (sim.tailLength - 1) * BODY_BALL_SPACING);
    const distances = [0];
    let length = 0;
    for (let i = 0; i < sim.stepHistory.count && length < reach; i++) {
        const p = shAt(sim.stepHistory, i).pos;
        const previous = points[points.length - 1];
        const distance = previous.distanceTo(p);
        if (distance < 0.0001) continue;
        const used = Math.min(distance, reach - length);
        points.push(previous.clone().lerp(p, used / distance));
        length += used; distances.push(length);
    }
    if (length < reach) {
        points.push(points[points.length - 1].clone().addScaledVector(forward, -(reach - length)));
        distances.push(reach);
    }
    return { points, distances, length: reach, right, normal, elapsed: 0, offset: 0, dirKey: sim.pos.dirKey };
}
// Shared geometry for drawing and pickup contacts. Head is anchored; tail reaches ±3 tiles.
export function wigglePointInto(out, sweep, fraction, offset = sweep.offset) {
    const distance = fraction * sweep.length;
    let low = 1, high = sweep.distances.length - 1;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (sweep.distances[mid] < distance) low = mid + 1;
        else high = mid;
    }
    const i = low;
    const a = sweep.distances[i - 1], b = sweep.distances[i];
    out.lerpVectors(sweep.points[i - 1], sweep.points[i], b > a ? (distance - a) / (b - a) : 0);
    return out.addScaledVector(sweep.right, offset * fraction * fraction);
}
