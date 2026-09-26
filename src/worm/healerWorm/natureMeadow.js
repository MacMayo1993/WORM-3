// src/worm/healerWorm/natureMeadow.js
//
// Geometry for the NATURE skin: one cover cell's worth of terrarium, grouped by
// layer so a material array can draw each with its own blend.
//
// Nothing here is positioned. Every vertex carries only its topology — which
// plant it belongs to (aKind, aIndex) and where it sits on that plant's parameter
// grid (uv) — and the vertex shader grows the plant from the cell's seams, sized in
// world units. That is what lets one geometry serve every board size: on a 15×15 a
// cover cell spans several stickers, and the shader still roots grass in every
// seam inside it.
//
// Pure (Three's BufferGeometry only, no React), so its budget is testable headlessly.

import { BufferGeometry, BufferAttribute } from 'three';

export const NATURE_KIND = { moss: 0, blade: 1, leaf: 2, flower: 3 };

/** Rows along a grass blade. Five gives a smooth curve at chase-camera distance. */
export const BLADE_ROWS = 5;

/**
 * Build one cell's terrarium.
 *
 * @param {number} blades   grass blades rooted in the seams
 * @param {number} leaves   ivy leaves spilling over the cube's edges
 * @param {number} flowers  flower heads nodding in the grass
 * @returns {BufferGeometry} groups: 0 moss bed, 1 plants (blades, leaves, flowers)
 */
export function buildNatureCellGeometry(blades = 48, leaves = 3, flowers = 2) {
  const position = [];
  const uv = [];
  const kind = [];
  const slot = [];
  const index = [];

  const quad = (k, s) => {
    const base = position.length / 3;
    for (const [x, y] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      position.push(x - 0.5, y - 0.5, 0);
      uv.push(x, y);
      kind.push(k);
      slot.push(s);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  // Layer 0: the moss bed, one quad covering the cell.
  quad(NATURE_KIND.moss, 0);
  const plantsStart = index.length;

  // Blades: three columns (left edge, spine, right edge) so the spine can fold
  // forward and catch the light, over BLADE_ROWS + 1 rows from root to tip.
  for (let b = 0; b < blades; b++) {
    const base = position.length / 3;
    for (let r = 0; r <= BLADE_ROWS; r++) {
      const t = r / BLADE_ROWS;
      for (let c = 0; c < 3; c++) {
        position.push(c * 0.5 - 0.5, t, 0);
        uv.push(c * 0.5, t);
        kind.push(NATURE_KIND.blade);
        slot.push(b);
      }
    }
    for (let r = 0; r < BLADE_ROWS; r++) {
      for (let c = 0; c < 2; c++) {
        const a = base + r * 3 + c;
        const d = a + 3;
        index.push(a, a + 1, d + 1, a, d + 1, d);
      }
    }
  }
  for (let l = 0; l < leaves; l++) quad(NATURE_KIND.leaf, l);
  for (let f = 0; f < flowers; f++) quad(NATURE_KIND.flower, f);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(position), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geo.setAttribute('aKind', new BufferAttribute(new Float32Array(kind), 1));
  geo.setAttribute('aIndex', new BufferAttribute(new Float32Array(slot), 1));
  const vertexCount = position.length / 3;
  geo.setIndex(new BufferAttribute(vertexCount > 65535 ? new Uint32Array(index) : new Uint16Array(index), 1));
  geo.addGroup(0, plantsStart, 0);
  geo.addGroup(plantsStart, index.length - plantsStart, 1);
  return geo;
}
