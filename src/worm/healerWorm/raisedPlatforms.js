import * as THREE from 'three';
import { cubieHasFlippedFace, isLiveFlippedFace } from '../../game/raisedCubie.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { getNextSurfacePosition } from '../wormLogic.js';
import { FACE_NORMALS, WORM_LIFT } from './constants.js';
import { shPush, ttPush } from '../circularBuffers.js';

export const WORM_PAD_HEIGHT = 0.5;
export const usesRaisedPlatforms = ctx => ctx.getTunnelEntry?.() === 'pad';
export function raisedPlatformPosition(tile, size, ctx) {
    const cubie = ctx.getCubies()?.[tile.x]?.[tile.y]?.[tile.z];
    const cap = ctx.getFlipCap?.() ?? 6;
    if (!cubie || !cubieHasFlippedFace(cubie, cap)) return null;
    const point = new THREE.Vector3().fromArray(getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 1));
    if (isLiveFlippedFace(cubie.stickers[tile.dirKey], cap)) point.addScaledVector(FACE_NORMALS[tile.dirKey], WORM_PAD_HEIGHT);
    return point;
}

// Capture a platform only underfoot or one cell ahead. This is an intentional
// jump, not a crawl teleport. The same sampled arc drives the head and tail.
export function startPlatformJump(sim, size, ctx, allowRide) {
    if (!usesRaisedPlatforms(ctx) || sim.isJumping || sim.rocketActive || sim.landingGraceT > 0) return false;
    let target = sim.pos, moveDir = sim.moveDir;
    let destination = sim.onRaisedPlatform ? null : raisedPlatformPosition(target, size, ctx);
    if (!destination) {
        const next = getNextSurfacePosition(sim.pos, sim.moveDir, size);
        if (!next) return false;
        target = next.pos ?? next;
        moveDir = next.moveDir ?? moveDir;
        destination = raisedPlatformPosition(target, size, ctx);
    }
    if (!destination) return false;
    sim.padFlight = { t: 0, sample: 0, start: sim.headInterpPos.clone(), end: destination, padHeight: isLiveFlippedFace(ctx.getCubies()[target.x][target.y][target.z].stickers[target.dirKey], ctx.getFlipCap?.() ?? 6) ? WORM_PAD_HEIGHT : 0,
        startNormal: sim.currentNormal.clone(), endNormal: FACE_NORMALS[target.dirKey].clone(),
        target: { ...target }, moveDir, allowRide, duration: 0.65 };
    sim.isJumping = true;
    sim.jumpCount = 1;
    sim.jumpT = 0.001;
    sim.pendingTunnelTrigger = null;
    ctx.feel('jump');
    return true;
}
const p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), turn = new THREE.Quaternion(), body = new THREE.Vector3();
export function tickPlatformJump(sim, delta) {
    const flight = sim.padFlight;
    if (!flight) return null;
    flight.t = Math.min(1, flight.t + Math.min(delta, 0.05) / flight.duration);
    q.setFromUnitVectors(flight.startNormal, flight.endNormal);
    const sample = (t, record) => {
        n.copy(flight.startNormal).applyQuaternion(turn.identity().slerp(q, t));
        const ease = t * t * (3 - 2 * t);
        p.lerpVectors(flight.start, flight.end, ease).addScaledVector(n, Math.sin(Math.PI * t) * 0.7);
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
    sim.jumpCount = 0;
    sim.raisedRouteDistance = sim.stepHistory.distance;
    sim.onRaisedPlatform = true;
    sim.raisedPadHeight = flight.padHeight;
    sim.padFlight = null;
    ttPush(sim.tileTrail, `${sim.pos.x},${sim.pos.y},${sim.pos.z},${sim.pos.dirKey}`);
    return flight;
}
