// src/worm/healerWorm/healReservations.js
// Heals already promised to other tunnels but not yet counted in `sim.healed`.
//
// A paid ride heals only once its tail clears the exit, so for a while its heal
// is spoken for but uncounted: on the ride itself (`sim.willHeal` while diving),
// for a frame in `sim.pendingTunnelHeal`, then on its passage (`passage.heal`)
// until the tail is out. A Story level's heal budget (storyTunnelHealGate) has
// to count those, or two rides in flight both spend the same remaining heal: a
// later ride could pay at entry and be refused at its exit once the earlier one
// sealed, or both could seal and eat the heals reserved for the surrounds.
//
// Tunnels are counted once each, by `pairId` (the two mouths' grid ids, the same
// from either end) or the sim's tunnel key, and the tunnel being asked about is
// left out, so a ride rechecking its own heal at the exit doesn't count itself.

const RIDING = new Set(['windup', 'entering', 'tunnel', 'exiting']);

/** Distinct heals queued for tunnels other than `tunnel`. */
export function queuedTunnelHeals(sim, tunnel) {
  const self = tunnel?.pairId ?? null;
  const seen = new Set();
  const add = (other, key) => {
    if (!other && key == null) return;
    if (other && other === tunnel) return;
    const id = other?.pairId ?? key;
    if (id == null || (self != null && id === self)) return;
    seen.add(id);
  };
  if (sim.willHeal && sim.activeTunnel && RIDING.has(sim.phase)) add(sim.activeTunnel, sim.currentTunnelKey);
  if (sim.pendingTunnelHeal) add(sim.pendingTunnelHeal.tunnel, sim.pendingTunnelHeal.tunnelKey);
  for (const passage of sim.tunnelPassages ?? []) {
    if (passage.heal) add(passage.heal.tunnel ?? passage.tunnel, passage.heal.tunnelKey ?? passage.tunnelKey);
  }
  return seen.size;
}
