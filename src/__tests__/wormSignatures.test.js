import { Vector3 } from 'three';
import { wiggleOffset, wigglePointInto, WIGGLE_DURATION } from '../worm/healerWorm/wiggleSweep.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { makeWormSim, resetWormSim, stepWormSim, queueTurn, killWormSim, startJump } from '../worm/healerWorm/wormSim.js';
import { signatureAvailability, signatureReadout, isParityLocked, releaseMobiTunnel, tickSignature, SIGNATURES } from '../worm/healerWorm/signatures.js';
import { liveRotation, resetLiveRotation } from '../worm/liveRotation.js';
import { ttPush } from '../worm/circularBuffers.js';
import { characterOrbCount, characterXpMultiplier, holdsRotationTimer } from '../worm/characterAbilities.js';
import { getStableKey } from '../worm/wormLogic.js';

function makeCtx(overrides = {}) {
  const events = [];
  const log = (type) => (...args) => { events.push({ type, args }); };
  return {
    events,
    getCubies: () => null,
    getGamePhase: () => 'active',
    isPaused: () => false,
    getSpeed: () => 1.0,
    getControlMode: () => 'non-oriented',
    getWormholeInterval: () => 9999,
    isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }),
    getHealingProgress: () => ({}),
    getOrbColor: () => '#22ff88',
    resolveTunnel: () => null,
    feel: log('feel'),
    onDeath: log('death'),
    onTunnelEnter: log('tunnelEnter'),
    onCrawlResume: log('crawlResume'),
    onPhase: log('phase'),
    onBoostState: log('boost'),
    onSurvivalTick: log('survival'),
    spawnWormholePair: log('spawn'),
    onFlippedTile: log('flipped'),
    applyDeposit: log('deposit'),
    onOrbPickup: log('pickup'),
    onPowerupsChanged: log('powerups'),
    applyHeal: log('heal'),
    onSpecialsChanged: log('specials'),
    onRocketState: log('rocketState'),
    onMagnetState: log('magnetState'),
    onSpecialSpawned: log('specialSpawned'),
    onSpecialExpired: log('specialExpired'),
    ...overrides,
  };
}

const SIZE = 5;
function world(character, overrides = {}) {
  const cubies = makeCubies(SIZE);
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  const ctx = makeCtx({ getCubies: () => cubies, getCharacter: () => character, ...overrides });
  return { sim, ctx, cubies };
}
const step = (sim, ctx, seconds = 0.05) => stepWormSim(sim, seconds, SIZE, ctx);
function run(sim, ctx, seconds) { for (let t = 0; t < seconds - 0.001; t += 0.05) step(sim, ctx); }
function activate(sim, ctx) { queueTurn(sim, 'signature'); step(sim, ctx); }
const eventsOf = (ctx, type) => ctx.events.filter(e => e.type === type);
beforeEach(() => resetLiveRotation());

