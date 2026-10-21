import { describe, expect, it } from 'vitest';
import { beltRing, laneBelts, wrappedDistance, makeRumbler, stepRumbler, collectRumbleLifts, rumbleBands,
  RUMBLE_LIFT, MAX_RUMBLE_TILES, RUMBLE_BIG_BOARD } from '../worm/healerWorm/rumbler.js';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
import { rotateTilePosition } from '../worm/wormHelpers.js';

// The Rumbler (design §5, R1 + R2): render-only crests running round the belts of
// the slices, under the worm's lane and round any layer about to turn.
const key = t => `${t.x},${t.y},${t.z},${t.dirKey}`;
const coord = (t, axis) => (axis === 'col' ? t.x : axis === 'row' ? t.y : t.z);
const quiet = { armed: false, sliceIndices: [], sliceDirs: [] };
const head = { tile: { x: 2, y: 2, z: 4, dirKey: 'PZ' }, moveDir: 'up', interpT: 0.5 };
const run = (state, input, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) stepRumbler(state, input, dt); };

describe('belts', () => {
  it('walk the 4N cells round every slice and close on themselves', () => {
    for (const size of [2, 3, 5, 8, 15]) {
      for (const axis of ['col', 'row', 'depth']) {
        for (let index = 0; index < size; index++) {
          const ring = beltRing(size, axis, index);
          expect(ring.L).toBe(4 * size);
          expect(new Set(ring.keys).size).toBe(ring.L);
          expect(ring.tiles.every(t => coord(t, axis) === index)).toBe(true);
          const last = ring.tiles[ring.L - 1];
          expect(key(getNextSurfacePosition(last, ring.moves[ring.L - 1], size))).toBe(ring.keys[0]);
          expect(beltRing(size, axis, index)).toBe(ring);
        }
      }
    }
  });

  it('know which way a positive turn of their layer carries them', () => {
    for (const size of [3, 4]) {
      for (const axis of ['col', 'row', 'depth']) {
        const ring = beltRing(size, axis, 1);
        const turned = rotateTilePosition(ring.tiles[0], axis, 1, 1, size);
        // A quarter turn moves every cell a quarter of the way round the belt.
        expect(ring.indexOf.get(key(turned))).toBe(((ring.spin * size) % ring.L + ring.L) % ring.L);
      }
    }
  });

  it('pick the lane the worm crawls along and the cross line through its head', () => {
    expect(laneBelts({ x: 2, y: 3, z: 4, dirKey: 'PZ' }, 'up')).toEqual({ lane: { axis: 'col', index: 2 }, cross: { axis: 'row', index: 3 } });
    expect(laneBelts({ x: 2, y: 3, z: 4, dirKey: 'PZ' }, 'right')).toEqual({ lane: { axis: 'row', index: 3 }, cross: { axis: 'col', index: 2 } });
    expect(laneBelts({ x: 4, y: 1, z: 3, dirKey: 'PX' }, 'up')).toEqual({ lane: { axis: 'depth', index: 3 }, cross: { axis: 'row', index: 1 } });
  });

  it('measure crest distance round the wrap', () => {
    expect(wrappedDistance(0.5, 19.5, 20)).toBeCloseTo(1);
    expect(wrappedDistance(10, 0, 20)).toBe(10);
  });
});

