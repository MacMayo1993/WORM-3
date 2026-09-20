import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { makeGapTraversal, advanceGap, setReachHeld, sampleGapBodyInto } from '../worm/traversal/gapTraversal.js';
import { makeBridgeCurve, fitBridgeToLength, sampleBridgeInto, bridgeHitsBoxes } from '../worm/traversal/bridgeCurve.js';
import { bodyLength, missingOrdinaryOrbs, HOLD_LENGTH } from '../worm/traversal/bodyMaterial.js';
const p = new Vector3(), n = new Vector3(), f = new Vector3();
function until(s, phase, limit = 15000) {
  for (let i = 0; i < limit && s.phase !== phase; i++) {
    advanceGap(s, 1 / 120);
    expect(s.ledger.total).toBeCloseTo(s.length, 9);
    if (s.curve) expect(bridgeHitsBoxes(s.curve, [...s.supports, ...s.obstacles], .10)).toBe(false);
    expect(Math.min(s.ledger.departure, s.ledger.free, s.ledger.landing)).toBeGreaterThanOrEqual(0);
  }
  expect(s.phase).toBe(phase);
}
describe('conserved reach, catch, sag and pull', () => {
  it.each([-.3, 0, .3])('crosses landing height %s with retained departure support after catch', landingHeight => {
    const s = makeGapTraversal({ landingHeight });
    expect(s.reason).toBe('READY'); expect(s.bridge.sag).toBeGreaterThan(.05);
    setReachHeld(s, true); until(s, 'latch');
    expect(s.sourceAttached).toBe(true); expect(s.targetAttached).toBe(true);
    expect(s.ledger.departure).toBeGreaterThan(HOLD_LENGTH);
    expect(s.reservations.size).toBe(2);
    sampleGapBodyInto(s, 0, p, n, f); expect(p.distanceTo(s.b)).toBeLessThan(1e-8);
    setReachHeld(s, false); until(s, 'pull');
    expect(s.ledger.departure).toBeGreaterThan(HOLD_LENGTH);
    sampleGapBodyInto(s, s.bridge.length / 2, p, n, f);
    expect(p.y).toBeLessThan((s.a.y + s.b.y) / 2 - .05);
    while (s.sourceAttached) advanceGap(s, 1 / 120);
    expect(s.spanOccupied).toBe(true); expect(s.reservations.has('landing')).toBe(true);
    expect(s.reservations.has('departure')).toBe(false);
    until(s, 'complete');
    expect(s.spanOccupied).toBe(false); expect(s.reservations.size).toBe(0);
    expect(s.ledger.landing).toBeCloseTo(s.length, 9);
    expect(s.stats).toEqual({ catches: 1, completions: 1, cancellations: 0, recoveries: 0 });
    advanceGap(s, .1); expect(s.stats.completions).toBe(1);
  });
  it('reports exact ordinary-orb shortage and never starts an impossible or blocked reach', () => {
    const s = makeGapTraversal({ segments: 4 });
    expect(bodyLength(4)).toBeCloseTo(.27); expect(s.missingOrbs).toBe(4);
    expect(missingOrdinaryOrbs(bodyLength(7), 4)).toBe(1);
    for (const blocked of [s, makeGapTraversal({ obstacle: true })]) {
      setReachHeld(blocked, true); advanceGap(blocked, .1);
      expect(blocked.phase).toBe('idle'); expect(blocked.reservations.size).toBe(0);
    }
    expect(makeGapTraversal({ segments: 4 + s.missingOrbs * 3 }).reason).toBe('READY');
  });
  it('retracts an uncaught tip smoothly with no landing attachment and allows retry', () => {
    const s = makeGapTraversal(); setReachHeld(s, true); until(s, 'reach');
    advanceGap(s, .1); advanceGap(s, .1);
    const before = s.headDistance; expect(before).toBeGreaterThan(0);
    setReachHeld(s, false); until(s, 'retract');
    expect(s.targetAttached).toBe(false);
    advanceGap(s, 1 / 120); expect(s.headDistance).toBeLessThan(before);
    until(s, 'idle'); expect(s.stats.cancellations).toBe(1); expect(s.stats.catches).toBe(0);
    expect(s.ledger.departure).toBeCloseTo(s.length);
    setReachHeld(s, true); until(s, 'complete'); expect(s.stats.completions).toBe(1);
  });
  it('freezes on pause, bounds resume debt and releases reservations when geometry changes', () => {
    const s = makeGapTraversal(); setReachHeld(s, true); until(s, 'latch');
    const snapshot = JSON.stringify(s); s.paused = true;
    advanceGap(s, 20); s.paused = false; expect(JSON.stringify(s)).toBe(snapshot);
    const time = s.time; advanceGap(s, 20); expect(s.time - time).toBeCloseTo(.1, 8);
    s.epoch++; advanceGap(s, 1 / 120);
    expect(s.phase).toBe('idle'); expect(s.reservations.size).toBe(0); expect(s.stats.recoveries).toBe(1);
  });
  it('uses the same material position at 30, 60 and 120 fps', () => {
    const states = [30, 60, 120].map(fps => {
      const s = makeGapTraversal(); setReachHeld(s, true);
      for (let i = 0; i < fps; i++) advanceGap(s, 1 / fps);
      return s;
    });
    for (const s of states) {
      expect(s.phase).toBe('pull'); expect(s.headDistance).toBeCloseTo(states[0].headDistance, 10);
    }
  });
  it('crosses with a maximum-length worm without early completion', () => {
    const s = makeGapTraversal({ segments: 1200 }); setReachHeld(s, true); until(s, 'pull');
    for (let i = 0; i < 600; i++) advanceGap(s, 1 / 60);
    expect(s.phase).toBe('pull'); expect(s.sourceAttached).toBe(true);
    until(s, 'complete'); expect(s.length).toBeCloseTo(107.91);
    sampleGapBodyInto(s, s.length, p, n, f); expect(p.x).toBeGreaterThan(s.b.x);
  });
});
describe('bridge geometry', () => {
  const a = new Vector3(0, 0, 0), b = new Vector3(1, .2, 0), up = new Vector3(0, 1, 0);
  it('fits sag to available length and supplies finite orthogonal frames', () => {
    expect(fitBridgeToLength(a, b, up, .9, .3)).toBeNull();
    const curve = fitBridgeToLength(a, b, up, 1.1, .3);
    expect(curve.length).toBeLessThanOrEqual(1.1); expect(curve.sag).toBeGreaterThan(0);
    for (let i = 0; i <= 100; i++) {
      sampleBridgeInto(curve, curve.length * i / 100, p, n, f);
      expect([...p, ...n, ...f].every(Number.isFinite)).toBe(true);
      expect(n.dot(f)).toBeCloseTo(0, 9); expect(f.length()).toBeCloseTo(1, 9);
      if (i === 0) expect(p.distanceTo(a)).toBe(0);
      if (i === 100) expect(p.distanceTo(b)).toBeLessThan(1e-9);
    }
  });
  it('rejects inflated body collisions between sampled endpoints', () => {
    const curve = makeBridgeCurve(a, new Vector3(1, 0, 0), up, 0);
    const boxes = [{ min: new Vector3(.49, .05, -.01), max: new Vector3(.51, .06, .01) }];
    expect(bridgeHitsBoxes(curve, boxes, 0)).toBe(false);
    expect(bridgeHitsBoxes(curve, boxes, .1)).toBe(true);
  });
});

