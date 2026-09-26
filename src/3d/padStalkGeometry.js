import * as THREE from 'three';

// StickerPlane's full square is 0.85 wide. Keep its existing back-face plane
// (-0.012) in front of the cap, with no coplanar flicker.
export const PAD_BACK_WIDTH = 0.85;
export const PAD_BACK_CLEARANCE = 0.016;
export const PAD_STALK_DEPTH = 1.04;

// A square funnel, rather than a narrow ribbon: four walls attach to the full
// perimeter and a solid cap covers the back. The half twist narrows toward the
// inner opening. Build once per scene; all bounce/extension is instance scaling.
export function createPadStalkGeometry() {
  const points = [], indices = [];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const segments = 24;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const half = (0.24 + (PAD_BACK_WIDTH - 0.24) * t * t) / 2;
    const angle = Math.PI * t;
    const c = Math.cos(angle), s = Math.sin(angle);
    for (const [x, y] of corners) points.push(half * (x * c - y * s), half * (x * s + y * c), t);
    if (i < segments) {
      for (let side = 0; side < 4; side++) {
        const a = i * 4 + side, b = i * 4 + (side + 1) % 4;
        indices.push(a, b, a + 4, b, b + 4, a + 4);
      }
    }
  }
  // Separate cap vertices preserve a flat underside instead of smoothed edges.
  const cap = points.length / 3;
  points.push(...points.slice(segments * 12, segments * 12 + 12));
  indices.push(cap, cap + 1, cap + 2, cap, cap + 2, cap + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
