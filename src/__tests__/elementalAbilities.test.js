import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { makeWormSim, resetWormSim, startElemental, stepWormSim, queueTurn, killWormSim, startJump, applyRotationToSim } from '../worm/healerWorm/wormSim.js';
import { getNextSurfacePosition, turnWorm } from '../worm/wormLogic.js';
import { makeGrowthOrb } from '../worm/healerWorm/orbSpawning.js';
import { ORB_SEGMENT_GROWTH } from '../worm/healerWorm/constants.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { growGarden, startFlameDash, elementalStep, fireOrbBonus, elementalPickupReach, tickElementalAbilities, elementalDrift, airJumpAdvance, chainTargets, ELEMENT_ABILITIES } from '../worm/healerWorm/elementalAbilities.js';

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
    const claim = type => { startElemental(sim, ctx, type, size); sim.elementalFocusT = 0; };
    return { sim, ctx, claim };
}
const tick = (sim, ctx, seconds) => { for (let i = 0; i < Math.ceil(seconds / .02); i++) stepWormSim(sim, .02, size, ctx); };
beforeEach(resetLiveRotation);

describe('enemy-free elemental abilities', () => {
    it('Fire immediately charges Boost, recharges on six distinct tiles, and caps double growth', () => {
        const { sim, claim, ctx } = fixture(); claim('fire');
        sim.boostCooldownT = 8; queueTurn(sim, 'boost'); tick(sim, ctx, .04);
        expect(sim.elementalAbilities.fireDashT).toBeGreaterThan(0);
        expect(sim.boostActiveT).toBe(0);
        sim.elementalAbilities.fireDashT = 0;
        for (let i = 0; i < 12; i++) elementalStep(sim, size, ctx);
        expect(sim.elementalAbilities.heat.size).toBe(1);
        expect(startFlameDash(sim, size)).toBe(false);
        for (let i = 0; i < 6; i++) { sim.pos = { x: i % 5, y: Math.floor(i / 5), z: 4, dirKey: 'PZ' }; elementalStep(sim, size, ctx); }
        expect(startFlameDash(sim, size)).toBe(true);
        expect(Array.from({ length: 9 }, () => fireOrbBonus(sim, { ignited: true }))).toEqual([3, 3, 3, 3, 3, 3, 0, 0, 0]);
    });
    it('adds fire growth through the normal pickup path, counting each orb once', () => {
        const { sim, claim, ctx } = fixture();
        const orb = makeGrowthOrb(sim.pos); sim.powerups.push(orb);
        claim('fire'); expect(orb.ignited).toBe(true); claim('lightning');
        const before = sim.tailLength; tick(sim, ctx, .02);
        expect(sim.tailLength - before).toBe(ORB_SEGMENT_GROWTH * 2);
        expect(ctx.onOrbPickup).toHaveBeenCalledTimes(1);
        expect(ctx.onOrbPickup.mock.calls[0][4]).toBe(ORB_SEGMENT_GROWTH * 2);
        expect(sim.powerups).toHaveLength(0);
        tick(sim, ctx, .2); expect(ctx.onOrbPickup).toHaveBeenCalledTimes(1);
    });
    it('Water collects a neighbouring lane while preserving the normal pickup accounting', () => {
        const { sim, claim, ctx } = fixture(); claim('water');
        const next = getNextSurfacePosition(sim.pos, sim.moveDir, size);
        const side = getNextSurfacePosition(next, turnWorm(next.moveDir ?? sim.moveDir, 'left'), size);
        sim.powerups.push(makeGrowthOrb(side)); tick(sim, ctx, .9);
        expect(ctx.onOrbPickup).toHaveBeenCalledTimes(1);
        expect(sim.powerups).toHaveLength(0);
        queueTurn(sim, 'turnRight'); tick(sim, ctx, .02);
        expect(sim.waterMomentum).toBeGreaterThan(.6); expect(sim.waterMomentum).toBeLessThan(.8);
    });
    it('Earth gardens ripen, never respawn, and cannot be farmed beyond six buds', () => {
        const { sim, ctx, claim } = fixture(); claim('grass');
        expect(sim.powerups).toHaveLength(2);
        expect(sim.powerups.every(o => o.garden.remaining > 0)).toBe(true);
        let planted = sim.powerups.length;
        for (let i = 0; i < 10; i++) {
            sim.powerups.length = 0;
            planted += growGarden(sim, size, ctx);
        }
        expect(planted).toBe(6); expect(sim.elementalAbilities.gardenBudget).toBe(0);
        claim('water'); expect(growGarden(sim, size, ctx)).toBe(0); // fusion refresh cannot reset Earth budget
    });
    it('Lightning chains at most three ripe orbs, preserves their identities and waits four seconds', () => {
        const { sim, ctx, claim } = fixture(); claim('lightning');
        for (const x of [0, 1, 2, 3]) sim.powerups.push(makeGrowthOrb({ x, y: sim.pos.y, z: 4, dirKey: 'PZ' }));
        sim.powerups.unshift(makeGrowthOrb(sim.pos, { garden: { remaining: 1.5 } }));
        expect(chainTargets(sim, size)).toHaveLength(3);
        const before = sim.tailLength; tick(sim, ctx, .02);
        expect(ctx.onOrbPickup).toHaveBeenCalledTimes(3);
        expect(sim.tailLength - before).toBe(3 * ORB_SEGMENT_GROWTH);
        expect(sim.powerups).toHaveLength(2);
        expect(sim.elementalAbilities.lightningT).toBe(4);
        expect(sim.fusionBursts.at(-1)).toMatchObject({ kind: 'element-discharge', defuse: true });
    });
    it('Ice gives one body-collision save, a finite phase window and drift acceleration', () => {
        const { sim, ctx, claim } = fixture(); claim('ice'); elementalDrift(sim);
        expect(sim.elementalAbilities.driftT).toBeGreaterThan(0);
        killWormSim(sim, ctx, { reason: 'self-collision' }); expect(sim.alive).toBe(true);
        expect(sim.elementalAbilities.iceShield).toBe(false);
        killWormSim(sim, ctx, { reason: 'self' }); expect(sim.alive).toBe(true);
        tickElementalAbilities(sim, 1.3, size, ctx, vi.fn());
        killWormSim(sim, ctx, { reason: 'self-collision' }); expect(sim.alive).toBe(false);
        expect(ctx.onDeath).toHaveBeenCalledTimes(1);
        const another = fixture(); another.claim('ice');
        killWormSim(another.sim, another.ctx, { reason: 'bomb' }); expect(another.sim.alive).toBe(false);
    });
    it('Air glides only while held, has finite travel and expands airborne collection', () => {
        const { sim, claim, ctx } = fixture(); claim('air'); startJump(sim, ctx, size);
        sim.jumpT = .5; queueTurn(sim, 'jump-hold');
        const ordinary = .2 / sim.jumpSpan;
        expect(airJumpAdvance(sim, .2)).toBeCloseTo(ordinary * .25);
        expect(elementalPickupReach(sim, size).size).toBeGreaterThan(1);
        queueTurn(sim, 'jump-release'); expect(airJumpAdvance(sim, .2)).toBeCloseTo(ordinary);
        queueTurn(sim, 'jump-hold'); airJumpAdvance(sim, 3);
        expect(sim.elementalAbilities.glideLeft).toBe(0);
        expect(airJumpAdvance(sim, .2)).toBeCloseTo(ordinary);
        sim.rocketActive = true; expect(elementalPickupReach(sim, size)).toBeNull();
    });
    it('freezes ability clocks and maturation while paused or traversing and clears them on reset', () => {
        const { sim, ctx, claim } = fixture(); claim('grass'); claim('fire'); startFlameDash(sim, size);
        const before = sim.powerups[0].garden.remaining;
        ctx.isPaused = () => true; tick(sim, ctx, 1);
        expect(sim.powerups[0].garden.remaining).toBe(before);
        expect(sim.elementalAbilities.fireDashT).toBe(ELEMENT_ABILITIES.fireDash);
        sim.phase = 'tunnel'; tickElementalAbilities(sim, 2, size, ctx, vi.fn());
        expect(sim.powerups[0].garden.remaining).toBe(before);
        resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
        expect(sim.elementalAbilities.fireReady).toBe(false);
        expect(sim.elementalAbilities.events).toHaveLength(0);
        expect(sim.powerups).toHaveLength(0);
    });
    it('transports buds, ignited orbs and heat identity with their rotating tiles', () => {
        const { sim, ctx, claim } = fixture(); claim('fire');
        sim.pos = { x: 4, y: 2, z: 4, dirKey: 'PZ' }; sim.elementalAbilities.fireReady = false;
        elementalStep(sim, size, ctx);
        const orb = makeGrowthOrb(sim.pos, { ignited: true, garden: { remaining: .7 } }); sim.powerups.push(orb);
        applyRotationToSim(sim, size, ctx, { axis: 'col', sliceIndex: 4, dir: 1 }, { inOpeningScramble: false, paused: false });
        expect(sim.powerups[0]).toMatchObject({ spawnId: orb.spawnId, ignited: true, garden: { remaining: .7 } });
        const o = sim.powerups[0]; expect(sim.elementalAbilities.heat.has(`${o.x},${o.y},${o.z},${o.dirKey}`)).toBe(true);
    });
});