describe('R1: the heave under the worm', () => {
  it('rises behind the head, rolls under it and lifts at most a few cells on its belts', () => {
    const state = makeRumbler(11);
    const input = { size: 5, head, live: true, reduced: false, clock: quiet };
    const belts = laneBelts(head.tile, head.moveDir);
    const onBelts = new Set([...beltRing(5, belts.lane.axis, belts.lane.index).keys, ...beltRing(5, belts.cross.axis, belts.cross.index).keys]);
    const lifts = new Map();
    let most = 0;
    for (let f = 0; f < 600; f++) {
      stepRumbler(state, input, 1 / 60);
      collectRumbleLifts(state, 5, lifts);
      most = Math.max(most, lifts.size);
      for (const [k, lift] of lifts) {
        expect(onBelts.has(k)).toBe(true);
        expect(lift).toBeLessThanOrEqual(RUMBLE_LIFT + 1e-9);
      }
    }
    expect(state.passes).toBeGreaterThanOrEqual(2);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(MAX_RUMBLE_TILES);
    expect(rumbleBands(state, input).length).toBeGreaterThan(0);
  });

  it('is the same every time from the same seed', () => {
    const trace = seed => {
      const state = makeRumbler(seed), out = [];
      for (let f = 0; f < 300; f++) { stepRumbler(state, { size: 5, head, live: true, reduced: false, clock: quiet }, 1 / 60); out.push(state.heaves.map(h => h.crest.toFixed(4)).join()); }
      return out.join('|');
    };
    expect(trace(3)).toBe(trace(3));
    expect(trace(3)).not.toBe(trace(4));
  });

  it('holds still while the game is held, and resuming never catches up', () => {
    const state = makeRumbler(5);
    const input = { size: 5, head, live: true, reduced: false, clock: quiet };
    run(state, input, 2.5);
    const running = state.heaves.find(h => h.kind === 'lane' && !h.retiring);
    expect(running).toBeTruthy();
    const rel = running.rel, passes = state.passes, count = state.heaves.length;
    // Held (a tunnel ride, a rescue, a focus beat): no crest moves and none starts.
    for (let f = 0; f < 10; f++) stepRumbler(state, { ...input, live: false }, 5);
    expect(running.rel).toBe(rel);
    expect(state.passes).toBe(passes);
    expect(state.heaves.length).toBeLessThanOrEqual(count);
  });

  it('lifts nothing on big boards or under reduced motion, where the belt is a still tint', () => {
    const state = makeRumbler(9), lifts = new Map();
    run(state, { size: RUMBLE_BIG_BOARD, head: { ...head, tile: { x: 2, y: 2, z: 7, dirKey: 'PZ' } }, live: true, reduced: false, clock: quiet }, 3);
    collectRumbleLifts(state, RUMBLE_BIG_BOARD, lifts);
    expect(lifts.size).toBe(0);
    const calm = makeRumbler(9), input = { size: 5, head, live: true, reduced: true, clock: quiet };
    run(calm, input, 4);
    expect(calm.heaves).toHaveLength(0);
    collectRumbleLifts(calm, 5, lifts, { reduced: true });
    expect(lifts.size).toBe(0);
    expect(rumbleBands(calm, input)).toEqual([{ axis: 'col', index: 2, crest: 0, strength: 0.35, still: true }]);
  });
});

describe('R2: the telegraph on the threatened layers', () => {
  const armed = (warning, dirs = [1, -1]) => ({ armed: true, axis: 'row', sliceIndices: [0, 3], sliceDirs: dirs, warning });

  it('circles every threatened layer the clock names, and only those', () => {
    const state = makeRumbler(2);
    const input = { size: 5, head: null, live: true, reduced: false, clock: armed(0.2) };
    run(state, input, 0.5);
    const threats = state.heaves.filter(h => h.kind === 'threat');
    expect(threats.map(h => `${h.axis}:${h.index}`).sort()).toEqual(['row:0', 'row:3']);
    // Each runs the way its own layer will turn.
    for (const heave of threats) expect(heave.turn).toBe(heave.index === 0 ? 1 : -1);
  });

  it('runs faster and harder as the warning ramps, and leaves when the turn is gone', () => {
    const state = makeRumbler(2);
    const ring = beltRing(5, 'row', 0);
    const speed = warning => {
      stepRumbler(state, { size: 5, head: null, live: true, reduced: false, clock: armed(warning) }, 1 / 60);
      const heave = state.heaves.find(h => h.kind === 'threat' && h.index === 0);
      const before = heave.crest;
      stepRumbler(state, { size: 5, head: null, live: true, reduced: false, clock: armed(warning) }, 1 / 60);
      // Signed step along the turn's own direction, unwrapped across the belt's seam.
      const step = ((((heave.crest - before) * ring.spin) % ring.L) + ring.L * 1.5) % ring.L - ring.L / 2;
      return { delta: step, amp: heave.amp };
    };
    const early = speed(0), late = speed(1);
    expect(early.delta).toBeGreaterThan(0);
    expect(late.delta).toBeGreaterThan(early.delta * 3);
    expect(late.amp).toBeGreaterThan(early.amp);
    run(state, { size: 5, head: null, live: true, reduced: false, clock: quiet }, 1);
    expect(state.heaves.filter(h => h.kind === 'threat')).toHaveLength(0);
  });
});
