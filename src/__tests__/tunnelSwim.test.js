import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { tunnelHeadPulse, tunnelSwimInto, offsetTunnelSwimInto } from '../worm/healerWorm/tunnelSwim.js';

const stroke = () => ({ side: 0, lift: 0, scale: 1, bank: 0 });

describe('render-only tunnel swimming', () => {
    it('keeps the head anchored and the stroke bounded on short and very long worms', () => {
        for (const count of [8, 40, 1200]) {
            for (let time = 0; time < 3; time += 0.1) {
                for (const index of [0, 1, 3, count - 1]) {
                    const s = tunnelSwimInto(stroke(), index, count, time, 1);
                    expect(Math.hypot(s.side, s.lift)).toBeLessThanOrEqual(0.076);
                    expect(s.scale).toBeGreaterThanOrEqual(0.935);
                    expect(s.scale).toBeLessThanOrEqual(1.065);
                    if (index === 0) expect(s).toEqual(stroke());
                }
            }
        }
    });

    it('travels down the body without resetting at phase boundaries', () => {
        const a = tunnelSwimInto(stroke(), 4, 40, 1, 1);
        const b = tunnelSwimInto(stroke(), 5, 40, 1 + 0.62 / 4.8, 1);
        expect(a.side).toBeCloseTo(b.side);
        expect(a.lift).toBeCloseTo(b.lift);
        expect(tunnelSwimInto(stroke(), 4, 40, 1.2, 1).side).not.toBeCloseTo(a.side);
        for (const [before, after] of [['windup', 'entering'], ['entering', 'tunnel'], ['tunnel', 'exiting'], ['exiting', 'windout']]) {
            expect(tunnelHeadPulse(before, 1, 1)).toBe(tunnelHeadPulse(after, 0, 1));
        }
        expect(tunnelHeadPulse('windup', 0, 1)).toBe(1);
        expect(tunnelHeadPulse('windout', 1, 1)).toBe(1);
    });

    it('blends to surface motion and disables added motion for reduced motion', () => {
        const full = tunnelSwimInto(stroke(), 4, 40, 1, 1);
        const half = tunnelSwimInto(stroke(), 4, 40, 1, 0.5);
        expect(half.side).toBeCloseTo(full.side / 2);
        expect(tunnelSwimInto(stroke(), 4, 40, 1, 0)).toEqual(stroke());
        expect(tunnelSwimInto(stroke(), 4, 40, 1, 1, true)).toEqual(stroke());
        expect(tunnelHeadPulse('tunnel', 0.5, 1, true)).toBe(1);
    });

    it('keeps displacement perpendicular to travel on all face directions, including parallel normals', () => {
        const s = tunnelSwimInto(stroke(), 4, 40, 1, 1);
        for (const axis of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
            const forward = new THREE.Vector3(...axis);
            for (const normal of [forward.clone(), forward.clone().negate(), new THREE.Vector3(0,1,0)]) {
                const before = normal.clone();
                const pos = offsetTunnelSwimInto(new THREE.Vector3(), forward, normal, s);
                expect(pos.toArray().every(Number.isFinite)).toBe(true);
                expect(pos.dot(forward)).toBeCloseTo(0, 10);
                expect(pos.length()).toBeCloseTo(Math.hypot(s.side, s.lift));
                expect(normal.equals(before)).toBe(true);
            }
        }
        const stationary = new THREE.Vector3(1, 2, 3);
        offsetTunnelSwimInto(stationary, new THREE.Vector3(), new THREE.Vector3(0,1,0), s);
        expect(stationary.toArray()).toEqual([1, 2, 3]);
    });
});
