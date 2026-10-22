import { feel, noise, tone, stopFeel } from '../utils/feel.js';

// Loaded with WORM. Short impacts leave space between actions, even when firing.
const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
const level = value => Math.min(6, Math.max(0, Number.isFinite(value) ? value : 0));
export const WORM_HAPTICS = {
  elementFusion: [24, 35, 24, 45, 48],
  orb: combo => [16 + level(combo) * 2, 24, 9],
  dive: [24, 32, 12, 38, 22],
  tunnelRush: [8, 38, 12], tunnelFold: [10, 32, 10], tunnelRelease: [12, 25, 18],
  exit: [28, 35, 12], heal: [20, 50, 32, 65, 48],
  // A tunnel heal: one firm knock per mouth; a double heal knocks twice per mouth.
  seal: (_rung, opts) => opts?.tier === 2 ? [26, 40, 26, 55, 34, 40, 60] : [26, 45, 40],
  shot: 12, shotHit: [18, 20, 8], enemyDown: [24, 32, 12], recharge: 6,
  shieldHit: [35, 35, 22], jump: [12, 22, 8], boost: [18, 30, 12],
  cut: [40, 30, 35], death: [55, 45, 85], rocket: [35, 25, 70, 25, 45],
  rocketLand: [25, 30, 10], magnet: [12, 25, 12, 25, 18],
  collapse: [30, 40, 20, 60, 45],
  rumble: [8, 30, 6],
  combo: [10, 18, 10, 18, 26],
  gust: [10, 30, 8],
};

const thump = (freq = 130, gain = 0.24) => tone({ freq, freqTo: 55, dur: 0.10, gain });
// The heal ladder: a pentatonic scale from C4, so any run of heals stays in key. Each
// tunnel heal this run roots its arpeggio one step higher (capped, so a long run
// tops out bright rather than shrill); the next run starts back at the bottom.
const PENTATONIC = [261.63, 293.66, 329.63, 392, 440];
const ladder = step => PENTATONIC[step % 5] * 2 ** Math.floor(step / 5);
export const SEAL_LADDER_TOP = 7;
const WORM_SFX = {
  elementFusion() {
    // Two voices converge, then resolve into a chord: a combination, not another
    // ordinary pickup. All voices use the existing mute/pause lifecycle.
    tone({ freq: 330, freqTo: 660, dur: 0.23, type: 'triangle', gain: 0.2 });
    tone({ freq: 990, freqTo: 660, dur: 0.23, gain: 0.15 });
    for (const freq of [523.25, 659.25, 783.99]) tone({ freq, dur: 0.42, gain: 0.12, when: 0.23 });
  },
  orb(combo = 0) {
    const f = notes[Math.floor(level(combo))];
    thump(170, 0.22);
    tone({ freq: f * 0.75, freqTo: f, dur: 0.09, type: 'triangle', gain: 0.35 });
    tone({ freq: f * 2, dur: 0.22, gain: 0.12, when: 0.045 });
  },
  // A tunnel heal: both mouths sealing. A knock, a rising arpeggio from this run's rung
  // and a bright shimmer; a double heal answers with the same figure an octave up.
  seal(rung = 0, opts = {}) {
    const root = Math.min(SEAL_LADDER_TOP, Math.max(0, Math.floor(Number.isFinite(rung) ? rung : 0)));
    thump(120, 0.26);
    [0, 2, 4].forEach((step, i) => tone({ freq: ladder(root + step), dur: 0.2 + i * 0.06, type: 'triangle', gain: 0.24, when: i * 0.07 }));
    tone({ freq: ladder(root + 4) * 2, dur: 0.5, gain: 0.07, when: 0.21 });
    if (opts.tier === 2) {
      [0, 2, 4].forEach((step, i) => tone({ freq: ladder(root + step + 5), dur: 0.24, type: 'triangle', gain: 0.17, when: 0.3 + i * 0.06 }));
      noise({ dur: 0.35, type: 'highpass', freq: 5200, gain: 0.06, when: 0.3 });
    }
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
  // An orb chain reaching ×3, ×5, ×8 (orbCombo.js): a quick sparkle run on top of
  // the pickup's own chime, a step higher at each milestone.
  combo(combo = 0) {
    const lift = level(Math.floor((combo + 1) / 3));
    for (let i = 0; i < 3; i++) tone({ freq: notes[Math.min(6, lift + i * 2)] * 2, dur: 0.12, gain: 0.1, when: 0.08 + i * 0.05 });
  },
  // Air's gale on landing: a breath of wind, nothing that sounds like a pickup.
  gust() {
    noise({ dur: 0.38, type: 'bandpass', freq: 900, q: 0.6, gain: 0.14 });
    tone({ freq: 240, freqTo: 420, dur: 0.3, gain: 0.05 });
  },
  // The Rumbler's crest rolling under the head: a low, short swell, felt more than heard.
  rumble() {
    noise({ dur: 0.42, type: 'lowpass', freq: 140, gain: 0.16 });
    tone({ freq: 62, freqTo: 48, dur: 0.4, gain: 0.12 });
  },
  // A worn-out tunnel caving in behind the worm: a low crumble and a sinking note.
  collapse() {
    noise({ dur: 0.55, type: 'lowpass', freq: 260, gain: 0.26 });
    tone({ freq: 140, freqTo: 42, dur: 0.6, gain: 0.2 });
    thump(90, 0.2);
  },
  shieldHit() {
    noise({ dur: 0.13, freq: 650, gain: 0.27 });
    thump(100, 0.32);
  },
};
const vocabulary = { sfx: WORM_SFX, haptics: WORM_HAPTICS };
const priorities = { death: 5, cut: 4, shieldHit: 4, heal: 4, seal: 4, collapse: 3, elementFusion: 3, dive: 3, exit: 3, rumble: 0,
  enemyDown: 3, shotHit: 2, orb: 2, combo: 2, gust: 1, shot: 1, recharge: 0 };

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
      const value = typeof pattern === 'function' ? pattern(opts.combo, opts) : pattern;
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
