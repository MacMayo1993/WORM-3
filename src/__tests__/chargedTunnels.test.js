import { describe, it, expect } from 'vitest';
import { makeWormSim, resetWormSim, stepWormSim, CHARGED_TOLL } from '../worm/healerWorm/wormSim.js';
import { makeCubies } from '../game/cubeState.js';

const SIZE = 3;

// The first tile the worm reaches is flipped and has an antipodal partner on the back face.
function world() {
  const cubies = makeCubies(SIZE);
  const entry = { x: 1, y: 2, z: 2, dirKey: 'PZ' };
  const exit = { x: 1, y: 0, z: 0, dirKey: 'NZ' };
  cubies[entry.x][entry.y][entry.z].stickers[entry.dirKey].curr = 4;
  cubies[exit.x][exit.y][exit.z].stickers[exit.dirKey].curr = 1;
  return { cubies, tunnel: { entry, exit, entryColor: 4, exitColor: 1 }, tunnelKey: 'strike-tunnel' };
}

function ride({ charged, orbs = 0, tail = 3 }) {
  const { cubies, tunnel, tunnelKey } = world();
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  sim.tailLength = tail;
  if (charged) sim.chargedTunnels.add(tunnelKey);
  const deposits = [];
  const noop = () => {};
  const ctx = {
    getCubies: () => cubies, getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 1,
    getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: orbs, 5: 0, 6: 0 }), getHealingProgress: () => ({}),
    getOrbColor: () => '#fff', resolveTunnel: () => ({ tunnel, tunnelKey }),
    feel: noop, onDeath: noop, onTunnelEnter: noop, onCrawlResume: noop, onPhase: noop, onBoostState: noop,
    onSurvivalTick: noop, spawnWormholePair: noop, onFlippedTile: noop, applyDeposit: d => deposits.push(d),
    onOrbPickup: noop, onPowerupsChanged: noop, applyHeal: noop, onSpecialsChanged: noop,
  };
  for (let i = 0; i < 40 && sim.phase === 'crawling'; i++) stepWormSim(sim, 0.05, SIZE, ctx);
  return { sim, deposits };
}

describe('charged tunnels', () => {
  it('an ordinary tunnel with no orbs to pay records no deposit', () => {
    const { sim, deposits } = ride({ charged: false });
    expect(sim.phase).toBe('windup');
    expect(deposits).toHaveLength(0);
  });

  it('a charged one pays its own toll without touching the worm or its orbs', () => {
    const { sim, deposits } = ride({ charged: true });
    expect(sim.phase).toBe('windup');
    expect(deposits).toHaveLength(1);
    expect(deposits[0].nextDeposited).toBe(CHARGED_TOLL);
    expect(deposits[0].nextInventory).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    expect(sim.tailLength).toBe(3);
  });

  it('the worm still pays the rest of the toll from its own orbs', () => {
    const { deposits } = ride({ charged: true, orbs: 9, tail: 30 });
    expect(deposits).toHaveLength(2);
    expect(deposits[0].nextDeposited).toBe(CHARGED_TOLL);
    expect(deposits[1].nextDeposited).toBe(4);   // HEAL_COST: the charge covered 2, the worm 2
    expect(deposits[1].nextInventory[4]).toBe(7);
  });

  it('a reset forgets which tunnels were charged', () => {
    const sim = makeWormSim(SIZE);
    sim.chargedTunnels.add('a');
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    expect(sim.chargedTunnels.size).toBe(0);
  });
});
