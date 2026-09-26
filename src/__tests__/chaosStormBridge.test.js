// The render-only channel from the chaos worker to the storm, the tunnel charge
// clock the wormhole renderers share with it, and the cubie kick a landing bolt
// delivers. All three are module state read every frame, so what matters is that
// they stay bounded, deterministic, and always come to rest.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORM_QUEUE_MAX,
  chaosStorm,
  pushChaosStormEvents,
  drainChaosStormEvents,
  pendingChaosStormEvents,
  clearChaosStorm,
  tunnelCharges,
  setTunnelCharge,
  tunnelChargeState,
  pruneTunnelCharges,
  CHARGE_TIMING,
  tunnelFocus,
  publishTunnelFocus
} from '../manifold/chaosStormBridge.js';
import { cubieKicks, fireCubieKick, cubieKickAmount, clearCubieKicks, KICK_DURATION_MS } from '../3d/cubieKick.js';

beforeEach(() => {
  clearChaosStorm();
  clearCubieKicks();
});

describe('storm event queue', () => {
  it('drains oldest first and empties', () => {
    pushChaosStormEvents([{ n: 1 }, { n: 2 }]);
    pushChaosStormEvents([{ n: 3 }]);
    const seen = [];
    expect(drainChaosStormEvents((ev) => seen.push(ev.n))).toBe(3);
    expect(seen).toEqual([1, 2, 3]);
    expect(pendingChaosStormEvents()).toBe(0);
  });

  it('stays bounded when nothing drains it, keeping the newest events', () => {
    const events = Array.from({ length: STORM_QUEUE_MAX + 10 }, (_, n) => ({ n }));
    pushChaosStormEvents(events);
    expect(pendingChaosStormEvents()).toBe(STORM_QUEUE_MAX);
    const seen = [];
    drainChaosStormEvents((ev) => seen.push(ev.n));
    expect(seen[0]).toBe(10);
    expect(seen.at(-1)).toBe(STORM_QUEUE_MAX + 9);
  });

  it('clearing drops pending work, every tunnel charge, and bumps the generation', () => {
    pushChaosStormEvents([{ n: 1 }]);
    setTunnelCharge('M1-001|M4-001', 'M1-001', 0);
    const gen = chaosStorm.gen;
    clearChaosStorm();
    expect(pendingChaosStormEvents()).toBe(0);
    expect(tunnelCharges.size).toBe(0);
    expect(chaosStorm.gen).toBe(gen + 1);
  });
});

describe('tunnel charge clock', () => {
  const sample = (charge, t) => ({ ...tunnelChargeState(charge, charge.startMs + t) });

  it('runs its front from the struck tile to the twin, monotonically, then arrives', () => {
    const charge = setTunnelCharge('p', 'M1-001', 1000, 'surge');
    const { travelMs } = CHARGE_TIMING.surge;
    let last = -1;
    for (let t = 0; t <= travelMs; t += travelMs / 12) {
      const s = sample(charge, t);
      expect(s.active).toBe(true);
      expect(s.front).toBeGreaterThanOrEqual(last);
      last = s.front;
    }
    expect(sample(charge, 0).front).toBe(0);
    expect(sample(charge, travelMs).front).toBeCloseTo(1);
    expect(sample(charge, travelMs - 1).arrived).toBe(false);
    expect(sample(charge, travelMs).arrived).toBe(true);
  });

  it('glows while travelling, crackles out through the linger, and ends exactly', () => {
    const charge = setTunnelCharge('p', 'M1-001', 0, 'surge');
    const { travelMs, lingerMs, strength } = CHARGE_TIMING.surge;
    expect(sample(charge, travelMs / 2).glow).toBeCloseTo(strength);
    const early = sample(charge, travelMs + lingerMs * 0.2).glow;
    const late = sample(charge, travelMs + lingerMs * 0.8).glow;
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
    expect(sample(charge, travelMs + lingerMs).active).toBe(false);
    expect(sample(charge, -1).active).toBe(false);
    expect(tunnelChargeState(null, 0).active).toBe(false);
  });

  it('gives a wormhole birth a slower, brighter surge than a routine flip', () => {
    expect(CHARGE_TIMING.birth.travelMs).toBeGreaterThan(CHARGE_TIMING.surge.travelMs);
    expect(CHARGE_TIMING.birth.strength).toBeGreaterThan(CHARGE_TIMING.surge.strength);
    expect(setTunnelCharge('p', 'a', 0, 'no-such-kind').travelMs).toBe(CHARGE_TIMING.surge.travelMs);
  });

  it('prunes only finished charges, and a re-charge restarts the pair', () => {
    setTunnelCharge('a', 'x', 0, 'surge');
    setTunnelCharge('b', 'y', 500, 'surge');
    const end = CHARGE_TIMING.surge.travelMs + CHARGE_TIMING.surge.lingerMs;
    expect(pruneTunnelCharges(end)).toBe(1);
    expect(tunnelCharges.has('b')).toBe(true);
    setTunnelCharge('b', 'z', 2000, 'birth');
    expect(tunnelCharges.get('b')).toMatchObject({ startMs: 2000, fromGridId: 'z', kind: 'birth' });
  });
});

describe('tunnel focus', () => {
  it('only clears the set it published', () => {
    const a = new Set(['a']);
    const b = new Set(['b']);
    const releaseA = publishTunnelFocus(a);
    const releaseB = publishTunnelFocus(b);
    releaseA();
    expect(tunnelFocus.ids).toBe(b);
    releaseB();
    expect(tunnelFocus.ids.size).toBe(0);
  });
});

describe('cubie kick', () => {
  it('punches in first, rebounds out, and settles to exactly zero', () => {
    const amp = 0.1;
    expect(cubieKickAmount(0, amp)).toBeCloseTo(0);
    expect(cubieKickAmount(KICK_DURATION_MS * 0.15, amp)).toBeLessThan(0);
    const samples = Array.from({ length: 50 }, (_, i) => cubieKickAmount((KICK_DURATION_MS * i) / 50, amp));
    expect(Math.max(...samples)).toBeGreaterThan(0);
    for (const v of samples) expect(Math.abs(v)).toBeLessThanOrEqual(amp);
    expect(cubieKickAmount(KICK_DURATION_MS, amp)).toBe(0);
    expect(cubieKickAmount(-5, amp)).toBe(0);
  });

  it('normalises the direction and merges a second hit into one heavy blow', () => {
    fireCubieKick('1,1,2', { x: 0, y: 0, z: 2 }, 0.1, 0);
    expect(cubieKicks.get('1,1,2')).toMatchObject({ x: 0, y: 0, z: 1, amp: 0.1, startMs: 0 });
    fireCubieKick('1,1,2', { x: 0, y: 0, z: 1 }, 0.05, 100);
    const merged = cubieKicks.get('1,1,2');
    expect(merged.startMs).toBe(100);
    expect(merged.amp).toBeGreaterThanOrEqual(0.05);
    expect(merged.amp).toBeLessThanOrEqual(0.1);
    fireCubieKick('0,0,0', { x: 1, y: 0, z: 0 }, 0, 0);
    expect(cubieKicks.has('0,0,0')).toBe(false);
  });
});
