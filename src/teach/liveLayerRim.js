import { Matrix4, Vector3 } from 'three';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';

const intoRim = new Matrix4();
const point = new Vector3();

// The cached template stays assembled and immutable. Move a private copy from
// each cubie's local face into the rim mesh's space, preserving the tile width.
// Sampling the real piece also includes its raised parent and live slice turn.
export function updateLiveLayerRim(geometry, template, cubies, size, expansion, worldToRim) {
  const source = template.attributes.position;
  const target = geometry.attributes.position;
  const scale = cubeExpansionScale(size, expansion);
  const refs = cubies?.size === size ? cubies.refs : null;
  template.userData.rimFaces.forEach(({ x, y, z, cx, cy, cz }, face) => {
    const piece = refs?.[(x * size + y) * size + z];
    if (piece) {
      piece.updateWorldMatrix(true, false);
      intoRim.multiplyMatrices(worldToRim, piece.matrixWorld);
    }
    for (let corner = 0; corner < 4; corner++) {
      const vertex = face * 4 + corner;
      point.fromBufferAttribute(source, vertex);
      if (piece) {
        point.x -= cx; point.y -= cy; point.z -= cz;
        point.applyMatrix4(intoRim);
      } else {
        // The registry may be empty during scene setup. Match the lattice until
        // the pieces mount; never scale the face itself to fill exploded gaps.
        point.x += cx * (scale - 1);
        point.y += cy * (scale - 1);
        point.z += cz * (scale - 1);
      }
      target.setXYZ(vertex, point.x, point.y, point.z);
    }
  });
  target.needsUpdate = true;
}
