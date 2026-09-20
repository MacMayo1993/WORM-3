import { Quaternion, Vector3 } from 'three';
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
export function makeWiggleSweep(sim, size) {
    const normal = FACE_NORMALS[sim.pos.dirKey].clone();
    const forward = new Vector3().fromArray(DIR_FORWARD[sim.pos.dirKey][sim.moveDir]);
    const right = new Vector3().crossVectors(forward, normal).normalize();
    const points = [sim.headInterpPos.clone().addScaledVector(normal, WORM_LIFT)];
    const reach = Math.max(BODY_BALL_SPACING, (sim.tailLength - 1) * BODY_BALL_SPACING);
    const distances = [0], normals = [normal.clone()], sides = [right.clone()];
    const turn = new Quaternion();
    let length = 0;
    for (let i = 0; i < sim.stepHistory.count && length < reach; i++) {
        const sample = shAt(sim.stepHistory, i);
        const p = sample.pos;
        const previous = points[points.length - 1];
        const distance = previous.distanceTo(p);
        if (distance < 0.0001) continue;
        const used = Math.min(distance, reach - length);
        points.push(previous.clone().lerp(p, used / distance));
        const nextNormal = sample.normal.clone().normalize();
        turn.setFromUnitVectors(normals.at(-1), nextNormal);
        sides.push(sides.at(-1).clone().applyQuaternion(turn).normalize());
        normals.push(nextNormal);
        length += used; distances.push(length);
    }
    if (length < reach) {
        points.push(points[points.length - 1].clone().addScaledVector(forward, -(reach - length)));
        distances.push(reach);
        normals.push(normals.at(-1).clone()); sides.push(sides.at(-1).clone());
    }
    // Smooth the transported frame over distance, not history sample count.
    // Dense corner samples must not make a sharp hinge in the wiping body.
    for (let i = 1; i < sides.length; i++) {
        const weight = 1 - Math.exp(-(distances[i] - distances[i - 1]) / 0.65);
        sides[i].lerpVectors(sides[i - 1], sides[i], weight);
    }
    for (let i = sides.length - 2; i >= 0; i--) {
        const weight = 1 - Math.exp(-(distances[i + 1] - distances[i]) / 0.65);
        sides[i].lerpVectors(sides[i + 1], sides[i], weight);
    }
    for (const side of sides) side.normalize();
    return { points, distances, normals, sides, size, phase: sim.timeAlive * 8, length: reach, right, normal, elapsed: 0, offset: 0, dirKey: sim.pos.dirKey };
}
// Shared geometry for drawing and pickup contacts. The ±3 tile offset is
// mapped onto the cube surface, with the head anchored.
const side = new Vector3();
// Local frames are parallel-transported down the saved route. Never apply the
// head's face direction to a section wrapped around a different face.
export function wigglePointInto(out, sweep, fraction, offset = sweep.offset, elapsed = sweep.elapsed) {
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
    const u = b > a ? (distance - a) / (b - a) : 0;
    side.lerpVectors(sweep.sides[i - 1], sweep.sides[i], u).normalize();
    const envelope = Math.sin(Math.PI * Math.min(1, Math.max(0, elapsed / WIGGLE_DURATION)));
    const wave = 0.26 * Math.sin(distance * 3 - sweep.phase - elapsed * 8) * Math.sin(Math.PI * fraction) * envelope;
    out.addScaledVector(side, offset * fraction * fraction + wave);
    // A continuous radial surface map carries the offset across cube edges.
    // It cannot switch faces discontinuously or pull wrapped sections inside.
    if (sweep.size && fraction > 0) {
        const radius = Math.max(Math.abs(out.x), Math.abs(out.y), Math.abs(out.z));
        if (radius > 1e-8) out.multiplyScalar((sweep.size / 2 + WORM_LIFT) / radius);
    }
    return out;
}
