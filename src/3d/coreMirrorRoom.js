import * as THREE from 'three';
import { CORE_MIRROR_HALF, corePassageGLSL } from './corePassage.js';
import { withPortalCutout } from './portalCutout.js';
import { createPlayStickerGeometry } from './rubiksPiece.js';

const REFLECTION_SIZE = 128;
const FACES = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// A shared cube-state reflection, rebuilt only on committed board/palette
// changes. No recursive scene captures or per-tile render targets on phones.
export function createCoreReflection(cubies, size, colors) {
  const palette = Object.fromEntries(Object.entries(colors).map(([id, color]) => [id, new THREE.Color(color).convertLinearToSRGB()]));
  const fallback = new THREE.Color('#cbd5df').convertLinearToSRGB();
  const grout = new THREE.Color('#172337').convertLinearToSRGB();
  const images = FACES.map((dirKey, face) => {
    const data = new Uint8Array(REFLECTION_SIZE * REFLECTION_SIZE * 4);
    for (let v = 0; v < REFLECTION_SIZE; v++) for (let u = 0; u < REFLECTION_SIZE; u++) {
      const x = Math.min(size - 1, Math.floor(u / REFLECTION_SIZE * size));
      const y = Math.min(size - 1, Math.floor(v / REFLECTION_SIZE * size));
      const edge = size - 1;
      const tile = face < 2 ? cubies[face === 0 ? edge : 0]?.[y]?.[x]
        : face < 4 ? cubies[x]?.[face === 2 ? edge : 0]?.[y]
          : cubies[x]?.[y]?.[face === 4 ? edge : 0];
      const color = palette[tile?.stickers?.[dirKey]?.curr] ?? fallback;
      const a = u / REFLECTION_SIZE * size % 1, b = v / REFLECTION_SIZE * size % 1;
      const seam = Math.min(a, b, 1 - a, 1 - b) < .045;
      const rgb = seam ? grout : color;
      // A restrained studio sheen leaves silver edges readable in the dark room.
      const sheen = .12 + .12 * Math.pow(Math.max(0, 1 - Math.abs(a + b - .8)), 8);
      const index = (v * REFLECTION_SIZE + u) * 4;
      data[index] = Math.round((rgb.r * .72 + sheen) * 255);
      data[index + 1] = Math.round((rgb.g * .72 + sheen) * 255);
      data[index + 2] = Math.round((rgb.b * .72 + sheen) * 255);
      data[index + 3] = 255;
    }
    return new THREE.DataTexture(data, REFLECTION_SIZE, REFLECTION_SIZE);
  });
  const texture = new THREE.CubeTexture(images);
  texture.name = 'anticube-room-reflection';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createCoreMirrorRoom(size, uniforms, reflection) {
  const group = new THREE.Group();
  group.name = 'anticube-mirror-room';
  group.visible = false;
  // Fine enough to read as individual mirrors; bounded even on Mega boards.
  const count = Math.max(3, Math.min(6, size));
  const pitch = CORE_MIRROR_HALF * 2 / count;
  const geometry = createPlayStickerGeometry(.95);
  const material = withPortalCutout(new THREE.MeshBasicMaterial({
    color: '#e4edf4', envMap: reflection, combine: THREE.MixOperation,
    reflectivity: .94, toneMapped: false
  }), uniforms, corePassageGLSL, 'core-mirror', true);
  const tiles = new THREE.InstancedMesh(geometry, material, 6 * count * count);
  tiles.name = 'anticube-mirror-tiles';
  tiles.frustumCulled = false;
  const pose = new THREE.Object3D(), normal = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1);
  let index = 0;
  for (const face of NORMALS) {
    normal.fromArray(face);
    pose.quaternion.setFromUnitVectors(z, normal.clone().negate());
    pose.scale.setScalar(pitch);
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      pose.position.set((col + .5) * pitch - CORE_MIRROR_HALF, (row + .5) * pitch - CORE_MIRROR_HALF, 0)
        .applyQuaternion(pose.quaternion).addScaledVector(normal, CORE_MIRROR_HALF);
      pose.updateMatrix(); tiles.setMatrixAt(index++, pose.matrix);
    }
  }
  tiles.instanceMatrix.needsUpdate = true;
  const backingGeometry = new THREE.BoxGeometry(CORE_MIRROR_HALF * 2 + .001, CORE_MIRROR_HALF * 2 + .001, CORE_MIRROR_HALF * 2 + .001);
  const backingMaterial = withPortalCutout(new THREE.MeshBasicMaterial({ color: '#1c2533', side: THREE.BackSide }),
    uniforms, corePassageGLSL, 'core-mirror-backing');
  group.add(new THREE.Mesh(backingGeometry, backingMaterial), tiles);
  return { group, material, dispose() {
    geometry.dispose(); material.dispose(); backingGeometry.dispose(); backingMaterial.dispose();
  } };
}
