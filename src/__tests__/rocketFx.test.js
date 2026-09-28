import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { ROCKET_DURATION, ROCKET_FLIGHT_LANDING, ROCKET_LANDING_GRACE } from '../worm/healerWorm/constants.js';
import {
  ROCKET_IGNITE_TIME, ROCKET_LIFTOFF_TIME, rocketBurnInto, rocketShakeAmount, rocketShakeInto, createRocketRandom,
  createSmokePool, clearSmokePool, emitPuff, stepSmokePool, puffLookInto
} from '../worm/healerWorm/rocketFx.js';

const CHANNELS = ['ignite', 'liftoff', 'landing', 'touchdown', 'thrust', 'hardware'];
const burnAt = (elapsed, flight = Math.min(1, elapsed)) => rocketBurnInto({}, true, ROCKET_DURATION - elapsed, flight, 0);

describe('rocket burn envelope', () => {
  it('is silent with no burn and no landing to show', () => {
    const burn = rocketBurnInto({}, false, 0, 0, 0);
    for (const key of CHANNELS) expect(burn[key]).toBe(0);
  });

  it('ignites fast, surges at liftoff and settles into the cruise flame', () => {
    const start = burnAt(0, 0);
    expect(start.ignite).toBe(0);
    expect(start.liftoff).toBe(1);
    expect(burnAt(ROCKET_IGNITE_TIME).ignite).toBe(1);
    const launch = burnAt(0.3), cruise = burnAt(ROCKET_LIFTOFF_TIME + 0.5);
    expect(launch.thrust).toBeGreaterThan(cruise.thrust);
    expect(cruise.liftoff).toBe(0);
    expect(cruise.landing).toBe(0);
    expect(cruise.thrust).toBeCloseTo(0.7, 6);
    expect(cruise.hardware).toBe(1);
  });

  it('throttles back over the descent', () => {
    const descent = burnAt(ROCKET_DURATION - ROCKET_FLIGHT_LANDING / 4, 0.25);
    expect(descent.landing).toBeCloseTo(0.75, 6);
    expect(descent.thrust).toBeLessThan(burnAt(3).thrust);
    expect(descent.thrust).toBeGreaterThan(0);
  });

  it('never blinks the flame or booster on a refuel and replays the surge as an afterburner', () => {
    const refuel = rocketBurnInto({}, true, ROCKET_DURATION, 1, 0);
    expect(refuel.ignite).toBe(1);
    expect(refuel.liftoff).toBe(1);
    expect(refuel.hardware).toBe(1);
    expect(refuel.thrust).toBeGreaterThan(burnAt(3).thrust);
  });

  it('kicks at touchdown, then stows the booster within the landing grace', () => {
    const land = rocketBurnInto({}, false, 0, 0, ROCKET_LANDING_GRACE);
    expect(land.touchdown).toBe(1);
    expect(land.hardware).toBe(1);
    expect(land.thrust).toBe(0);
    expect(rocketBurnInto({}, false, 0, 0, ROCKET_LANDING_GRACE * 0.7).touchdown).toBeCloseTo(0, 6);
    expect(rocketBurnInto({}, false, 0, 0, ROCKET_LANDING_GRACE * 0.4).hardware).toBe(0);
  });

  it('keeps every channel finite and bounded across a whole burn', () => {
    let flight = 0;
    for (let t = ROCKET_DURATION; t >= 0; t -= 1 / 30) {
      flight = Math.min(1, flight + 1 / 30, t / ROCKET_FLIGHT_LANDING);
      const burn = rocketBurnInto({}, true, t, flight, 0);
      for (const key of CHANNELS) {
        expect(Number.isFinite(burn[key])).toBe(true);
        expect(burn[key]).toBeGreaterThanOrEqual(0);
        // The booster may overshoot a little as it clunks into place; nothing else does.
        expect(burn[key]).toBeLessThanOrEqual(key === 'hardware' || key === 'thrust' ? 1.25 : 1);
      }
    }
  });
});

