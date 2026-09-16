// src/utils/feel.js
// Centralized "game feel" layer for worm mode: procedural Web Audio SFX + haptic
// patterns, dispatched by named event.
//
// No audio assets — every sound is synthesized on demand from oscillators and
// filtered noise, so this ships with zero binaries. Recorded samples can be swapped
// in later behind the same feel() API without touching any call site.

import { vibrate } from './audio.js';

let _ctx = null;
let _master = null;
let _enabledSfx = true;
let _enabledHaptics = true;
let _unlockAttached = false;
const voices = new Set();
let hapticEnd = 0, hapticPriority = 0;

function finishVoice(source, nodes, start, end) {
  const release = () => { if (!voices.delete(source)) return; source.disconnect(); nodes.forEach(node => node.disconnect()); };
  source.onended = release;
  voices.add(source);
  source.start(start);
  source.stop(end);
}

/** Cancel live/scheduled voices and the motor when leaving or pausing play. */
export function stopFeel({ audio = true, haptics = true } = {}) {
  if (audio) for (const source of voices) { try { source.stop(); } catch (_) {} source.onended(); }
  if (haptics) {
    if (hapticEnd > Date.now()) vibrate(0);
    hapticEnd = 0;
  }
}


// Lazily create the AudioContext. Browsers start it 'suspended' until a user gesture
// resumes it (see attachUnlock), so creating it eagerly is harmless.
function ctx() {
  if (_ctx) return _ctx;
  if (typeof window === 'undefined') return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
    _master = _ctx.createGain();
    _master.gain.value = 0.35; // global SFX headroom
    _master.connect(_ctx.destination);
  } catch (_) {
    _ctx = null;
  }
  return _ctx;
}

// Resume audio on the first user gesture anywhere on the page — the standard unlock
// for autoplay-restricted browsers. Idempotent and cheap once running.
function attachUnlock() {
  if (_unlockAttached || typeof window === 'undefined') return;
  _unlockAttached = true;
  const unlock = () => {
    if (!_enabledSfx) return;
    const c = ctx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
}

/** Enable/disable the two feedback channels (synced from settings). */
export function setFeelEnabled({ sfx, haptics } = {}) {
  if (sfx === false) stopFeel({ haptics: false });
  if (typeof sfx === 'boolean') _enabledSfx = sfx;
  if (haptics === false) stopFeel({ audio: false });
  if (typeof haptics === 'boolean') _enabledHaptics = haptics;
}

/** Manually resume audio (e.g. from a known user gesture). Safe to call anytime. */
export function resumeFeel() {
  attachUnlock();
  if (!_enabledSfx) return;
  const c = ctx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

// ── Low-level synth voices ────────────────────────────────────────────────────
// A short tone with a fast attack + exponential decay. Optional pitch glide (freqTo).
export function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.5, attack = 0.005, freqTo = null, when = 0 }) {
  const c = ctx();
  if (!c || !_master || c.state === 'suspended') return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(_master);
  finishVoice(osc, [g], t0, t0 + dur + 0.02);
}

// Filtered white-noise burst — whooshes, snips, thuds.
export function noise({ dur = 0.15, gain = 0.4, type = 'bandpass', freq = 1200, q = 1, when = 0 }) {
  const c = ctx();
  if (!c || !_master || c.state === 'suspended') return;
  const t0 = c.currentTime + when;
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  filt.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(_master);
  finishVoice(src, [filt, g], t0, t0 + dur + 0.02);
}

function chord(freqs, opts = {}) {
  freqs.forEach((f, i) => tone({ ...opts, freq: f, when: (opts.when ?? 0) + i * 0.02 }));
}

// Pitch sweeps share envelope defaults across the event vocabulary.
function sweep(freq, freqTo, dur, gain, type = 'sine', when = 0) {
  tone({ freq, freqTo, dur, gain, type, when });
}

function cubeClick(depth, quiet) {
  const step = 1 + Math.min(Math.max(0, depth), 6) * 0.055;
  noise({ dur: quiet ? 0.03 : 0.035, type: 'bandpass', freq: 1800 * step, q: 1.6, gain: quiet ? 0.09 : 0.16 });
  sweep(150 * step, 110 * step, quiet ? 0.06 : 0.07, quiet ? 0.07 : 0.12, 'triangle');
}

// C-major pentatonic run — the orb combo climbs this so quick pickups arpeggiate
// upward (rising pitch = classic reward escalation) and never hit a sour note.
const COMBO_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];

