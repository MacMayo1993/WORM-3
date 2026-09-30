import { describe, it, expect } from 'vitest';
import { makeWormSim, resetWormSim, stepWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { orbCreditFace } from '../worm/healerWorm/economy.js';
import { makeCubies } from '../game/cubeState.js';

const SIZE = 5;

function makeCtx(cubies) {
  const events = [];
  const log = type => (...args) => { events.push({ type, args }); };
  const noop = () => {};
  return {
    events,
    getCubies: () => cubies,
    getGamePhase: () => 'active',
    isPaused: () => false,
    getSpeed: () => 1.0,
    getControlMode: () => 'non-oriented',
    getWormholeInterval: () => 9999,
    isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }),
    getHealingProgress: () => ({}),
    getOrbColor: face => `#face0${face}`,
    resolveTunnel: () => null,
    feel: noop, onDeath: noop, onTunnelEnter: noop, onCrawlResume: noop, onPhase: noop, onBoostState: noop,
    onSurvivalTick: noop, spawnWormholePair: noop, onFlippedTile: noop, applyDeposit: noop,
    onOrbPickup: log('pickup'), onPowerupsChanged: noop, applyHeal: noop, onSpecialsChanged: noop,
    onExplodeState: noop, onExpansionAmount: noop, onRocketState: noop, onMagnetState: noop,
    onOrbShowerState: noop, onSpecialSpawned: noop, onSpecialExpired: noop, onElementalTheme: noop,
    onViewPower: noop, onStoryMechanic: noop
  };
}

function stepUntilCommit(sim, ctx) {
  const from = tileKey(sim.pos);
  for (let i = 0; i < 200; i++) {
    stepWormSim(sim, 0.05, SIZE, ctx);
    if (tileKey(sim.pos) !== from) return;
  }
}

describe('parity orb credit', () => {
  it('credits the antipode of the tile, the colour of the orb’s body', () => {
    // White ↔ yellow, red ↔ orange, green ↔ blue, both ways.
    expect([1, 2, 3, 4, 5, 6].map(orbCreditFace)).toEqual([4, 5, 6, 1, 2, 3]);
    expect(orbCreditFace(0)).toBe(0);
  });

  it('adds the body’s colour to the reserve and the worm when an orb is eaten', () => {
    const cubies = makeCubies(SIZE);
    // Find the tile the worm steps onto next, then put an orb there.
    const probe = makeWormSim(SIZE);
    resetWormSim(probe, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    stepUntilCommit(probe, makeCtx(cubies));
    const next = probe.pos;
    const tileFace = cubies[next.x][next.y][next.z].stickers[next.dirKey].curr;

    const sim = makeWormSim(SIZE);
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    sim.powerups = [{ ...next, type: 'apple', spawnId: 'credit-test' }];
    const ctx = makeCtx(cubies);
    stepUntilCommit(sim, ctx);

    const credited = orbCreditFace(tileFace);
    expect(credited).not.toBe(tileFace);
    const [pickup] = ctx.events.filter(e => e.type === 'pickup');
    expect(pickup.args[0]).toBe(credited);        // reserve face
    expect(pickup.args[2]).toBe(`#face0${credited}`); // flash / bead colour
    expect(sim.orbPickupFaceIds).toEqual([credited]);
    expect(sim.orbPickupColors).toEqual([`#face0${credited}`]);
  });
});
