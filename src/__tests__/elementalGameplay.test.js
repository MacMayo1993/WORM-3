import { describe, it, expect } from 'vitest';
import { makeWormSim, resetWormSim, startJump } from '../worm/healerWorm/wormSim.js';
import { addElementalPatch, tickElementalGameplay, consumeSpring, iceHoldsTurn, isHotTile, rotateElementalPatches, ELEMENTAL_PATCH_LIMIT } from '../worm/healerWorm/elementalGameplay.js';

function simOf(type) {
    const sim = makeWormSim(5);
    resetWormSim(sim, 5, { orbCount: 0, wormholeInterval: 9999 });
    sim.elementalType = type;
    sim.elementalT = 10;
    return sim;
}

describe('elemental gameplay', () => {
    it('builds bounded, frame-rate-independent water momentum and eases out after expiry', () => {
        const a = simOf('water'), b = simOf('water');
        for (let i = 0; i < 100; i++) tickElementalGameplay(a, 0.01);
        tickElementalGameplay(b, 1);
        expect(a.waterMomentum).toBeCloseTo(b.waterMomentum, 10);
        expect(a.waterMomentum).toBeGreaterThan(0.8);
        expect(a.waterMomentum).toBeLessThan(1);
        a.elementalT = 0;
        tickElementalGameplay(a, 1);
        expect(a.waterMomentum).toBeLessThan(0.15);
    });
    it('holds an ice turn only until the boundary and allows airborne steering', () => {
        const sim = simOf('ice');
        sim.interpT = 0.5;
        expect(iceHoldsTurn(sim, 0.01, 0.4)).toBe(true);
        expect(iceHoldsTurn(sim, 0.21, 0.4)).toBe(false);
        sim.isJumping = true;
        expect(iceHoldsTurn(sim, 0.01, 0.4)).toBe(false);
    });
    it('consumes a spring on a grounded jump but not a second airborne press', () => {
        const sim = simOf('grass');
        addElementalPatch(sim, sim.pos, 'grass');
        startJump(sim, { feel() {} });
        expect(sim.jumpSpan).toBe(2.2);
        expect(sim.jumpHeight).toBe(2.1);
        expect(sim.elementalPatches.size).toBe(0);
        addElementalPatch(sim, sim.pos, 'grass');
        startJump(sim, { feel() {} });
        expect(sim.elementalPatches.size).toBe(1);
    });
    it('expires fire before spring pads, freezes in tunnels, and bounds memory', () => {
        const sim = simOf('fire');
        addElementalPatch(sim, sim.pos, 'fire');
        expect(isHotTile(sim.elementalPatches, sim.pos)).toBe(true);
        sim.phase = 'entering';
        tickElementalGameplay(sim, 4);
        expect(isHotTile(sim.elementalPatches, sim.pos)).toBe(true);
        sim.phase = 'crawling';
        tickElementalGameplay(sim, 3);
        expect(isHotTile(sim.elementalPatches, sim.pos)).toBe(false);
        for (let i = 0; i < 40; i++) addElementalPatch(sim, { x: i, y: 0, z: 0, dirKey: 'PZ' }, 'grass');
        expect(sim.elementalPatches.size).toBe(ELEMENTAL_PATCH_LIMIT);
        tickElementalGameplay(sim, 8);
        expect(sim.elementalPatches.size).toBe(0);
    });
    it('transports patch identity and remaining lifetime with a rotated tile', () => {
        const sim = simOf('grass');
        addElementalPatch(sim, sim.pos, 'grass');
        tickElementalGameplay(sim, 2);
        const destination = { x: 0, y: 2, z: 2, dirKey: 'NX' };
        rotateElementalPatches(sim, () => destination);
        expect([...sim.elementalPatches.values()][0]).toEqual({ ...destination, type: 'grass', ttl: 6 });
        sim.pos = destination;
        expect(consumeSpring(sim)).toBe(true);
        expect(consumeSpring(sim)).toBe(false);
    });
});
