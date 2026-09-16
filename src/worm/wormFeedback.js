import { feel, noise, tone, stopFeel } from '../utils/feel.js';

// Loaded with WORM. Short impacts leave space between actions, even when firing.
const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
const level = value => Math.min(6, Math.max(0, Number.isFinite(value) ? value : 0));
export const WORM_HAPTICS = {
  orb: combo => [16 + level(combo) * 2, 24, 9],
  dive: [24, 32, 12, 38, 22],
  tunnelRush: [8, 38, 12], tunnelFold: [10, 32, 10], tunnelRelease: [12, 25, 18],
  exit: [28, 35, 12], heal: [20, 50, 32, 65, 48],
  shot: 12, shotHit: [18, 20, 8], enemyDown: [24, 32, 12], recharge: 6,
  shieldHit: [35, 35, 22], jump: [12, 22, 8], boost: [18, 30, 12],
  cut: [40, 30, 35], death: [55, 45, 85], rocket: [22, 25, 45],
  rocketLand: [25, 30, 10], magnet: [12, 25, 12, 25, 18],
};

const thump = (freq = 130, gain = 0.24) => tone({ freq, freqTo: 55, dur: 0.10, gain });
const WORM_SFX = {
  orb(combo = 0) {
    const f = notes[Math.floor(level(combo))];
    thump(170, 0.22);
    tone({ freq: f * 0.75, freqTo: f, dur: 0.09, type: 'triangle', gain: 0.35 });
    tone({ freq: f * 2, dur: 0.22, gain: 0.12, when: 0.045 });
  },
  dive() {
    thump(190);
    tone({ freq: 620, freqTo: 90, dur: 0.38, gain: 0.26 });
    noise({ dur: 0.32, freq: 850, gain: 0.14 });
  },
  tunnelRush() {
    noise({ dur: 0.45, freq: 550, q: 0.5, gain: 0.13 });
    tone({ freq: 100, freqTo: 160, dur: 0.4, gain: 0.13 });
  },
  tunnelFold() {
    tone({ freq: 180, freqTo: 110, dur: 0.24, gain: 0.12 });
    tone({ freq: 360, freqTo: 540, dur: 0.3, gain: 0.07 });
  },
  tunnelRelease() {
    noise({ dur: 0.3, freq: 1600, gain: 0.12 });
    tone({ freq: 160, freqTo: 640, dur: 0.32, type: 'triangle', gain: 0.2 });
  },
  exit() {
    thump(150);
    tone({ freq: 520, freqTo: 780, dur: 0.18, type: 'triangle', gain: 0.25 });
  },
  shot() {
    noise({ dur: 0.035, type: 'highpass', freq: 2200, gain: 0.13 });
    tone({ freq: 820, freqTo: 190, dur: 0.075, type: 'triangle', gain: 0.21 });
    thump(120, 0.12);
  },
  shotHit() {
    noise({ dur: 0.045, freq: 1700, gain: 0.20 });
    tone({ freq: 320, freqTo: 140, dur: 0.09, type: 'triangle', gain: 0.22 });
  },
  enemyDown() {
    thump(170);
    tone({ freq: 660, dur: 0.13, gain: 0.17 });
    tone({ freq: 990, dur: 0.18, gain: 0.13, when: 0.07 });
  },
  recharge() { tone({ freq: 1100, dur: 0.06, gain: 0.08 }); },
  shieldHit() {
    noise({ dur: 0.13, freq: 650, gain: 0.27 });
    thump(100, 0.32);
  },
};
const vocabulary = { sfx: WORM_SFX, haptics: WORM_HAPTICS };
const priorities = { death: 5, cut: 4, shieldHit: 4, heal: 4, dive: 3, exit: 3,
  enemyDown: 3, shotHit: 2, orb: 2, shot: 1, recharge: 0 };

/** Per-run arbitration. Uses the game clock: no timers or catch-up buzzes. */
export function createWormFeedback(dispatch = feel, stop = stopFeel) {
  let time = 0, motorUntil = 0, priority = -1, suspended = false, marker = '';
  const last = new Map();
  function emit(event, opts = {}) {
    if (suspended) return;
    if (time - (last.get(event) ?? -Infinity) < (event === 'orb' ? 0.065 : 0.045)) return;
    last.set(event, time);
    if (event === 'death') { stop(); motorUntil = 0; }
    const rank = priorities[event] ?? 1;
    const haptics = time >= motorUntil || rank > priority;
    const pattern = WORM_HAPTICS[event];
    if (haptics && pattern != null) {
      const value = typeof pattern === 'function' ? pattern(opts.combo) : pattern;
      motorUntil = time + (Array.isArray(value) ? value.reduce((a, b) => a + b, 0) : value) / 1000;
      priority = rank;
    }
    dispatch(event, { ...opts, haptics, priority: rank }, vocabulary);
  }
  function hold(value) {
    if (value && !suspended) stop();
    suspended = value;
    if (value) motorUntil = 0;
  }
  return {
    emit, hold,
    advance(delta) { if (!suspended) time += Math.max(0, Math.min(0.05, delta)); },
    tunnel(phase, progress, alive = true) {
      if (suspended || !alive) return;
      const next = phase === 'tunnel' ? `tunnel:${Math.min(2, Math.floor(progress * 3))}` : phase;
      if (next === marker) return;
      marker = next;
      if (phase === 'entering') emit('tunnelRush');
      if (phase === 'tunnel') emit('tunnelFold');
      if (phase === 'exiting') emit('tunnelRelease');
    },
    reset() { stop(); time = 0; motorUntil = 0; priority = -1; marker = ''; last.clear(); },
  };
}
