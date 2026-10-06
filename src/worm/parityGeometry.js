import * as THREE from 'three';

// ── Möbius strip geometry factory ───────────────────────────────────────────
// Creates a mathematically correct Möbius strip: a band that makes one 180°
// half-twist as it loops around. The last ring lands on the first ring flipped
// top-to-bottom — that's the defining Möbius closure.
export function createParityMobiusGeometry(R, w) {
  const uS = 48, vS = 3, cols = vS + 1;
  const pos = [], uvs = [], idx = [];
  // The band is roughly 2πR long and 2w wide — about 9:1. A plain 0..1 U would
  // smear a tile pattern the whole way round the loop, so U repeats enough times
  // to keep each pattern cell square-ish when the band wears a tile style. An
  // integer count keeps the repeat aligned with the seam at u=0.
  const uRepeat = Math.max(1, Math.round((Math.PI * R) / (2 * w)));
  for (let i = 0; i <= uS; i++) {
    const u = (i / uS) * Math.PI * 2;
    for (let j = 0; j <= vS; j++) {
      const v = (j / vS) * 2 - 1;
      pos.push(
        (R + w * v * Math.cos(u * 0.5)) * Math.cos(u),
        (R + w * v * Math.cos(u * 0.5)) * Math.sin(u),
        w * v * Math.sin(u * 0.5)
      );
      uvs.push((i / uS) * uRepeat, j / vS);
    }
  }
  // One side first. The last column (u = 2π) is its own copy of the first,
  // flipped across the band (P(2π, v) = P(0, -v)), rather than wrapping back
  // onto column 0: on a Möbius band the surface normal reverses round the loop,
  // so a vertex welded across that seam would average opposite normals away.
  for (let i = 0; i < uS; i++) {
    for (let j = 0; j < vS; j++) {
      const a = i * cols + j, b = a + 1;
      const c = (i + 1) * cols + j, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  side.setIndex(idx);
  side.computeVertexNormals();
  const normals = side.attributes.normal.array;
  side.dispose();
  // The far side is the same surface on its own vertices, wound backwards with
  // its normals reversed. The band is two-sided in GEOMETRY rather than needing
  // a DoubleSide material: a Möbius band is one-sided and would otherwise drop
  // half its loop under a front-face-only material — but `side` is part of
  // three's program cache key, so a DoubleSide variant of a tile-style shader is
  // a whole second program that has to be compiled the first time an orb on
  // that face is drawn (a visible stall mid-crawl, right when the camera rounds
  // a corner onto a new face). Doubling ~600 triangles is free by comparison,
  // and it lets the band share the exact material the stickers already use.
  // Separate vertices matter: welding both windings onto one vertex sums equal
  // and opposite face normals into floating-point residue pointing anywhere,
  // which every lit material and tile style worn on the band reads.
  const count = pos.length / 3;
  const back = [];
  for (let t = 0; t < idx.length; t += 3) back.push(idx[t + 2] + count, idx[t + 1] + count, idx[t] + count);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...pos, ...pos], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([...uvs, ...uvs], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([...normals, ...normals.map((n) => -n)], 3));
  g.setIndex([...idx, ...back]);
  return g;
}

