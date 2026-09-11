import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeStepHistory, shPush, shAt } from '../worm/circularBuffers.js';
import { advanceTunnelHead, tunnelTailCleared, tunnelTailReach } from '../worm/healerWorm/tunnelTrail.js';
import { getTunnelWorldPosInto, getWindWorldPosInto } from '../worm/wormLogic.js';

const tunnel = {
    entry: { x: 1, y: 1, z: 2, dirKey: 'PZ' },
    exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' },
};
const phases = ['entering', 'tunnel', 'exiting', 'windout'];
function makeSim() {
    const sim = {
        activeTunnel: tunnel, tunnelProgress: 0,
        headInterpPos: new THREE.Vector3(), currentNormal: new THREE.Vector3(0, 0, 1),
        stepHistory: makeStepHistory(20000),
    };
    // A long approach leading toward the entrance. Long tails must retain it,
    // rather than vanish when the head exits the much shorter tunnel.
    for (let z = 115; z >= 1.5; z -= 0.02) shPush(sim.stepHistory, new THREE.Vector3(0, 0, z), sim.currentNormal, -1, -1, -1);
    getTunnelWorldPosInto(sim.headInterpPos, tunnel, 0, 3);
    return sim;
}
function phase(sim, name, end = 1, frames = 60) {
    sim.tunnelProgress = 0;
    for (let i = 1; i <= Math.ceil(end * frames); i++) {
        const p = Math.min(end, i / frames);
        advanceTunnelHead(sim, name, p, 3);
        sim.tunnelProgress = p;
    }
}
function bodyPoint(sim, distance) {
    let a = sim.headInterpPos;
    for (let i = 0; i < sim.stepHistory.count; i++) {
        const b = shAt(sim.stepHistory, i).pos;
        const span = a.distanceTo(b);
        if (span > 0 && distance <= span) return a.clone().lerp(b, distance / span);
        distance -= span;
        a = b;
    }
    throw new Error('Body ran out of history');
}

describe('continuous worm tunnel trail', () => {
    it('keeps trailing segments inside as the head starts its exit flourish', () => {
        const sim = makeSim();
        for (const name of phases.slice(0, 3)) phase(sim, name);
        const before = Array.from({ length: 40 }, (_, i) => bodyPoint(sim, i * 0.09));
        phase(sim, 'windout', 0.0001, 10000);
        for (let i = 1; i < 40; i++) {
            const after = bodyPoint(sim, i * 0.09);
            expect(after.distanceTo(before[i])).toBeLessThan(0.01);
        }
        expect(bodyPoint(sim, 0.9).z).toBeGreaterThan(-1.5);
        expect(bodyPoint(sim, 0.9).z).toBeLessThan(1.5);
    });

    it.each([40, 100, 1200])('retains every segment of a %i-segment worm without endpoint clamping', (count) => {
        const sim = makeSim();
        for (const name of phases) phase(sim, name);
        const points = Array.from({ length: count }, (_, i) => bodyPoint(sim, i * 0.09));
        for (let i = 1; i < points.length; i++) {
            const gap = points[i].distanceTo(points[i - 1]);
            expect(gap).toBeGreaterThan(0.04);
            expect(gap).toBeLessThanOrEqual(0.09001);
        }
        if (count >= 100) expect(points.some(p => Math.abs(p.z) < 1.4)).toBe(true);
    });

    it('reconstructs the same route at 30, 60 and 120 Hz', () => {
        const simulations = [30, 60, 120].map(frames => {
            const sim = makeSim();
            for (const name of phases) phase(sim, name, 1, frames);
            return sim;
        });
        for (let i = 0; i < 100; i++) {
            const expected = bodyPoint(simulations[0], i * 0.09);
            for (const sim of simulations.slice(1)) expect(bodyPoint(sim, i * 0.09).distanceTo(expected)).toBeLessThan(1e-6);
        }
    });

    it('joins the flourish to both the tunnel mouth and the lifted surface', () => {
        const mouth = getTunnelWorldPosInto(new THREE.Vector3(), tunnel, 1, 3);
        const start = getWindWorldPosInto(new THREE.Vector3(), tunnel, 'exit', 1, 3);
        const end = getWindWorldPosInto(new THREE.Vector3(), tunnel, 'exit', 0, 3);
        expect(start.distanceTo(mouth)).toBeLessThan(1e-10);
        expect(end.z).toBeCloseTo(-1.6, 10);
    });

    it('measures tail clearance in route distance, including growth and cuts', () => {
        const passage = { exitDistance: 20 };
        const history = { distance: 20 + tunnelTailReach(40) };
        expect(tunnelTailCleared(passage, history, 40)).toBe(true);
        expect(tunnelTailCleared(passage, history, 100)).toBe(false);
        expect(tunnelTailCleared(passage, history, 10)).toBe(true);
    });
});