// ── SFX vocabulary ────────────────────────────────────────────────────────────
const SFX = {
  springCharge() {
    sweep(220, 110, 0.23, 0.2, 'triangle');
  },
  beacon() {
    for (let i = 0; i < 3; i++) tone({ freq: 660 + i * 220, dur: 0.3, gain: 0.14, when: i * 0.12 });
  },
  parityLock() {
    sweep(180, 90, 0.16, 0.22, 'triangle');
    tone({ freq: 880, dur: 0.18, gain: 0.12, when: 0.13 });
  },
  elementFire() {
    noise({ dur: 0.5, type: 'bandpass', freq: 850, q: 0.8, gain: 0.25 });
    sweep(180, 420, 0.3, 0.16, 'triangle');
  },
  elementWater() {
    noise({ dur: 0.45, type: 'lowpass', freq: 650, gain: 0.16 });
    sweep(520, 980, 0.22, 0.2);
    sweep(780, 1170, 0.2, 0.12, 'sine', 0.13);
  },
  elementIce() {
    for (let i = 0; i < 3; i++) tone({ freq: 1200 * [1, 1.5, 2][i], dur: 0.45, gain: 0.1, when: i * 0.09 });
  },
  elementNature() {
    noise({ dur: 0.35, type: 'lowpass', freq: 1800, gain: 0.08 });
    for (let i = 0; i < 3; i++) tone({ freq: [392, 494, 587][i], dur: 0.3, type: 'triangle', gain: 0.1, when: i * 0.12 });
  },
  orb(combo = 0) {
    const f = COMBO_SCALE[Math.min(combo, COMBO_SCALE.length - 1)];
    sweep(f, f * 1.5, 0.1, 0.42, 'triangle');
    sweep(f * 2, f * 2, 0.14, 0.12);
  },
  jump() {
    sweep(300, 640, 0.09, 0.35);
  },
  boost() {
    noise({ dur: 0.22, type: 'bandpass', freq: 900, q: 0.7, gain: 0.32 });
    sweep(220, 660, 0.22, 0.22, 'sawtooth');
  },
  dive() {
    sweep(700, 120, 0.34, 0.4);
    noise({ dur: 0.34, type: 'lowpass', freq: 700, gain: 0.18 });
  },
  exit() {
    sweep(200, 900, 0.18, 0.4, 'triangle');
  },
  heal() {
    chord([523.25, 659.25, 783.99, 1046.5], { dur: 0.5, gain: 0.3 });
  },
  cut() {
    noise({ dur: 0.12, type: 'highpass', freq: 2600, gain: 0.5 });
    sweep(420, 170, 0.12, 0.18, 'square');
  },
  death() {
    sweep(400, 55, 0.7, 0.4, 'sawtooth');
  },
  countdownBeat() {
    tone({ freq: 440, dur: 0.12, type: 'square', gain: 0.28 });
  },

  // ── Special power-ups ───────────────────────────────────────────────────────
  // A special orb appearing: a soft two-note chime, quiet enough not to compete
  // with a pickup, distinct enough to look up for.
  specialSpawn() {
    chord([880, 1318.51], { dur: 0.22, gain: 0.16 });
  },
  // Launch: thrust noise under a rising sweep.
  rocket() {
    noise({ dur: 0.42, type: 'lowpass', freq: 1400, gain: 0.34 });
    sweep(180, 1200, 0.42, 0.26, 'sawtooth');
  },
  // Touchdown at the end of the flight — a short, dry thud.
  rocketLand() {
    noise({ dur: 0.1, type: 'lowpass', freq: 420, gain: 0.32 });
    sweep(150, 70, 0.12, 0.24);
  },
  // A special timed out untouched. Deliberately soft and downward — informative,
  // not punitive; missing one is a small shrug, not a failure state.
  specialExpire() {
    sweep(520, 300, 0.2, 0.14);
  },
  // Magnet engaging: a humming fifth that reads as a field switching on.
  magnet() {
    chord([392, 587.33], { dur: 0.36, type: 'triangle', gain: 0.24 });
    sweep(96, 196, 0.36, 0.2);
  },
  countdownGo() {
    chord([523.25, 659.25, 783.99, 1046.5, 1318.51], { dur: 0.42, type: 'triangle', gain: 0.33 });
  },

  // ── Wormhole tunnel events ──────────────────────────────────────────────────
  // A pair's FIRST flip: the two tiles are revealed as the same point in RP2.
  // This happens at most once per pair, so it gets the biggest sound in the set —
  // a rising sweep that resolves into an open fifth.
  tunnelBirth() {
    sweep(180, 720, 0.26, 0.34, 'triangle');
    chord([523.25, 783.99], { dur: 0.38, gain: 0.22, when: 0.18 });
  },

  // Subsequent flips on an existing pair. Pitch climbs the pentatonic scale with
  // the tile's flip count, so working a single pair toward its cap arpeggiates
  // upward and the danger is audible before it is visible.
  tunnelPulse(flips = 0) {
    const f = COMBO_SCALE[Math.min(Math.max(0, flips), COMBO_SCALE.length - 1)];
    sweep(f, f * 1.25, 0.11, 0.38, 'triangle');
  },

  // The pair hit FLIP_CAP and severed. Deliberately the ugliest sound here —
  // a snapped cable, not a reward.
  tunnelSnap() {
    noise({ dur: 0.18, type: 'highpass', freq: 3000, gain: 0.5 });
    sweep(320, 48, 0.42, 0.34, 'sawtooth');
  },
  // The touch tray's keys. Dry and short — the sound of a switch bottoming out,
  // not an event in the game. It fires on every press, so it has to sit under the
  // game's own vocabulary rather than compete with it.
  uiKey() {
    noise({ dur: 0.025, type: 'highpass', freq: 2600, gain: 0.16 });
    sweep(190, 130, 0.045, 0.09, 'square');
  },

  // ── The cube itself ─────────────────────────────────────────────────────────
  // Worm mode has had this whole layer since it shipped; the cube was still
  // calling play('/sounds/*.mp3') against files that do not exist, so the main
  // game — the actual Rubik's cube — made no sound at all.

  // A slice turn. Plastic-on-plastic: a filtered click over a short woody body.
  // This fires on EVERY move including shuffles, so it is the quietest thing in
  // the set by some margin — presence, not an event.
  //
  // Pitch steps with the slice's depth so a sequence of turns has melodic
  // contour instead of one click repeated. Depth is small (0..size-1) and the
  // ratio is deliberately narrow: a turn should never sound like a different
  // event just because it happened further back.
  cubeTurn(depth = 0) { cubeClick(depth, false); },

  // The same turn during an auto-shuffle. Quieter, and deliberately absent from
  // the haptic table: a scramble fires 25+ moves in a burst, which is pleasant
  // to hear as a cube being worked and horrible to feel as 25 buzzes.
  cubeShuffleTurn(depth = 0) { cubeClick(depth, true); },

  // THE signature move: a tile and its antipode swap through the middle of the
  // cube. Three acts, timed to the same ~0.5s squish the haptic already mirrors:
  //
  //   seize    (t=0)     the tile is grabbed — a small dry tick
  //   crossing (t=0.25)  it collapses through the manifold seam — pitch dives,
  //                      because the tile is travelling INTO the cube
  //   snap     (t=0.41)  it overshoots back out on the far side — pitch climbs
  //                      the pentatonic with the tile's flip count, so a tile
  //                      near its cap rings higher and the danger is audible
  //                      before the shader's heat makes it visible
  //
  // The climb is the same COMBO_SCALE the orb and tunnel pulses use, so a player
  // already reads rising pitch as "escalating" by the time they meet it here.
  cubeFlip(flips = 0, opts = {}) {
    const cap = opts.cap > 0 ? opts.cap : 6;
    const danger = Math.min(1, Math.max(0, flips / cap));
    const f = COMBO_SCALE[Math.min(Math.max(0, flips), COMBO_SCALE.length - 1)];

    noise({ dur: 0.03, type: 'highpass', freq: 3200, gain: 0.13 });
    sweep(520, 190, 0.16, 0.20, 'sine', 0.25);
    // Gain leans on danger so a nearly spent tile snaps back harder, matching
    // the haptic's growing kick rather than fighting it.
    sweep(f, f * 1.5, 0.14, 0.26 + danger * 0.12, 'triangle', 0.41);
  },

  // Tapping a tile that has nothing left. Currently the tap is simply ignored,
  // which reads as an unresponsive control rather than a spent tile — this is a
  // dull, closed thud that says "heard you, and no".
  cubeRefuse() {
    noise({ dur: 0.06, type: 'lowpass', freq: 300, gain: 0.22 });
    sweep(110, 82, 0.09, 0.10, 'square');
  },

  // The solve. The largest sound in the game, and the only one that resolves all
  // the way up the pentatonic — everything else stops short of the octave.
  cubeSolved() {
    chord([523.25, 659.25, 783.99, 1046.5], { dur: 0.85, gain: 0.26 });
    sweep(261.63, 1046.5, 0.5, 0.2, 'triangle');
    chord([783.99, 1046.5, 1318.51], { dur: 0.7, gain: 0.18, when: 0.34 });
  },

  // Reset / shuffle — the cube being taken back. A downward sweep under a wash
  // of noise: the opposite shape to the solve, deliberately.
  cubeReset() {
    noise({ dur: 0.3, type: 'bandpass', freq: 900, q: 0.6, gain: 0.2 });
    sweep(480, 130, 0.3, 0.16, 'triangle');
  },
};

