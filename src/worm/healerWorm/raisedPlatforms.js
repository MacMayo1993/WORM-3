import { livePlatformFormation } from '../platformFormation.js';
import * as THREE from 'three';
import { cubieHasFlippedFace, isLiveFlippedFace, raisedWormExpansion, WORM_PAD_HEIGHT } from '../../game/raisedCubie.js';
import { wormExpansion } from '../wormExpansion.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getNextSurfacePosition } from '../wormLogic.js';
import { FACE_NORMALS, DIR_FORWARD, WORM_LIFT } from './constants.js';
import { shPush, ttPush } from '../circularBuffers.js';
import { arcLift } from './jumpArc.js';

export { WORM_PAD_HEIGHT };
export const usesRaisedPlatforms = ctx => ctx.getTunnelEntry?.() === 'pad';
export function raisedPlatformPosition(tile, size, ctx) {
    const cubie = ctx.getCubies()?.[tile.x]?.[tile.y]?.[tile.z];
    const cap = ctx.getFlipCap?.() ?? 6;
    // All faces travel with the whole piece. Only the flipped face is a tunnel.
    if (!cubie?.stickers[tile.dirKey] || !cubieHasFlippedFace(cubie, cap)) return null;
    const point = new THREE.Vector3().fromArray(getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, raisedWormExpansion(wormExpansion.amount, size)));
    return isLiveFlippedFace(cubie.stickers[tile.dirKey], cap)
        ? point.addScaledVector(FACE_NORMALS[tile.dirKey], WORM_PAD_HEIGHT) : point;
}

// Share the same two-cell aim window with the chase camera. Prefer the nearest
// platform and follow surface topology through an edge, never arbitrary neighbours.
export const PLATFORM_AIM_CELLS = 2;
export function findRaisedPlatform(pos, moveDir, size, ctx, onPlatform = false) {
    let target = pos, heading = moveDir;
    for (let ahead = 0; ahead <= PLATFORM_AIM_CELLS; ahead++) {
        const destination = ahead === 0 && onPlatform ? null : raisedPlatformPosition(target, size, ctx);
        if (destination) return { target, moveDir: heading, destination };
        const next = getNextSurfacePosition(target, heading, size);
        if (!next) break;
        target = next.pos ?? next;
        heading = next.moveDir ?? heading;
    }
    return null;
}

// Launch to the actual expanded surface, not a fixed-height surface hop. An
// airborne second press can still catch the ledge without snapping to the floor.
export function startPlatformJump(sim, size, ctx, allowRide) {
    if (!usesRaisedPlatforms(ctx) || sim.padFlight || sim.rocketActive || sim.landingGraceT > 0) return false;
    const aim = findRaisedPlatform(sim.pos, sim.moveDir, size, ctx, sim.onRaisedPlatform);
    if (!aim) return false;
    const { target, moveDir, destination } = aim;
    const start = sim.headInterpPos.clone();
    if (sim.isJumping) start.addScaledVector(sim.currentNormal, arcLift(sim.jumpT, sim.jumpHeight, sim.jumpBase));
    const endNormal = FACE_NORMALS[target.dirKey].clone();
    const above = destination.clone().addScaledVector(endNormal, 0.35);
    const offset = start.clone().sub(destination).projectOnPlane(endNormal);
    const launch = start.clone();
    // When directly underneath, move outside the cubie before rising. Otherwise
    // even a high enough jump passes straight through its solid underside.
    if (offset.length() < 1.05) {
        if (offset.lengthSq() < 1e-6) offset.fromArray(DIR_FORWARD[target.dirKey][moveDir]).negate();
        offset.normalize().multiplyScalar(1.05).add(destination);
        launch.copy(offset).addScaledVector(endNormal, start.clone().sub(destination).dot(endNormal));
    }
    sim.padFlight = { t: 0, sample: 0, start, launch, above, end: destination,
        padHeight: isLiveFlippedFace(ctx.getCubies()[target.x][target.y][target.z].stickers[target.dirKey], ctx.getFlipCap?.() ?? 6) ? WORM_PAD_HEIGHT : 0,
        startNormal: sim.currentNormal.clone(), endNormal,
        target: { ...target }, moveDir, allowRide, // Time the landing for the end of the lift if the player jumps during
        // construction; the destination remains fixed at the tape-height platform.
        duration: Math.max((livePlatformFormation(target, size)?.formationRemaining ?? 0) + 1 / 60,
            Math.min(1.25, 0.65 + Math.max(0, start.distanceTo(destination) - 3) * 0.035)) };
    sim.isJumping = true;
    sim.jumpCount = 1;
    sim.jumpT = 0.001;
    sim.jumpBase = 0;
    sim.pendingTunnelTrigger = null;
    ctx.feel('jump');
    return true;
}
const smooth = t => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
export function samplePlatformArc(flight, t, out) {
    const { start, launch, above, end, endNormal } = flight;
    if (t < 0.2) return out.lerpVectors(start, launch, smooth(t / 0.2));
    if (t >= 0.78) return out.lerpVectors(above, end, smooth((t - 0.78) / 0.22));
    const travel = (t - 0.2) / 0.58, across = smooth(travel), rise = smooth(travel / 0.45);
    out.lerpVectors(launch, above, across);
    // Reach clearance height before crossing over the ledge, then settle onto
    // its top. The ordinary landing stays at tape height on every board size.
    const height = (above.x - launch.x) * endNormal.x + (above.y - launch.y) * endNormal.y + (above.z - launch.z) * endNormal.z;
    return out.addScaledVector(endNormal, Math.max(0, height) * (rise - across));
}

const p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), turn = new THREE.Quaternion(), body = new THREE.Vector3();
export function tickPlatformJump(sim, delta) {
    const flight = sim.padFlight;
    if (!flight) return null;
    flight.t = Math.min(1, flight.t + Math.min(delta, 0.05) / flight.duration);
    q.setFromUnitVectors(flight.startNormal, flight.endNormal);
    const sample = (t, record) => {
        n.copy(flight.startNormal).applyQuaternion(turn.identity().slerp(q, t));
        samplePlatformArc(flight, t, p);
        if (record) shPush(sim.stepHistory, body.copy(p).addScaledVector(n, WORM_LIFT), n, -1, -1, -1);
        else { sim.headInterpPos.copy(p); sim.currentNormal.copy(n); }
    };
    while (flight.sample / 64 <= flight.t) sample(flight.sample++ / 64, true);
    sample(flight.t, false);
    sim.jumpT = flight.t;
    if (flight.t < 1) return null;
    sim.pos = flight.target;
    sim.moveDir = flight.moveDir;
    sim.curWorldPos.copy(flight.end);
    sim.prevWorldPos = null;
    sim.prevTile = null;
    sim.crossingCorner = false;
    sim.interpT = 1;
    sim.stepAcc = 0;
    sim.lastRecordedT = 1.02;
    sim.isJumping = false;
    sim.jumpT = 0;
    sim.jumpBase = 0;
    sim.jumpCount = 0;
    sim.raisedRouteDistance = sim.stepHistory.distance;
    sim.onRaisedPlatform = true;
    sim.raisedPadHeight = flight.padHeight;
    sim.padFlight = null;
    ttPush(sim.tileTrail, `${sim.pos.x},${sim.pos.y},${sim.pos.z},${sim.pos.dirKey}`);
    return flight;
}
