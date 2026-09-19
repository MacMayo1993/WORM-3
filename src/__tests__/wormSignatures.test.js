import { describe, it, expect, beforeEach } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { makeWormSim, resetWormSim, stepWormSim, queueTurn, killWormSim, applyRotationToSim, startJump, tryShedSkin, tileKey } from '../worm/healerWorm/wormSim.js';
import { signatureAvailability, signatureReadout, isParityLocked, SIGNATURES } from '../worm/healerWorm/signatures.js';
import { liveRotation, resetLiveRotation } from '../worm/liveRotation.js';
import { ttPush, shAt } from '../worm/circularBuffers.js';
import { rotateTilePosition } from '../worm/wormHelpers.js';

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
function tunnelWorld() {
  const w = world('mobi');
  const entry = { x: 2, y: 3, z: 4, dirKey: 'PZ' };
  const exit = { x: 2, y: 1, z: 0, dirKey: 'NZ' };
  w.cubies[2][3][4].stickers.PZ.curr = 4;
  const tunnel = { entry, exit, entryColor: 4, exitColor: 1 };
  w.ctx.resolveTunnel = () => ({ tunnel, tunnelKey: 'lock-test' });
  return { ...w, entry, tunnel };
}
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

describe('Glow: Pulse Beacon', () => {
  it('collects an adjacent orb, leaves a distant one, and keeps boost available', () => {
    const { sim, ctx } = world('glow');
    sim.powerups = [{ x: 3, y: 3, z: 4, dirKey: 'PZ', type: 'apple' }, { x: 0, y: 3, z: 4, dirKey: 'PZ', type: 'apple' }];
    activate(sim, ctx); run(sim, ctx, 1.05);
    expect(eventsOf(ctx, 'pickup')).toHaveLength(1);
    expect(sim.powerups[1].x).toBe(0);
    queueTurn(sim, 'boost'); step(sim, ctx); expect(sim.boostActiveT).toBeGreaterThan(0);
  });
  it('removes the extra pickup reach after expiry', () => {
    const { sim, ctx } = world('glow'); activate(sim, ctx);
    sim.signature.active = 0.01;
    sim.powerups = [{ x: 3, y: 3, z: 4, dirKey: 'PZ', type: 'apple' }];
    run(sim, ctx, 1.05);
    expect(eventsOf(ctx, 'pickup')).toHaveLength(0);
    expect(signatureReadout(sim, SIZE, ctx).ready).toBe(false);
  });
  it('does not shrink an existing magnet reach', () => {
    const { sim, ctx } = world('glow');
    sim.magnetT = sim.magnetMaxT = 10;
    sim.powerups = [{ x: 4, y: 3, z: 4, dirKey: 'PZ', type: 'apple' }];
    activate(sim, ctx); run(sim, ctx, 1.05);
    expect(eventsOf(ctx, 'pickup')).toHaveLength(1);
  });
});

