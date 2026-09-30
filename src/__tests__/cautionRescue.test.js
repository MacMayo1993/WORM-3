import * as THREE from 'three';
import { beforeEach, expect, it, vi } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { makeWormSim, resetWormSim, stepWormSim, queueTurn } from '../worm/healerWorm/wormSim.js';
import { cautionEntry, cautionFallPoint, CAUTION_FALL_SECONDS, makeCautionFall, tickCautionFall } from '../worm/healerWorm/cautionRescue.js';
import { FACE_NORMALS } from '../worm/healerWorm/constants.js';
import { resetLiveRotation, setLiveRotation } from '../worm/liveRotation.js';
import { wormExpansion } from '../worm/wormExpansion.js';
import { createExteriorPortals } from '../3d/exteriorPortals.js';
import { ttAt } from '../worm/circularBuffers.js';

const size = 5, noop = () => {};
function stage(face = 'PZ') {
    const cubies = makeCubies(size), sim = makeWormSim(size);
    resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
    const n = FACE_NORMALS[face], axis = ['x', 'y', 'z'].find(key => n[key]);
    const source = { x: 2, y: 2, z: 2, dirKey: face }; source[axis] = n[axis] > 0 ? 4 : 0;
    const target = { ...source }; target[axis === 'x' ? 'y' : 'x']++;
    Object.assign(cubies[target.x][target.y][target.z].stickers[face], { flips: 1, curr: 7 });
    sim.pos = source; sim._curWP.fromArray(getStickerWorldPos(source.x, source.y, source.z, face, size, 0));
    sim.curWorldPos = sim._curWP; sim.headInterpPos.copy(sim._curWP); sim.currentNormal.copy(n);
    sim.moveDir = face === 'PZ' ? 'right' : 'up';
    const ctx = {
        getCubies: () => cubies, getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 2,
        getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
        getOrbInventory: () => ({}), getHealingProgress: () => ({}), getOrbColor: () => '#ffffff',
        getTunnelEntry: () => 'pad', resolveTunnel: () => null, feel: noop, onDeath: vi.fn(),
        onTunnelEnter: noop, onCrawlResume: noop, onPhase: vi.fn(), onBoostState: noop, onSurvivalTick: noop,
        spawnWormholePair: noop, onFlippedTile: noop, applyDeposit: noop, onOrbPickup: vi.fn(),
        onPowerupsChanged: noop, applyHeal: noop, onSpecialsChanged: noop, onRocketState: noop,
        onJumpRescue: vi.fn(),
    };
    return { sim, ctx, cubies, target };
}
const step = ({ sim, ctx }, dt = 0.02) => stepWormSim(sim, dt, size, ctx);
function prompt(s) {
    for (let i = 0; i < 100 && !s.sim.cautionRescue; i++) step(s);
    expect(s.sim.cautionRescue).not.toBeNull();
}
beforeEach(() => { resetLiveRotation(); wormExpansion.amount = 0; });

it('holds before entering the tile, freezing movement, pickups and gameplay clocks', () => {
    const s = stage(); prompt(s);
    const { sim, ctx, target } = s;
    expect(sim.pos).not.toEqual(target);
    expect(ttAt(sim.tileTrail, 0)).not.toBe(`${target.x},${target.y},${target.z},${target.dirKey}`);
    const snapshot = [sim.timeAlive, sim.wormholeTimer, sim.boostCooldownT, sim.stepHistory.count, sim.headInterpPos.toArray()];
    step(s, 0.75);
    expect(sim.jumpRescueT).toBeCloseTo(0.25);
    expect([sim.timeAlive, sim.wormholeTimer, sim.boostCooldownT, sim.stepHistory.count, sim.headInterpPos.toArray()]).toEqual(snapshot);
    expect(ctx.onJumpRescue).toHaveBeenCalledWith(true, 'caution');
    expect(ctx.onOrbPickup).not.toHaveBeenCalled();
});

it.each(['left', 'right', 'turnLeft', 'turnRight', 'jump'])('accepts %s as a recovery and keeps the worm alive', input => {
    const s = stage(); prompt(s);
    queueTurn(s.sim, input); step(s);
    expect(s.sim.jumpRescueT).toBe(0);
    expect(s.sim.cautionRescue).toBeNull();
    if (input === 'jump') expect(s.sim.padFlight?.target).toMatchObject(s.target);
    else {
        expect(s.sim.moveDir).toBe(input.toLowerCase().includes('left') ? 'up' : 'down');
        for (let i = 0; i < 20; i++) step(s);
        expect(s.sim.pos).not.toEqual(s.target);
        expect(s.sim.cautionRescue).toBeNull();
    }
    expect(s.sim.alive).toBe(true);
    expect(s.ctx.onDeath).not.toHaveBeenCalled();
});

