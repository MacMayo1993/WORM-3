import { livePlatformFormation, rushPlatformFormation } from '../platformFormation.js';
import * as THREE from 'three';
import { cubieHasFlippedFace, isLiveFlippedFace, raisedWormExpansion, WORM_PAD_HEIGHT } from '../../game/raisedCubie.js';
import { wormExpansion } from '../wormExpansion.js';
import { cubeExpansionScale } from '../../game/cubeWorldGeometry.js';
import { SURFACE_OFFSET } from '../../utils/constants.js';
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
    // A buried or rising mouth cannot capture a platform jump. Ordinary faces
    // stay standable if another open flipped face keeps the whole piece raised.
    if (isLiveFlippedFace(cubie.stickers[tile.dirKey], cap) && ctx.isBurrowFaceOpen?.(cubie.stickers[tile.dirKey]) === false) return null;
    if (!Object.values(cubie.stickers).some(sticker => isLiveFlippedFace(sticker, cap) && ctx.isBurrowFaceOpen?.(sticker) !== false)) return null;
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

// ── Platform flight ──────────────────────────────────────────────────────────
// One cubic Bézier from the visible head to the pad, advanced uniformly in
// natural time. A Bézier walked that way accelerates almost constantly, like a
// thrown body: the head leaves along the crawl, never stops in mid-air, and
// comes down onto the pad still moving, which the landing coil then carries
// on. The arc's height is searched against the raised piece and the cube body,
// so the same rule clears the ledge on every board size and across edges.
const PIECE_CLEAR = 0.65;     // the 0.96 body's half plus a head radius
const APEX_OVER_PAD = 0.32;   // a visible drop onto the landing
const ESCAPE_MARGIN = 0.14;   // leave the piece's footprint before rising past it
const ARC_SAMPLES = 48;
// A pad that is still rising finishes within this share of the flight. One
// whose rise cannot be hurried holds the worm at the top of its arc (hang time)
// rather than stretching the whole flight into slow motion.
const RUSH_SHARE = 0.85;
const HANG_WIDTH = 0.5;
// The last stretch eases onto the springy pad: touchdown arrives at about half
// the ballistic speed, close to the pace the landing coil sets off at.
const FLARE_START = 0.7;
const FLARE = 1;
// Backing out from under a pad starts near crawl pace instead of snapping away.
const EASE_END = 0.25;
const ESCAPE_EASE = 1.2;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function bezierInto(out, ctrl, t) {
    const u = 1 - t;
    return out.copy(ctrl[0]).multiplyScalar(u * u * u).addScaledVector(ctrl[1], 3 * u * u * t)
        .addScaledVector(ctrl[2], 3 * u * t * t).addScaledVector(ctrl[3], t * t * t);
}
function bezierTangentInto(out, ctrl, t) {
    const u = 1 - t;
    return out.subVectors(ctrl[1], ctrl[0]).multiplyScalar(3 * u * u)
        .addScaledVector(_a.subVectors(ctrl[2], ctrl[1]), 6 * u * t)
        .addScaledVector(_b.subVectors(ctrl[3], ctrl[2]), 3 * t * t);
}

const insideBox = (p, center, half) => Math.abs(p.x - center.x) < half && Math.abs(p.y - center.y) < half && Math.abs(p.z - center.z) < half;
// Leave the raised piece at most once (a head already under it must get out
// first), never re-enter it, and never dip into the unraised cube body.
function arcClears(ctrl, piece, cubeHalf) {
    let left = !insideBox(ctrl[0], piece, PIECE_CLEAR);
    for (let i = 1; i <= ARC_SAMPLES; i++) {
        bezierInto(_c, ctrl, i / ARC_SAMPLES);
        if (insideBox(_c, piece, PIECE_CLEAR)) { if (left) return false; } else left = true;
        if (insideBox(_c, _a.set(0, 0, 0), cubeHalf)) return false;
    }
    return left;
}
function arcApex(ctrl, end, normal) {
    let best = -Infinity, at = 0.5;
    for (let i = 0; i <= ARC_SAMPLES; i++) {
        const h = bezierInto(_c, ctrl, i / ARC_SAMPLES).sub(end).dot(normal);
        if (h > best) { best = h; at = i / ARC_SAMPLES; }
    }
    return { height: best, at };
}
function arcLength(ctrl) {
    let length = 0;
    bezierInto(_b, ctrl, 0);
    for (let i = 1; i <= ARC_SAMPLES; i++) { bezierInto(_c, ctrl, i / ARC_SAMPLES); length += _c.distanceTo(_b); _b.copy(_c); }
    return length;
}

