import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeStepHistory, shPush, shAt } from '../worm/circularBuffers.js';
import { advanceTunnelHead, tunnelTailCleared, tunnelTailReach } from '../worm/healerWorm/tunnelTrail.js';
import { getTunnelWorldPosInto, getWindWorldPosInto } from '../worm/wormLogic.js';
import { FACE_NORMALS } from '../worm/healerWorm/constants.js';
import { BORE_MOUTH } from '../utils/tunnelPath.js';

const tunnel = {
    entry: { x: 1, y: 1, z: 2, dirKey: 'PZ' },
    exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' },
};
const phases = ['entering', 'tunnel', 'exiting', 'windout'];
function makeSim(route = tunnel, size = 3) {
    const sim = {
        activeTunnel: route, tunnelProgress: 0, size,
        headInterpPos: new THREE.Vector3(), currentNormal: new THREE.Vector3(0, 0, 1),
        stepHistory: makeStepHistory(20000),
    };
    // A long approach leading toward the entrance. Long tails must retain it,
    // rather than vanish when the head exits the much shorter tunnel.
    sim.currentNormal.copy(FACE_NORMALS[route.entry.dirKey]);
    getTunnelWorldPosInto(sim.headInterpPos, route, 0, size);
    for (let distance = 113.5; distance >= 0; distance -= 0.02) {
        const point = sim.headInterpPos.clone().addScaledVector(sim.currentNormal, distance);
        shPush(sim.stepHistory, point, sim.currentNormal, -1, -1, -1);
    }
    return sim;
}
function phase(sim, name, end = 1, frames = 60) {
    sim.tunnelProgress = 0;
    for (let i = 1; i <= Math.ceil(end * frames); i++) {
        const p = Math.min(end, i / frames);
        advanceTunnelHead(sim, name, p, sim.size);
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
    it('moves only through the aperture at entry and exit, without an above-mouth orbit', () => {
        for (const side of ['entry', 'exit']) {
            const mouth = getWindWorldPosInto(new THREE.Vector3(), tunnel, side, 1, 3);
            const surface = getWindWorldPosInto(new THREE.Vector3(), tunnel, side, 0, 3);
            let previous = surface.clone(), distance = 0;
            for (let i = 1; i <= 1000; i++) {
                const point = getWindWorldPosInto(new THREE.Vector3(), tunnel, side, i / 1000, 3);
                distance += previous.distanceTo(point);
                expect(point.x).toBeCloseTo(mouth.x, 10);
                expect(point.y).toBeCloseTo(mouth.y, 10);
                previous = point;
            }
            expect(distance).toBeCloseTo(surface.distanceTo(mouth), 8);
            expect(distance).toBeLessThan(0.11);
        }
    });

    it('keeps even a starter tail inside at the end of the exit handoff', () => {
        const sim = makeSim();
        for (const name of phases.slice(0, 3)) phase(sim, name);
        const passage = { exitDistance: sim.stepHistory.distance };
        phase(sim, 'windout');
        expect(sim.stepHistory.distance - passage.exitDistance).toBeLessThan(0.11);
        expect(tunnelTailCleared(passage, sim.stepHistory, 4)).toBe(false);
        expect(bodyPoint(sim, 3 * 0.09).z).toBeGreaterThan(-1.5);
    });

    it('retains the same-face exit route for the trailing body on all six faces', () => {
        for (const size of [2, 3, 5, 15]) {
            const middle = Math.floor(size / 2);
            for (const [dirKey, normal] of Object.entries(FACE_NORMALS)) {
                const axis = normal.x ? 'x' : normal.y ? 'y' : 'z';
                const lateral = axis === 'x' ? 'z' : 'x';
                const entry = { x: middle, y: middle, z: middle, dirKey };
                entry[axis] = normal[axis] > 0 ? size - 1 : 0;
                entry[lateral] = 0;
                const route = { entry, exit: { ...entry, [lateral]: size - 1 } };
                const simulations = [30, 60, 120].map(frames => {
                    const sim = makeSim(route, size);
                    for (const name of phases) phase(sim, name, 1, frames);
                    return sim;
                });
                const mouth = getTunnelWorldPosInto(new THREE.Vector3(), route, 1, size);
                const entryMouth = getTunnelWorldPosInto(new THREE.Vector3(), route, 0, size);
                for (let i = 0; i < 1200; i++) {
                    const point = bodyPoint(simulations[0], i * 0.09);
                    for (const sim of simulations.slice(1)) {
                        expect(bodyPoint(sim, i * 0.09).distanceTo(point)).toBeLessThan(1e-6);
                    }
                    // A centreline crossing either face aperture stays on its
                    // axis. The deep core and lifted flourish are unrestricted.
                    const height = point.clone().sub(mouth).dot(normal);
                    if (height > -0.2 && height < 0.02) {
                        const exitOffset = point.clone().sub(mouth).projectOnPlane(normal).length();
                        const entryOffset = point.clone().sub(entryMouth).projectOnPlane(normal).length();
                        expect(Math.min(exitOffset, entryOffset)).toBeLessThan(BORE_MOUTH - 0.15);
                    }
                }
                // Transit provenance must survive head exit: no surface-clearance
                // projection may eject the remaining interior body onto the cube.
                expect(Array.from({ length: simulations[0].stepHistory.count }, (_, i) =>
                    shAt(simulations[0].stepHistory, i)).some(p => p.transit && p.pos.clone().sub(mouth).dot(normal) < -0.2)).toBe(true);
            }
        }
    });

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


describe('raised-pad mouth loops', () => {
    it.each([3, 7, 15])('loops once above every face and reverses exactly on exit at size %i', size => {
        for (const [dirKey, normal] of Object.entries(FACE_NORMALS)) {
            const mid = Math.floor(size / 2), entry = { x: mid, y: mid, z: mid, dirKey };
            entry[normal.x ? 'x' : normal.y ? 'y' : 'z'] = normal.x + normal.y + normal.z > 0 ? size - 1 : 0;
            const route = { entry, exit: { ...entry }, padExpansion: .5, padHeight: .5 };
            const surface = getWindWorldPosInto(new THREE.Vector3(), route, 'entry', 0, size);
            const mouth = getTunnelWorldPosInto(new THREE.Vector3(), route, 0, size);
            let previous = surface, lateralMax = 0;
            const forward = [], reverse = [];
            const a = makeSim(route, size), b = makeSim(route, size);
            for (let i = 0; i <= 120; i++) {
                const progress = i / 120;
                const point = getWindWorldPosInto(new THREE.Vector3(), route, 'entry', progress, size);
                expect(point.distanceTo(previous)).toBeLessThan(.12);
                const relative = point.clone().sub(surface), lateral = relative.clone().projectOnPlane(normal).length();
                lateralMax = Math.max(lateralMax, lateral);
                if (lateral > .001) expect(relative.dot(normal)).toBeGreaterThanOrEqual(0);
                advanceTunnelHead(a, 'windup', progress, size); a.tunnelProgress = progress;
                advanceTunnelHead(b, 'windout', progress, size); b.tunnelProgress = progress;
                forward.push(a.headInterpPos.clone()); reverse.push(b.headInterpPos.clone());
                previous = point;
            }
            expect(lateralMax).toBeCloseTo(.38, 4);
            expect(previous.distanceTo(mouth)).toBeLessThan(1e-10);
            for (let i = 0; i <= 120; i++) expect(forward[i].distanceTo(reverse[120 - i])).toBeLessThan(1e-8);
        }
    });

    it('records the same raised orbit for the entire body at 30/60/120 Hz', () => {
        const route = { ...tunnel, padExpansion: .5, padHeight: .5 };
        const simulations = [30, 60, 120].map(frames => {
            const sim = makeSim(route);
            for (const name of ['windup', ...phases]) phase(sim, name, 1, frames);
            return sim;
        });
        for (let i = 0; i < 100; i++) {
            const point = bodyPoint(simulations[0], i * .09);
            for (const sim of simulations.slice(1)) expect(bodyPoint(sim, i * .09).distanceTo(point)).toBeLessThan(1e-6);
        }
    });
});
