import * as THREE from 'three';

// A closed curved slab: the piece of a cape, quilt or blanket that wraps over
// one bead. Its axis runs along Z through the origin (the bead's centre) and it
// spans `arc` radians around +Y, so a run of them laid one per body segment
// reads as one garment hugging the back.
//
// It is a solid, not an open shell: both faces, both ends and both edges are
// closed, so the ink outline hull (a back-face copy pushed out along welded
// normals) wraps it like any other primitive. Every triangle is wound outward;
// `handmadeAccessories.test.js` checks that, because a flipped face turns the
// hull inside out.
//
// args: [radius (mid-surface), thickness, length, arc, segments]
export function createArchGeometry(radius = 1.1, thickness = 0.12, length = 1, arc = 2.4, segments = 10) {
  const outer = radius + thickness / 2;
  const inner = radius - thickness / 2;
  const half = length / 2;
  const positions = [];
  const normals = [];
  const uvs = [];
  const index = [];

  const push = (x, y, z, nx, ny, nz, u, v) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    uvs.push(u, v);
    return positions.length / 3 - 1;
  };
  const angleAt = i => -arc / 2 + (arc * i) / segments;
  const quad = (a, b, c, d) => { index.push(a, b, c, a, c, d); };

  // Outer and inner faces: smooth radial normals, two rings of vertices each.
  for (const [r, sign] of [[outer, 1], [inner, -1]]) {
    const rows = [[], []];
    for (let i = 0; i <= segments; i++) {
      const phi = angleAt(i), sx = Math.sin(phi), cy = Math.cos(phi);
      rows[0].push(push(r * sx, r * cy, half, sign * sx, sign * cy, 0, i / segments, 0));
      rows[1].push(push(r * sx, r * cy, -half, sign * sx, sign * cy, 0, i / segments, 1));
    }
    for (let i = 0; i < segments; i++) {
      // Outward from the outer face, and the reverse on the inner one.
      if (sign > 0) quad(rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]);
      else quad(rows[0][i], rows[1][i], rows[1][i + 1], rows[0][i + 1]);
    }
  }

  // The two flat ends (front +Z, back -Z): a strip between inner and outer edges.
  for (const z of [half, -half]) {
    const nz = Math.sign(z);
    const outerRow = [], innerRow = [];
    for (let i = 0; i <= segments; i++) {
      const phi = angleAt(i), sx = Math.sin(phi), cy = Math.cos(phi);
      outerRow.push(push(outer * sx, outer * cy, z, 0, 0, nz, i / segments, 0));
      innerRow.push(push(inner * sx, inner * cy, z, 0, 0, nz, i / segments, 1));
    }
    for (let i = 0; i < segments; i++) {
      if (nz > 0) quad(outerRow[i], innerRow[i], innerRow[i + 1], outerRow[i + 1]);
      else quad(outerRow[i], outerRow[i + 1], innerRow[i + 1], innerRow[i]);
    }
  }

  // The two side edges (the arch's ends), facing away along the tangent.
  for (const end of [0, segments]) {
    const phi = angleAt(end), sx = Math.sin(phi), cy = Math.cos(phi);
    const dir = end === 0 ? -1 : 1;
    // Tangent of increasing phi is (cos, -sin); the end faces along ±that.
    const nx = dir * cy, ny = -dir * sx;
    const a = push(outer * sx, outer * cy, half, nx, ny, 0, 0, 0);
    const b = push(outer * sx, outer * cy, -half, nx, ny, 0, 1, 0);
    const c = push(inner * sx, inner * cy, -half, nx, ny, 0, 1, 1);
    const d = push(inner * sx, inner * cy, half, nx, ny, 0, 0, 1);
    if (dir > 0) quad(a, d, c, b);
    else quad(a, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}
