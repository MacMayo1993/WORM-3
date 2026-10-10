import { BufferGeometry, Float32BufferAttribute } from 'three';

// A rounded square hugs the slice instead of orbiting beyond its corner diagonal.
// Its straight sections stay outside the faces, and its corner radius clears the
// cube's corners. Two narrow crossing strips make the arrows readable from both
// face-on and overhead views, merged into a single draw.
export function turnGuidePoint(axis, axial, u, v) {
  return axis === 'col' ? [axial, u, v] : axis === 'row' ? [v, axial, u] : [u, v, axial];
}

export function buildTurnGuideGeometry(size, axis, sliceIndex, reduced = false) {
  const half = size / 2, corner = 0.32, center = half - 0.06;
  const arcSteps = reduced ? 6 : 12;
  const path = [];
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2;
    const cx = side === 0 || side === 3 ? center : -center;
    const cy = side < 2 ? center : -center;
    for (let i = 0; i <= arcSteps; i++) {
      const a = angle + i / arcSteps * Math.PI / 2;
      path.push([cx + corner * Math.cos(a), cy + corner * Math.sin(a), Math.cos(a), Math.sin(a)]);
    }
  }
  path.push(path[0]);
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Math.hypot(path[i][0] - path[i-1][0], path[i][1] - path[i-1][1]));
  const length = lengths.at(-1), axial = sliceIndex - (size - 1) / 2;
  const positions = [], uvs = [], indices = [];
  for (let plane = 0; plane < 2; plane++) {
    const base = positions.length / 3;
    for (let i = 0; i < path.length; i++) {
      const [u,v,nu,nv] = path[i];
      for (const side of [-1,1]) {
        const radial = plane === 0 ? 0 : side * 0.105;
        positions.push(...turnGuidePoint(axis, axial + (plane === 0 ? side * 0.21 : 0), u + radial * nu, v + radial * nv));
        uvs.push(lengths[i] / length, (side + 1) / 2);
      }
      if (i) {
        const n = base + i * 2;
        indices.push(n-2,n-1,n,n-1,n+1,n);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.trackLength = length;
  return geometry;
}
