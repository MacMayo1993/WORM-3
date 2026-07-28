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
    const c = ctx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
}

/** Enable/disable the two feedback channels (synced from settings). */
export function setFeelEnabled({ sfx, haptics } = {}) {
  if (typeof sfx === 'boolean') _enabledSfx = sfx;
  if (typeof haptics === 'boolean') _enabledHaptics = haptics;
}

/** Manually resume audio (e.g. from a known user gesture). Safe to call anytime. */
export function resumeFeel() {
  const c = ctx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

// ── Low-level synth voices ────────────────────────────────────────────────────
// A short tone with a fast attack + exponential decay. Optional pitch glide (freqTo).
function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.5, attack = 0.005, freqTo = null, when = 0 }) {
  const c = ctx();
  if (!c || !_master) return;
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
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Filtered white-noise burst — whooshes, snips, thuds.
function noise({ dur = 0.15, gain = 0.4, type = 'bandpass', freq = 1200, q = 1, when = 0 }) {
  const c = ctx();
  if (!c || !_master) return;
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
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function chord(freqs, opts = {}) {
  freqs.forEach((f, i) => tone({ ...opts, freq: f, when: (opts.when ?? 0) + i * 0.02 }));
}

// C-major pentatonic run — the orb combo climbs this so quick pickups arpeggiate
// upward (rising pitch = classic reward escalation) and never hit a sour note.
const COMBO_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];

// ── SFX vocabulary ────────────────────────────────────────────────────────────
const SFX = {
  orb(combo = 0) {
    const f = COMBO_SCALE[Math.min(combo, COMBO_SCALE.length - 1)];
    tone({ freq: f, freqTo: f * 1.5, dur: 0.1, type: 'triangle', gain: 0.5 });
  },
  jump() {
    tone({ freq: 300, freqTo: 640, dur: 0.09, type: 'sine', gain: 0.35 });
  },
  boost() {
    noise({ dur: 0.22, type: 'bandpass', freq: 900, q: 0.7, gain: 0.32 });
    tone({ freq: 220, freqTo: 660, dur: 0.22, type: 'sawtooth', gain: 0.22 });
  },
  dive() {
    tone({ freq: 700, freqTo: 120, dur: 0.34, type: 'sine', gain: 0.4 });
    noise({ dur: 0.34, type: 'lowpass', freq: 700, gain: 0.18 });
  },
  exit() {
    tone({ freq: 200, freqTo: 900, dur: 0.18, type: 'triangle', gain: 0.4 });
  },
  heal() {
    chord([523.25, 659.25, 783.99, 1046.5], { dur: 0.5, type: 'sine', gain: 0.3 });
  },
  cut() {
    noise({ dur: 0.12, type: 'highpass', freq: 2600, gain: 0.5 });
    tone({ freq: 420, freqTo: 170, dur: 0.12, type: 'square', gain: 0.18 });
  },
  death() {
    tone({ freq: 400, freqTo: 55, dur: 0.7, type: 'sawtooth', gain: 0.4 });
  },
  countdownBeat() {
    tone({ freq: 440, dur: 0.12, type: 'square', gain: 0.28 });
  },

  // ── Special power-ups ───────────────────────────────────────────────────────
  // A special orb appearing: a soft two-note chime, quiet enough not to compete
  // with a pickup, distinct enough to look up for.
  specialSpawn() {
    chord([880, 1318.51], { dur: 0.22, type: 'sine', gain: 0.16 });
  },
  // Launch: thrust noise under a rising sweep.
  rocket() {
    noise({ dur: 0.42, type: 'lowpass', freq: 1400, gain: 0.34 });
    tone({ freq: 180, freqTo: 1200, dur: 0.42, type: 'sawtooth', gain: 0.26 });
  },
  // Touchdown at the end of the flight — a short, dry thud.
  rocketLand() {
    noise({ dur: 0.1, type: 'lowpass', freq: 420, gain: 0.32 });
    tone({ freq: 150, freqTo: 70, dur: 0.12, type: 'sine', gain: 0.24 });
  },
  // Magnet engaging: a humming fifth that reads as a field switching on.
  magnet() {
    chord([392, 587.33], { dur: 0.36, type: 'triangle', gain: 0.24 });
    tone({ freq: 96, freqTo: 196, dur: 0.36, type: 'sine', gain: 0.2 });
  },
  countdownGo() {
    chord([523.25, 659.25, 783.99, 1046.5, 1318.51], { dur: 0.42, type: 'triangle', gain: 0.33 });
  },

  // ── Wormhole tunnel events ──────────────────────────────────────────────────
  // A pair's FIRST flip: the two tiles are revealed as the same point in RP2.
  // This happens at most once per pair, so it gets the biggest sound in the set —
  // a rising sweep that resolves into an open fifth.
  tunnelBirth() {
    tone({ freq: 180, freqTo: 720, dur: 0.26, type: 'triangle', gain: 0.34 });
    chord([523.25, 783.99], { dur: 0.38, type: 'sine', gain: 0.22, when: 0.18 });
  },

  // Subsequent flips on an existing pair. Pitch climbs the pentatonic scale with
  // the tile's flip count, so working a single pair toward its cap arpeggiates
  // upward and the danger is audible before it is visible.
  tunnelPulse(flips = 0) {
    const f = COMBO_SCALE[Math.min(Math.max(0, flips), COMBO_SCALE.length - 1)];
    tone({ freq: f, freqTo: f * 1.25, dur: 0.11, type: 'triangle', gain: 0.38 });
  },

  // The pair hit FLIP_CAP and severed. Deliberately the ugliest sound here —
  // a snapped cable, not a reward.
  tunnelSnap() {
    noise({ dur: 0.18, type: 'highpass', freq: 3000, gain: 0.5 });
    tone({ freq: 320, freqTo: 48, dur: 0.42, type: 'sawtooth', gain: 0.34 });
  },
};

// ── Haptic vocabulary ──────────────────────────────────────────────────────────
// Distinct patterns (ms, or [gap, buzz, gap, buzz…]) so events are identifiable by
// feel alone. Orb rises with the combo to mirror the pitch climb.
const HAPTICS = {
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
  rocket: [0, 40, 20, 60],
  rocketLand: 22,
  magnet: [0, 18, 25, 18, 25, 18],
  countdownBeat: 12,
  countdownGo: [0, 20, 30, 40],
  tunnelBirth: [0, 12, 60, 30],
  // Grows with the flip count, mirroring the pitch climb.
  tunnelPulse: (flips = 0) => 10 + Math.min(flips, 6) * 4, // 10 → 34ms
  tunnelSnap: [0, 60, 35, 90],
};

/**
 * Fire the feedback for a named game event.
 * @param {string} event  key into SFX/HAPTICS (e.g. 'orb', 'heal', 'death')
 * @param {object} [opts] { combo } for escalating events — the escalation level,
 *                        whatever it counts for that event (orb pickups in a row
 *                        for 'orb', a tile's flip count for 'tunnelPulse').
 */
export function feel(event, opts = {}) {
  attachUnlock();
  if (_enabledSfx) {
    const fn = SFX[event];
    if (fn) {
      try {
        fn(opts.combo);
      } catch (_) {}
    }
  }
  if (_enabledHaptics) {
    const h = HAPTICS[event];
    const pattern = typeof h === 'function' ? h(opts.combo) : h;
    if (pattern != null) vibrate(pattern);
  }
}
