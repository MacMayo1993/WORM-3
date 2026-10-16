// The loading cover as something to play with: hold anywhere to dive faster,
// tap to kick the cube into a spin and ring both portals, and MOBI keeps you
// company with a line every couple of loops and a count of how many you've made.
//
// Everything here runs off LoadingPortal's frame loop (the fall's own clock, `t`
// in seconds of fall) or off pointer events; nothing sets React state. The dive
// speeds every animation in the scene together through the Web Animations API, so
// the cube, its twists and flips, the airflow and the canvases (which read the
// fall's currentTime) never drift apart.

import { passes } from './loadingWormhole.js';

/** The dive: how fast it goes and how quickly it comes on and lets go (seconds). */
export const WARP = { rate: 2.6, rise: 0.35, fall: 0.55, step: 0.2 };
/** A kick's flare decays over `decay` seconds of fall and adds `spin` radians to the vortex. */
export const KICK = { decay: 0.4, spin: 2.4, ring: 0.6, cubeMs: 900 };
/** How long each portal takes to spring open as the cover arrives, and the floor's lag. */
export const OPEN = { duration: 0.42, floorDelay: 0.1 };
/**
 * MOBI changes his line every LINE_LOOPS loops (the hint stays a loop longer),
 * but never sooner than LINE_MS real milliseconds, so a dive can't hurry a line
 * off before it's read; with reduced motion, every LINE_MS_STILL ms.
 */
export const LINE_LOOPS = 2;
export const HINT_LOOPS = 3;
export const LINE_MS = 2800;
export const LINE_MS_STILL = 3500;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The dive's 0–1 level after `dt` real seconds, rising while held and easing off when let go. */
export function warpLevel(level, holding, dt) {
  return clamp01(level + (holding ? dt / WARP.rise : -dt / WARP.fall));
}

/**
 * The playback rate for a dive level, smoothed and quantized to WARP.step so a
 * press re-times the scene's animations a handful of times, not every frame.
 */
export function warpRate(level) {
  const s = clamp01(level);
  const eased = s * s * (3 - 2 * s);
  return +(1 + Math.round(((WARP.rate - 1) * eased) / WARP.step) * WARP.step).toFixed(2);
}

/** 0 before `delay`, then a springy 0 → 1 (with a little overshoot) over OPEN.duration. */
export function portalOpen(t, delay = 0) {
  const u = clamp01((t - delay) / OPEN.duration);
  if (u >= 1) return 1;
  const c = 1.9;
  const v = u - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
}

/** The kick's flare at fall time t: 1 at the kick, fading. */
export function kickPulse(t, kickAt) {
  if (kickAt === null || t < kickAt) return 0;
  return Math.exp(-(t - kickAt) / KICK.decay);
}

/** The vortex's extra turn from kicks: settled kicks in `base`, the latest still easing in. */
export function kickSpin(t, kickAt, base) {
  if (kickAt === null || t < kickAt) return base;
  return base + KICK.spin * (1 - Math.exp(-(t - kickAt) / 0.5));
}

// MOBI's lines (docs/COPY_STYLE.md: warm, practical, a little funny; he calls the
// player "partner" and never says "math").
export const MOBI_HINT = 'Hold anywhere to dive faster, partner. Tap to give it a spin.';
export const MOBI_FIRST_DIVE = 'Wheee! I mean… ahem. Very professional.';
export const MOBI_LINES = [
  'Every tile on the Flip Cube has a twin, straight through the middle.',
  'Flip a tile and its twin flips too. Doors on this ship come in pairs.',
  'Ride a tunnel and you come out at your twin, mirrored.',
  'The Core is the one spot on the ship that is its own twin.',
  'A turning layer can cut your tail off at the seam. Keep your head out of it.',
  'Lost your tail? Grab the dropped orbs back before they blink out.',
  'Two elements fuse, and order matters: Water then Fire makes Steam.',
  "I don't have a stomach, so all this falling is fine by me.",
  'This ship survived W³, the Great Worm War. It can survive a loading screen.',
  'Same cube out the top as went in the bottom. Nothing lost, nothing doubled.',
  'Healing the Flip Cube is how I get home. Thanks for the help, partner.'
];
export const MOBI_MILESTONES = {
  10: "Ten loops! Good thing I don't get dizzy.",
  25: "Twenty-five loops. You're a natural at falling, partner.",
  50: "Fifty loops! I'm putting that in the ship's log.",
  100: 'A hundred loops. Even the Core is impressed.'
};

// Where MOBI's deck is in this session, so the next cover carries on from the
// last instead of opening on the same line every time.
let deck = 0;
const DIVED_KEY = 'worm3_loader_dived';