// In-plane direction that leaves the piece's footprint soonest. Backing out the
// way the worm came is preferred, so the landing still faces its heading.
function escapeDirection(out, start, piece, normal, forward) {
    let best = Infinity;
    for (const axis of ['x', 'y', 'z']) {
        if (Math.abs(normal[axis]) > 0.5) continue;
        for (const sign of [-1, 1]) {
            _b.set(0, 0, 0); _b[axis] = sign;
            const exit = PIECE_CLEAR - sign * (start[axis] - piece[axis]) + 0.25 * _b.dot(forward);
            if (exit < best) { best = exit; out.copy(_b); }
        }
    }
    return PIECE_CLEAR - out.dot(_c.subVectors(start, piece));
}

// Search the lowest arc that clears; fall back to the tallest candidate.
function buildPlatformArc(start, startNormal, end, endNormal, piece, cubeHalf, forward) {
    const ctrl = [start.clone(), new THREE.Vector3(), new THREE.Vector3(), end.clone()];
    const up = new THREE.Vector3().addVectors(startNormal, endNormal).normalize();
    const escape = insideBox(start, piece, PIECE_CLEAR) ? new THREE.Vector3() : null;
    const exit = escape ? escapeDirection(escape, start, piece, endNormal, forward) : 0;
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
    for (let i = 0; i < 24; i++) {
        const scale = 1 + i * 0.12;
        if (escape) {
            // Back out under the translucent piece, then come over its rim.
            ctrl[1].copy(start).addScaledVector(escape, (exit + ESCAPE_MARGIN) * 2.2 * scale).addScaledVector(endNormal, 0.08 * scale);
            ctrl[2].copy(end).addScaledVector(escape, 0.9 * scale).addScaledVector(endNormal, 0.9 * scale);
        } else {
            // Degree-elevated quadratic: exactly a parabola in natural time.
            const q = _b.copy(mid).addScaledVector(up, 0.55 * scale);
            ctrl[1].lerpVectors(start, q, 2 / 3);
            ctrl[2].lerpVectors(end, q, 2 / 3);
        }
        if (arcClears(ctrl, piece, cubeHalf) && arcApex(ctrl, end, endNormal).height >= APEX_OVER_PAD) break;
    }
    return ctrl;
}

// Natural time runs the Bézier uniformly apart from three smooth slow-downs: a
// launch ease when backing out from under a pad, the landing flare, and a hang
// around the apex for a pad that is still rising. dτ/dσ = T0·(1 + ease + flare +
// hang), integrated in closed form so the landing arrives exactly on time.
function hangIntegral(flight, s) {
    const x = Math.max(0, Math.min(1, (s - flight.hangCenter) / HANG_WIDTH + 0.5));
    return HANG_WIDTH * (x / 2 - Math.sin(2 * Math.PI * x) / (4 * Math.PI));
}
function flareIntegral(s) {
    const x = Math.max(0, Math.min(1, (s - FLARE_START) / (1 - FLARE_START)));
    return (1 - FLARE_START) * (x / 2 - Math.sin(Math.PI * x) / (2 * Math.PI));
}
function easeIntegral(s) {
    const y = 1 - Math.max(0, Math.min(1, s / EASE_END));
    return EASE_END * (0.5 - y / 2 + Math.sin(Math.PI * y) / (2 * Math.PI));
}
const FLARE_TIME = FLARE * flareIntegral(1);
const flightTimeAt = (flight, s) => flight.ballistic
    * (s + FLARE * flareIntegral(s) + flight.ease * easeIntegral(s) + flight.hangK * hangIntegral(flight, s));