describe('signature input and lifecycle', () => {
  it.each(['unknown'])('leaves %s boost intact without granting a signature', character => {
    const { sim, ctx } = world(character);
    activate(sim, ctx);
    expect(sim.signature.active).toBe(0);
    queueTurn(sim, 'boost'); step(sim, ctx);
    expect(sim.boostActiveT).toBeGreaterThan(0);
  });
  it.each(['scrambling', 'spawning', 'countdown', 'solved'])('rejects inputs in %s', phase => {
    const { sim, ctx } = world('glow', { getGamePhase: () => phase });
    activate(sim, ctx);
    expect(sim.signature.cooldown).toBe(0);
    expect(sim.signature.active).toBe(0);
  });
  it('rejects demo, paused and dead inputs without queuing a later activation', () => {
    const { sim, ctx } = world('glow', { isDemoLesson: () => true });
    activate(sim, ctx); expect(sim.signature.active).toBe(0);
    ctx.isDemoLesson = () => false; ctx.isPaused = () => true;
    activate(sim, ctx); expect(sim.signatureRequested).toBe(false);
    ctx.isPaused = () => false; step(sim, ctx); expect(sim.signature.active).toBe(0);
    killWormSim(sim, ctx); activate(sim, ctx); expect(sim.signature.active).toBe(0);
    resetWormSim(sim, SIZE, { orbCount: 0 });
    expect(sim.signatureRequested).toBe(false); expect(sim.signature.cooldown).toBe(0);
  });
  it('freezes active and cooldown clocks during pause and tunnel transit', () => {
    const { sim, ctx } = world('glow'); activate(sim, ctx);
    const { active, cooldown } = sim.signature;
    ctx.isPaused = () => true; run(sim, ctx, 1);
    expect(sim.signature).toMatchObject({ active, cooldown });
    ctx.isPaused = () => false; sim.phase = 'windup'; sim.activeTunnel = null;
    step(sim, ctx); expect(sim.signature).toMatchObject({ active, cooldown });
  });
  it('coalesces repeated presses and keeps the steering queue', () => {
    const { sim, ctx } = world('glow');
    queueTurn(sim, 'turnRight'); queueTurn(sim, 'signature'); queueTurn(sim, 'signature'); step(sim, ctx);
    expect(sim.signature.seq).toBe(1); expect(sim.moveDir).toBe('right');
    activate(sim, ctx); expect(sim.signature.seq).toBe(1);
    expect(sim.signature.cooldown).toBeLessThan(SIGNATURES.glow.cooldown);
  });
  it('clears active effects on death, reset and character changes', () => {
    const { sim, ctx } = world('glow'); activate(sim, ctx);
    ctx.getCharacter = () => 'inch'; step(sim, ctx);
    expect(sim.signature.active).toBe(0); expect(sim.signature.cooldown).toBe(0);
    ctx.getCharacter = () => 'glow'; activate(sim, ctx);
    killWormSim(sim, ctx); expect(sim.signature.active).toBe(0);
    resetWormSim(sim, SIZE, { orbCount: 0 }); expect(sim.signature.target).toBeNull();
  });
});

describe('Inch: Spring Loaded', () => {
  it('holds position for the wind-up, then launches the longer arc', () => {
    const { sim, ctx } = world('inch');
    const pos = { ...sim.pos }, interp = sim.interpT;
    activate(sim, ctx);
    expect(sim.signature.charge).toBeGreaterThan(0);
    expect(sim.pos).toEqual(pos); expect(sim.interpT).toBe(interp);
    run(sim, ctx, 0.2);
    expect(sim.isJumping).toBe(true); expect(sim.jumpSpan).toBe(2.2);
    expect(sim.jumpHeight).toBe(1.8); expect(sim.signature.cooldown).toBeGreaterThan(23);
    const jumpT = sim.jumpT; startJump(sim, ctx, SIZE); expect(sim.jumpT).toBe(jumpT);
    run(sim, ctx, 2.4); expect(sim.isJumping).toBe(false); expect(sim.signature.active).toBe(0);
  });
  it('rejects a flipped landing without spending a charge', () => {
    const { sim, ctx, cubies } = world('inch');
    const p = signatureAvailability(sim, SIZE, ctx).target;
    cubies[p.x][p.y][p.z].stickers[p.dirKey].curr = 4;
    activate(sim, ctx);
    expect(sim.signature.charge).toBe(0); expect(sim.signature.cooldown).toBe(0);
    expect(signatureReadout(sim, SIZE, ctx).reason).toContain('wormhole');
  });
  it('revalidates the landing if a cube turn begins during the charge', () => {
    const { sim, ctx } = world('inch'); activate(sim, ctx);
    liveRotation.active = true;
    run(sim, ctx, 0.2);
    expect(sim.isJumping).toBe(false); expect(sim.signature.cooldown).toBe(0);
  });
  it('blocks occupied landings but ignores old trail outside the visible body', () => {
    const { sim, ctx } = world('inch');
    const p = signatureAvailability(sim, SIZE, ctx).target;
    const key = `${p.x},${p.y},${p.z},${p.dirKey}`;
    ttPush(sim.tileTrail, key); ttPush(sim.tileTrail, '2,2,4,PZ');
    sim.tailLength = 100;
    expect(signatureAvailability(sim, SIZE, ctx).reason).toBe('Body blocks landing');
    sim.tailLength = 1;
    expect(signatureAvailability(sim, SIZE, ctx).reason).toBe('');
  });
});

