// Where the player is pointing, for the menu worms to look at and the menu
// scene to lean toward, and which worm a tap lands on.
//
// The menus are DOM over the canvas (the carousel's swipe stage covers the cube
// completely), so the canvas's own pointer events never see most of the screen.
// One set of window listeners, installed while anything is subscribed, tracks
// the pointer everywhere and hit-tests taps against the worms' last projected
// screen positions synchronously, so the cube's own click can ask whether the
// tap was a poke before it shakes.

const LOOK_HOLD_MS = 4000; // eyes stay on the pointer this long after it stops
const TOUCH_HOLD_MS = 2500;
const POKE_CLAIM_MS = 450;

const state = {
  // Normalised device coordinates, as three.js's raycaster wants them.
  x: 0, y: 0,
  // Client pixels.
  clientX: 0, clientY: 0,
  at: -Infinity,   // performance.now() of the last move or press
  touch: false,
  // Device tilt, -1…1 each way, relative to how the phone was first held.
  tiltX: 0, tiltY: 0, tiltAt: -Infinity,
};
let tiltBase = null;
const targets = new Map();
let users = 0;
let pokedAt = -Infinity;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function track(event) {
  const w = window.innerWidth || 1, h = window.innerHeight || 1;
  state.clientX = event.clientX;
  state.clientY = event.clientY;
  state.x = (event.clientX / w) * 2 - 1;
  state.y = -(event.clientY / h) * 2 + 1;
  state.touch = event.pointerType === 'touch';
  state.at = now();
}

/** The worm (if any) under a screen point: the nearest target whose reach covers it. */
export function findPokeTarget(clientX, clientY) {
  let best = null, bestD = Infinity;
  for (const target of targets.values()) {
    if (!target.visible) continue;
    const pts = target.points;
    for (let i = 0; i < target.count; i++) {
      const dx = pts[i * 2] - clientX, dy = pts[i * 2 + 1] - clientY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= target.reach && d < bestD) { best = target; bestD = d; }
    }
  }
  return best;
}

function press(event) {
  track(event);
  const target = findPokeTarget(event.clientX, event.clientY);
  if (target) {
    pokedAt = now();
    target.onPoke?.();
  }
}

function orient(event) {
  if (event.beta == null || event.gamma == null) return;
  if (!tiltBase) tiltBase = { beta: event.beta, gamma: event.gamma };
  const clamp = v => Math.max(-1, Math.min(1, v));
  state.tiltX = clamp((event.gamma - tiltBase.gamma) / 25);
  state.tiltY = clamp((event.beta - tiltBase.beta) / 25);
  state.tiltAt = now();
}

function install() {
  if (typeof window === 'undefined') return;
  window.addEventListener('pointermove', track, { passive: true });
  window.addEventListener('pointerdown', press, { passive: true, capture: true });
  // Read when the browser offers it; never ask (iOS would prompt).
  window.addEventListener('deviceorientation', orient, { passive: true });
}
function uninstall() {
  if (typeof window === 'undefined') return;
  window.removeEventListener('pointermove', track);
  window.removeEventListener('pointerdown', press, { capture: true });
  window.removeEventListener('deviceorientation', orient);
  tiltBase = null;
}

/** Keep the listeners up while the caller lives; returns the release. */
export function retainMenuPointer() {
  if (users++ === 0) install();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--users === 0) uninstall();
  };
}

/** The live pointer state (read, never write). */
export const menuPointer = state;

/** Whether the pointer moved (or a finger touched) recently enough to look at. */
export function pointerIsFresh(at = now()) {
  return at - state.at < (state.touch ? TOUCH_HOLD_MS : LOOK_HOLD_MS);
}

/**
 * -1…1 lean for the scene: the mouse's place on screen on desktop, the
 * phone's tilt where it reports one, 0 when neither has moved lately.
 */
export function menuLeanInto(out, at = now()) {
  if (at - state.tiltAt < 1000) { out.x = state.tiltX; out.y = -state.tiltY; return out; }
  if (!state.touch && pointerIsFresh(at)) { out.x = state.x; out.y = state.y; return out; }
  out.x = 0; out.y = 0;
  return out;
}

/**
 * A worm that can be poked. `points` holds up to `capacity` client-pixel
 * points along its body (x, y pairs), refreshed by the caller each frame.
 */
export function registerPokeTarget(onPoke, capacity = 4) {
  const target = { onPoke, points: new Float32Array(capacity * 2), count: 0, reach: 36, visible: false };
  const key = {};
  targets.set(key, target);
  target.release = () => targets.delete(key);
  return target;
}

/** True once, if a worm took the tap that is now arriving as a click. */
export function wormTookTap(at = now()) {
  const took = at - pokedAt < POKE_CLAIM_MS;
  pokedAt = -Infinity;
  return took;
}

/** Tests: forget everything. */
export function resetMenuPointer() {
  targets.clear();
  pokedAt = -Infinity;
  Object.assign(state, { x: 0, y: 0, clientX: 0, clientY: 0, at: -Infinity, touch: false, tiltX: 0, tiltY: 0, tiltAt: -Infinity });
  tiltBase = null;
}
