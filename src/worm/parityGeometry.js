import * as THREE from 'three';

// ── Möbius strip geometry factory ───────────────────────────────────────────
// Creates a mathematically correct Möbius strip: a band that makes one 180°
// half-twist as it loops around. The last ring reconnects to the first ring
// with vertices flipped top-to-bottom — that's the defining Möbius closure.
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
  for (let i = 0; i < uS; i++) {
    for (let j = 0; j < vS; j++) {
      const a = i * cols + j, b = i * cols + j + 1;
      const last = i === uS - 1;
      const c = last ? vS - j     : (i + 1) * cols + j;
      const d = last ? vS - j - 1 : (i + 1) * cols + j + 1;
      // Each quad is emitted twice, the second copy wound backwards, so the band
      // is two-sided in GEOMETRY rather than needing a DoubleSide material. A
      // Möbius band is one-sided and would otherwise drop half its loop under a
      // front-face-only material — but `side` is part of three's program cache
      // key, so a DoubleSide variant of a tile-style shader is a whole second
      // program that has to be compiled the first time an orb on that face is
      // drawn (a visible stall mid-crawl, right when the camera rounds a corner
      // onto a new face). Doubling ~576 triangles is free by comparison, and it
      // lets the band share the exact material the stickers already use.
      idx.push(a, b, c, b, d, c);
      idx.push(c, b, a, c, d, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

