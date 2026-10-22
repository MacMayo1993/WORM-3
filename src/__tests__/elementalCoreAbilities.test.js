// The elements' core-loop powers: each one helps heal the cube on a board with no
// enemies or bombs (tunnel tolls and wear, surround heals, cuts, the slice clock).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { makeWormSim, resetWormSim, stepWormSim, startElemental, dropCutOrbs, airGale, CHARGED_TOLL } from '../worm/healerWorm/wormSim.js';
import { collectManifoldRing } from '../worm/wormLogic.js';
import { makeGrowthOrb } from '../worm/healerWorm/orbSpawning.js';
import { ORB_SEGMENT_GROWTH } from '../worm/healerWorm/constants.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import {
    ELEMENT_ABILITIES, smeltToll, tunnelRideWears, hazardClockRate, riptideReach, regrowsCut,
    overgrowthTiles, takeGale, overchargeTunnel,
} from '../worm/healerWorm/elementalAbilities.js';

beforeEach(resetLiveRotation);

const wash = (sim, type, pair = null) => { sim.elementalType = type; sim.elementalPair = pair; sim.elementalT = 10; };
const keyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;
const tileOf = key => { const [x, y, z, dirKey] = key.split(','); return { x: +x, y: +y, z: +z, dirKey }; };

// A 3×3 whose first tile ahead of the worm is a flipped mouth (as chargedTunnels.test.js).
function ride(prep, { orbs = 0, tail = 3 } = {}) {
    const SIZE = 3;
    const cubies = makeCubies(SIZE);
    const entry = { x: 1, y: 2, z: 2, dirKey: 'PZ' };
    const exit = { x: 1, y: 0, z: 0, dirKey: 'NZ' };
    cubies[entry.x][entry.y][entry.z].stickers[entry.dirKey].curr = 4;
    cubies[exit.x][exit.y][exit.z].stickers[exit.dirKey].curr = 1;
    const tunnel = { entry, exit, entryColor: 4, exitColor: 1 }, tunnelKey = 'ride-tunnel';
    const sim = makeWormSim(SIZE);
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    sim.tailLength = tail;
    prep(sim, tunnelKey);
    const deposits = [];
    const noop = () => {};
    const ctx = {
        getCubies: () => cubies, getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 1,
        getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
        getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: orbs, 5: 0, 6: 0 }), getHealingProgress: () => ({}),
        getOrbColor: () => '#fff', resolveTunnel: () => ({ tunnel, tunnelKey }), isStoryMode: () => true,
        feel: noop, onDeath: noop, onTunnelEnter: noop, onCrawlResume: noop, onPhase: noop, onBoostState: noop,
        onSurvivalTick: noop, spawnWormholePair: noop, onFlippedTile: noop, applyDeposit: d => deposits.push(d),
        onOrbPickup: noop, onPowerupsChanged: noop, applyHeal: noop, onSpecialsChanged: noop, onElementalTheme: noop,
    };
    for (let i = 0; i < 40 && sim.phase === 'crawling'; i++) stepWormSim(sim, 0.05, SIZE, ctx);
    return { sim, deposits, tunnelKey };
}

const size = 5;
function fixture() {
    const sim = makeWormSim(size), cubies = makeCubies(size);
    resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
    const ctx = {
        getCubies: () => cubies, getGamePhase: () => 'active', isPaused: () => false,
        getSpeed: () => 1, getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999,
        isPrismCharacter: () => false, isStoryMode: () => true, getOrbInventory: () => ({}), getHealingProgress: () => ({}),
        getOrbColor: () => '#fff', resolveTunnel: () => null,
    };
    for (const key of ['feel', 'onDeath', 'onTunnelEnter', 'onCrawlResume', 'onPhase', 'onBoostState', 'onSurvivalTick',
        'spawnWormholePair', 'onFlippedTile', 'applyDeposit', 'onOrbPickup', 'onPowerupsChanged', 'applyHeal',
        'onSpecialsChanged', 'onSpecialSpawned', 'onSpecialExpired', 'onElementalTheme', 'onFusion']) ctx[key] = vi.fn();
    return { sim, ctx, cubies };
}
// A tile exactly `steps` manifold steps from the head.
function tileAt(sim, steps) {
    const inner = collectManifoldRing(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, size, steps - 1);
    const outer = collectManifoldRing(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, size, steps);
    for (const key of outer) if (!inner.has(key)) return tileOf(key);
    return null;
}

