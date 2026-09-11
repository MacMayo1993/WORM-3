import * as THREE from 'three';
import { shPush, shAt } from '../circularBuffers.js';
import {
    makeTunnelCenterline, buildTunnelCenterlineInto, tunnelTToArc,
    getTunnelArcPosSmoothInto, getWindWorldPosInto,
} from '../wormLogic.js';
import { FACE_NORMALS, BODY_BALL_SPACING, MAX_TAIL, windoutHeadS } from './constants.js';
import { INCH_BALL_SPACING } from './inchGait.js';

const path = makeTunnelCenterline();
const normal = new THREE.Vector3();
const startNormal = new THREE.Vector3();
const turn = new THREE.Quaternion();

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
    if (!wind) buildTunnelCenterlineInto(path, tunnel, size);
    const entryN = FACE_NORMALS[tunnel.entry.dirKey];
    const exitN = FACE_NORMALS[tunnel.exit.dirKey];
    startNormal.copy(entryN);
    turn.setFromUnitVectors(entryN, exitN);

    const sample = (p, record) => {
        if (wind) {
            const exiting = phase === 'windout';
            getWindWorldPosInto(sim.headInterpPos, tunnel, exiting ? 'exit' : 'entry', exiting ? windoutHeadS(p) : p, size);
            if (!exiting && sim.tunnelApproach) {
                sim.headInterpPos.lerp(sim.tunnelApproach, 1 - THREE.MathUtils.smoothstep(p, 0, 0.3));
            }
            normal.copy(exiting ? exitN : entryN);
        } else {
            const t = phase === 'entering' ? p * 0.33
                : phase === 'tunnel' ? 0.33 + p * 0.34 : 0.67 + p * 0.33;
            getTunnelArcPosSmoothInto(sim.headInterpPos, path, tunnelTToArc(path, t));
            // Rotate normals, never interpolate opposing vectors through zero.
            normal.copy(startNormal).applyQuaternion(newTurn.identity().slerp(turn, t));
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
const newTurn = new THREE.Quaternion();

// A conservative reach covers every character, including the slightly wider
// inch-worm spacing. The clearance also leaves one bead radius past the mouth.
export function tunnelTailReach(tailLength) {
    return (Math.min(MAX_TAIL, Math.max(1, tailLength)) - 1)
        * Math.max(BODY_BALL_SPACING, INCH_BALL_SPACING) + 0.15;
}

export function tunnelTailCleared(passage, history, tailLength) {
    return history.distance - passage.exitDistance >= tunnelTailReach(tailLength);
}
