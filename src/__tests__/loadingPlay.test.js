import { describe, it, expect, beforeEach } from 'vitest';
import { FALL, PASS_AT } from '../components/screens/loadingWormhole.js';
import {
  KICK,
  LINE_MS,
  MOBI_FIRST_DIVE,
  MOBI_HINT,
  MOBI_LINES,
  MOBI_MILESTONES,
  OPEN,
  WARP,
  createLoadingPlay,
  kickPulse,
  kickSpin,
  portalOpen,
  warpLevel,
  warpRate
} from '../components/screens/loadingPlay.js';

// A stand-in for the scene: records every re-time of its animations.
function fakeScene(count = 5) {
  const retimes = [];
  const anims = Array.from({ length: count }, () => ({ updatePlaybackRate: (r) => retimes.push(r) }));
  const classes = new Set();
  return {
    retimes,
    classes,
    getAnimations: () => anims,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 400 }),
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) }
  };
}
const fakeText = () => ({ textContent: '', classList: { add: () => {} } });

// Drive the controller like LoadingPortal does: real ms in, fall seconds out at `rate`.
function run(play, { from, ms, rate = () => play.rate, step = 16 }) {
  let now = from.now;
  let t = from.t;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    now += step;
    t += (step / 1000) * rate();
    play.frame(t, now);
  }
  return { now, t };
}

describe('the dive', () => {
  it('comes on while held and lets go when released, within its rise and fall times', () => {
    let level = 0;
    for (let i = 0; i < 10; i++) level = warpLevel(level, true, WARP.rise / 10);
    expect(level).toBeCloseTo(1, 6);
    for (let i = 0; i < 10; i++) level = warpLevel(level, false, WARP.fall / 10);
    expect(level).toBeCloseTo(0, 6);
  });

  it('runs at the full rate when fully on and at normal speed when off, in a few steps between', () => {
    expect(warpRate(0)).toBe(1);
    expect(warpRate(1)).toBe(WARP.rate);
    const rates = new Set();
    for (let l = 0; l <= 1; l += 0.01) rates.add(warpRate(l));
    expect(rates.size).toBeLessThanOrEqual(Math.round((WARP.rate - 1) / WARP.step) + 1);
    let last = 0;
    for (let l = 0; l <= 1; l += 0.01) {
      expect(warpRate(l)).toBeGreaterThanOrEqual(last);
      last = warpRate(l);
    }
  });

  it('re-times every animation in the scene together, a handful of times a press, and puts it back', () => {
    const scene = fakeScene(7);
    const play = createLoadingPlay({ scene, line: fakeText(), badge: fakeText() });
    let at = run(play, { from: { now: 0, t: 0 }, ms: 300 });
    play.press();
    expect(scene.classes.has('wl-warp')).toBe(true);
    at = run(play, { from: at, ms: 1000 });
    expect(play.rate).toBe(WARP.rate);
    play.release();
    expect(scene.classes.has('wl-warp')).toBe(false);
    run(play, { from: at, ms: 1000 });
    expect(play.rate).toBe(1);
    // Every re-time reaches all seven animations at once.
    expect(scene.retimes.length % 7).toBe(0);
    const steps = scene.retimes.length / 7;
    expect(steps).toBeLessThanOrEqual(2 * Math.round((WARP.rate - 1) / WARP.step));
    expect(scene.retimes.at(-1)).toBe(1);
  });

  it('does nothing with reduced motion', () => {
    const scene = fakeScene();
    const play = createLoadingPlay({ scene, line: fakeText(), badge: fakeText(), reduced: true });
    play.frame(2.8, 0);
    play.press();
    play.frame(2.8, 500);
    expect(play.rate).toBe(1);
    expect(play.kicks).toBe(0);
    expect(scene.retimes).toEqual([]);
  });
});

