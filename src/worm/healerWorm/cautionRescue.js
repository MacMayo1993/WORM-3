import * as THREE from 'three';
import { raisedPlatformPosition, usesRaisedPlatforms } from './raisedPlatforms.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { liveRotation } from '../liveRotation.js';
import { isTileInSlice } from '../wormLogic.js';
import { FACE_NORMALS, DIR_FORWARD, WORM_LIFT, WORM_HEAD_RADIUS } from './constants.js';
import { shPush } from '../circularBuffers.js';
import { isPitTile } from './tunnelPits.js';

export const CAUTION_FALL_SECONDS = 3.4;
export const CAUTION_DISSOLVE_START = 1.7;
export const CAUTION_PULL_SECONDS = 0.65;
export const CAUTION_DISSOLVE_END = 3.2;

// The fence belongs to the whole raised cubie, including its ordinary corner
// faces. Query the same live platform/burrow rules used by jumps, rather than
// treating every colour mismatch as an open hole.
//
// A collapsed tunnel's pit (tunnelPits.js) stops the worm at its rim the same
// way, with the same moment to turn away or jump clear.
export function cautionEntry(sim, next, size, ctx) {
    if (!next || !usesRaisedPlatforms(ctx) || !['active', 'finalHealing'].includes(ctx.getGamePhase()) ||
        sim.isJumping || sim.padFlight || sim.rocketActive || sim.restRead || sim.signature.sweep ||
        (sim.signature.character === 'inch' && sim.signature.active > 0)) return null;
    // A moving destination is read at commit by the crossing system. Never
    // turn the outgoing cubie's opening into an invisible obstacle.
    if (liveRotation.active && liveRotation.sliceIndices.some(layer =>
        isTileInSlice(liveRotation.axis, layer, sim.pos.x, sim.pos.y, sim.pos.z) ||
        isTileInSlice(liveRotation.axis, layer, next.x, next.y, next.z))) return null;
    if (isPitTile(sim, next) && !isPitTile(sim, sim.pos)) {
        return { tile: { x: next.x, y: next.y, z: next.z, dirKey: next.dirKey }, pit: true };
    }
    // A worm on top walks on along raised pieces. Fresh off one, or just down from
    // a rocket, the next piece is still solid: stop at its tape.
    if (sim.onRaisedPlatform) return null;
    if (!raisedPlatformPosition(next, size, ctx) || raisedPlatformPosition(sim.pos, size, ctx)) return null;
    return { tile: { x: next.x, y: next.y, z: next.z, dirKey: next.dirKey } };
}

// A raised piece still fills most of its slot (it rises 0.355 out of a 1-deep
// slot), so the opening is bored down through the piece from its top
// (`raisedMouth`, the landing point a jump would take, pad included) and the
// worm goes over its rim into it. A pit's pad has dropped into its slot, so its
// mouth is on the floor. `depth` adds the climb, so either fall ends as deep.
export function makeCautionFall(sim, tile, size, raisedMouth = null) {
    const normal = FACE_NORMALS[tile.dirKey].clone();
    const floor = new THREE.Vector3().fromArray(getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, sim.expansionAmount));
    const mouth = raisedMouth ? raisedMouth.clone() : floor;
    const rise = raisedMouth ? Math.max(0, _rise.subVectors(raisedMouth, floor).dot(normal)) : 0;
    const start = sim.headInterpPos.clone().addScaledVector(sim.currentNormal, WORM_LIFT);
    const approach = mouth.clone().sub(start).projectOnPlane(normal);
    const reach = approach.length();
    approach.normalize();
    if (approach.lengthSq() < 1e-8) approach.fromArray(DIR_FORWARD[tile.dirKey].up);
    return { tile, elapsed: 0, sample: 0, start, mouth, normal, approach, rise, reach,
        startNormal: sim.currentNormal.clone(), forward: approach.clone(),
        depth: Math.min(2.2, size * 0.65) + rise, dissolve: 0 };
}
const _rise = new THREE.Vector3(), _across = new THREE.Vector3();

// Over a raised piece's rim the head keeps this far above the top: its own
// radius and a hair, so it never brushes the plastic or the pad.
const RIM_CLEAR = WORM_HEAD_RADIUS + 0.05;
// The head must be at full height before its edge reaches the piece's side
// (half of the 0.96 body), measured from the bore's axis.
const WALL_REACH = 0.48 + WORM_HEAD_RADIUS;

// Pull over the edge, then drop well below the shell before dissolving. The
// camera looks down the same cleared shaft, so the descent stays visible.
// The same history draws the tail along the head's route on every cube face.
export function cautionFallPoint(out, fall, elapsed) {
    const glide = THREE.MathUtils.smoothstep(elapsed, 0, CAUTION_PULL_SECONDS);
    const drop = THREE.MathUtils.smoothstep(elapsed, 0.55, 2.9);
    if (fall.rise > 0) {
        // Climb outside the piece, cross its rim at full height, then drop down
        // the bore once centred on it (the drop starts after the glide is near done).
        const from = _rise.subVectors(fall.start, fall.mouth).dot(fall.normal);
        const wall = THREE.MathUtils.clamp(1 - WALL_REACH / Math.max(fall.reach, 1e-6), 0.05, 0.95);
        const climb = THREE.MathUtils.smoothstep(glide, 0, wall);
        _across.subVectors(fall.start, fall.mouth).projectOnPlane(fall.normal);
        return out.copy(fall.mouth).addScaledVector(_across, 1 - glide)
            .addScaledVector(fall.normal, from + (RIM_CLEAR - from) * climb - fall.depth * drop);
    }
    out.copy(fall.start).lerp(fall.mouth, glide);
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