describe('character abilities', () => {
  it('Book pauses the layer clock without stopping movement or teleporting', () => {
    const { sim, ctx } = world('book'); const origin = { ...sim.pos };
    activate(sim, ctx); expect(holdsRotationTimer(sim.signature)).toBe(true);
    run(sim, ctx, 1.1); expect(sim.pos).not.toEqual(origin);
    const seq = sim.signature.seq; activate(sim, ctx); expect(sim.signature.seq).toBe(seq);
    expect(signatureReadout(sim, SIZE, ctx).returnReady).toBe(false);
    tickSignature(sim, 5, SIZE, ctx); expect(holdsRotationTimer(sim.signature)).toBe(false);
  });
  it('Classic and Prism are always-on passives', () => {
    for (const id of ['classic', 'prism']) {
      const { sim, ctx } = world(id); activate(sim, ctx);
      expect(sim.signature.active).toBe(0); expect(SIGNATURES[id].passive).toBe(true);
    }
    expect(characterOrbCount(5, 'classic')).toBe(8);
    expect(characterOrbCount(5, 'prism')).toBe(5);
    expect(characterXpMultiplier('book')).toBe(1.25);
    expect(characterXpMultiplier('glow')).toBe(1);
  });
  it('Glow paints for three seconds without granting the old magnet reach', () => {
    const { sim, ctx } = world('glow');
    const seq = sim.pathHistory.nextSeq;
    sim.powerups = [{ x: 3, y: 3, z: 4, dirKey: 'PZ', type: 'apple' }];
    activate(sim, ctx); expect(sim.signature.trailStartSeq).toBe(seq);
    expect(sim.signature.active).toBeCloseTo(2.95);
    run(sim, ctx, 1.05); expect(eventsOf(ctx, 'pickup')).toHaveLength(0);
    tickSignature(sim, 3, SIZE, ctx); expect(sim.signature.active).toBe(0);
  });
  it('MOBI creates beneath its head, enters without a deposit, and must heal before creating again', () => {
    const { sim, ctx, cubies } = world('mobi');
    const entry = { ...sim.pos }, exit = { x: 2, y: 2, z: 0, dirKey: 'NZ' };
    const tunnel = { entry, exit, entryColor: 4, exitColor: 1, pairId: 'personal' };
    const stableKeys = [entry, exit].map(p => getStableKey(p.x,p.y,p.z,p.dirKey,cubies));
    let created = false;
    ctx.canCreateMobiTunnel = () => !created;
    ctx.createMobiTunnel = p => {
      expect(p).toEqual(entry); created = true;
      cubies[2][2][4].stickers.PZ.curr = 4;
      return { tunnel, stableKeys };
    };
    ctx.resolveTunnel = () => ({ tunnel, tunnelKey: 'personal' });
    ctx.getOrbInventory = () => ({ 4: 30 }); sim.tailLength = 34;
    activate(sim, ctx);
    expect(sim.phase).toBe('windup'); expect(eventsOf(ctx, 'tunnelEnter')).toHaveLength(1);
    expect(eventsOf(ctx, 'deposit')).toHaveLength(0); expect(sim.tailLength).toBe(34);
    expect(isParityLocked(sim, entry, ctx)).toBe(true); expect(isParityLocked(sim, exit, ctx)).toBe(true);
    expect(isParityLocked(sim, { ...entry, x: 1 }, ctx)).toBe(false);
    sim.phase = 'crawling'; sim.tunnelPassages = [];
    tickSignature(sim, 9.9, SIZE, ctx); expect(isParityLocked(sim, entry, ctx)).toBe(true);
    tickSignature(sim, .11, SIZE, ctx); expect(isParityLocked(sim, entry, ctx)).toBe(false);
    expect(signatureAvailability(sim, SIZE, ctx).reason).toContain('Heal your previous');
    releaseMobiTunnel(sim, { pairId: 'other' }); expect(sim.signature.mobiTunnel).not.toBeNull();
    releaseMobiTunnel(sim, tunnel); expect(sim.signature.mobiTunnel).toBeNull();
  });
  it('MOBI lock follows a sticker identity rather than stale tile coordinates', () => {
    const { sim, ctx, cubies } = world('mobi');
    const p = { ...sim.pos }, moved = { ...p, x: 1 };
    sim.signature.mobiTunnel = { pairId: 'personal', reentryT: 10,
      stableKeys: [getStableKey(p.x,p.y,p.z,p.dirKey,cubies)] };
    [cubies[p.x][p.y][p.z].stickers.PZ, cubies[moved.x][moved.y][moved.z].stickers.PZ] =
      [cubies[moved.x][moved.y][moved.z].stickers.PZ, cubies[p.x][p.y][p.z].stickers.PZ];
    expect(isParityLocked(sim, moved, ctx)).toBe(true); expect(isParityLocked(sim, p, ctx)).toBe(false);
  });
  it('MOBI rejects unavailable terrain without creating a tunnel', () => {
    const { sim, ctx } = world('mobi'); activate(sim, ctx);
    expect(sim.signature.seq).toBe(0); expect(sim.signature.mobiTunnel).toBeNull();
  });
  it('holds the head and discards turns through both wiper cycles, then resumes', () => {
    const { sim, ctx } = world('wiggle');
    const origin = { ...sim.pos };
    queueTurn(sim, 'turnLeft'); activate(sim, ctx);
    expect(sim.pos).toEqual(origin);
    expect(sim.signature.sweep).not.toBeNull();
    for (let i = 0; i < 40; i++) {
      queueTurn(sim, 'turnRight'); queueTurn(sim, 'jump'); step(sim, ctx);
      expect(sim.pos).toEqual(origin); expect(sim.moveDir).toBe('up');
      expect(sim.pendingTurns).toHaveLength(0); expect(sim.isJumping).toBe(false);
    }
    run(sim, ctx, 0.35);
    expect(sim.signature.sweep).toBeNull(); expect(sim.signature.active).toBe(0);
    expect(sim.pos).toEqual(origin);
    run(sim, ctx, 1.05); expect(sim.pos.y).toBe(3); expect(sim.moveDir).toBe('up');
  });
  it('reaches three tiles on each side twice and returns exactly to center', () => {
    expect([0, .3, .9, 1.5, 2.1, 2.4].map(wiggleOffset)).toEqual([0, -3, 3, -3, 3, 0]);
    const { sim, ctx } = world('wiggle'); activate(sim, ctx);
    const sweep = sim.signature.sweep, tail = new Vector3(), origin = new Vector3();
    wigglePointInto(origin, sweep, 1, 0);
    wigglePointInto(tail, sweep, 1, -3);
    expect(tail.distanceTo(origin)).toBeCloseTo(3);
    wigglePointInto(tail, sweep, 0, 3);
    expect(tail.distanceTo(sweep.points[0])).toBeCloseTo(0);
  });
  it('collects crossed orbs once with normal growth, leaving off-path orbs', () => {
    const { sim, ctx } = world('wiggle', { isStoryMode: () => true });
    sim.powerups = [0, 4].map(x => ({ x, y: 2, z: 4, dirKey: 'PZ', type: 'apple' }));
    sim.powerups.push({ x: 0, y: 4, z: 4, dirKey: 'PZ', type: 'apple' });
    const length = sim.tailLength;
    activate(sim, ctx); run(sim, ctx, WIGGLE_DURATION - .05);
    expect(eventsOf(ctx, 'pickup')).toHaveLength(2);
    expect(sim.tailLength).toBe(length + 6);
    expect(sim.powerups).toHaveLength(1); expect(sim.powerups[0].y).toBe(4);
  });
  it('freezes during pause and clears on death without releasing queued steering', () => {
    const { sim, ctx } = world('wiggle'); activate(sim, ctx);
    const elapsed = sim.signature.sweep.elapsed;
    ctx.isPaused = () => true; run(sim, ctx, 1);
    expect(sim.signature.sweep.elapsed).toBe(elapsed);
    ctx.isPaused = () => false; killWormSim(sim, ctx);
    expect(sim.signature.sweep).toBeNull(); expect(sim.pendingTurns).toHaveLength(0);
  });
  it('Prism keeps pickup colors and quantity intact; wildcard applies on deposit', () => {
    const { sim, ctx } = world('prism', { isStoryMode: () => true });
    sim.powerups = [{ x: 2, y: 3, z: 4, dirKey: 'PZ', type: 'apple' }];
    run(sim, ctx, 1.05);
    expect(eventsOf(ctx, 'pickup')).toHaveLength(1);
    expect(eventsOf(ctx, 'pickup')[0].args[4]).toBe(3);
    expect(sim.tailLength).toBe(7);
  });
});

it('caps dense Classic orb layouts at distinct surface tiles', () => {
  const sim = makeWormSim(3);
  resetWormSim(sim, 3, { orbCount: characterOrbCount(100, 'classic'), wormholeInterval: 9999 });
  expect(sim.powerups).toHaveLength(53);
  expect(new Set(sim.powerups.map(p => `${p.x},${p.y},${p.z},${p.dirKey}`)).size).toBe(53);
});
