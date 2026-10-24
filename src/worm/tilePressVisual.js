// Keep the deepest spring overshoot in front of the inset Worm chassis (0.46).
export const PRESS_DEPTH = 0.032;
const PRESS_SHRINK = 0.20;

// `baseZ` is the lit square's own height over the tile when `footprint` is the
// square itself (a tile-surface decal anchor) rather than a group holding it.
export function updateTilePressVisual(inner, footprint, uniforms, press, contact, color, baseZ = 0) {
  const weight = Math.max(-0.12, Math.min(1.12, press));
  const shrink = 1 - Math.max(0, weight) * PRESS_SHRINK;
  if (inner) inner.scale.set(shrink, shrink, 1);
  // Contact controls light; the spring controls movement. Rebound must never
  // re-light a square after the tail has left it.
  const lit = contact > 0 && weight > 0.01;
  if (footprint) {
    footprint.visible = lit;
    footprint.position.z = baseZ + (lit ? -weight * PRESS_DEPTH * 0.5 : 0);
  }
  uniforms.uPress.value = lit ? weight : 0;
  if (lit) uniforms.uColor.value.set(color);
  return -weight * PRESS_DEPTH;
}