describe('a kick', () => {
  it('flares at the press and fades', () => {
    expect(kickPulse(1, null)).toBe(0);
    expect(kickPulse(0.9, 1)).toBe(0);
    expect(kickPulse(1, 1)).toBe(1);
    expect(kickPulse(1 + 4 * KICK.decay, 1)).toBeLessThan(0.02);
  });

  it('turns the vortex forward without a jump, however fast the taps come', () => {
    const play = createLoadingPlay({ scene: fakeScene(), line: fakeText(), badge: fakeText() });
    let now = 0;
    let t = 0;
    let last = 0;
    for (let i = 0; i < 400; i++) {
      now += 16;
      t += 0.016 * play.rate;
      if (i % 20 === 5) play.press();
      if (i % 20 === 9) play.release();
      play.frame(t, now);
      expect(play.spin).toBeGreaterThanOrEqual(last);
      expect(play.spin - last).toBeLessThan(0.2);
      last = play.spin;
    }
    expect(play.kicks).toBe(20);
    expect(kickSpin(5, null, 3)).toBe(3);
  });
});

describe('the portals opening', () => {
  it('are shut before their delay, overshoot a little and settle open', () => {
    expect(portalOpen(0)).toBe(0);
    expect(portalOpen(0.05, OPEN.floorDelay)).toBe(0);
    let peak = 0;
    for (let t = 0; t <= OPEN.duration; t += 0.005) {
      const v = portalOpen(t);
      expect(v).toBeGreaterThanOrEqual(0);
      peak = Math.max(peak, v);
    }
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.25);
    expect(portalOpen(OPEN.duration + 0.01)).toBe(1);
  });

  it('have the upper portal open before the cube comes out of it', () => {
    // The cube's lowest point (0.9 cubes below its centre) reaches the upper lip.
    const emerges = ((FALL.lip - 0.9 + FALL.lead) / FALL.drop) * FALL.period;
    expect(portalOpen(emerges)).toBeGreaterThan(0.9);
    expect(portalOpen(PASS_AT, OPEN.floorDelay)).toBe(1);
  });
});

describe('MOBI on the loading cover', () => {
  beforeEach(() => localStorage.clear());

  it('opens with the hint until the player has dived once, and cheers the first dive', () => {
    const line = fakeText();
    const play = createLoadingPlay({ scene: fakeScene(), line, badge: fakeText() });
    play.frame(0, 0);
    expect(line.textContent).toBe(MOBI_HINT);
    play.press();
    expect(line.textContent).toBe(MOBI_FIRST_DIVE);
    play.release();
    const next = fakeText();
    createLoadingPlay({ scene: fakeScene(), line: next, badge: fakeText() }).frame(0, 0);
    expect(MOBI_LINES).toContain(next.textContent);
  });

  it('counts the loops and never hurries a line off, even mid-dive', () => {
    localStorage.setItem('worm3_loader_dived', '1');
    const line = fakeText();
    const badge = fakeText();
    const play = createLoadingPlay({ scene: fakeScene(), line, badge });
    play.frame(0, 0);
    play.press();
    let shown = line.textContent;
    let since = 0;
    let now = 0;
    let t = 0;
    for (let i = 0; i < 1000; i++) {
      now += 16;
      t += 0.016 * play.rate;
      play.frame(t, now);
      if (line.textContent !== shown) {
        if (!Object.values(MOBI_MILESTONES).includes(line.textContent)) expect(now - since).toBeGreaterThanOrEqual(LINE_MS);
        shown = line.textContent;
        since = now;
      }
    }
    expect(badge.textContent).toBe(`×${play.loops}`);
    expect(play.loops).toBeGreaterThan(10);
  });

  it('marks each milestone the moment it is reached', () => {
    const line = fakeText();
    const badge = fakeText();
    const play = createLoadingPlay({ scene: fakeScene(), line, badge });
    play.frame(0, 0);
    play.frame(PASS_AT + 9 * FALL.period + 0.01, 100);
    expect(play.loops).toBe(10);
    expect(line.textContent).toBe(MOBI_MILESTONES[10]);
  });

  it('keeps every line short enough to read in one go', () => {
    for (const text of [MOBI_HINT, MOBI_FIRST_DIVE, ...MOBI_LINES, ...Object.values(MOBI_MILESTONES)]) {
      expect(text.length).toBeLessThanOrEqual(80);
      expect(text.toLowerCase()).not.toContain('math');
    }
  });
});
