import { describe, it, expect, beforeEach } from 'vitest';
import { FALL, PASS_AT, funnelPoint } from '../components/screens/loadingWormhole.js';
import {
  KICK,
  HINT_MS,
  MOBI_FIRST_DIVE,
  MOBI_HINT,
  MOBI_TIPS,
  MOBI_MILESTONES,
  OPEN,
  TILT,
  WARP,
  createLoadingPlay,
  kickPulse,
  kickSpin,
  milestoneCrossed,
  openingLine,
  orientationAim,
  pointerAim,
  portalOpen,
  TIP_MS,
  tiltRotate,
  tiltToward,
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

  // MOBI's label and the bar that runs down until his next line.
  const fakeClock = () => {
    const runs = [];
    return { runs, animate: (_frames, opts) => runs.push(opts.duration) };
  };

  it('opens with the hint until the player has dived once, and cheers the first dive', () => {
    const opening = openingLine();
    expect(opening).toEqual({ text: MOBI_HINT, kind: 'hint' });
    const line = { ...fakeText(), textContent: opening.text };
    const name = fakeText();
    const play = createLoadingPlay({ scene: fakeScene(), line, name, badge: fakeText(), opening });
    play.frame(0, 0);
    expect(line.textContent).toBe(MOBI_HINT);
    play.press();
    expect(line.textContent).toBe(MOBI_FIRST_DIVE);
    play.release();
    // From then on every cover opens on a tip.
    const next = openingLine();
    expect(next.kind).toBe('tip');
    expect(MOBI_TIPS).toContain(next.text);
  });

  it('opens on a tip with reduced motion, where there is no dive to hint at', () => {
    const opening = openingLine(true);
    expect(opening.kind).toBe('tip');
    expect(MOBI_TIPS).toContain(opening.text);
  });

  it('cycles through different tips on a clock of its own, with the bar running down each one', () => {
    const line = fakeText();
    const name = fakeText();
    const clock = fakeClock();
    const play = createLoadingPlay({ scene: fakeScene(), line, name, clock, badge: fakeText() });
    play.frame(0, 0);
    expect(line.textContent).toBe(MOBI_HINT);
    expect(clock.runs).toEqual([HINT_MS]);
    play.frame(0.5, HINT_MS - 1);
    expect(line.textContent).toBe(MOBI_HINT);
    play.frame(0.6, HINT_MS);
    expect(MOBI_TIPS).toContain(line.textContent);
    expect(name.textContent).toBe('MOBI · TIP');
    const seen = [line.textContent];
    for (let k = 1; k < 4; k++) {
      play.frame(0.7, HINT_MS + k * TIP_MS);
      expect(seen).not.toContain(line.textContent);
      seen.push(line.textContent);
    }
    expect(clock.runs).toEqual([HINT_MS, TIP_MS, TIP_MS, TIP_MS, TIP_MS]);
  });

  it('counts the loops and never hurries a tip off, even mid-dive', () => {
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
    for (let i = 0; i < 2000; i++) {
      now += 16;
      t += 0.016 * play.rate;
      play.frame(t, now);
      if (line.textContent !== shown) {
        if (!Object.values(MOBI_MILESTONES).includes(line.textContent)) expect(now - since).toBeGreaterThanOrEqual(TIP_MS);
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

  it('finds the milestones a stalled frame jumps over', () => {
    expect(milestoneCrossed(9, 10)).toBe(10);
    expect(milestoneCrossed(9, 11)).toBe(10);
    expect(milestoneCrossed(10, 11)).toBeNull();
    expect(milestoneCrossed(0, 9)).toBeNull();
    // A jump across several marks the latest.
    expect(milestoneCrossed(8, 30)).toBe(25);
    expect(milestoneCrossed(99, 140)).toBe(100);
  });

  it('still marks a milestone when a busy main thread skips the frame that reached it', () => {
    const line = fakeText();
    const badge = fakeText();
    const play = createLoadingPlay({ scene: fakeScene(), line, badge });
    play.frame(0, 0);
    play.frame(PASS_AT + 8 * FALL.period + 0.01, 100);
    expect(play.loops).toBe(9);
    // Stalled from loop 9 straight to loop 11: no frame ever saw loop 10.
    play.frame(PASS_AT + 10 * FALL.period + 0.01, 3200);
    expect(play.loops).toBe(11);
    expect(line.textContent).toBe(MOBI_MILESTONES[10]);
    expect(badge.textContent).toBe('×11');
    // And it is said once, not again on the next loop.
    play.frame(PASS_AT + 11 * FALL.period + 0.01, 3300);
    expect(line.textContent).toBe(MOBI_MILESTONES[10]);
  });

  it('keeps every line short enough to read in one go', () => {
    expect(MOBI_TIPS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(MOBI_TIPS).size).toBe(MOBI_TIPS.length);
    for (const text of [MOBI_HINT, MOBI_FIRST_DIVE, ...MOBI_TIPS, ...Object.values(MOBI_MILESTONES)]) {
      expect(text.length).toBeLessThanOrEqual(100);
      expect(text.toLowerCase()).not.toContain('math');
    }
  });
});

describe('the tilt', () => {
  // A scene that records what the controller writes to it and its two cubes.
  function tiltScene() {
    const cubes = [{ style: { rotate: '' } }, { style: { rotate: '' } }];
    const writes = [];
    const style = {};
    Object.defineProperty(style, 'transform', {
      get: () => writes.at(-1) ?? '',
      set: (v) => {
        writes.push(v);
      }
    });
    return {
      ...fakeScene(),
      style,
      cubes,
      writes,
      querySelectorAll: (sel) => (sel === '.wl-cube' ? cubes : [])
    };
  }

  it('reads the pointer as a lean from the centre of the screen', () => {
    const at = {};
    expect(pointerAim(200, 400, 400, 800, at)).toEqual({ x: 0, y: 0 });
    expect(pointerAim(0, 800, 400, 800, at)).toEqual({ x: -1, y: 1 });
    expect(pointerAim(-50, 900, 400, 800, at)).toEqual({ x: -1, y: 1 });
    expect(pointerAim(10, 10, 0, 0, at)).toEqual({ x: 0, y: 0 });
  });

  it('eases toward the aim at the same pace whatever the frame rate', () => {
    let at60 = 0;
    for (let i = 0; i < 60; i++) at60 = tiltToward(at60, 1, 1 / 60);
    let at30 = 0;
    for (let i = 0; i < 30; i++) at30 = tiltToward(at30, 1, 1 / 30);
    expect(at60).toBeCloseTo(at30, 6);
    expect(at60).toBeGreaterThan(0.99);
  });

  it("takes the phone's resting pose as level, turns with the screen, and recentres a held lean", () => {
    const base = { beta: null, gamma: null };
    const out = {};
    expect(orientationAim(40, 0, 0, base, out)).toEqual({ x: 0, y: 0 });
    orientationAim(40, TILT.degrees, 0, base, out);
    expect(out.x).toBeCloseTo(1, 1);
    expect(out.y).toBeCloseTo(0, 6);
    // Landscape: the same physical tip reads along the other screen axis.
    const side = { beta: 0, gamma: 0 };
    orientationAim(TILT.degrees / 2, 0, 90, side, out);
    expect(out.x).toBeCloseTo(0.5, 1);
    expect(Math.abs(out.y)).toBeLessThan(1e-9);
    // Held still, the lean drifts back to level.
    const held = { beta: 0, gamma: 0 };
    for (let i = 0; i < 2000; i++) orientationAim(0, 10, 0, held, out);
    expect(Math.abs(out.x)).toBeLessThan(0.05);
  });

  it('turns the cube to show the side the viewer leans toward', () => {
    expect(tiltRotate(0, 0)).toBe('0 1 0 0deg');
    // Leaning right is a turn about the vertical, the negative way in CSS.
    expect(tiltRotate(1, 0)).toBe(`0.0000 -1.0000 0 ${TILT.turn[0].toFixed(3)}deg`);
    expect(tiltRotate(0, 1)).toBe(`1.0000 0.0000 0 ${TILT.turn[1].toFixed(3)}deg`);
  });

  it('slides the scene opposite the lean, writes nothing at rest, and clears itself once back level', () => {
    const scene = tiltScene();
    const play = createLoadingPlay({ scene, line: fakeText(), badge: fakeText() });
    let at = run(play, { from: { now: 0, t: 0 }, ms: 500 });
    expect(scene.writes).toEqual([]);
    play.aim('pointer', 1, -1);
    at = run(play, { from: at, ms: 1500 });
    const [, x, y] = scene.style.transform.match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px/).map(Number);
    expect(x).toBeCloseTo(-TILT.near, 0);
    expect(y).toBeCloseTo(TILT.near, 0);
    expect(scene.cubes[0].style.rotate).toBe(scene.cubes[1].style.rotate);
    const moving = scene.writes.length;
    run(play, { from: at, ms: 500 });
    expect(scene.writes.length - moving).toBeLessThan(5);
    play.aim('pointer', 0, 0, false);
    run(play, { from: at, ms: 3000 });
    expect(scene.style.transform).toBe('');
    expect(scene.cubes[0].style.rotate).toBe('');
  });

  it('prefers a pointer to the phone, and ignores sensor jitter', () => {
    const play = createLoadingPlay({ scene: tiltScene(), line: fakeText(), badge: fakeText() });
    play.aim('motion', 0.5, 0);
    play.aim('pointer', -1, 0);
    run(play, { from: { now: 0, t: 0 }, ms: 1500 });
    expect(play.tiltX).toBeLessThan(-0.9);
    play.aim('pointer', 0, 0, false);
    play.aim('motion', 0.5 + TILT.deadzone / 2, 0);
    run(play, { from: { now: 1500, t: 1.5 }, ms: 1500 });
    expect(play.tiltX).toBeCloseTo(0.5, 2);
  });

  it('stays level with reduced motion', () => {
    const scene = tiltScene();
    const play = createLoadingPlay({ scene, line: fakeText(), badge: fakeText(), reduced: true });
    play.aim('pointer', 1, 1);
    run(play, { from: { now: 0, t: 0 }, ms: 1000 });
    expect(play.tiltX).toBe(0);
    expect(scene.writes).toEqual([]);
  });

  it('leans the throat inside its mouth and leaves the rim where it is', () => {
    const level = { cx: 400, cy: 300, a: 200, b: 72 };
    const leaned = { ...level, lx: TILT.lean, ly: -TILT.lean };
    for (const angle of [0, 1, 2, 4]) {
      expect(funnelPoint(leaned, 0, angle)).toEqual(funnelPoint(level, 0, angle));
    }
    const throat = funnelPoint(leaned, 1, 0);
    const straight = funnelPoint(level, 1, 0);
    expect(throat.x - straight.x).toBeCloseTo(TILT.lean * level.a, 6);
    expect(throat.y - straight.y).toBeCloseTo(-TILT.lean * level.b, 6);
  });
});