describe('Fire: Smelter', () => {
    it('pays one heal segment of a ride from the Fire budget, on top of a charge', () => {
        const { deposits, sim } = ride(sim => { wash(sim, 'fire'); sim.elementalAbilities.smeltBudget = 3; });
        expect(deposits).toHaveLength(1);
        expect(deposits[0].nextDeposited).toBe(1);
        expect(sim.tailLength).toBe(3);
        expect(sim.elementalAbilities.smeltBudget).toBe(2);
        const charged = ride((sim, key) => { wash(sim, 'fire'); sim.elementalAbilities.smeltBudget = 3; sim.chargedTunnels.add(key); });
        expect(charged.deposits[0].nextDeposited).toBe(CHARGED_TOLL + 1);
    });
    it('pays two mid-dash, never more than the budget or the need, and nothing without Fire', () => {
        const sim = makeWormSim(size);
        wash(sim, 'fire');
        sim.elementalAbilities.smeltBudget = 3; sim.elementalAbilities.fireDashT = 0.5;
        expect(smeltToll(sim, 4)).toBe(ELEMENT_ABILITIES.smeltDash);
        expect(smeltToll(sim, 4)).toBe(1);
        expect(smeltToll(sim, 4)).toBe(0);
        sim.elementalAbilities.smeltBudget = 3;
        expect(smeltToll(sim, 1)).toBe(1);
        sim.elementalT = 0;
        expect(smeltToll(sim, 4)).toBe(0);
    });
    it('a Fire claim fills the budget', () => {
        const { sim, ctx } = fixture();
        startElemental(sim, ctx, 'fire', size);
        expect(sim.elementalAbilities.smeltBudget).toBe(ELEMENT_ABILITIES.smeltBudget);
    });
});

describe('Water: Smooth Passage and Riptide', () => {
    it('a ride under Water does not wear the tunnel and leaves at full momentum', () => {
        const dry = ride(() => {});
        expect(dry.sim.tunnelUseCounts.get(dry.tunnelKey)).toBe(1);
        const wet = ride(sim => { wash(sim, 'water'); sim.waterMomentum = 0.2; });
        expect(wet.sim.phase).toBe('windup');
        expect(wet.sim.tunnelUseCounts.has(wet.tunnelKey)).toBe(false);
        expect(wet.sim.waterMomentum).toBe(1);
        expect(tunnelRideWears(wet.sim)).toBe(false);
    });
    it('pulls a dropped orb back from three steps and holds its crumble clock', () => {
        const { sim, ctx } = fixture();
        const far = tileAt(sim, 3);
        sim.droppedOrbs.push({ ...far, ttl: 5, payload: [{ faceId: 2, color: '#0f0', segments: ORB_SEGMENT_GROWTH }] });
        const before = sim.tailLength;
        wash(sim, 'water');
        expect(riptideReach(sim)).toBe(3);
        stepWormSim(sim, 0.02, size, ctx);
        expect(sim.droppedOrbs).toHaveLength(0);
        expect(sim.tailLength).toBe(before + ORB_SEGMENT_GROWTH);
        expect(ctx.onOrbPickup.mock.calls[0][5]).toBe(true); // a recovery, not a new pickup
    });
    it('dropped orbs out of reach keep their clock while Water is up, and age without it', () => {
        const { sim, ctx } = fixture();
        sim.droppedOrbs.push({ ...tileAt(sim, 5), ttl: 5, payload: [{ faceId: 2, color: '#0f0', segments: 3 }] });
        wash(sim, 'water');
        stepWormSim(sim, 0.1, size, ctx);
        expect(sim.droppedOrbs[0].ttl).toBe(5);
        sim.elementalT = 0;
        stepWormSim(sim, 0.1, size, ctx);
        expect(sim.droppedOrbs[0].ttl).toBeLessThan(5);
    });
});

describe('Earth: Regrowth and Overgrowth', () => {
    const drop = sim => ({ origin: { ...sim.pos }, faceIds: [2, 4], colors: ['#0f0', '#f80'], segments: [ORB_SEGMENT_GROWTH, 1] });
    it('a cut under Earth grows its orbs straight back instead of scattering them', () => {
        const { sim, ctx } = fixture();
        wash(sim, 'grass');
        const before = sim.tailLength;
        expect(dropCutOrbs(sim, size, ctx, drop(sim))).toBe(2);
        expect(sim.droppedOrbs).toHaveLength(0);
        expect(sim.tailLength).toBe(before + ORB_SEGMENT_GROWTH + 1);
        expect(ctx.onOrbPickup).toHaveBeenCalledTimes(2);
        expect(ctx.onOrbPickup.mock.calls.every(call => call[5] === true)).toBe(true);
        expect(sim.orbPickupFaceIds.slice(-2)).toEqual([2, 4]);
    });
    it('without Earth the cut scatters as before', () => {
        const { sim, ctx } = fixture();
        expect(regrowsCut(sim)).toBe(false);
        expect(dropCutOrbs(sim, size, ctx, drop(sim))).toBe(0);
        expect(sim.droppedOrbs.length).toBeGreaterThan(0);
    });
    it('spring pads and growing buds count as cover for a surround, only under Earth', () => {
        const { sim } = fixture();
        const pad = { x: 0, y: 0, z: 4, dirKey: 'PZ' }, bud = { x: 1, y: 0, z: 4, dirKey: 'PZ' };
        sim.elementalPatches.set(keyOf(pad), { ...pad, type: 'grass', ttl: 5 });
        sim.elementalPatches.set('2,0,4,PZ', { x: 2, y: 0, z: 4, dirKey: 'PZ', type: 'fire', ttl: 5 });
        sim.powerups.push(makeGrowthOrb(bud, { garden: { remaining: 1 } }), makeGrowthOrb({ x: 3, y: 0, z: 4, dirKey: 'PZ' }));
        expect(overgrowthTiles(sim, new Set()).size).toBe(0);
        wash(sim, 'grass');
        expect([...overgrowthTiles(sim, new Set())].sort()).toEqual([keyOf(pad), keyOf(bud)].sort());
    });
});