describe('rocket camera shake', () => {
  it('kicks hardest at ignition, rumbles in cruise and thumps at touchdown', () => {
    const launch = rocketShakeAmount(burnAt(0.2));
    const cruise = rocketShakeAmount(burnAt(3));
    const touchdown = rocketShakeAmount(rocketBurnInto({}, false, 0, 0, ROCKET_LANDING_GRACE));
    expect(launch).toBeGreaterThan(touchdown);
    expect(touchdown).toBeGreaterThan(cruise);
    expect(cruise).toBeGreaterThan(0);
    expect(rocketShakeAmount(rocketBurnInto({}, false, 0, 0, 0))).toBe(0);
  });

  it('stays within its amplitude, moves smoothly and rests at zero', () => {
    const out = new Vector3(), prev = new Vector3();
    rocketShakeInto(prev, 0, 0.05);
    for (let i = 1; i <= 600; i++) {
      rocketShakeInto(out, i / 600, 0.05);
      expect(Math.abs(out.x)).toBeLessThanOrEqual(0.05 + 1e-9);
      expect(Math.abs(out.y)).toBeLessThanOrEqual(0.05 + 1e-9);
      expect(out.z).toBe(0);
      expect(out.distanceTo(prev)).toBeLessThan(0.02);
      prev.copy(out);
    }
    expect(rocketShakeInto(out, 1.234, 0).length()).toBe(0);
  });
});

describe('rocket smoke pool', () => {
  const puff = { life: 1, size0: 0.1, size1: 0.5, alpha: 0.8, heat: 1, cool: 10, drag: 2 };

  it('is reproducible from a seed', () => {
    const a = createRocketRandom(7), b = createRocketRandom(7), c = createRocketRandom(8);
    const seqA = Array.from({ length: 20 }, a), seqB = Array.from({ length: 20 }, b);
    expect(seqA).toEqual(seqB);
    expect(Array.from({ length: 20 }, c)).not.toEqual(seqA);
    for (const v of seqA) expect(v >= 0 && v < 1).toBe(true);
  });

  it('never grows past its capacity and recycles the oldest puff', () => {
    const pool = createSmokePool(8);
    for (let i = 0; i < 20; i++) emitPuff(pool, i, 0, 0, 0, 0, 0, puff);
    expect(pool.live).toBe(8);
    // Slots hold the eight newest puffs (x = 12…19).
    expect([...Array(8).keys()].map(i => pool.pos[i * 3]).sort((m, n) => m - n)).toEqual([12, 13, 14, 15, 16, 17, 18, 19]);
    stepSmokePool(pool, 0.1);
    expect(pool.live).toBe(8);
  });

  it('drifts, slows under drag and expires on schedule', () => {
    const pool = createSmokePool(4);
    emitPuff(pool, 0, 0, 0, 2, 0, 0, puff);
    stepSmokePool(pool, 0.1);
    const x1 = pool.pos[0], v1 = pool.vel[0];
    expect(x1).toBeGreaterThan(0);
    expect(v1).toBeLessThan(2);
    stepSmokePool(pool, 0.1);
    expect(pool.pos[0]).toBeGreaterThan(x1);
    expect(pool.vel[0]).toBeLessThan(v1);
    for (let i = 0; i < 9; i++) stepSmokePool(pool, 0.1);
    expect(pool.live).toBe(0);
    expect(puffLookInto({}, pool, 0)).toBe(false);
  });

  it('holds still when no time passes (a paused burn)', () => {
    const pool = createSmokePool(4);
    emitPuff(pool, 1, 2, 3, 1, 1, 1, puff);
    const before = [...pool.pos.slice(0, 3), pool.age[0]];
    stepSmokePool(pool, 0);
    expect([...pool.pos.slice(0, 3), pool.age[0]]).toEqual(before);
  });

  it('grows, thins out and cools at each puff\'s own rate', () => {
    const pool = createSmokePool(4);
    emitPuff(pool, 0, 0, 0, 0, 0, 0, puff);
    emitPuff(pool, 0, 0, 0, 0, 0, 0, { ...puff, cool: 2 });
    const early = {}, late = {}, slow = {};
    stepSmokePool(pool, 0.1);
    puffLookInto(early, pool, 0);
    puffLookInto(slow, pool, 1);
    stepSmokePool(pool, 0.8);
    puffLookInto(late, pool, 0);
    expect(early.size).toBeGreaterThan(puff.size0);
    expect(late.size).toBeGreaterThan(early.size);
    expect(late.size).toBeLessThanOrEqual(puff.size1);
    expect(late.alpha).toBeLessThan(early.alpha);
    expect(late.heat).toBeLessThan(early.heat);
    expect(slow.heat).toBeGreaterThan(early.heat);
  });

  it('empties on clear', () => {
    const pool = createSmokePool(4);
    for (let i = 0; i < 3; i++) emitPuff(pool, 0, 0, 0, 0, 0, 0, puff);
    clearSmokePool(pool);
    expect(pool.live).toBe(0);
    for (let i = 0; i < 4; i++) expect(puffLookInto({}, pool, i)).toBe(false);
  });
});
