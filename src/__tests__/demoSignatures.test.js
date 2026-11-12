import { describe, expect, it } from 'vitest';
import { DEMO_SIGNATURE_LESSONS, stageDemoSignature, readDemoSignature } from '../worm/healerWorm/demoSignatures.js';
import { makeWormSim, resetWormSim, stepWormSim, queueTurn } from '../worm/healerWorm/wormSim.js';
import { makeCubies } from '../game/cubeState.js';
import { SIGNATURES } from '../worm/healerWorm/signatures.js';
import { computeOrbDeposit } from '../worm/healerWorm/economy.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

function setup(character) {
  resetLiveRotation();
  const sim = makeWormSim(5); resetWormSim(sim, 5, { orbCount: 0, wormholeInterval: 9999 });
  const lesson = DEMO_SIGNATURE_LESSONS.find(item => item.character === character);
  const practice = {}, inventory = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const cubies = stageDemoSignature(sim, 5, lesson, practice, makeCubies(5), inventory);
  const state = { wormOrbInventory: inventory, wormTunnelCount: 0 };
  const read = clock => readDemoSignature(sim, practice, lesson, state, 0.05, clock);
  return { sim, lesson, practice, cubies, inventory, state, read };
}

describe('optional character laboratory', () => {
  it('covers every shipped signature once without adding button-only completions', () => {
    expect(DEMO_SIGNATURE_LESSONS.map(l => l.character).sort()).toEqual(Object.keys(SIGNATURES).sort());
    expect(new Set(DEMO_SIGNATURE_LESSONS.map(l => l.id)).size).toBe(7);
    for (const { character } of DEMO_SIGNATURE_LESSONS) {
      const w = setup(character);
      w.sim.signature.character = character; w.sim.signature.seq = 1;
      expect(w.read().done).toBe(false);
    }
  });
  it('leaves unrelated lessons untouched', () => {
    const w = setup('classic');
    expect(readDemoSignature(w.sim, {}, { id: 'jump' }, w.state, 0.05)).toBeNull();
    expect(stageDemoSignature(w.sim, 5, { id: 'jump' }, {}, w.cubies, w.inventory)).toBe(w.cubies);
  });
  it('requires actual wildcard expenditure, healing, and a clear tail for Prism', () => {
    const w = setup('prism'), face = w.practice.signature.entryFace;
    expect(w.inventory[face]).toBe(0);
    expect(w.sim.orbPickupSegments).toEqual([3, 3]);
    expect(w.sim.orbPickupSegments.reduce((sum, n) => sum + n, 0)).toBe(Object.values(w.inventory).reduce((sum, n) => sum + n, 0));
    const args = { inventory: w.inventory, deposited: 0, entryFaceId: face, tailLength: w.sim.tailLength };
    expect(computeOrbDeposit({ ...args, isPrism: false })).toBeNull();
    const deposit = computeOrbDeposit({ ...args, isPrism: true });
    expect(deposit.n).toBe(4);
    w.sim.healed = 1;
    expect(w.read().done).toBe(false);
    w.state.wormOrbInventory = deposit.nextInventory;
    w.sim.tunnelPassages = [{}]; expect(w.read().done).toBe(false);
    w.sim.tunnelPassages = []; expect(w.read().done).toBe(true);
    w.sim.alive = false; expect(w.read().done).toBe(false);
  });
  it('requires Book to stop a clock that was running and then resume it', () => {
    const w = setup('book'), clock = { total: 10, secondsLeft: 10, held: false };
    w.read(clock); clock.secondsLeft = 9.95; w.read(clock);
    Object.assign(w.sim.signature, { character: 'book', seq: 1, active: 8 }); clock.held = true;
    for (let i = 0; i < 25; i++) expect(w.read(clock).done).toBe(false);
    w.sim.signature.active = 0; expect(w.read(clock).done).toBe(false);
    clock.held = false; clock.secondsLeft = 9.9; expect(w.read(clock).done).toBe(true);
  });
  it('does not confuse an always-held demo clock with Time Out', () => {
    const w = setup('book'); Object.assign(w.sim.signature, { character: 'book', seq: 1, active: 8 });
    for (let i = 0; i < 100; i++) w.read({ total: 10, secondsLeft: 10, held: true });
    w.sim.signature.active = 0;
    expect(w.read({ total: 10, secondsLeft: 9.9, held: false }).done).toBe(false);
  });
  it('requires Mobi creation and a completed ride rather than only a new tunnel', () => {
    const w = setup('mobi'); Object.assign(w.sim.signature, { character: 'mobi', seq: 1, mobiTunnel: { pairId: 'demo' } });
    expect(w.read().done).toBe(false); w.state.wormTunnelCount = 1;
    w.sim.phase = 'tunneling'; expect(w.read().done).toBe(false);
    w.sim.phase = 'crawling'; w.sim.tunnelPassages = [{}]; expect(w.read().done).toBe(false);
    w.sim.tunnelPassages = []; expect(w.read().done).toBe(true);
  });
});

// Exercise the staged pickups and body geometry through production physics,
// not synthetic completion flags. The clock and tunnel integration live in
// their existing mode/hook tests; these four need only the crawler simulation.
it.each(['classic', 'wiggle', 'inch', 'glow'])('%s staging is completable through real physics', character => {
  const w = setup(character);
  const base = {
    getCubies: () => w.cubies, getCharacter: () => character,
    getGamePhase: () => 'active', isPaused: () => false, getSpeed: () => 1,
    getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999,
    isPrismCharacter: () => false, getOrbInventory: () => w.inventory,
    getHealingProgress: () => ({}), getOrbColor: () => '#22ff88', resolveTunnel: () => null,
    onOrbPickup: () => {}, isDemoLesson: () => true, allowDemoSignature: () => true,
  };
  const ctx = new Proxy(base, { get: (target, key) => key in target ? target[key] : () => {} });
  queueTurn(w.sim, 'signature');
  let result;
  for (let i = 0; i < 400; i++) {
    stepWormSim(w.sim, 0.05, 5, ctx); result = w.read();
    if (result.done || !w.sim.alive) break;
  }
  expect(result.done, `${character}: ${result.progress}; ${w.sim.signature.notice}`).toBe(true);
});