describe('Ice: Cold Snap', () => {
    it('halves the slice-turn clock while Ice is up, in either half of a pair', () => {
        const sim = makeWormSim(size);
        expect(hazardClockRate(sim)).toBe(1);
        wash(sim, 'ice');
        expect(hazardClockRate(sim)).toBe(ELEMENT_ABILITIES.coldSnapRate);
        wash(sim, 'fire', 'ice');
        expect(hazardClockRate(sim)).toBe(ELEMENT_ABILITIES.coldSnapRate);
        sim.elementalT = 0;
        expect(hazardClockRate(sim)).toBe(1);
    });
});

describe('Lightning: Overcharge', () => {
    const tunnelAt = (entry, key) => ({ tunnelKey: key, tunnel: { entry, exit: { x: 2, y: 0, z: 0, dirKey: 'NZ' } } });
    it('charges the nearest uncharged mouth within three steps, once each', () => {
        const { sim } = fixture();
        wash(sim, 'lightning');
        const near = tunnelAt(tileAt(sim, 1), 'near'), mid = tunnelAt(tileAt(sim, 2), 'mid'), far = tunnelAt(tileAt(sim, 4), 'far');
        const ctx = { getActiveTunnels: () => [far, mid, near] };
        expect(overchargeTunnel(sim, size, ctx)).toBe('near');
        expect(overchargeTunnel(sim, size, ctx)).toBe('mid');
        expect(overchargeTunnel(sim, size, ctx)).toBe(null);
        expect([...sim.chargedTunnels].sort()).toEqual(['mid', 'near']);
        expect(sim.elementalAbilities.overcharged).toBe(2);
    });
    it('every discharge overcharges, with nothing else on the board', () => {
        const { sim, ctx } = fixture();
        const hit = tunnelAt(tileAt(sim, 2), 'quiet');
        ctx.getActiveTunnels = () => [hit];
        wash(sim, 'lightning');
        stepWormSim(sim, 0.02, size, ctx);
        expect(sim.chargedTunnels.has('quiet')).toBe(true);
    });
});

describe('Air: Gale', () => {
    it('only a landing after half a second of flight is a gale, and it is taken once', () => {
        const sim = makeWormSim(size);
        wash(sim, 'air');
        sim.elementalAbilities.flightT = 0.3;
        expect(takeGale(sim)).toBe(false);
        sim.elementalAbilities.flightT = ELEMENT_ABILITIES.galeFlight;
        expect(takeGale(sim)).toBe(true);
        expect(takeGale(sim)).toBe(false);
    });
    it('sweeps ripe orbs and dropped orbs within two steps, even over a flipped tile', () => {
        const { sim, ctx, cubies } = fixture();
        wash(sim, 'air');
        const two = tileAt(sim, 2), three = tileAt(sim, 3);
        cubies[two.x][two.y][two.z].stickers[two.dirKey].curr = 9;
        sim.powerups.push(makeGrowthOrb(two), makeGrowthOrb(three), makeGrowthOrb(tileAt(sim, 1), { garden: { remaining: 1 } }));
        sim.droppedOrbs.push({ ...tileAt(sim, 1), ttl: 5, payload: [{ faceId: 3, color: '#fff', segments: ORB_SEGMENT_GROWTH }] });
        expect(airGale(sim, size, ctx)).toBe(1);
        expect(sim.powerups).toHaveLength(2); // the far orb and the unripe bud stay
        expect(sim.droppedOrbs).toHaveLength(0);
    });
    it('sounds a gust, not an orb chime, when there is nothing to take', () => {
        const { sim, ctx } = fixture();
        wash(sim, 'air');
        expect(airGale(sim, size, ctx)).toBe(0);
        const events = ctx.feel.mock.calls.map(([event]) => event);
        expect(events).toContain('gust');
        expect(events).not.toContain('orb');
    });
});
