import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { makeWormSim, resetWormSim, stepWormSim, queueTurn, applyRotationToSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { voidTunnel, mendTunnel, isPitTile, remapTunnelKeys, rideExhausted } from '../worm/healerWorm/tunnelPits.js';
import { raisedPlatformPosition } from '../worm/healerWorm/raisedPlatforms.js';
import { FACE_NORMALS, WORMHOLE_MAX_TRAVERSALS } from '../worm/healerWorm/constants.js';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { wormExpansion } from '../worm/wormExpansion.js';
import { cubiePitFaces, wormPieceRaised } from '../game/raisedCubie.js';
import { getManifoldGridId } from '../game/coordinates.js';

// A tunnel holds three rides. The last collapses it behind the worm: both mouths
// become pits that kill if you crawl or drop into them, until a ring heal mends them.
const key = (a, b) => [tileKey(a), tileKey(b)].sort().join('|');
const noop = () => {};

describe('pit bookkeeping', () => {
  const blank = () => ({ voidTunnelKeys: new Set(), pitTiles: new Set(), pitVersion: 0, tunnelUseCounts: new Map(),
    chargedTunnels: new Set(), ringHealedTunnelKeys: new Set(), pendingVoidKill: null, currentTunnelKey: null,
    pendingTunnelHeal: null, tunnelPassages: [] });

  it('turns both mouths of a collapsed tunnel into pits until it is mended', () => {
    const sim = blank();
    const a = { x: 0, y: 1, z: 2, dirKey: 'PZ' }, b = { x: 2, y: 1, z: 0, dirKey: 'NZ' };
    voidTunnel(sim, key(a, b));
    expect(isPitTile(sim, a)).toBe(true);
    expect(isPitTile(sim, b)).toBe(true);
    expect(isPitTile(sim, { ...a, x: 1 })).toBe(false);
    const version = sim.pitVersion;
    voidTunnel(sim, key(a, b));
    expect(sim.pitVersion).toBe(version);
    mendTunnel(sim, key(a, b));
    expect(isPitTile(sim, a)).toBe(false);
    expect(sim.pitVersion).toBe(version + 1);
  });

  it('counts the third ride as the last', () => {
    const sim = blank();
    sim.tunnelUseCounts.set('k', WORMHOLE_MAX_TRAVERSALS - 1);
    expect(rideExhausted(sim, 'k')).toBe(false);
    sim.tunnelUseCounts.set('k', WORMHOLE_MAX_TRAVERSALS);
    expect(rideExhausted(sim, 'k')).toBe(true);
  });

  it('carries wear, collapse and charge through a slice turn, re-sorting each pair', () => {
    const sim = blank();
    const a = { x: 0, y: 1, z: 2, dirKey: 'PZ' }, b = { x: 2, y: 1, z: 0, dirKey: 'NZ' };
    const moved = { x: 9, y: 9, z: 9, dirKey: 'PX' };   // sorts after b once moved
    const k = key(a, b);
    sim.tunnelUseCounts.set(k, 2); sim.chargedTunnels.add(k);
    voidTunnel(sim, k);
    sim.tunnelPassages.push({ tunnelKey: k, heal: { tunnelKey: k } });
    sim.pendingVoidKill = { tunnelKey: k, traversals: 4 };
    const remapTile = tk => (tk === tileKey(a) ? tileKey(moved) : tk);
    remapTunnelKeys(sim, remapTile);
    const k2 = key(moved, b);
    expect(k2).not.toBe(k);
    expect(sim.tunnelUseCounts.get(k2)).toBe(2);
    expect(sim.tunnelUseCounts.has(k)).toBe(false);
    expect([...sim.voidTunnelKeys]).toEqual([k2]);
    expect([...sim.chargedTunnels]).toEqual([k2]);
    expect(sim.tunnelPassages[0]).toMatchObject({ tunnelKey: k2, heal: { tunnelKey: k2 } });
    expect(sim.pendingVoidKill.tunnelKey).toBe(k2);
    expect(isPitTile(sim, moved)).toBe(true);
    expect(isPitTile(sim, a)).toBe(false);
  });
});

describe('the last ride collapses the tunnel behind the worm', () => {
  const SIZE = 3;
  function world() {
    const cubies = makeCubies(SIZE);
    const entry = { x: 1, y: 2, z: 2, dirKey: 'PZ' };
    const exit = { x: 1, y: 0, z: 0, dirKey: 'NZ' };
    cubies[entry.x][entry.y][entry.z].stickers[entry.dirKey].curr = 4;
    cubies[exit.x][exit.y][exit.z].stickers[exit.dirKey].curr = 1;
    return { cubies, tunnel: { entry, exit, entryColor: 4, exitColor: 1 }, tunnelKey: key(entry, exit) };
  }
  const ctxFor = (cubies, tunnel, tunnelKey, overrides = {}) => {
    const events = [];
    const log = type => (...args) => events.push({ type, args });
    return { events, getCubies: () => cubies, getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 1,
      getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
      getOrbInventory: () => ({}), getHealingProgress: () => ({}), getOrbColor: () => '#fff',
      resolveTunnel: () => ({ tunnel, tunnelKey }), feel: log('feel'), onDeath: log('death'), onTunnelEnter: noop,
      onCrawlResume: noop, onPhase: noop, onBoostState: noop, onSurvivalTick: noop, spawnWormholePair: noop,
      onFlippedTile: noop, applyDeposit: noop, onOrbPickup: noop, onPowerupsChanged: noop, applyHeal: log('heal'),
      onSpecialsChanged: noop, onRocketState: noop, onMagnetState: noop, onSpecialSpawned: noop, onSpecialExpired: noop,
      ...overrides };
  };
  const runUntil = (sim, ctx, done, seconds = 40, dt = 0.05) => {
    for (let i = 0; i < seconds / dt; i++) { stepWormSim(sim, dt, SIZE, ctx); if (done()) return true; }
    return false;
  };

  it('caves in once the tail is clear: both mouths become pits and the worm lives', () => {
    const { cubies, tunnel, tunnelKey } = world();
    const sim = makeWormSim(SIZE);
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    const ctx = ctxFor(cubies, tunnel, tunnelKey);
    sim.tunnelUseCounts.set(tunnelKey, WORMHOLE_MAX_TRAVERSALS - 1);
    expect(runUntil(sim, ctx, () => sim.phase === 'crawling' && sim.tunnelPassages.length > 0)).toBe(true);
    // Out of the exit, tail still inside: nothing has collapsed yet.
    expect(sim.voidTunnelKeys.size).toBe(0);
    expect(runUntil(sim, ctx, () => sim.voidTunnelKeys.size > 0 || !sim.alive)).toBe(true);
    expect(sim.alive).toBe(true);
    expect(sim.voidTunnelKeys.has(tunnelKey)).toBe(true);
    expect(isPitTile(sim, tunnel.entry) && isPitTile(sim, tunnel.exit)).toBe(true);
    expect(ctx.events.filter(e => e.type === 'feel' && e.args[0] === 'collapse')).toHaveLength(1);
    expect(sim.tunnelPassages).toHaveLength(0);
  });

  it('heals instead when that last ride pays for it', () => {
    const { cubies, tunnel, tunnelKey } = world();
    const sim = makeWormSim(SIZE);
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    const ctx = ctxFor(cubies, tunnel, tunnelKey, {
      getHealingProgress: () => ({ 'PZ-1-2-2': { deposited: 4, faceId: 4 }, 'NZ-1-0-0': { deposited: 4, faceId: 1 } }),
    });
    sim.tunnelUseCounts.set(tunnelKey, WORMHOLE_MAX_TRAVERSALS - 1);
    expect(runUntil(sim, ctx, () => ctx.events.some(e => e.type === 'heal') || !sim.alive)).toBe(true);
    expect(sim.alive).toBe(true);
    expect(sim.voidTunnelKeys.size).toBe(0);
    expect(sim.pitTiles.size).toBe(0);
  });

  it('carries a pit through a slice turn that moves one of its mouths', () => {
    const { cubies, tunnel, tunnelKey } = world();
    const sim = makeWormSim(SIZE);
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    const ctx = ctxFor(cubies, tunnel, tunnelKey);
    voidTunnel(sim, tunnelKey);
    sim.tunnelUseCounts.set(tunnelKey, 3);
    // The exit (z = 0) turns with the back layer; the entry stays.
    applyRotationToSim(sim, SIZE, ctx, { axis: 'depth', sliceIndex: 0, dir: 1 }, { inOpeningScramble: false, paused: false });
    expect(sim.voidTunnelKeys.size).toBe(1);
    expect(sim.voidTunnelKeys.has(tunnelKey)).toBe(false);
    expect(isPitTile(sim, tunnel.entry)).toBe(true);
    expect(isPitTile(sim, tunnel.exit)).toBe(false);
    expect(sim.pitTiles.size).toBe(2);
    const [moved] = [...sim.voidTunnelKeys];
    expect(sim.tunnelUseCounts.get(moved)).toBe(3);
  });
});

describe('a pit in the floor', () => {
  const size = 5;
  beforeEach(() => { resetLiveRotation(); wormExpansion.amount = 0; });
  // The worm crawls along PZ toward a collapsed tunnel's mouth one tile ahead.
  function stage({ pitsAhead = 1 } = {}) {
    const cubies = makeCubies(size), sim = makeWormSim(size);
    resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
    const source = { x: 1, y: 2, z: 4, dirKey: 'PZ' };
    sim.pos = source; sim._curWP.fromArray(getStickerWorldPos(source.x, source.y, source.z, 'PZ', size, 0));
    sim.curWorldPos = sim._curWP; sim.headInterpPos.copy(sim._curWP); sim.currentNormal.copy(FACE_NORMALS.PZ);
    sim.moveDir = 'right';
    const pits = [];
    let tile = source;
    for (let i = 0; i < pitsAhead; i++) {
      tile = getNextSurfacePosition(tile, 'right', size);
      tile = { x: tile.x, y: tile.y, z: tile.z, dirKey: tile.dirKey };
      const twin = { x: size - 1 - tile.x, y: size - 1 - tile.y, z: 0, dirKey: 'NZ' };
      for (const t of [tile, twin]) Object.assign(cubies[t.x][t.y][t.z].stickers[t.dirKey], { flips: 1, curr: 7 });
      voidTunnel(sim, key(tile, twin));
      pits.push(tile);
    }
    const ctx = {
      getCubies: () => cubies, getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 2,
      getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
      getOrbInventory: () => ({}), getHealingProgress: () => ({}), getOrbColor: () => '#ffffff',
      getTunnelEntry: () => 'pad', resolveTunnel: () => null, feel: noop, onDeath: vi.fn(),
      onTunnelEnter: noop, onCrawlResume: noop, onPhase: vi.fn(), onBoostState: noop, onSurvivalTick: noop,
      spawnWormholePair: noop, onFlippedTile: noop, applyDeposit: noop, onOrbPickup: vi.fn(),
      onPowerupsChanged: noop, applyHeal: noop, onSpecialsChanged: noop, onRocketState: noop,
      onJumpRescue: vi.fn(),
      isPitFace: (x, y, z, dirKey) => sim.pitTiles.has(`${x},${y},${z},${dirKey}`),
    };
    return { sim, ctx, cubies, pits };
  }
  const step = ({ sim, ctx }, dt = 0.02) => stepWormSim(sim, dt, size, ctx);

  it('is neither a raised platform nor a landing', () => {
    const { ctx, pits } = stage();
    expect(raisedPlatformPosition(pits[0], size, ctx)).toBeNull();
  });

  it('stops the worm at its rim with the pit cue, then drops it in if nothing is pressed', () => {
    const s = stage();
    for (let i = 0; i < 100 && !s.sim.cautionRescue; i++) step(s);
    expect(s.sim.cautionRescue).toMatchObject({ pit: true, tile: s.pits[0] });
    expect(s.ctx.onJumpRescue).toHaveBeenCalledWith(true, 'pit');
    for (let i = 0; i < 400 && s.sim.alive; i++) step(s);
    expect(s.sim.alive).toBe(false);
    expect(s.ctx.onDeath.mock.calls[0][0]).toMatchObject({ reason: 'pit', headTile: tileKey(s.pits[0]) });
  });

  it.each(['turnLeft', 'turnRight'])('lets the worm turn away at the rim (%s)', input => {
    const s = stage();
    for (let i = 0; i < 100 && !s.sim.cautionRescue; i++) step(s);
    queueTurn(s.sim, input); step(s);
    for (let i = 0; i < 60; i++) step(s);
    expect(s.sim.alive).toBe(true);
    expect(s.ctx.onDeath).not.toHaveBeenCalled();
  });

  it('lets the worm jump clear over it', () => {
    const s = stage();
    for (let i = 0; i < 100 && !s.sim.cautionRescue; i++) step(s);
    queueTurn(s.sim, 'jump'); step(s);
    for (let i = 0; i < 120; i++) step(s);
    expect(s.sim.alive).toBe(true);
    expect(s.ctx.onDeath).not.toHaveBeenCalled();
  });

  it('swallows a worm that comes down in it', () => {
    const s = stage({ pitsAhead: 3 });
    // Airborne over the run of pits: no rim to stop on, the landing is a fall.
    queueTurn(s.sim, 'jump');
    for (let i = 0; i < 400 && s.sim.alive; i++) step(s);
    expect(s.sim.alive).toBe(false);
    expect(s.ctx.onDeath.mock.calls[0][0].reason).toBe('pit');
    expect(s.ctx.onPhase).toHaveBeenCalledWith('falling');
  });
});

describe('a pit no longer holds its piece up', () => {
  it('lowers a piece whose only live flipped face has collapsed, by grid id', () => {
    const size = 3, cap = 6;
    const cubies = makeCubies(size);
    const cubie = cubies[1][2][2];
    Object.assign(cubie.stickers.PZ, { flips: 1, curr: 4 });
    expect(wormPieceRaised(cubie, cap, '')).toBe(true);
    const grids = [getManifoldGridId(cubie.stickers.PZ, size)];
    const faces = cubiePitFaces(cubie, cap, size, grids);
    expect(faces).toBe('PZ');
    expect(wormPieceRaised(cubie, cap, faces)).toBe(false);
    expect(cubiePitFaces(cubie, cap, size, [])).toBe('');
  });
});

describe('a pit sits in its slot for every renderer', () => {
  it('puts portal visuals and the fence on the floor, not on a raised pad', async () => {
    const { raisedPortalPosition, raisedPortalLift } = await import('../worm/raisedPortalPosition.js');
    const { buildCautionPerimeter } = await import('../worm/healerWorm/cautionPerimeter.js');
    const { useGameStore } = await import('../hooks/useGameStore.js');
    const size = 3, cubies = makeCubies(size);
    const tile = { x: 1, y: 2, z: 2, dirKey: 'PZ' };
    Object.assign(cubies[1][2][2].stickers.PZ, { flips: 1, curr: 4 });
    const grid = getManifoldGridId(cubies[1][2][2].stickers.PZ, size);
    const base = { ...useGameStore.getState(), cubies, size, wormHealerMode: true, chaosLevel: 0 };
    const floor = getStickerWorldPos(1, 2, 2, 'PZ', size, wormExpansion.amount);
    const live = raisedPortalPosition(1, 2, 2, 'PZ', size, { ...base, wormPitGrids: [] });
    const pit = raisedPortalPosition(1, 2, 2, 'PZ', size, { ...base, wormPitGrids: [grid] });
    expect(live[2]).toBeGreaterThan(floor[2] + 0.2);
    expect(pit).toEqual(floor);
    expect(raisedPortalLift(1, 2, 2, 'PZ', { ...base, wormPitGrids: [grid] })).toBe(0);
    // The tape rings the pit's own mouth; the rest of its (no longer raised) piece goes unfenced.
    const fenced = buildCautionPerimeter([tile], cubies, size, 6, false, null, []);
    const pitFence = buildCautionPerimeter([tile], cubies, size, 6, false, null, [grid]);
    expect(pitFence.edges.length).toBe(4);
    expect(fenced.edges.length).toBeGreaterThan(pitFence.edges.length);
  });
});
