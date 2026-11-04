import * as THREE from 'three';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';
import { resolveCubeViewAppearance } from '../../3d/cubeViewAppearance.js';
import { getTileStyleMaterial } from '../../3d/styles/TileStyleMaterials.jsx';
import { instanceTileStyleShaders } from '../../3d/styles/instancedTileStyle.js';
import { withPortalCutout } from '../../3d/portalCutout.js';
import { interiorPortalGLSL } from './interiorPortals.js';
import { CHROME_TILE_FINISH } from '../../3d/cubeViewStyles.js';
import { createPlayStickerGeometry } from '../../3d/rubiksPiece.js';

// Sit inward of the physical sticker backs, including the worm's deepest press.
// Chrome walls are solid extrusions: their backs extend PLAY_STICKER_DEPTH
// outward from this plane. At the old 0.04 inset those dark backs reached 0.496
// while pressed exterior faces sank to 0.474, hiding occupied tiles for as long
// as the tail kept the room mounted. 0.08 also leaves the room in front of the
// physical backs when seen from inside, without changing the mouth positions.
export const INTERIOR_TILE_INSET = 0.08;

// Classic pickups retain the plain tile shader, including physical tile identity.
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
  const pose = new THREE.Object3D(), tint = new THREE.Color();
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
        // The inside has its own polished identity, independent of the exterior
        // skin. Classic view pickups still restore their plain, standard palette.
        const chrome = viewPower !== 'view-classic';
        const style = chrome ? 'chrome' : dead ? 'solid' : manifoldStyles?.[face] ?? 'solid';
        const color = dead ? '#555555' : colors[face] ?? '#444';
        // All chrome walls share ONE draw and their live tint is per instance.
        const source = chrome ? 'chrome' : getTileStyleMaterial(style, color,
          false, null, colors[ANTIPODAL_COLOR[face]] ?? '#ffffff');
        let mesh = batches.get(source);
        if (mesh && mesh.instanceMatrix.count < layout.length) { release(mesh); batches.delete(source); mesh = null; }
        if (!mesh) {
          const geometry = chrome ? createPlayStickerGeometry(0.88) : new THREE.PlaneGeometry(0.88, 0.88);
          geometry.setAttribute('aTileIdentity', new THREE.InstancedBufferAttribute(new Float32Array(layout.length * 4), 4));
          const material = chrome
            ? withPortalCutout(new THREE.MeshStandardMaterial({ ...CHROME_TILE_FINISH,
              // Keep seams legible while an environment loads or is unavailable.
              emissive: '#ffffff', emissiveIntensity: 0.012 }), portals, interiorPortalGLSL, 'interior-chrome')
            : batchMaterial(source, portals);
          mesh = new THREE.InstancedMesh(geometry, material, layout.length);
          mesh.name = chrome ? 'tunnel-interior-batch-chrome' : `tunnel-interior-batch-${face}-${style}`;
          mesh.count = 0;
          mesh.userData.tileKeys = [];
          batches.set(source, mesh); group.add(mesh);
        }
        const index = mesh.count++;
        pose.position.set(px, py, pz); pose.rotation.set(rx, ry, rz); pose.updateMatrix();
        mesh.setMatrixAt(index, pose.matrix);
        if (chrome) mesh.setColorAt(index, tint.set(color));
        const home = sticker.origPos;
        mesh.geometry.attributes.aTileIdentity.setXYZW(index, home?.x ?? 0, home?.y ?? 0, home?.z ?? 0, sticker.orig ?? 0);
        mesh.userData.tileKeys.push(`${sx}-${sy}-${sz}-${dirKey}`);
      }
      for (const [source, mesh] of batches) {
        if (!mesh.count) { release(mesh); batches.delete(source); continue; }
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, mesh.count * 16);
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
          mesh.instanceColor.clearUpdateRanges();
          mesh.instanceColor.addUpdateRange(0, mesh.count * 3);
          mesh.instanceColor.needsUpdate = true;
        }
        const identity = mesh.geometry.attributes.aTileIdentity;
        identity.clearUpdateRanges(); identity.addUpdateRange(0, mesh.count * 4); identity.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    },
    dispose() { for (const mesh of batches.values()) release(mesh); batches.clear(); }
  };
}
