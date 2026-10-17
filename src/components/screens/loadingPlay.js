// The loading cover as something to play with: hold anywhere to dive faster,
// tap to kick the cube into a spin and ring both portals, and MOBI keeps you
// company with a line every couple of loops and a count of how many you've made.
//
// The view tilts too: the mouse (or a finger held on the cover, or a phone's own
// tilt where the browser gives it without asking) moves the viewer, so the cube
// and portals slide over the paper, the cube turns to show its other sides and
// the throats lean inside their mouths. See TILT.
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
 * How long MOBI holds each line, in real milliseconds (a dive never hurries a
 * tip off before it's read): a gameplay tip for TIP_MS, the hold-to-dive hint
 * for HINT_MS. A milestone or the first dive cuts in at once and holds for TIP_MS.
 */
export const TIP_MS = 4000;
export const HINT_MS = 3000;

/**
 * The tilt: where the viewer leans, as -1…1 across and down the screen.
 * `near` px is how far the portals and cube slide (opposite the lean), `far` px
 * how far the paper does, `turn` degrees how far the cube turns at full lean
 * (across, then down), `lean` how far a throat shifts inside its mouth (in
 * mouth half-widths), `ease` the smoothing rate (1/s), and `degrees` the phone
 * tilt from its resting pose that counts as full lean.
 */
export const TILT = { near: 16, far: 6, turn: [9, 6], lean: 0.16, ease: 7, degrees: 22, settle: 0.004, deadzone: 0.03 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

/** Ease `current` toward `target` over `dt` real seconds (frame-rate independent). */
export function tiltToward(current, target, dt) {
  return current + (target - current) * (1 - Math.exp(-dt * TILT.ease));
}

/** Screen point → lean (-1…1 across and down, 0 at the centre), into `out`. */
export function pointerAim(x, y, width, height, out) {
  out.x = width > 0 ? clamp1((x / width) * 2 - 1) : 0;
  out.y = height > 0 ? clamp1((y / height) * 2 - 1) : 0;
  return out;
}

/**
 * A phone's tilt → lean, relative to the pose it rests in (`base`, which drifts
 * toward the current pose so a lean held still slowly recentres), turned to the
 * screen's orientation (`angle`, degrees). `beta` tips the top away, `gamma`
 * tips the right side down. Writes `out`; updates `base`.
 */
export function orientationAim(beta, gamma, angle, base, out) {
  if (base.beta === null) {
    base.beta = beta;
    base.gamma = gamma;
  }
  const db = beta - base.beta;
  const dg = gamma - base.gamma;
  base.beta += db * TILT.settle;
  base.gamma += dg * TILT.settle;
  // In portrait the right side tipping down leans right, the top tipping away leans down.
  let x = dg;
  let y = db;
  const turn = (((Math.round(angle / 90) % 4) + 4) % 4) * 90;
  if (turn === 90) [x, y] = [db, -dg];
  else if (turn === 180) [x, y] = [-dg, -db];
  else if (turn === 270) [x, y] = [-db, dg];
  out.x = clamp1(x / TILT.degrees);
  out.y = clamp1(y / TILT.degrees);
  return out;
}

/**
 * The cube's turn for a lean, as a CSS `rotate` value: leaning right shows more
 * of its right side (a turn about the vertical), leaning down less of its top.
 */
export function tiltRotate(x, y) {
  const rx = y * TILT.turn[1];
  const ry = -x * TILT.turn[0];
  const deg = Math.hypot(rx, ry);
  if (deg < 0.01) return '0 1 0 0deg';
  return `${(rx / deg).toFixed(4)} ${(ry / deg).toFixed(4)} 0 ${deg.toFixed(3)}deg`;
}

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
// player "partner" and never says "math"). The tips state real rules: each names
// the mechanic it teaches, and the numbers are the game's own (dropped orbs last
// DROPPED_ORB_LIFETIME, Ice runs the turn clock at coldSnapRate, and so on).
export const MOBI_HINT = 'Hold anywhere to dive faster, partner. Tap to give it a spin.';
export const MOBI_FIRST_DIVE = 'Wheee! I mean… ahem. Very professional.';
export const MOBI_TIPS = [
  'Every tile has a twin straight through the middle. Flip one and its twin flips too.',
  "Tiles wear out: every flip spends some of a tile's life, so keep an eye on its health bar.",
  'Jump onto a raised flip pad to dive into its tunnel.',
  'Ride a tunnel and you come out at your twin, mirrored.',
  'Riding a turning layer is safe, but it cuts your tail at the seam. Never cross it head-first.',
  'Lost some tail? Your orbs scatter. Grab them back within 5 seconds, before they blink out.',
  "An orb pays out in its tile's twin colour: one on a white tile gives you a yellow bead.",
  'Two elements fuse, and order matters: Fire then Water is Steam, Water then Fire is Quench.',
  'Under Ice, layer turns come half as often. A good time to cross the board.',
  "Ride under Water and your tunnels don't wear out.",
  "Fire pays part of every tunnel's toll for you.",
  'Lightning marks its tiles before it strikes. Be off the ring, or in the air, when it lands.',
  'Jump again in mid-air for a double jump.',
  'Every ten WORM Story levels you clear unlocks a new worm.',
  'New modes open as you clear WORM Story levels. The Store opens after your first.'
];
export const MOBI_MILESTONES = {
  10: "Ten loops! Good thing I don't get dizzy.",
  25: "Twenty-five loops. You're a natural at falling, partner.",
  50: "Fifty loops! I'm putting that in the ship's log.",
  100: 'A hundred loops. Even the Core is impressed.'
};

const MILESTONE_LOOPS = Object.keys(MOBI_MILESTONES)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * The milestone the loop count crossed going from `from` to `to`, or null. A
 * stalled main thread (the cover's whole reason to exist) or a throttled tab can
 * advance several loops in one frame, so a milestone is any one in (from, to],
 * not only one landed on exactly; if a jump crosses several, the latest wins.
 */
export function milestoneCrossed(from, to) {
  let crossed = null;
  for (const loop of MILESTONE_LOOPS) {
    if (loop > from && loop <= to) crossed = loop;
  }
  return crossed;
}

// Where MOBI's tips are in this session, so the next cover carries on from the
// last instead of opening on the same tip every time.
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

/** The next tip from MOBI's deck. */
export function nextTip() {
  const tip = MOBI_TIPS[deck % MOBI_TIPS.length];
  deck += 1;
  return tip;
}

/**
 * What MOBI says as the cover appears: the hold-to-dive hint until the player
 * has dived once (never with reduced motion, where there is no dive), else the
 * next tip. Rendered with the cover itself, so his first line never waits on a
 * busy main thread for the first frame.
 */
export function openingLine(reduced = false) {
  return !reduced && !readDived() ? { text: MOBI_HINT, kind: 'hint' } : { text: nextTip(), kind: 'tip' };
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
const CLOCK = [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }];
const NAME = { tip: 'MOBI · TIP', hint: 'MOBI', say: 'MOBI' };

/**
 * The cover's play controller. `scene` is the `.wl-scene` element (its
 * animations are the ones a dive speeds up, and `wl-warp` on it shows the dive),
 * `veil` the speed lines centred on it, `line`/`badge` MOBI's line and loop count,
 * `name` the label over his line, `clock` the bar that runs down until the next
 * one, and `opening` the line the cover was rendered with (`openingLine`). LoadingPortal calls `frame(t, now)` once per drawn frame, then
 * reads `warp`, `kick`, `kickSince` and `spin` to draw.
 */
export function createLoadingPlay({ scene, veil, line, badge, name, clock, opening = null, reduced = false }) {
  const play = {
    tiltX: 0,
    tiltY: 0,
    tiltMoved: false,
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
    frame,
    aim
  };
  // What the tilt is easing toward: a pointer while one is aiming, else the phone.
  const pointer = { x: 0, y: 0, active: false };
  const motion = { x: 0, y: 0, active: false };
  const cubes = Array.from(scene?.querySelectorAll?.('.wl-cube') ?? []);
  let kickAt = null;
  let tilted = false;
  let kickPending = false;
  let spinBase = 0;
  let lastNow = null;
  let lineAt = 0;
  let lineKind = opening?.kind ?? null;
  let dived = readDived();
  let started = false;

  const holdFor = (kind) => (kind === 'hint' ? HINT_MS : TIP_MS);
  const runClock = (kind) => {
    clock?.animate?.(CLOCK, { duration: holdFor(kind), easing: 'linear', fill: 'forwards' });
  };
  const say = (text, kind, now = lastNow ?? 0) => {
    lineAt = now;
    lineKind = kind;
    if (name && name.textContent !== NAME[kind]) name.textContent = NAME[kind];
    runClock(kind);
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
      say(MOBI_FIRST_DIVE, 'say');
    }
  }

  /**
   * Point the view: `source` 'pointer' (a mouse over the cover, or a finger held
   * on it) or 'motion' (the phone's tilt); `active` false stops that source.
   */
  function aim(source, x, y, active = true) {
    if (reduced) return;
    const into = source === 'motion' ? motion : pointer;
    // Sensor noise below the deadzone doesn't move anything (or redraw the paper).
    if (source === 'motion' && into.active && Math.abs(x - into.x) < TILT.deadzone && Math.abs(y - into.y) < TILT.deadzone) return;
    into.x = x;
    into.y = y;
    into.active = active;
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
      // The cover arrived already saying `opening`; its time starts now.
      if (opening) {
        lineAt = now;
        runClock(opening.kind);
      } else say(dived || reduced ? nextTip() : MOBI_HINT, dived || reduced ? 'tip' : 'hint', now);
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

    // The tilt: eased toward its aim, written to the scene only when it moves.
    const goal = pointer.active ? pointer : motion.active ? motion : null;
    const tx = tiltToward(play.tiltX, goal ? goal.x : 0, dt);
    const ty = tiltToward(play.tiltY, goal ? goal.y : 0, dt);
    const settled = Math.abs(tx) < 0.001 && Math.abs(ty) < 0.001 && !goal;
    play.tiltMoved = Math.abs(tx - play.tiltX) > 0.0005 || Math.abs(ty - play.tiltY) > 0.0005;
    play.tiltX = settled ? 0 : tx;
    play.tiltY = settled ? 0 : ty;
    if (play.tiltMoved || (settled && tilted)) {
      tilted = !settled;
      if (scene?.style)
        scene.style.transform = settled ? '' : `translate3d(${(-tx * TILT.near).toFixed(2)}px, ${(-ty * TILT.near).toFixed(2)}px, 0)`;
      const turn = settled ? '' : tiltRotate(play.tiltX, play.tiltY);
      for (const cube of cubes) cube.style.rotate = turn;
      play.tiltMoved = true;
    }

    play.warp = warpLevel(play.warp, play.holding, dt);
    const rate = warpRate(play.warp);
    if (rate !== play.rate) retime(rate);

    // Loops: the badge pops each pass and MOBI marks the milestones. A dive
    // buzzes the phone once per pass.
    const loops = reduced ? 0 : passes(t);
    if (loops !== play.loops) {
      const milestone = milestoneCrossed(play.loops, loops);
      play.loops = loops;
      if (badge) {
        badge.textContent = `×${loops}`;
        badge.classList.add('wl-on');
        badge.animate?.(POP, { duration: milestone ? 520 : 260, easing: 'ease-out' });
      }
      if (play.holding) vibrate(12);
      if (milestone) say(MOBI_MILESTONES[milestone], 'say', now);
    }
    // MOBI moves on to the next tip once the line up now has had its time.
    if (now - lineAt >= holdFor(lineKind)) say(nextTip(), 'tip', now);
  }

  return play;
}
