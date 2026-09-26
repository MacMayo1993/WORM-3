import { makeTunnelRideFrame, tunnelRideFrameInto } from '../../utils/tunnelRide.js';
import * as THREE from 'three';
import { shPush, shAt } from '../circularBuffers.js';
import {
    makeTunnelCenterline, buildTunnelCenterlineInto, tunnelTToArc,
    getWindWorldPosInto,
} from '../wormLogic.js';
import { FACE_NORMALS, BODY_BALL_SPACING, MAX_TAIL, windoutHeadS } from './constants.js';
import { INCH_BALL_SPACING } from './inchGait.js';

const path = makeTunnelCenterline();
const normal = new THREE.Vector3();
const rideFrame = makeTunnelRideFrame();

// Fixed parameter samples, rather than one point per display frame: the body
// follows the same bends at 30/60/120 Hz. The ring already retains the approach
// and will retain these samples when ordinary crawling records the departure.
const SAMPLES = 1024;
export function advanceTunnelHead(sim, phase, nextProgress, size) {
    const tunnel = sim.activeTunnel;
    if (!tunnel) return;
    const from = Math.min(1, sim.tunnelProgress);
    const to = Math.min(1, nextProgress);
    const wind = phase === 'windup' || phase === 'windout';
    if (!wind) buildTunnelCenterlineInto(path, tunnel, size, sim.expansionAmount);
    const entryN = FACE_NORMALS[tunnel.entry.dirKey];
    const exitN = FACE_NORMALS[tunnel.exit.dirKey];

    const sample = (p, record) => {
        if (wind) {
            const exiting = phase === 'windout';
            if (!exiting && sim.tunnelApproach && !tunnel.padHeight) {
                // First reach the mouth's centre at crawl height, then descend
                // axially. A diagonal dive from the still-approaching head can
                // cross the solid tile beside the aperture.
                const aligned = THREE.MathUtils.smoothstep(p, 0, 0.65);
                const dive = THREE.MathUtils.smoothstep(p, 0.65, 1);
                getWindWorldPosInto(sim.headInterpPos, tunnel, 'entry', dive, size, sim.expansionAmount);
                sim.headInterpPos.lerp(sim.tunnelApproach, 1 - aligned);
            } else {
                getWindWorldPosInto(sim.headInterpPos, tunnel, exiting ? 'exit' : 'entry', exiting ? windoutHeadS(p) : p, size, sim.expansionAmount);
            }
            normal.copy(exiting ? exitN : entryN);
        } else {
            const t = phase === 'entering' ? p * 0.33
                : phase === 'tunnel' ? 0.33 + p * 0.34 : 0.67 + p * 0.33;
            const arc = tunnelTToArc(path, t);
            tunnelRideFrameInto(rideFrame, path, arc);
            sim.headInterpPos.copy(rideFrame.center);
            normal.copy(rideFrame.normal);
            // Join the surface-facing wind-up/out without snapping the face at
            // the aperture, where the floor already tapers out of sight.
            const mouthBlend = THREE.MathUtils.smoothstep(Math.min(arc, path.total - arc), 0, 0.25);
            normal.lerp(arc < path.total / 2 ? entryN : exitN, 1 - mouthBlend).normalize();
        }
        sim.currentNormal.copy(normal);
        if (record && (sim.stepHistory.count === 0 ||
            shAt(sim.stepHistory, 0).pos.distanceToSquared(sim.headInterpPos) >= 0.0001 || p === 1)) {
            shPush(sim.stepHistory, sim.headInterpPos, normal, -1, -1, -1, true);
        }
    };
    if (from === 0) sample(0, true);
    for (let i = Math.floor(from * SAMPLES) + 1; i <= Math.floor(to * SAMPLES); i++) sample(i / SAMPLES, true);
    sample(to, false);
}

// A conservative reach covers every character, including the slightly wider
// inch-worm spacing. The clearance also leaves one bead radius past the mouth.
export function tunnelTailReach(tailLength) {
    return (Math.min(MAX_TAIL, Math.max(1, tailLength)) - 1)
        * Math.max(BODY_BALL_SPACING, INCH_BALL_SPACING) + 0.15;
}

export function tunnelTailCleared(passage, history, tailLength) {
    return history.distance - passage.exitDistance >= tunnelTailReach(tailLength);
}
