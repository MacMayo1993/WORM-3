// src/manifold/chaosStormBridge.js
//
// Render-only channel between the chaos worker's TICK handler and the storm that
// draws it (ChaosStorm), plus the tunnel charge state the wormhole renderers read.
//
// Module state, not Zustand: chaos emits several events per tick at up to ~12
// ticks a second, and routing that through the store re-rendered CubeAssembly on
// every bolt. Nothing in here is ever read back by the simulation.

// Bounded so a hidden or unmounted storm can never accumulate work.
export const STORM_QUEUE_MAX = 64;

const queue = [];

/**
 * `gen` bumps on every clear, so a renderer holding live effects from a round
 * that has since stopped (or reset) knows to drop them rather than finish them.
 */
export const chaosStorm = { gen: 0 };

export function pushChaosStormEvents(events) {
  if (!events?.length) return;
  for (const ev of events) {
    if (queue.length >= STORM_QUEUE_MAX) queue.shift();
    queue.push(ev);
  }
}

/** Hand every pending event to `visit`, oldest first, and empty the queue. */
export function drainChaosStormEvents(visit) {
  if (!queue.length) return 0;
  const n = queue.length;
  for (let i = 0; i < n; i++) visit(queue[i]);
  queue.length = 0;
  return n;
}

export const pendingChaosStormEvents = () => queue.length;

export function clearChaosStorm() {
  queue.length = 0;
  tunnelCharges.clear();
  chaosStorm.gen += 1;
}

// ── Tunnel charges ────────────────────────────────────────────────────────────
// When chaos flips a tile, its twin flips with it — they are one point of the
// projective plane. The storm makes that visible: a surge runs from the struck
// tile down its wormhole, through the core, and out of the twin. The wormhole
// renderers (RestingCords, MobiusTunnel) light the same span in step by reading
// this map with the same clock.

/** pairId → { startMs, fromGridId, travelMs, lingerMs, strength, kind } */
export const tunnelCharges = new Map();

export const CHARGE_TIMING = {
  surge: { travelMs: 360, lingerMs: 320, strength: 0.85 },
  birth: { travelMs: 520, lingerMs: 420, strength: 1 },
  recover: { travelMs: 420, lingerMs: 240, strength: 0.45 },
  overload: { travelMs: 230, lingerMs: 520, strength: 1 }
};

export function setTunnelCharge(pairId, fromGridId, startMs, kind = 'surge') {
  if (!pairId) return null;
  const t = CHARGE_TIMING[kind] ?? CHARGE_TIMING.surge;
  const charge = { startMs, fromGridId, travelMs: t.travelMs, lingerMs: t.lingerMs, strength: t.strength, kind };
  tunnelCharges.set(pairId, charge);
  return charge;
}

/**
 * Where a charge is at `nowMs`.
 *
 *   front — 0 at the struck tile, 1 at its twin; eased so the surge is sucked in,
 *           races the core, and decelerates into the far mouth
 *   glow  — overall brightness: snaps up, holds while the front travels, then
 *           decays through the linger so the tunnel crackles out rather than off
 *
 * @returns {{ active: boolean, front: number, glow: number, arrived: boolean }}
 */
export function tunnelChargeState(charge, nowMs, out = {}) {
  out.active = false;
  out.front = 0;
  out.glow = 0;
  out.arrived = false;
  if (!charge) return out;
  const t = nowMs - charge.startMs;
  const travel = Math.max(1, charge.travelMs);
  const linger = Math.max(1, charge.lingerMs);
  if (t < 0 || t >= travel + linger) return out;
  const u = Math.min(1, t / travel);
  out.active = true;
  out.front = 0.5 - 0.5 * Math.cos(Math.PI * u);
  out.arrived = t >= travel;
  const rise = Math.min(1, t / 60);
  const fade = t <= travel ? 1 : 1 - (t - travel) / linger;
  out.glow = (charge.strength ?? 1) * rise * fade * Math.sqrt(fade);
  return out;
}

/** Drop finished charges. Returns how many remain. */
export function pruneTunnelCharges(nowMs) {
  for (const [id, c] of tunnelCharges) {
    if (nowMs - c.startMs >= c.travelMs + c.lingerMs) tunnelCharges.delete(id);
  }
  return tunnelCharges.size;
}

// ── Tunnel focus ──────────────────────────────────────────────────────────────
// Which pairs WormholeNetwork is currently drawing as full Möbius ribbons. Those
// follow the throated gameplay centerline; resting cords run straight to the
// core. The storm's surge traces whichever one the player can actually see.
const NO_FOCUS = new Set();
export const tunnelFocus = { ids: NO_FOCUS };

export function publishTunnelFocus(ids) {
  tunnelFocus.ids = ids ?? NO_FOCUS;
  return () => {
    if (tunnelFocus.ids === ids) tunnelFocus.ids = NO_FOCUS;
  };
}