it('ignores unrelated inputs and completes the inward fall and dissolve before declaring death once', () => {
    const s = stage(); prompt(s);
    for (const input of ['boost', 'signature', 'up', 'down', 'fire']) queueTurn(s.sim, input);
    step(s, 1);
    expect(s.sim.phase).toBe('falling');
    expect(s.sim.alive).toBe(true);
    expect(s.sim.jumpRescueT).toBe(0);
    expect(s.sim.headInterpPos.equals(s.sim.cautionFall.start)).toBe(true);
    expect(s.ctx.onPhase).toHaveBeenCalledWith('falling');
    const aliveTime = s.sim.timeAlive, fall = s.sim.cautionFall;
    for (let i = 0; i < 65; i++) { queueTurn(s.sim, 'jump'); step(s); }
    expect(s.sim.headInterpPos.clone().sub(fall.mouth).dot(fall.normal)).toBeLessThan(0);
    expect(fall.dissolve).toBeGreaterThan(0);
    expect(fall.dissolve).toBeLessThan(1);
    for (let i = 0; i < 80; i++) step(s);
    expect(s.sim.phase).toBe('dead');
    expect(s.sim.alive).toBe(false);
    expect(s.sim.timeAlive).toBe(aliveTime);
    expect(fall.dissolve).toBe(1);
    expect(s.ctx.onDeath).toHaveBeenCalledTimes(1);
    expect(s.ctx.onDeath.mock.calls[0][0]).toMatchObject({ reason: 'caution-fall' });
    resetWormSim(s.sim, size, { orbCount: 0 });
    expect(s.sim.cautionFall).toBeNull(); expect(s.sim.cautionRescue).toBeNull();
});

it('preserves the countdown while paused and cancels when the raised opening heals', () => {
    const s = stage(); prompt(s);
    s.ctx.isPaused = () => true; step(s, 10);
    expect(s.sim.jumpRescueT).toBe(1);
    s.ctx.isPaused = () => false;
    s.cubies[s.target.x][s.target.y][s.target.z].stickers.PZ.flips = 2;
    step(s); expect(s.sim.cautionRescue).toBeNull(); expect(s.sim.alive).toBe(true);
});

it.each(['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'])('detects the same exposed boundary on %s', face => {
    const s = stage(face);
    expect(cautionEntry(s.sim, s.target, size, s.ctx)).not.toBeNull();
    for (const flag of ['isJumping', 'rocketActive', 'onRaisedPlatform']) {
        s.sim[flag] = true; expect(cautionEntry(s.sim, s.target, size, s.ctx)).toBeNull(); s.sim[flag] = false;
    }
    s.ctx.isBurrowFaceOpen = () => false;
    expect(cautionEntry(s.sim, s.target, size, s.ctx)).toBeNull();
});

it('includes ordinary faces of a raised corner and excludes unsettled rotation destinations', () => {
    const s = stage();
    s.target.y = 4;
    Object.assign(s.cubies[3][4][4].stickers.PY, { flips: 1, curr: 7 });
    expect(cautionEntry(s.sim, s.target, size, s.ctx)).not.toBeNull();
    setLiveRotation('col', [3], [0.5], 3, 0.5);
    expect(cautionEntry(s.sim, s.target, size, s.ctx)).toBeNull();
});

it('reuses one bounded opening for the fall and closes it after retry', () => {
    const s = stage(); prompt(s); step(s, 1);
    const fall = s.sim.cautionFall, portals = createExteriorPortals();
    portals.update(null, size, 0, fall);
    expect(portals.uniforms.uExteriorOpen.value).toBe(1);
    const points = portals.uniforms.uExteriorPoints.value;
    for (let i = 0; i < 9; i++) expect(points[i].equals(points[i + 9])).toBe(true);
    for (const t of [1, 1.5, CAUTION_FALL_SECONDS]) {
        const point = cautionFallPoint(new THREE.Vector3(), fall, t);
        const radial = point.sub(fall.mouth).projectOnPlane(fall.normal);
        expect(radial.length()).toBeLessThan(0.01);
    }
    portals.update(null, size, 0);
    expect(portals.uniforms.uExteriorOpen.value).toBe(0);
    portals.dispose();
});

it.each(Object.keys(FACE_NORMALS))('starts dissolving during the visible pull across the tape on %s', face => {
    const s = stage(face);
    s.sim.cautionFall = makeCautionFall(s.sim, s.target, size);
    const fall = s.sim.cautionFall;
    const startGap = fall.start.clone().sub(fall.mouth).projectOnPlane(fall.normal).length();
    for (let i = 0; i < 20; i++) tickCautionFall(s.sim, 0.02);
    const offset = s.sim.headInterpPos.clone().sub(fall.mouth);
    expect(offset.dot(fall.normal)).toBeGreaterThan(0.1);
    expect(offset.projectOnPlane(fall.normal).length()).toBeLessThan(startGap);
    expect(offset.length()).toBeGreaterThan(0.3);
    expect(fall.dissolve).toBeGreaterThan(0.1);
    for (let i = 0; i < 100; i++) tickCautionFall(s.sim, 0.02);
    expect(fall.dissolve).toBe(1);
    expect(s.sim.headInterpPos.clone().sub(fall.mouth).dot(fall.normal)).toBeGreaterThan(-0.7);
});

it('freezes the pull and dissolve while paused and finishes them before the death card', () => {
    const s = stage(); prompt(s); step(s, 1); step(s, 0.05);
    const fall = s.sim.cautionFall;
    const snapshot = [fall.elapsed, fall.dissolve, s.sim.headInterpPos.toArray(), s.sim.stepHistory.count];
    s.ctx.isPaused = () => true; step(s, 20);
    expect([fall.elapsed, fall.dissolve, s.sim.headInterpPos.toArray(), s.sim.stepHistory.count]).toEqual(snapshot);
    s.ctx.isPaused = () => false;
    for (let i = 0; i < 41; i++) step(s, 0.05);
    expect(fall.dissolve).toBe(1);
    expect(s.sim.alive).toBe(true);
    for (let i = 0; i < 5; i++) step(s, 0.05);
    expect(s.sim.alive).toBe(false);
});
