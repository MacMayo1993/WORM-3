// Pure transforms shared by the renderer, workers and traversal geometry.
export const cubeExpansionMultiplier = size => size >= 4 ? 1.53 : 1.8;
export const cubeExpansionScale = (size, amount = 0) => 1 + amount * cubeExpansionMultiplier(size);
export function cubieCenterInto(out, x, y, z, size, amount = 0) {
  const k = (size - 1) / 2, scale = cubeExpansionScale(size, amount);
  out[0] = (x - k) * scale; out[1] = (y - k) * scale; out[2] = (z - k) * scale;
  return out;
}

// Inverse of the centered lattice dilation; callers with explicit grid IDs skip it.
export const cubeGridIndex = (coordinate, size, amount = 0) =>
  Math.round(coordinate / cubeExpansionScale(size, amount) + (size - 1) / 2);