describe('MOBI: Parity Lock', () => {
  it('crosses the sealed entrance without entering, healing, depositing or using it', () => {
    const { sim, ctx, entry, cubies } = tunnelWorld();
    const before = JSON.stringify(cubies);
    activate(sim, ctx); expect(isParityLocked(sim, entry)).toBe(true);
    run(sim, ctx, 1.5);
    expect(sim.phase).toBe('crawling'); expect(sim.onFlippedTile).toBe(false);
    for (const type of ['tunnelEnter', 'heal', 'deposit']) expect(eventsOf(ctx, type)).toHaveLength(0);
    expect(sim.tunnelUseCounts.size).toBe(0); expect(JSON.stringify(cubies)).toBe(before);
  });
  it('clears a stale pending trigger without stalling the crawl', () => {
    const { sim, ctx, entry } = tunnelWorld(); activate(sim, ctx);
    sim.pendingTunnelTrigger = entry;
    const elapsed = sim.stepAcc; step(sim, ctx);
    expect(sim.pendingTunnelTrigger).toBeNull(); expect(sim.stepAcc).toBeGreaterThan(elapsed);
  });
  it('restores normal entry when the seal expires under the worm', () => {
    const { sim, ctx } = tunnelWorld(); activate(sim, ctx); run(sim, ctx, 1.15);
    sim.signature.active = 0.01;
    run(sim, ctx, 0.35);
    // The 180 ms mouth alignment has finished by this observation time.
    expect(sim.phase).toBe('entering'); expect(eventsOf(ctx, 'tunnelEnter')).toHaveLength(1);
  });
  it('waits for a cube turn to settle before rearming an expired seal', () => {
    const { sim, ctx } = tunnelWorld(); activate(sim, ctx); run(sim, ctx, 1.15);
    liveRotation.active = true; sim.signature.active = 0.01;
    step(sim, ctx);
    expect(sim.pendingTunnelTrigger).toBeNull(); expect(sim.phase).toBe('crawling');
    resetLiveRotation(); run(sim, ctx, 0.35);
    expect(sim.phase).toBe('entering');
  });
  it('leaves other entrances dangerous', () => {
    const { sim, ctx, cubies } = tunnelWorld(); activate(sim, ctx);
    cubies[2][4][4].stickers.PZ.curr = 4;
    run(sim, ctx, 2.5);
    expect(sim.phase).toBe('entering'); expect(eventsOf(ctx, 'tunnelEnter')).toHaveLength(1);
  });
  it('does not spend the cooldown when no entrance is in front', () => {
    const { sim, ctx } = world('mobi'); activate(sim, ctx);
    expect(sim.signature.cooldown).toBe(0);
    expect(signatureReadout(sim, SIZE, ctx).reason).toBe('No entrance ahead');
  });
  it('refuses a voided entrance', () => {
    const { sim, ctx } = tunnelWorld(); sim.voidTunnelKeys.add('lock-test'); activate(sim, ctx);
    expect(sim.signature.cooldown).toBe(0);
  });
  it('carries the seal with its own layer in an opposite-direction paired turn', () => {
    const { sim, ctx, entry } = tunnelWorld(); activate(sim, ctx);
    const rotation = { axis: 'row', dir: 1, sliceIndex: 1, sliceIndices: [1, 3], sliceDirs: [1, -1] };
    applyRotationToSim(sim, SIZE, ctx, rotation, { inOpeningScramble: false, paused: false });
    expect(sim.signature.target).toMatchObject(rotateTilePosition(entry, 'row', 3, -1, SIZE));
    expect(isParityLocked(sim, entry)).toBe(false);
    expect(isParityLocked(sim, sim.signature.target)).toBe(true);
  });
});