// ── Haptic vocabulary ──────────────────────────────────────────────────────────
// Distinct patterns (ms, or [buzz, gap, buzz…]) so events are identifiable by
// feel alone. Orb rises with the combo to mirror the pitch climb.
const HAPTICS = {
  springCharge: [10, 45, 18],
  beacon: [8, 65, 8, 65, 8],
  parityLock: [22, 35, 12],
  elementFire: [12, 20, 8],
  elementWater: [8, 35, 8],
  elementIce: [5, 25, 5, 25, 5],
  elementNature: 12,
  orb: (combo = 0) => 8 + Math.min(combo, 6) * 3, // 8 → 26ms
  jump: 14,
  boost: [0, 25, 30, 25],
  dive: [0, 15, 20, 15, 25],
  exit: 35,
  heal: [0, 30, 40, 60],
  cut: [0, 50, 30, 50],
  death: [0, 80, 40, 120],
  nearMiss: 8,
  specialSpawn: 10,
  specialExpire: 6,
  rocket: [0, 40, 20, 60],
  rocketLand: 22,
  magnet: [0, 18, 25, 18, 25, 18],
  countdownBeat: 12,
  countdownGo: [0, 20, 30, 40],
  tunnelBirth: [0, 12, 60, 30],
  // Grows with the flip count, mirroring the pitch climb.
  tunnelPulse: (flips = 0) => 10 + Math.min(flips, 6) * 4, // 10 → 34ms
  tunnelSnap: [0, 60, 35, 90],
  // Short enough to read as the key itself rather than as something happening.
  uiKey: 10,

  // ── The cube itself ─────────────────────────────────────────────────────────
  // Light enough to sit under a fast sequence of turns without buzzing the hand.
  cubeTurn: 7,

  // The flip's three-act pattern, moved here from audio.vibrateFlip so ONE
  // dispatch owns both halves of the feedback. That also fixes a real bug: the
  // old call site vibrated through navigator directly, so turning haptics off in
  // settings silenced worm mode and left the cube buzzing anyway.
  //
  // [seize, gap, crossing, gap, snap] in ms, timed to the audio above. The
  // crossing and snap grow with the flip count, so a tile straining near its cap
  // snaps back with a kick you can actually feel.
  //
  // navigator.vibrate cancels any in-flight pattern, so during a chaos burst the
  // last flip's pattern wins rather than stacking — which reads as one settling
  // buzz instead of a smear.
  cubeFlip: (flips = 0, opts = {}) => {
    const cap = opts.cap > 0 ? opts.cap : 6;
    const danger = Math.min(1, Math.max(0, flips / cap));
    return [8, 235, Math.round(14 + danger * 10), 150, Math.round(26 + danger * 24)];
  },

  cubeRefuse: [0, 18, 40, 12],
  cubeSolved: [0, 40, 60, 40, 60, 90],
  cubeReset: 16,
};

