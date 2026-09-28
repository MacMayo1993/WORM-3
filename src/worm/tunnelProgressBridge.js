// Shared mutable state written by WormChaseCamera (Three.js RAF) and
// read by MobiusHUD (DOM RAF). A plain object is fine — no need for
// React state since the consumer does its own requestAnimationFrame.
export const tunnelState = {
  active: false,
  occupiedTunnelIds: new Set(), // head and recorded trailing passages
  portalTunnel: null, // current passage, retained while its tail clears the exit
  t: 0,            // tunnelTraversalT: entry arm (0–0.4), core (0.4–0.6), exit arm (0.6–1)
  activeTunnelId: null, // pairId of the tunnel the worm is currently traversing (null when idle)
  tunnel: null,    // that tunnel's descriptor ({ entry, exit } grid tiles), for the core's approach zoom
  coreZoom: 1,     // cosmetic core growth (VoidCore); occupied tracks keep their simulation route
  coreZoomAnchor: null, // the fixed dock of that growth, in cube coordinates
};