describe('remaining signatures', () => {
  it('defines all seven characters', () => expect(Object.keys(SIGNATURES).sort()).toEqual(['book', 'classic', 'glow', 'inch', 'mobi', 'prism', 'wiggle']));
  it('arms Shed Skin only when the tail can pay and consumes it once', () => {
    const { sim, ctx } = world('classic'); activate(sim, ctx);
    expect(sim.signature.active).toBe(0);
    sim.tailLength = 16; ctx.getOrbInventory = () => ({ 1: 12 });
    sim.orbPickupFaceIds = [1, 1, 1, 1]; sim.orbPickupColors = ['a', 'b', 'c', 'd'];
    const shed = []; ctx.onTailShed = (...args) => shed.push(args);
    activate(sim, ctx); expect(sim.signature.active).toBeGreaterThan(0);
    expect(tryShedSkin(sim, ctx, 'body')).toBe(true);
    expect(sim.tailLength).toBeLessThanOrEqual(13);
    expect(shed).toHaveLength(1);
    expect(Object.values(shed[0][0]).reduce((a,b) => a+b, 0)).toBeLessThanOrEqual(sim.tailLength - 4);
    expect(tryShedSkin(sim, ctx, 'body')).toBe(false);
    expect(sim.alive).toBe(true);
  });
  it('consumes Shed Skin through the real pending-collision gameplay path', () => {
    const { sim, ctx } = world('classic'); sim.tailLength = 30;
    const body = '2,1,4,PZ'; ttPush(sim.tileTrail, body); ttPush(sim.tileTrail, tileKey(sim.pos));
    sim.pendingSelfCollision = { key: body };
    activate(sim, ctx);
    expect(sim.alive).toBe(true); expect(sim.signature.active).toBe(0);
    expect(sim.pendingSelfCollision).toBeNull(); expect(sim.tailLength).toBeLessThan(30);
  });
  it('does not protect Shed Skin from non-body deaths', () => {
    const { sim, ctx } = world('classic'); sim.tailLength = 10; activate(sim, ctx);
    killWormSim(sim, ctx, { reason: 'bomb' }); expect(sim.alive).toBe(false);
  });
  it('returns Book to its mark without restoring its spent inventory or progress', () => {
    const { sim, ctx } = world('book'); const mark = { ...sim.pos };
    activate(sim, ctx); run(sim, ctx, 1.1);
    expect(sim.pos).not.toEqual(mark);
    sim.tailLength = 4; const inventory = { 1: 1 }; ctx.getOrbInventory = () => inventory;
    const deposited = { tunnel: { deposited: 3 } }; ctx.getHealingProgress = () => deposited;
    activate(sim, ctx);
    expect(sim.pos).toEqual(mark); expect(sim.signature.active).toBe(0);
    expect(sim.signature.cooldown).toBeGreaterThan(28);
    expect(ctx.getOrbInventory()).toBe(inventory); expect(ctx.getHealingProgress()).toBe(deposited);
    expect(sim.tailLength).toBe(4); expect(eventsOf(ctx, 'pickup')).toHaveLength(0);
    for (let i = 0; i < sim.stepHistory.count; i++) {
      const sample = shAt(sim.stepHistory, i);
      expect([sample.tx, sample.ty, sample.tz]).toEqual([mark.x, mark.y, mark.z]);
    }
  });
  it('refuses a blocked Bookmark return while retaining the remaining return window', () => {
    const { sim, ctx, cubies } = world('book'); activate(sim, ctx); run(sim, ctx, 1.1);
    const target = sim.signature.target; cubies[target.x][target.y][target.z].stickers[target.dirKey].curr = 4;
    const pos = { ...sim.pos }; activate(sim, ctx);
    expect(sim.pos).toEqual(pos); expect(sim.signature.active).toBeGreaterThan(0);
    expect(sim.signature.notice).toContain('wormhole');
    run(sim, ctx, 3); expect(sim.signature.active).toBe(0);
  });
  it('rotates the Bookmark heading with its own cube slice', () => {
    const { sim, ctx } = world('book'); activate(sim, ctx);
    applyRotationToSim(sim, SIZE, ctx, { axis: 'depth', dir: 1, sliceIndex: 4 }, { inOpeningScramble: false, paused: false });
    expect(sim.signature.target.dirKey).toBe('PZ');
    expect(sim.signature.heading).not.toBe('up');
    expect(sim.signature.heading).toBe(sim.moveDir);
  });
  it('Wiggle dodges a tile toward the last steering side and resumes forward', () => {
    const { sim, ctx } = world('wiggle');
    queueTurn(sim, 'turnLeft'); // remembered even while the dodge consumes the queued steering
    activate(sim, ctx);
    expect(sim.pos).toEqual({ x: 1, y: 2, z: 4, dirKey: 'PZ' });
    expect(sim.signature.dashing).toBe(true); expect(sim.interpT).toBeGreaterThan(0); expect(sim.interpT).toBeLessThan(1);
    run(sim, ctx, 0.15); expect(sim.signature.dashing).toBe(false);
    expect(sim.moveDir).toBe('up'); expect(sim.alive).toBe(true);
    run(sim, ctx, 0.1); expect(sim.pos.y).toBe(3);
  });
  it('refuses a Wiggle landing on a mouth, body or another face without charging', () => {
    const { sim, ctx, cubies } = world('wiggle');
    cubies[3][2][4].stickers.PZ.curr = 4; activate(sim, ctx);
    expect(sim.signature.cooldown).toBe(0);
    cubies[3][2][4].stickers.PZ.curr = cubies[3][2][4].stickers.PZ.orig;
    ttPush(sim.tileTrail, '3,2,4,PZ'); ttPush(sim.tileTrail, tileKey(sim.pos)); sim.tailLength = 100;
    activate(sim, ctx); expect(sim.signature.cooldown).toBe(0);
    sim.pos.x = 4; activate(sim, ctx); expect(sim.signature.notice).toContain('Face edge');
  });
  it('Prism converts only three actual pickups, adding one segment each', () => {
    const { sim, ctx, cubies } = world('prism');
    const entry = { x: 0, y: 0, z: 4, dirKey: 'PZ' }; cubies[0][0][4].stickers.PZ.curr = 4;
    ctx.getActiveTunnels = () => [{ entry }]; ctx.resolveTunnel = () => ({ tunnelKey: 'test' });
    activate(sim, ctx); expect(sim.signature.charges).toBe(3);
    sim.powerups = Array.from({ length: 4 }, () => ({ x: 2, y: 3, z: 4, dirKey: 'PZ', type: 'apple' }));
    run(sim, ctx, 1.05);
    const pickups = eventsOf(ctx, 'pickup');
    expect(pickups).toHaveLength(4);
    expect(pickups.map(p => p.args[0])).toEqual([4, 4, 4, 1]);
    expect(pickups.map(p => p.args[4])).toEqual([4, 4, 4, 3]);
    expect(sim.signature.charges).toBe(0); expect(sim.signature.active).toBe(0);
    expect(sim.tailLength).toBe(19);
  });
});
