import { describe, expect, it } from 'vitest';
import { advanceTunnelBodyClearance, tunnelBodyCameraKeep } from '../worm/healerWorm/tunnelBodyClearance.js';

describe('tunnel body camera clearance', () => {
    it('fades below-lens beads continuously across contact instead of removing a full bead', () => {
        expect(tunnelBodyCameraKeep(0.0999, 0, 1)).toBe(0);
        expect(tunnelBodyCameraKeep(0.1001, 0, 1)).toBeLessThan(0.00001);
        expect(tunnelBodyCameraKeep(0.15, 0, 1)).toBeCloseTo(0.5);
        expect(tunnelBodyCameraKeep(0.2, 0, 1)).toBe(1);
        let previous = 0;
        for (let distance = 0.09; distance < 0.22; distance += 0.001) {
            const keep = tunnelBodyCameraKeep(distance, 0, 1);
            expect(keep).toBeGreaterThanOrEqual(previous);
            expect(keep - previous).toBeLessThan(0.016);
            previous = keep;
        }
    });

    it('still clears obstructing beads and preserves distant or below-camera body', () => {
        expect(tunnelBodyCameraKeep(0.25, 1, 0)).toBe(0);
        expect(tunnelBodyCameraKeep(0.25, 1, 1)).toBe(1);
        expect(tunnelBodyCameraKeep(0.51, 1, 0)).toBe(1);
        expect(tunnelBodyCameraKeep(0.05, 1, 0, 0)).toBe(1);
    });

    it('restores the tail gradually when windout hands off to crawling', () => {
        const during = advanceTunnelBodyClearance(0, true, 'windout', 1);
        const after = advanceTunnelBodyClearance(during, false, 'crawling', 1 / 60);
        expect(after).toBeGreaterThan(0.7);
        const beforeKeep = tunnelBodyCameraKeep(0.25, 1, 0, during);
        const afterKeep = tunnelBodyCameraKeep(0.25, 1, 0, after);
        expect(afterKeep - beforeKeep).toBeLessThan(0.27);
        expect(advanceTunnelBodyClearance(after, false, 'crawling', 1)).toBeLessThan(1e-6);
    });

    it('is frame-rate stable on entry and exit, and holds while paused', () => {
        for (const transit of [true, false]) {
            const initial = transit ? 0 : 1;
            let split = initial;
            for (let i = 0; i < 12; i++) split = advanceTunnelBodyClearance(split, transit, 'crawling', 1 / 120);
            expect(split).toBeCloseTo(advanceTunnelBodyClearance(initial, transit, 'crawling', 0.1), 12);
            expect(advanceTunnelBodyClearance(split, transit, 'crawling', 0)).toBe(split);
        }
    });

    it('never enables ordinary jump culling or carries tunnel clearance into a jump', () => {
        for (const phase of ['jumping', 'cannon', 'rocket']) {
            expect(advanceTunnelBodyClearance(0, false, phase, 1 / 60)).toBe(0);
            expect(advanceTunnelBodyClearance(1, false, phase, 1 / 60)).toBe(0);
        }
        expect(advanceTunnelBodyClearance(0, false, 'crawling', 1)).toBe(0);
    });
});
