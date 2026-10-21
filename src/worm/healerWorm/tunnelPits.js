// src/worm/healerWorm/tunnelPits.js
//
// Collapsed tunnels are pits. A tunnel holds WORMHOLE_MAX_TRAVERSALS rides; the
// last one collapses it BEHIND the worm: once the tail is out and nothing of the
// worm lies on either mouth, both pads drop into their slots and the two mouths
// become holes in the floor. Crawling or jumping into one is a fall; surrounding
// it with the body (a ring heal) mends the pair. A ride that still somehow begins
// on a worn-out tunnel keeps the old rule and collapses mid-ride (wormSim.js).
//
// State is the sim's own: `voidTunnelKeys` (positional tunnel keys, remapped
// through every slice turn) and `pitTiles`, the mouths' tile keys, rebuilt from
// them whenever they change. `pitVersion` counts changes so the crawler can
// publish the pits to the renderers only when they move.

import { WORMHOLE_MAX_TRAVERSALS } from './constants.js';
import { ttAt } from '../circularBuffers.js';

const tileKeyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;

/** Re-derive the pit mouths from the collapsed tunnels. */
export function rebuildPitTiles(sim) {
  sim.pitTiles.clear();
  for (const key of sim.voidTunnelKeys) {
    const bar = key.indexOf('|');
    if (bar < 0) continue;
    sim.pitTiles.add(key.slice(0, bar));
    sim.pitTiles.add(key.slice(bar + 1));
  }
  sim.pitVersion++;
}

/** Collapse a tunnel: its two mouths become pits. */
export function voidTunnel(sim, tunnelKey) {
  if (!tunnelKey || sim.voidTunnelKeys.has(tunnelKey)) return;
  sim.voidTunnelKeys.add(tunnelKey);
  rebuildPitTiles(sim);
}

/** A heal mends a collapsed tunnel: its mouths stop being pits. */
export function mendTunnel(sim, tunnelKey) {
  if (!sim.voidTunnelKeys.delete(tunnelKey)) return;
  rebuildPitTiles(sim);
}

/** Whether this tile is the mouth of a collapsed tunnel. */
export function isPitTile(sim, tile) {
  return sim.pitTiles.size > 0 && !!tile && sim.pitTiles.has(tileKeyOf(tile));
}

/** The ride that wore this tunnel out has been taken: it collapses behind the worm. */
export function rideExhausted(sim, tunnelKey) {
  return !!tunnelKey && (sim.tunnelUseCounts.get(tunnelKey) ?? 0) >= WORMHOLE_MAX_TRAVERSALS;
}

/** Any of the worm's first `reach` body tiles lying on either of the tunnel's mouths. */
export function mouthOccupied(sim, tunnel, reach) {
  if (!tunnel) return false;
  const entry = tileKeyOf(tunnel.entry), exit = tileKeyOf(tunnel.exit);
  const n = Math.min(sim.tileTrail.count, reach);
  for (let i = 0; i < n; i++) {
    const key = ttAt(sim.tileTrail, i);
    if (key === entry || key === exit) return true;
  }
  return false;
}

/**
 * Carry every record keyed by a tunnel's mouths through a committed slice turn.
 * A tunnel key is its two mouths' tile keys, the smaller first (wormLogic.js), so
 * each half rides its own layer and the pair is re-sorted. Without this a turned
 * layer gave its tunnels fresh keys: their rides reset to zero and a pit would
 * have filled itself in.
 */
export function remapTunnelKeys(sim, remapTileKey) {
  const remap = key => {
    if (!key) return key;
    const bar = key.indexOf('|');
    if (bar < 0) return key;
    const a = remapTileKey(key.slice(0, bar));
    const b = remapTileKey(key.slice(bar + 1));
    return a <= b ? `${a}|${b}` : `${b}|${a}`;
  };
  const remapSet = set => {
    if (!set?.size) return;
    const keys = [...set];
    set.clear();
    for (const key of keys) set.add(remap(key));
  };
  if (sim.tunnelUseCounts.size) {
    const entries = [...sim.tunnelUseCounts];
    sim.tunnelUseCounts.clear();
    for (const [key, uses] of entries) sim.tunnelUseCounts.set(remap(key), uses);
  }
  remapSet(sim.voidTunnelKeys);
  remapSet(sim.chargedTunnels);
  remapSet(sim.ringHealedTunnelKeys);
  if (sim.pendingVoidKill) sim.pendingVoidKill = { ...sim.pendingVoidKill, tunnelKey: remap(sim.pendingVoidKill.tunnelKey) };
  if (sim.currentTunnelKey) sim.currentTunnelKey = remap(sim.currentTunnelKey);
  if (sim.pendingTunnelHeal?.tunnelKey) sim.pendingTunnelHeal = { ...sim.pendingTunnelHeal, tunnelKey: remap(sim.pendingTunnelHeal.tunnelKey) };
  for (const passage of sim.tunnelPassages) {
    passage.tunnelKey = remap(passage.tunnelKey);
    if (passage.heal?.tunnelKey) passage.heal = { ...passage.heal, tunnelKey: remap(passage.heal.tunnelKey) };
  }
  if (sim.voidTunnelKeys.size) rebuildPitTiles(sim);
}
