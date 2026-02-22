// src/game/mirrorBlocks.js
// Mirror blocks (mirror cube) geometry utilities.
//
// A mirror cube is mechanically identical to a standard Rubik's cube but uses
// asymmetric layer widths instead of colored stickers to encode piece identity.
// Each piece has a unique shape determined by its (x, y, z) grid position, and
// the puzzle is solved when the cube returns to a perfect rectangular form.

// Asymmetric layer widths per cube size.
// Values must sum to exactly `size`. The intentional asymmetry makes each
// piece uniquely shaped so the puzzle is solvable by shape alone.
const LAYER_WIDTHS = {
  2: [0.75, 1.25],
  3: [0.6, 1.0, 1.4],
  4: [0.55, 0.85, 1.15, 1.45],
  5: [0.5, 0.75, 1.0, 1.25, 1.5],
};

const GAP = 0.02; // small cosmetic gap between pieces

export function getMirrorLayerWidths(size) {
  return LAYER_WIDTHS[size] || Array.from({ length: size }, () => 1.0);
}

// Centers for each layer along one axis, with the whole cube spanning -size/2 to +size/2.
export function getMirrorCenters(size) {
  const widths = getMirrorLayerWidths(size);
  const centers = [];
  let pos = -size / 2;
  for (let i = 0; i < size; i++) {
    centers.push(pos + widths[i] / 2);
    pos += widths[i];
  }
  return centers;
}

// World-space center position for a cubie at grid position (x, y, z).
export function getMirrorPosition(x, y, z, size) {
  const centers = getMirrorCenters(size);
  return [centers[x], centers[y], centers[z]];
}

// Box dimensions [wx, wy, wz] for a cubie at grid position (x, y, z).
// Each dimension is the layer width minus a small gap so pieces don't overlap.
export function getMirrorDimensions(x, y, z, size) {
  const widths = getMirrorLayerWidths(size);
  return [widths[x] - GAP, widths[y] - GAP, widths[z] - GAP];
}