function flightParamAt(flight, elapsed) {
    if (elapsed >= flight.duration) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (flightTimeAt(flight, mid) < elapsed) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
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
    const padHeight = isLiveFlippedFace(ctx.getCubies()[target.x][target.y][target.z].stickers[target.dirKey], ctx.getFlipCap?.() ?? 6) ? WORM_PAD_HEIGHT : 0;
    const piece = destination.clone().addScaledVector(endNormal, -(SURFACE_OFFSET + padHeight));
    const cubeHalf = (size - 1) / 2 * cubeExpansionScale(size, wormExpansion.amount) + 0.5;
    const forward = new THREE.Vector3().fromArray(DIR_FORWARD[sim.pos.dirKey]?.[sim.moveDir] ?? DIR_FORWARD[target.dirKey][moveDir]);
    const ctrl = buildPlatformArc(start, sim.currentNormal, destination, endNormal, piece, cubeHalf, forward);
    const apex = arcApex(ctrl, destination, endNormal);
    const length = arcLength(ctrl);
    const ballistic = Math.max(0.45, Math.min(0.75, 0.36 + 0.1 * length));
    const ease = insideBox(start, piece, PIECE_CLEAR) ? ESCAPE_EASE : 0;
    const natural = ballistic * (1 + FLARE_TIME + ease * easeIntegral(1));
    // A pad still rising hurries to be fully up just before touchdown. If its
    // rise cannot be hurried, the landing waits for it at the top of the arc.
    const formation = livePlatformFormation(target, size);
    if (rushPlatformFormation(formation, natural * RUSH_SHARE)) {
        // Twins rise in step, and the band between them grows with both.
        const twin = ctx.resolveTunnel?.(target.x, target.y, target.z, target.dirKey)?.tunnel?.exit;
        if (twin) rushPlatformFormation(livePlatformFormation(twin, size), natural * RUSH_SHARE);
    }
    const duration = Math.max(natural, (formation?.formationRemaining ?? 0) + 1 / 60);
    const heading = bezierTangentInto(new THREE.Vector3(), ctrl, 1).projectOnPlane(endNormal);
    if (heading.lengthSq() < 1e-6) heading.fromArray(DIR_FORWARD[target.dirKey][moveDir]);
    sim.padFlight = { t: 0, elapsed: 0, sample: 0, samples: Math.max(48, Math.ceil(length / 0.03)),
        ctrl, start, above: bezierInto(new THREE.Vector3(), ctrl, apex.at), end: destination, padHeight,
        startNormal: sim.currentNormal.clone(), endNormal, heading: heading.normalize(),
        target: { ...target }, moveDir, allowRide, ballistic, ease, natural, duration, leftover: 0,
        hangK: duration > natural + 1e-6 ? (duration - natural) / ballistic / (HANG_WIDTH / 2) : 0,
        hangCenter: Math.max(HANG_WIDTH / 2, Math.min(1 - HANG_WIDTH / 2, apex.at)) };
    sim.isJumping = true;
    sim.jumpCount = 1;
    sim.jumpT = 0.001;
    sim.jumpBase = 0;
    sim.pendingTunnelTrigger = null;
    ctx.feel('jump');
    return true;
}
export const samplePlatformArc = (flight, t, out) => bezierInto(out, flight.ctrl, Math.max(0, Math.min(1, t)));

const p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), turn = new THREE.Quaternion(), body = new THREE.Vector3();
export function tickPlatformJump(sim, delta) {
    const flight = sim.padFlight;
    if (!flight) return null;
    const reached = flight.elapsed + Math.min(delta, 0.05);
    flight.elapsed = Math.min(flight.duration, reached);
    // Time past touchdown, spent on the landing coil in the same tick.
    flight.leftover = reached - flight.elapsed;
    flight.t = flightParamAt(flight, flight.elapsed);
    q.setFromUnitVectors(flight.startNormal, flight.endNormal);
    const sample = (t, record) => {
        n.copy(flight.startNormal).applyQuaternion(turn.identity().slerp(q, t));
        samplePlatformArc(flight, t, p);
        if (record) shPush(sim.stepHistory, body.copy(p).addScaledVector(n, WORM_LIFT), n, -1, -1, -1);
        else { sim.headInterpPos.copy(p); sim.currentNormal.copy(n); }
    };
    while (flight.sample / flight.samples <= flight.t) sample(flight.sample++ / flight.samples, true);
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
