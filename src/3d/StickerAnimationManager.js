// StickerAnimationManager.js
//
// Single active-sticker registry, replacing one useFrame subscription per
// StickerPlane (294 at size 7, each paying R3F dispatch overhead plus an
// idle-gate check every frame even when fully at rest).
//
// Every StickerPlane still owns its own tick closure (capturing its own refs,
// meta, materials, etc.) and the closure body is unchanged — only the
// invocation mechanism moves. A sticker registers its tick function once on
// mount (always present while mounted) but is only *invoked* while its key is
// in the active set. Idle tiles cost nothing per frame: they're simply absent
// from the loop StickerAnimationDriver runs.
//
// Activation happens at the few discrete events that can make a sticker need
// per-frame work (flip start, death start/end, heal trigger, or already being
// a persistent wormhole tile at mount) — see the activateSticker() call sites
// in StickerPlane.jsx. Deactivation happens from inside the tick itself, at
// exactly the point where it already determines there's nothing left to do.

const tickFns = new Map(); // gridId -> tick(state, delta)
const activeKeys = new Set(); // gridId currently being ticked each frame

// Shared time value for the persistent wispy-ring shader on every flipped tile.
// All wispy ring materials reference this single object so only one value
// write per frame is needed regardless of how many tiles are on screen.
export const wispyTime = { value: 0.0 };

export function registerSticker(key, tick) {
  if (!key) return;
  tickFns.set(key, tick);
}

export function unregisterSticker(key) {
  if (!key) return;
  tickFns.delete(key);
  activeKeys.delete(key);
}

export function activateSticker(key) {
  if (key && tickFns.has(key)) activeKeys.add(key);
}

export function deactivateSticker(key) {
  if (key) activeKeys.delete(key);
}

export function runActiveStickers(state, delta) {
  for (const key of activeKeys) {
    const tick = tickFns.get(key);
    if (tick) tick(state, delta);
    else activeKeys.delete(key); // stale entry (shouldn't happen) — self-heal
  }
}

export function activeStickerCount() {
  return activeKeys.size;
}
