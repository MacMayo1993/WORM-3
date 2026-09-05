// Shared mutable state written by HealerWormMode (Three.js frame loop) and read
// by RotationCountdownHUD (DOM RAF), the same arrangement tunnelProgressBridge
// uses for the Möbius band. A plain object rather than store state: the clock
// changes every frame and the HUD paints itself from a ref, so pushing it
// through React would be one re-render per frame of every run.
export const rotationClock = {
  armed: false,       // a move is queued and the layer is lit
  secondsLeft: 0,     // until the layer turns
  total: 0,           // length of the current cycle, for the bar
  warning: 0,         // 0→1 through the final telegraph window
  held: false,        // the countdown is paused (tunnel transit, focus beat)
  axis: null,         // 'col' | 'row' | 'depth' — which way the layer turns
  sliceIndex: null
};

export function resetRotationClock() {
  rotationClock.armed = false;
  rotationClock.secondsLeft = 0;
  rotationClock.total = 0;
  rotationClock.warning = 0;
  rotationClock.held = false;
  rotationClock.axis = null;
  rotationClock.sliceIndex = null;
}
