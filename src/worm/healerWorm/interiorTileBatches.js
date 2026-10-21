import * as THREE from 'three';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';
import { resolveCubeViewAppearance } from '../../3d/cubeViewAppearance.js';
import { getTileStyleMaterial } from '../../3d/styles/TileStyleMaterials.jsx';
import { instanceTileStyleShaders } from '../../3d/styles/instancedTileStyle.js';
import { withPortalCutout } from '../../3d/portalCutout.js';
import { interiorPortalGLSL } from './interiorPortals.js';

// The room uses the equipped tile shaders, including physical tile identity.
// Supply each tile's frame/seed as attributes instead of rebinding uniforms and
// issuing a draw for every wall square. Never modify the shared material cache.
function batchMaterial(source, portals) {
  const material = source.clone();
  material.uniforms = { ...source.uniforms };
  instanceTileStyleShaders(material, 'aTileIdentity', 'vInteriorIdentity');
  return withPortalCutout(material, portals, interiorPortalGLSL, 'interior');
}

export function makeInteriorTileBatches(portals) {
  const group = new THREE.Group();
  group.name = 'tunnel-interior-tiles';
  const batches = new Map();
  const pose = new THREE.Object3D();
  const release = mesh => {
    group.remove(mesh);
    mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose();
  };
  return {
    group,
    sync(layout, cubies, settings, cap, viewPower = null) {
      const { colors, manifoldStyles } = resolveCubeViewAppearance(settings, viewPower);
      for (const mesh of batches.values()) { mesh.count = 0; mesh.userData.tileKeys.length = 0; }
      for (const tile of layout) {
        const { sx, sy, sz, dirKey, px, py, pz, rx, ry, rz } = tile;
        const sticker = cubies?.[sx]?.[sy]?.[sz]?.stickers?.[dirKey];
        const face = ANTIPODAL_COLOR[sticker?.curr];
        if (!face) continue;
        const dead = sticker.flips >= cap;
        const style = dead ? 'solid' : manifoldStyles?.[face] ?? 'solid';
        const source = getTileStyleMaterial(style, dead ? '#555555' : colors[face] ?? '#444',
          false, null, colors[ANTIPODAL_COLOR[face]] ?? '#ffffff');
        let mesh = batches.get(source);
        if (mesh && mesh.instanceMatrix.count < layout.length) { release(mesh); batches.delete(source); mesh = null; }
        if (!mesh) {
          const geometry = new THREE.PlaneGeometry(0.88, 0.88);
          geometry.setAttribute('aTileIdentity', new THREE.InstancedBufferAttribute(new Float32Array(layout.length * 4), 4));
          mesh = new THREE.InstancedMesh(geometry, batchMaterial(source, portals), layout.length);
          mesh.name = `tunnel-interior-batch-${face}-${style}`;
          mesh.count = 0;
          mesh.userData.tileKeys = [];
          batches.set(source, mesh); group.add(mesh);
        }
        const index = mesh.count++;
        pose.position.set(px, py, pz); pose.rotation.set(rx, ry, rz); pose.updateMatrix();
        mesh.setMatrixAt(index, pose.matrix);
        const home = sticker.origPos;
        mesh.geometry.attributes.aTileIdentity.setXYZW(index, home?.x ?? 0, home?.y ?? 0, home?.z ?? 0, sticker.orig ?? 0);
        mesh.userData.tileKeys.push(`${sx}-${sy}-${sz}-${dirKey}`);
      }
      for (const [source, mesh] of batches) {
        if (!mesh.count) { release(mesh); batches.delete(source); continue; }
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, mesh.count * 16);
        mesh.instanceMatrix.needsUpdate = true;
        const identity = mesh.geometry.attributes.aTileIdentity;
        identity.clearUpdateRanges(); identity.addUpdateRange(0, mesh.count * 4); identity.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    },
    dispose() { for (const mesh of batches.values()) release(mesh); batches.clear(); }
  };
}
