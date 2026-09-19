const mouthKey = tile => `${tile.x},${tile.y},${tile.z},${tile.dirKey}`;
export function tunnelRouteKey(tunnel) {
  const a = mouthKey(tunnel.entry), b = mouthKey(tunnel.exit);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function makeTunnelTubePool() { return { slots: [], occupied: new Set() }; }

// One shell per physical route, even while the worm doubles back through it.
// Slots survive React renders and are recycled only after their fade completes.
export function syncTunnelTubePool(pool, activeTunnel, passages) {
  const { slots, occupied } = pool;
  occupied.clear();
  if (activeTunnel) occupied.add(tunnelRouteKey(activeTunnel));
  for (const passage of passages) if (passage.tunnel) occupied.add(tunnelRouteKey(passage.tunnel));
  for (const slot of slots) { slot.activeTunnel = null; slot.tailOccupied = false; }
  const claim = (tunnel, active) => {
    if (!tunnel) return;
    const key = tunnelRouteKey(tunnel);
    let slot = slots.find(s => s.key === key);
    if (!slot) {
      slot = slots.find(s => !occupied.has(s.key) && s.opacity < 0.01);
      if (!slot) { slot = { id: slots.length, opacity: 0, activeTunnel: null, tailOccupied: false }; slots.push(slot); }
      slot.key = key;
      slot.tunnel = tunnel;
    }
    if (active) slot.activeTunnel = tunnel;
    else slot.tailOccupied = true;
  };
  for (const passage of passages) claim(passage.tunnel, false);
  claim(activeTunnel, true);
  return slots;
}

// Keep the shell's orientation on a reversed traversal; only reverse the marker.
export function tunnelTubeHeadProgress(slot, progress) {
  return slot.activeTunnel && mouthKey(slot.activeTunnel.entry) !== mouthKey(slot.tunnel.entry)
    ? 1 - progress : progress;
}
