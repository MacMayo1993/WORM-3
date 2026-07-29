import { describe, it, expect, beforeEach } from 'vitest';
import {
  wormPress,
  pressTile,
  tickWormPress,
  getWormPress,
  anyWormPress,
  resetWormPress,
  remapWormPress,
  MAX_PRESSED_TILES,
  pressedTileCount
} from '../worm/tilePressBridge.js';

const FRAME = 1 / 60;

/** Hold a tile down for `seconds`, re-asking every frame the way the crawler does. */
const hold = (key, seconds, amount = 1) => {
  for (let t = 0; t < seconds; t += FRAME) {
    pressTile(key, amount);
    tickWormPress(FRAME);
  }
};

/** Let go and let the spring run for `seconds`. */
const release = (seconds) => {
  for (let t = 0; t < seconds; t += FRAME) tickWormPress(FRAME);
};

describe('tilePressBridge', () => {
  beforeEach(() => resetWormPress());

  it('starts flat and stays flat for tiles nobody stands on', () => {
    expect(getWormPress('M1-001')).toBe(0);
    expect(anyWormPress()).toBe(false);
    tickWormPress(FRAME);
    expect(getWormPress('M1-001')).toBe(0);
  });

  it('sinks a tile that is being stood on', () => {
    hold('M1-005', 0.25);
    const p = getWormPress('M1-005');
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(1.3); // a spring, so some overshoot is expected — but not a launch
  });

  it('settles at full press while the worm stays put', () => {
    hold('M1-005', 2);
    expect(getWormPress('M1-005')).toBeCloseTo(1, 2);
  });

  it('presses proportionally — the head end sinks deeper than the tail', () => {
    for (let t = 0; t < 2; t += FRAME) {
      pressTile('head', 1);
      pressTile('mid', 0.7);
      pressTile('tail', 0.45);
      tickWormPress(FRAME);
    }
    expect(getWormPress('head')).toBeGreaterThan(getWormPress('mid'));
    expect(getWormPress('mid')).toBeGreaterThan(getWormPress('tail'));
    expect(getWormPress('tail')).toBeGreaterThan(0);
  });

  it('takes the deepest request when body segments overlap a tile', () => {
    for (let t = 0; t < 2; t += FRAME) {
      pressTile('M2-003', 0.3);
      pressTile('M2-003', 0.9);
      pressTile('M2-003', 0.5);
      tickWormPress(FRAME);
    }
    // The deepest ask wins rather than the three stacking into an impossible dent.
    expect(getWormPress('M2-003')).toBeCloseTo(0.9, 2);
  });

  it('springs back past level once the worm moves on, then settles flat', () => {
    hold('M3-007', 1.5);
    // The rebound: the tile overshoots proud of the surface before settling. This is
    // the difference between a springy surface and one that was simply dented.
    let minAfterRelease = Infinity;
    for (let t = 0; t < 0.6; t += FRAME) {
      tickWormPress(FRAME);
      minAfterRelease = Math.min(minAfterRelease, getWormPress('M3-007'));
    }
    expect(minAfterRelease).toBeLessThan(0);
    release(2);
    expect(getWormPress('M3-007')).toBe(0);
  });

  it('stops tracking a tile once it has finished rebounding', () => {
    hold('M4-002', 1);
    expect(anyWormPress()).toBe(true);
    release(3);
    // Nothing left to animate — the sticker can go back to sleep and cost nothing.
    expect(anyWormPress()).toBe(false);
    expect(getWormPress('M4-002')).toBe(0);
  });

  it('ignores a missing key rather than tracking a phantom tile', () => {
    pressTile(null, 1);
    pressTile(undefined, 1);
    tickWormPress(FRAME);
    expect(anyWormPress()).toBe(false);
    expect(getWormPress(null)).toBe(0);
  });

  it('clamps the requested amount', () => {
    hold('M5-001', 2, 9);
    expect(getWormPress('M5-001')).toBeCloseTo(1, 2);
    resetWormPress();
    hold('M5-002', 2, -4);
    expect(getWormPress('M5-002')).toBeCloseTo(0, 2);
  });

  it('survives a frame-rate hitch without launching the tile', () => {
    // delta is clamped inside the spring: a 400 ms stall must not integrate into a
    // wild overshoot, or a lag spike would visibly punch tiles through the cube.
    pressTile('M6-001', 1);
    tickWormPress(0.4);
    expect(Math.abs(getWormPress('M6-001'))).toBeLessThan(1);
  });

  it('resets every dent when a run restarts', () => {
    hold('M1-001', 1);
    resetWormPress();
    expect(anyWormPress()).toBe(false);
    expect(getWormPress('M1-001')).toBe(0);
  });

  it('moves spring displacement and velocity with a rotating tile', () => {
    hold('1,2,6,PZ', 0.4);
    const before = getWormPress('1,2,6,PZ');
    remapWormPress(key => key === '1,2,6,PZ' ? '6,2,5,PX' : key);
    expect(getWormPress('1,2,6,PZ')).toBe(0);
    expect(getWormPress('6,2,5,PX')).toBe(before);
  });

  it('publishes a colour for the lit squares', () => {
    expect(wormPress.color).toMatch(/^#/);
  });

  it('caps how many tiles a very long worm can light at once', () => {
    // Not a spring property — a budget. Every pressed tile wakes a sticker's
    // per-frame tick and draws a border, and a 600-segment worm covers the cube.
    expect(MAX_PRESSED_TILES).toBeGreaterThan(8);
    expect(MAX_PRESSED_TILES).toBeLessThanOrEqual(96);
  });

  it('includes both cells when the starting worm straddles a tile boundary', () => {
    expect(pressedTileCount(0.36, 2)).toBe(2);
    expect(pressedTileCount(0.36, 1)).toBe(1);
  });

  it('includes the partially occupied tail cell for longer worms', () => {
    expect(pressedTileCount(2, 10)).toBe(3);
    expect(pressedTileCount(2.01, 10)).toBe(4);
  });
});