it('matches fixed-tick state at fractional frame rates and jitter without interpolating geometry', () => {
  const run = deltas => {
    const s = makeGapTraversal(); setReachHeld(s, true);
    let elapsed = 0;
    deltas.forEach(delta => {
      elapsed += delta; advanceGap(s, delta);
      const ticks = Math.floor((elapsed + 1e-10) * 120);
      expect(s.time).toBeCloseTo(ticks / 120, 9);
      expect(s.accumulator).toBeGreaterThan(-1e-9);
      expect(s.accumulator).toBeLessThan(1 / 120 + 1e-9);
    });
    expect(s.capEvents).toBe(0); return s;
  };
  const total = 1.237, reference = run([...Array(148).fill(1 / 120), total - 148 / 120]);
  for (const fps of [30, 60, 90, 120, 144]) {
    const frames = Math.floor(total * fps), deltas = [...Array(frames).fill(1 / fps), total - frames / fps];
    const s = run(deltas);
    expect(s.headDistance).toBeCloseTo(reference.headDistance, 10);
    expect(s.accumulator).toBeCloseTo(reference.accumulator, 10);
    expect(s.events).toEqual(reference.events);
  }
  const jitter = []; let sum = 0;
  for (let i = 0; sum < total; i++) {
    const delta = Math.min([.004, .017, .023, .009][i % 4], total - sum);
    jitter.push(delta); sum += delta;
  }
  expect(run(jitter).headDistance).toBeCloseTo(reference.headDistance, 10);
});
it('records cap saturation and discarded time instead of claiming wall-clock replay equivalence', () => {
  const s = makeGapTraversal(); setReachHeld(s, true); advanceGap(s, .35);
  expect(s.time).toBeCloseTo(.1, 10); expect(s.droppedTime).toBeCloseTo(.25, 10);
  expect(s.capEvents).toBe(1);
  expect(s.events.at(-1)).toMatchObject({ type: 'time-cap', received: .35, accepted: .1, dropped: .24999999999999997 });
});
