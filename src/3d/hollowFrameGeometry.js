import { BoxGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Hollow cube edge beams — 12 beams forming a skeletal cube frame
const EDGE_H = 0.49; // half of cube size
const BEAM_T = 0.04;  // beam half-thickness — slimmer for a more open cage

// Dimensions and transforms match the original twelve individual beams.
const BEAM_DIMS = {
  x: [EDGE_H * 2, BEAM_T * 2, BEAM_T * 2],
  y: [BEAM_T * 2, EDGE_H * 2, BEAM_T * 2],
  z: [BEAM_T * 2, BEAM_T * 2, EDGE_H * 2],
};

const HOLLOW_EDGES = [
  // X-axis edges (4)
  { pos: [0, -EDGE_H, -EDGE_H], geo: 'x' },
  { pos: [0, -EDGE_H, EDGE_H], geo: 'x' },
  { pos: [0, EDGE_H, -EDGE_H], geo: 'x' },
  { pos: [0, EDGE_H, EDGE_H], geo: 'x' },
  // Y-axis edges (4)
  { pos: [-EDGE_H, 0, -EDGE_H], geo: 'y' },
  { pos: [-EDGE_H, 0, EDGE_H], geo: 'y' },
  { pos: [EDGE_H, 0, -EDGE_H], geo: 'y' },
  { pos: [EDGE_H, 0, EDGE_H], geo: 'y' },
  // Z-axis edges (4)
  { pos: [-EDGE_H, -EDGE_H, 0], geo: 'z' },
  { pos: [-EDGE_H, EDGE_H, 0], geo: 'z' },
  { pos: [EDGE_H, -EDGE_H, 0], geo: 'z' },
  { pos: [EDGE_H, EDGE_H, 0], geo: 'z' },
];


// One shared mesh preserves every beam, with no material groups (one draw).
export function createHollowFrameGeometry() {
  const beams = HOLLOW_EDGES.map(edge => new BoxGeometry(...BEAM_DIMS[edge.geo]).translate(...edge.pos));
  const geometry = mergeGeometries(beams, false);
  for (const beam of beams) beam.dispose();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export const hollowFrameGeometry = createHollowFrameGeometry();