function readDived() {
  try {
    return globalThis.localStorage?.getItem(DIVED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDived() {
  try {
    globalThis.localStorage?.setItem(DIVED_KEY, '1');
  } catch {
    // Private mode or blocked storage: the hint just shows again next time.
  }
}

/** The next line from MOBI's deck. */
export function nextDeckLine() {
  const line = MOBI_LINES[deck % MOBI_LINES.length];
  deck += 1;
  return line;
}

const vibrate = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // iOS has no vibration API; the dive still reads on screen.
  }
};

const POP = [{ transform: 'scale(1.45)' }, { transform: 'scale(1)' }];
const LINE_IN = [
  { opacity: 0, transform: 'translateY(5px)' },
  { opacity: 1, transform: 'none' }
];
const SPIN = [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }];

/**
 * The cover's play controller. `scene` is the `.wl-scene` element (its
 * animations are the ones a dive speeds up, and `wl-warp` on it shows the dive),
 * `veil` the speed lines centred on it, `line`/`badge` MOBI's line and loop count. LoadingPortal calls `frame(t, now)` once per drawn frame, then
 * reads `warp`, `kick`, `kickSince` and `spin` to draw.
 */
export function createLoadingPlay({ scene, veil, line, badge, reduced = false }) {
  const play = {
    warp: 0,
    kick: 0,
    kickSince: Infinity,
    kicks: 0,
    spin: 0,
    holding: false,
    rate: 1,
    loops: 0,
    press,
    release,
    frame
  };
  let kickAt = null;
  let kickPending = false;
  let spinBase = 0;
  let lastNow = null;
  let lineLoops = 0;
  let lineAt = 0;
  let dived = readDived();
  let started = false;

  const say = (text, now = lastNow ?? 0) => {
    lineAt = now;
    if (!line || line.textContent === text) return;
    line.textContent = text;
    line.animate?.(LINE_IN, { duration: 280, easing: 'ease-out' });
  };

  const retime = (rate) => {
    play.rate = rate;
    for (const anim of scene?.getAnimations?.({ subtree: true }) ?? []) {
      if (anim.updatePlaybackRate) anim.updatePlaybackRate(rate);
      else anim.playbackRate = rate;
    }
  };

  function press() {
    if (reduced) return;
    if (!play.holding && scene) {
      // Centre the speed lines on the shaft (the cover is fixed to the viewport).
      const box = scene.getBoundingClientRect();
      veil?.style.setProperty('--wl-veil-x', `${box.left + box.width / 2}px`);
      veil?.style.setProperty('--wl-veil-y', `${box.top + box.height / 2}px`);
      scene.classList.add('wl-warp');
    }
    play.holding = true;
    kickPending = true;
    // Spin the cube and its twin together, about their own vertical axis.
    for (const el of scene?.querySelectorAll?.('.wl-spin') ?? []) {
      if (el.getAnimations?.().some((a) => a.playState === 'running')) continue;
      el.animate?.(SPIN, { duration: KICK.cubeMs, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' });
    }
    if (!dived) {
      dived = true;
      writeDived();
      say(MOBI_FIRST_DIVE);
      lineLoops = play.loops;
    }
  }

  function release() {
    if (!play.holding) return;
    play.holding = false;
    scene?.classList.remove('wl-warp');
  }

  function frame(t, now) {
    const dt = lastNow === null ? 0 : Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    if (!started) {
      started = true;
      say(dived || reduced ? nextDeckLine() : MOBI_HINT, now);
    }

    if (kickPending) {
      kickPending = false;
      // Fold the last kick's remaining ease into the base so the vortex never jumps.
      spinBase = kickSpin(t, kickAt, spinBase);
      kickAt = t;
      play.kicks += 1;
    }
    play.kick = kickPulse(t, kickAt);
    play.kickSince = kickAt === null ? Infinity : t - kickAt;
    play.spin = kickSpin(t, kickAt, spinBase);

    play.warp = warpLevel(play.warp, play.holding, dt);
    const rate = warpRate(play.warp);
    if (rate !== play.rate) retime(rate);

    // Loops: the badge pops each pass; MOBI moves on every LINE_LOOPS, and
    // marks the milestones. A dive buzzes the phone once per pass.
    const loops = reduced ? 0 : passes(t);
    if (loops !== play.loops) {
      play.loops = loops;
      if (badge) {
        badge.textContent = `×${loops}`;
        badge.classList.add('wl-on');
        badge.animate?.(POP, { duration: MOBI_MILESTONES[loops] ? 520 : 260, easing: 'ease-out' });
      }
      if (play.holding) vibrate(12);
      if (MOBI_MILESTONES[loops]) {
        say(MOBI_MILESTONES[loops], now);
        lineLoops = loops;
      }
    }
    const due = reduced
      ? now - lineAt >= LINE_MS_STILL
      : now - lineAt >= LINE_MS && loops - lineLoops >= (line?.textContent === MOBI_HINT ? HINT_LOOPS : LINE_LOOPS);
    if (due) {
      say(nextDeckLine(), now);
      lineLoops = loops;
    }
  }

  return play;
}