/**
 * Fire the feedback for a named game event.
 * @param {string} event  key into SFX/HAPTICS (e.g. 'orb', 'heal', 'death')
 * @param {object} [opts] { combo } for escalating events — the escalation level,
 *                        whatever it counts for that event (orb pickups in a row
 *                        for 'orb', a tile's flip count for 'tunnelPulse' and
 *                        'cubeFlip'). The whole opts object is passed through as
 *                        a second argument for events that need more than one
 *                        number — 'cubeFlip' reads `cap`, because a tile's flip
 *                        count only means something against the cap in force
 *                        (Disparity runs on a configurable one).
 */
export function feel(event, opts = {}, vocabulary = {}) {
  attachUnlock();
  if (_enabledSfx) {
    const fn = vocabulary.sfx?.[event] ?? SFX[event];
    if (fn) {
      try {
        fn(opts.combo, opts);
      } catch (_) {}
    }
  }
  if (_enabledHaptics && opts.haptics !== false) {
    const h = vocabulary.haptics?.[event] ?? HAPTICS[event];
    const pattern = typeof h === 'function' ? h(opts.combo, opts) : h;
    const priority = opts.priority ?? (event === 'uiKey' ? 0 : 1);
    if (pattern != null && (Date.now() >= hapticEnd || priority >= hapticPriority)) {
      hapticPriority = priority;
      vibrate(pattern);
      hapticEnd = Date.now() + (Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern);
    }
  }
}
