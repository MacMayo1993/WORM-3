// src/worm/healerWorm/elementalCells.js
//
// The cover cells every elemental cube skin is drawn over, and exactly where each
// one ends.
//
// A cell is one instance of a skin's geometry. Up to the quality tier's grid cap
// there is one cell per sticker; past it (6×6 and larger) a gridN×gridN sample of
// stickers each stands in for a patch of its neighbours, so the cost stays constant
// in cube size.
//
// ── Why each cell carries its own extent ─────────────────────────────────────
// The first version gave every cell one symmetric span, `2·max(halfLeft, halfRight)`,
// and scaled a unit quad by it. On a board whose size does not divide by the grid
// cap the sampled stickers sit unevenly, so the wider half won and the quad reached
// past the narrower side — on the face border that meant up to half a sticker of
// skin hanging off the cube edge. Those overhangs are the ragged "plastic wrap"
// flaps the water and ice skins used to show around the silhouette.
//
// Each cell now carries four world-unit distances (to its local −X, +X, −Y and +Y
// borders) and a flag per border saying whether that border is a cube EDGE rather
// than a seam shared with a neighbouring cell. The borders sit at the midpoints
// between sampled stickers and at the face boundary, so the cells of a face tile it
// exactly: no gaps, no overlaps, nothing past the edge. Shaders build every vertex
// from these numbers, which is also what lets a skin wrap a cube edge deliberately
// (the water and ice shells round it over) instead of by accident.
//
// Distances are in world units — one sticker is one unit — so a shader can recover
// the sticker lattice inside a coarse cell (`fract(local + 0.5) - 0.5`, since every
// cell is centred on a sticker) and draw per-sticker seams at any board size.

import * as THREE from 'three';
import { getWormStickerWorldPos as getStickerWorldPos } from '../wormExpansion.js';
import { FACE_NORMALS } from './constants.js';

// Per-face definition: the fixed axis pinned to the outer layer, plus the two
// in-plane axes the grid varies over. Order is part of the contract — instance
// indices follow it, and the seeds derive from face key + grid position.
export const ELEMENTAL_FACES = [
  { dk: 'PX', fixed: 'x', outer: (n) => n - 1, a: 'y', b: 'z' },
  { dk: 'NX', fixed: 'x', outer: () => 0, a: 'y', b: 'z' },
  { dk: 'PY', fixed: 'y', outer: (n) => n - 1, a: 'x', b: 'z' },
  { dk: 'NY', fixed: 'y', outer: () => 0, a: 'x', b: 'z' },
  { dk: 'PZ', fixed: 'z', outer: (n) => n - 1, a: 'x', b: 'y' },
  { dk: 'NZ', fixed: 'z', outer: () => 0, a: 'x', b: 'y' }
];

const AXIS_INDEX = { x: 0, y: 1, z: 2 };
const _z = new THREE.Vector3(0, 0, 1);
const _t = new THREE.Vector3();

/**
 * Which way a cell's local X or Y axis points across its face: along the face's
 * `a` or `b` grid axis, and with which sign. The rest orientation maps local +Z to
 * the face normal with a shortest-arc rotation, which always lands the in-plane
 * axes on world axes, but WHICH ones (and their signs) differs per face.
 */
function resolveLocalAxis(local, quat, face) {
  _t.copy(local).applyQuaternion(quat);
  const ia = AXIS_INDEX[face.a];
  const ib = AXIS_INDEX[face.b];
  const ca = _t.getComponent(ia);
  const cb = _t.getComponent(ib);
  return Math.abs(ca) >= Math.abs(cb)
    ? { grid: 'a', sign: ca >= 0 ? 1 : -1 }
    : { grid: 'b', sign: cb >= 0 ? 1 : -1 };
}

/**
 * Sampled sticker indices along one face axis, and each grid line's distance to
 * the borders on either side (world units), plus whether that border is the face
 * boundary (a cube edge).
 */
