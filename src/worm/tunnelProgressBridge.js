// Shared mutable state written by WormChaseCamera (Three.js RAF) and
// read by MobiusHUD (DOM RAF). A plain object is fine — no need for
// React state since the consumer does its own requestAnimationFrame.
export const tunnelState = {
  active: false,
  t: 0,  // 0→1 globally across entering(0–0.33) → tunnel(0.33–0.67) → exiting(0.67–1)
};
