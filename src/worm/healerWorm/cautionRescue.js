import * as THREE from 'three';
import { raisedPlatformPosition, usesRaisedPlatforms } from './raisedPlatforms.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { liveRotation } from '../liveRotation.js';
import { isTileInSlice } from '../wormLogic.js';
import { FACE_NORMALS, DIR_FORWARD, WORM_LIFT } from './constants.js';
import { shPush } from '../circularBuffers.js';

export const CAUTION_FALL_SECONDS = 3.4;
export const CAUTION_DISSOLVE_START = 1.7;
export const CAUTION_PULL_SECONDS = 0.65;
export const CAUTION_DISSOLVE_END = 3.2;

// The fence belongs to the whole raised cubie, including its ordinary corner
// faces. Query the same live platform/burrow rules used by jumps, rather than
// treating every colour mismatch as an open hole.
export function cautionEntry(sim, next, size, ctx) {
    if (!next || !usesRaisedPlatforms(ctx) || !['active', 'finalHealing'].includes(ctx.getGamePhase()) ||
        sim.isJumping || sim.padFlight || sim.onRaisedPlatform || sim.raisedDeparture ||
        sim.rocketActive || sim.landingGraceT > 0 || sim.restRead || sim.signature.sweep ||
        (sim.signature.character === 'inch' && sim.signature.active > 0)) return null;
    // A moving destination is read at commit by the crossing system. Never
    // turn the outgoing cubie's opening into an invisible obstacle.
    if (liveRotation.active && liveRotation.sliceIndices.some(layer =>
        isTileInSlice(liveRotation.axis, layer, sim.pos.x, sim.pos.y, sim.pos.z) ||
        isTileInSlice(liveRotation.axis, layer, next.x, next.y, next.z))) return null;
    if (!raisedPlatformPosition(next, size, ctx) || raisedPlatformPosition(sim.pos, size, ctx)) return null;
    return { tile: { x: next.x, y: next.y, z: next.z, dirKey: next.dirKey } };
}

export function makeCautionFall(sim, tile, size) {
    const normal = FACE_NORMALS[tile.dirKey].clone();
    const mouth = new THREE.Vector3().fromArray(getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, sim.expansionAmount));
    const start = sim.headInterpPos.clone().addScaledVector(sim.currentNormal, WORM_LIFT);
    const approach = mouth.clone().sub(start).projectOnPlane(normal).normalize();
    if (approach.lengthSq() < 1e-8) approach.fromArray(DIR_FORWARD[tile.dirKey].up);
    return { tile, elapsed: 0, sample: 0, start, mouth, normal, approach,
        startNormal: sim.currentNormal.clone(), forward: approach.clone(),
        depth: Math.min(2.2, size * 0.65), dissolve: 0 };
}

// Pull over the edge, then drop well below the shell before dissolving. The
// camera looks down the same cleared shaft, so the descent stays visible.
// The same history draws the tail along the head's route on every cube face.
export function cautionFallPoint(out, fall, elapsed) {
    const glide = THREE.MathUtils.smoothstep(elapsed, 0, CAUTION_PULL_SECONDS);
    out.copy(fall.start).lerp(fall.mouth, glide);
    const drop = THREE.MathUtils.smoothstep(elapsed, 0.55, 2.9);
    // A small lift brings the head into the tape, without reading as a rescue jump.
    const tug = 0.15 * Math.sin(Math.PI * glide);
    return out.addScaledVector(fall.normal, WORM_LIFT * glide + tug - fall.depth * drop);
}

const point = new THREE.Vector3(), before = new THREE.Vector3(), normal = new THREE.Vector3();
export function tickCautionFall(sim, delta) {
    const fall = sim.cautionFall;
    fall.elapsed = Math.min(CAUTION_FALL_SECONDS, fall.elapsed + Math.min(0.05, Math.max(0, delta)));
    // Fixed presentation samples keep the whole body on one continuous route,
    // independently of frame rate. Gameplay clocks do not advance here.
    while (fall.sample / 120 <= fall.elapsed) {
        const t = fall.sample++ / 120;
        cautionFallPoint(point, fall, t);
        normal.copy(fall.startNormal).lerp(fall.approach, THREE.MathUtils.smoothstep(t, 0.55, 1.2)).normalize();
        shPush(sim.stepHistory, point, normal, -1, -1, -1, true);
    }
    cautionFallPoint(sim.headInterpPos, fall, fall.elapsed);
    cautionFallPoint(before, fall, Math.max(0, fall.elapsed - 1 / 120));
    fall.forward.subVectors(sim.headInterpPos, before);
    if (fall.forward.lengthSq() < 1e-9) fall.forward.copy(fall.normal).negate();
    fall.forward.normalize();
    sim.currentNormal.copy(normal);
    fall.dissolve = THREE.MathUtils.clamp((fall.elapsed - CAUTION_DISSOLVE_START) /
        (CAUTION_DISSOLVE_END - CAUTION_DISSOLVE_START), 0, 1);
    return fall.elapsed >= CAUTION_FALL_SECONDS;
}