export function gridLines(size, gridN) {
  const n = Math.max(1, Math.min(size, gridN));
  const idx = [];
  for (let j = 0; j < n; j++) idx.push(Math.min(size - 1, Math.floor(((j + 0.5) * size) / n)));
  return idx.map((p, j) => ({
    index: p,
    low: j === 0 ? p + 0.5 : (p - idx[j - 1]) / 2,
    high: j === n - 1 ? size - 1 - p + 0.5 : (idx[j + 1] - p) / 2,
    lowEdge: j === 0,
    highEdge: j === n - 1
  }));
}

/**
 * Build the cover cells for a board.
 *
 * @param {number} size     cube edge length in stickers
 * @param {number} maxGrid  the quality tier's cells-per-face-axis cap
 * @returns {Array<{
 *   key:string, faceKey:string, j:number, k:number, gridN:number,
 *   x:number, y:number, z:number, dirKey:string,
 *   restPos:number[], restQuat:THREE.Quaternion,
 *   extent:number[], edge:number[]
 * }>}
 *   extent  world-unit distance from the cell centre to its local −X, +X, −Y, +Y
 *           borders
 *   edge    1 where that border is a cube edge, 0 where it is a seam shared with a
 *           neighbouring cell on the same face
 */
export function buildElementalCells(size, maxGrid) {
  const gridN = Math.max(1, Math.min(size, maxGrid));
  const lines = gridLines(size, gridN);
  const out = [];
  for (const f of ELEMENTAL_FACES) {
    const n = FACE_NORMALS[f.dk] ?? FACE_NORMALS.PZ;
    const restQuat = new THREE.Quaternion().setFromUnitVectors(_z, n);
    const ax = resolveLocalAxis(new THREE.Vector3(1, 0, 0), restQuat, f);
    const ay = resolveLocalAxis(new THREE.Vector3(0, 1, 0), restQuat, f);
    for (let j = 0; j < gridN; j++) {
      for (let k = 0; k < gridN; k++) {
        const coord = { x: 0, y: 0, z: 0 };
        coord[f.fixed] = f.outer(size);
        coord[f.a] = lines[j].index;
        coord[f.b] = lines[k].index;
        const wp = getStickerWorldPos(coord.x, coord.y, coord.z, f.dk, size, 0);
        // Map this cell's grid-line borders onto its own local axes.
        const along = (axis) => {
          const line = axis.grid === 'a' ? lines[j] : lines[k];
          // Local +axis runs toward the higher grid index when sign is +1.
          return axis.sign > 0
            ? { neg: line.low, pos: line.high, negEdge: line.lowEdge, posEdge: line.highEdge }
            : { neg: line.high, pos: line.low, negEdge: line.highEdge, posEdge: line.lowEdge };
        };
        const bx = along(ax);
        const by = along(ay);
        out.push({
          key: `${f.dk}-${j}-${k}`,
          faceKey: f.dk,
          j,
          k,
          gridN,
          x: coord.x,
          y: coord.y,
          z: coord.z,
          dirKey: f.dk,
          restPos: [wp[0], wp[1], wp[2]],
          restQuat,
          extent: [bx.neg, bx.pos, by.neg, by.pos],
          edge: [bx.negEdge ? 1 : 0, bx.posEdge ? 1 : 0, by.negEdge ? 1 : 0, by.posEdge ? 1 : 0]
        });
      }
    }
  }
  return out;
}

/** Attach the shared per-instance attributes to a skin's geometry. */
export function attachCellAttributes(geo, cellData) {
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellData.cell, 4));
  geo.setAttribute('aExtent', new THREE.InstancedBufferAttribute(cellData.extent, 4));
  geo.setAttribute('aEdge', new THREE.InstancedBufferAttribute(cellData.edges, 4));
  // Dynamic: the sweep is rewritten once when a claim origin arrives, which can be
  // a frame or two after the mesh mounts.
  const sweep = new THREE.InstancedBufferAttribute(cellData.sweep, 1);
  sweep.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aSweep', sweep);
  return geo;
}
