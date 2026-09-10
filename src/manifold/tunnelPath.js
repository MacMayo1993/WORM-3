// Gameplay tunnel centerline, sampled without allocations by both renderers.
export function tunnelPoint(start, end, center, right, up, u, time, isCenter, out) {
  if (u < 0.5) out.copy(start).lerp(center, u * 2);
  else out.copy(center).lerp(end, (u - 0.5) * 2);
  const envelope = isCenter ? 0 : Math.sin(u * Math.PI) ** 3;
  const angle = u * Math.PI * 10 - time * 4;
  return out.addScaledVector(right, Math.sin(angle) * 0.25 * envelope)
    .addScaledVector(up, Math.cos(angle) * 0.25 * envelope);
}
