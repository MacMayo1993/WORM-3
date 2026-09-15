// Keep the deepest spring overshoot in front of the inset Worm chassis (0.46).
export const PRESS_DEPTH = 0.032;
const PRESS_SHRINK = 0.20;

export function updateTilePressVisual(inner, footprint, uniforms, press, contact, color) {
  const weight = Math.max(-0.12, Math.min(1.12, press));
  const shrink = 1 - Math.max(0, weight) * PRESS_SHRINK;
  if (inner) inner.scale.set(shrink, shrink, 1);
  // Contact controls light; the spring controls movement. Rebound must never
  // re-light a square after the tail has left it.
  const lit = contact > 0 && weight > 0.01;
  if (footprint) {
    footprint.visible = lit;
    footprint.position.z = lit ? -weight * PRESS_DEPTH * 0.5 : 0;
  }
  uniforms.uPress.value = lit ? weight : 0;
  if (lit) uniforms.uColor.value.set(color);
  return -weight * PRESS_DEPTH;
}