describe('upgraded ordered fusions', () => {
    it('keeps Wildfire planting and Emberseed showers distinct and within their shared garden budget', () => {
        const wildfire = fixture(); wildfire.claim('fire'); wildfire.claim('grass');
        wildfire.sim.powerups.length = 0; startFlameDash(wildfire.sim, size); elementalStep(wildfire.sim, size, wildfire.ctx);
        expect(wildfire.sim.powerups).toHaveLength(1);
        expect(wildfire.sim.powerups[0].garden.ember).toBe(false);
        const ember = fixture(); ember.claim('grass'); ember.claim('fire');
        tickElementalAbilities(ember.sim, 1.5, size, ember.ctx, vi.fn());
        expect(ember.sim.powerups.some(o => o.cascade?.kind === 'garden')).toBe(true);
        expect(ember.sim.powerups.length).toBeLessThanOrEqual(6);
        expect(ember.sim.powerups.length).toBeGreaterThan(2);
    });
    it('Static discharges on a drift even while the ordinary chain cooldown is running', () => {
        const { sim, ctx, claim } = fixture(); claim('ice'); claim('lightning');
        sim.elementalAbilities.lightningT = 3; sim.powerups.push(makeGrowthOrb(sim.pos));
        elementalDrift(sim); tick(sim, ctx, .02);
        expect(ctx.onOrbPickup).toHaveBeenCalledTimes(1);
        expect(sim.elementalAbilities.chainPending).toBe(false);
    });
    it('Quench dashes lay momentum-preserving obsidian, while Highlands grows three landing buds', () => {
        const quench = fixture(); quench.claim('water'); quench.claim('fire');
        startFlameDash(quench.sim, size); elementalStep(quench.sim, size, quench.ctx);
        const key = `${quench.sim.pos.x},${quench.sim.pos.y},${quench.sim.pos.z},${quench.sim.pos.dirKey}`;
        expect(quench.sim.elementalPatches.get(key).obsidian).toBe(true);
        queueTurn(quench.sim, 'turnLeft'); tick(quench.sim, quench.ctx, .02);
        expect(quench.sim.waterMomentum).toBe(1);
        const highlands = fixture(); highlands.claim('air'); highlands.claim('grass');
        const before = highlands.sim.powerups.length;
        highlands.sim.pos = { x: 0, y: 0, z: 4, dirKey: 'PZ' };
        startJump(highlands.sim, highlands.ctx, size); highlands.sim.jumpT = .99999;
        tick(highlands.sim, highlands.ctx, .02);
        expect(highlands.sim.powerups.length - before).toBe(3);
        expect(highlands.sim.elementalPatches.get('0,0,4,PZ').charged).toBe(true);
    });
    it('Steam collects ignited orbs beyond Water’s side lanes', () => {
        const { sim, ctx, claim } = fixture(); claim('fire'); claim('water');
        const ahead = getNextSurfacePosition(sim.pos, sim.moveDir, size);
        const twoAhead = getNextSurfacePosition(ahead, ahead.moveDir ?? sim.moveDir, size);
        sim.powerups.push(makeGrowthOrb(twoAhead, { ignited: true }));
        tick(sim, ctx, .85);
        expect(ctx.onOrbPickup).toHaveBeenCalledTimes(1);
        expect(ctx.onOrbPickup.mock.calls[0][4]).toBe(6);
    });
});
