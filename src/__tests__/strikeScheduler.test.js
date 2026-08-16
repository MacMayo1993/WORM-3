// The lightning strike schedule, on a fake clock with a seeded generator.
//
// The strikes are pure staging — "the worm is a lightning rod" — so the things
// worth pinning are the fairness gates, not the look: never while the player is not
// in control, never at something off screen, never twice running on the same body
// point, never from Math.random, and never a write back into the simulation.
import { describe, it, expect, vi } from 'vitest';
import {
  makeStrikeState,
  tickStrikes,
  STRIKE_MIN_GAP,
  STRIKE_MAX_GAP,
  STRIKE_RETRY_GAP
} from '../worm/healerWorm/strikeScheduler.js';

const DT = 1 / 60;

/** Run the schedule for `seconds` and collect every strike it emits. */
function run(state, seconds, ctx) {
  const out = [];
  for (let t = 0; t < seconds; t += DT) {
    const s = tickStrikes(state, DT, ctx);
    if (s) out.push(s);
  }
  return out;
}

const live = (targetCount = 8) => ({ enabled: true, targetCount });

describe('strike scheduling', () => {
  it('strikes repeatedly while a lightning wash is up', () => {
    const strikes = run(makeStrikeState(7), 30, live());
    expect(strikes.length).toBeGreaterThan(5);
  });

  it('waits before the first strike rather than firing on the claim frame', () => {
    // The player should see the cube charge before anything hits them.
    expect(run(makeStrikeState(7), STRIKE_MIN_GAP * 0.9, live())).toHaveLength(0);
  });

  it('respects the minimum gap between strikes', () => {
    const state = makeStrikeState(3);
    let sinceLast = 0;
    const gaps = [];
    for (let t = 0; t < 60; t += DT) {
      sinceLast += DT;
      if (tickStrikes(state, DT, live())) { gaps.push(sinceLast); sinceLast = 0; }
    }
    expect(gaps.length).toBeGreaterThan(10);
    for (const g of gaps.slice(1)) {
      expect(g).toBeGreaterThanOrEqual(STRIKE_MIN_GAP - DT);
      expect(g).toBeLessThanOrEqual(STRIKE_MAX_GAP + DT);
    }
  });

  it('never hits the same body point twice running', () => {
    const strikes = run(makeStrikeState(11), 90, live());
    expect(strikes.length).toBeGreaterThan(10);
    for (let i = 1; i < strikes.length; i++) {
      expect(strikes[i].targetIndex).not.toBe(strikes[i - 1].targetIndex);
    }
  });

  it('only ever targets a body point that exists', () => {
    for (const targetCount of [2, 5, 40]) {
      for (const s of run(makeStrikeState(5), 40, live(targetCount))) {
        expect(s.targetIndex).toBeGreaterThanOrEqual(0);
        expect(s.targetIndex).toBeLessThan(targetCount);
      }
    }
  });
});

describe('strike gates', () => {
  it('fires nothing while disabled — pause, tunnel, death, claim freeze, reduced motion', () => {
    // The renderer folds every one of those into `enabled`; this is the single
    // switch that has to hold them all.
    expect(run(makeStrikeState(7), 120, { enabled: false, targetCount: 8 })).toHaveLength(0);
  });

  it('fires nothing when the worm has no body points', () => {
    expect(run(makeStrikeState(7), 120, { enabled: true, targetCount: 0 })).toHaveLength(0);
  });

  it('holds the schedule through an interruption instead of restarting it', () => {
    // Resetting the wait on every gate would mean a board with frequent tunnel
    // transits never sees a strike at all.
    const held = makeStrikeState(7);
    run(held, STRIKE_MAX_GAP, { enabled: false, targetCount: 8 });
    const afterPause = run(held, STRIKE_MAX_GAP + 0.1, live());

    const fresh = makeStrikeState(7);
    const uninterrupted = run(fresh, STRIKE_MAX_GAP + 0.1, live());
    expect(afterPause.length).toBe(uninterrupted.length);
  });

  it('never strikes a body point the camera cannot see', () => {
    const visibleSet = new Set([2, 3]);
    for (const s of run(makeStrikeState(9), 60, { ...live(), visible: (i) => visibleSet.has(i) })) {
      expect(visibleSet.has(s.targetIndex)).toBe(true);
    }
  });

  it('goes quiet when the whole worm is off camera, and resumes when it returns', () => {
    const state = makeStrikeState(9);
    expect(run(state, 30, { ...live(), visible: () => false })).toHaveLength(0);
    expect(run(state, 30, live()).length).toBeGreaterThan(0);
  });

  it('re-checks promptly rather than burning a full gap when nothing is strikeable', () => {
    const state = makeStrikeState(9);
    run(state, STRIKE_MAX_GAP + 0.1, { ...live(), visible: () => false });
    expect(state.t).toBeLessThanOrEqual(STRIKE_RETRY_GAP + 1e-6);
  });

  it('cannot pick a target when only the last-struck point is visible', () => {
    const state = makeStrikeState(4);
    run(state, 30, live(6));
    const only = state.lastTarget;
    expect(run(state, 30, { ...live(6), visible: (i) => i === only })).toHaveLength(0);
  });
});

describe('strike determinism', () => {
  it('never calls Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    run(makeStrikeState(13), 60, live());
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('replays identically from the same seed', () => {
    const a = run(makeStrikeState(21), 60, live());
    const b = run(makeStrikeState(21), 60, live());
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(5);
  });

  it('differs between seeds, so two sessions do not strike in lockstep', () => {
    const a = run(makeStrikeState(21), 60, live());
    const b = run(makeStrikeState(22), 60, live());
    expect(a).not.toEqual(b);
  });

  it('hands the renderer a stable bolt seed and a monotonic id', () => {
    const strikes = run(makeStrikeState(31), 60, live());
    expect(strikes.length).toBeGreaterThan(3);
    for (const [i, s] of strikes.entries()) {
      expect(Number.isFinite(s.seed)).toBe(true);
      expect(s.id).toBe(i + 1);
    }
  });

  it('touches nothing but its own state', () => {
    // The scheduler takes no sim handle by construction; this pins that the context
    // it IS given is never written to either.
    const ctx = Object.freeze({ enabled: true, targetCount: 8 });
    expect(() => run(makeStrikeState(1), 30, ctx)).not.toThrow();
  });
});
