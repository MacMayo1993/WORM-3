import * as THREE from 'three';
import { createWorldTransformTracker } from './worldTransformTracker.js';
import { setInstanceCount, uploadInstancePrefix } from './instanceUploads.js';

// WORM's see-through cubie shells, drawn as one instanced mesh per look.
//
// Every WORM body is a transparent, double-sided rounded box. three.js renders that
// combination in two passes, and flags `material.needsUpdate` before each, so every
// body sends the renderer back through program selection twice a frame. On a 10×10
// that was 845 draws and 845 program re-selections a frame for the bodies alone
// (93% of the frame's draws, and most of its CPU). Batched, each look is one mesh:
// the same shared geometry and the same material, so three.js still draws the
// back faces and then the front faces, now for every body at once.
//
// The bodies stay transparent, so instances are written far to near each frame:
// the painter's order three.js used to give the individual meshes. Each instance
// is frustum-culled as its mesh was. The cubie keeps an invisible mesh of the same
// shape where its body was: it is the instance's transform anchor and still takes
// the piece's pointer events (R3F raycasts invisible meshes).

const EMPTY = Object.freeze({});
const byFarthestFirst = (a, b) => b.depth - a.depth;

function propsKey(props) {
  let key = '';
  for (const name of Object.keys(props).sort()) key += `${name}=${props[name]};`;
  return key;
}

// `materialFor` wraps each batch material the way the cube's other materials are
// wrapped (the exterior portal bore), so a batched shell opens like the meshes did.
export function createCubieBodyBatches(capacity = 4096, materialFor = material => material) {
  const group = new THREE.Group();
  group.name = 'CubieBodyBatches';
  const entries = new Set(), batches = new Map();
  const tracker = createWorldTransformTracker();
  const inverse = new THREE.Matrix4(), local = new THREE.Matrix4();
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), sphere = new THREE.Sphere();
  const eye = new THREE.Vector3(), forward = new THREE.Vector3();
  let shadows = false;
  function batchFor(geometry, props) {
    const key = `${geometry.uuid}|${propsKey(props)}`;
    let batch = batches.get(key);
    if (batch) return batch;
    const material = materialFor(new THREE.MeshStandardMaterial(props));
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.name = 'CubieBodyBatch';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; // culled per instance below
    // three.js sorts transparent objects by bounding-sphere centre; every body sits
    // around the cube's centre, so give the batch that centre rather than letting it
    // compute a sphere from whatever instances happen to be live on first sight.
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    mesh.renderOrder = -1; // the bodies' own order: before cube-wide transparent layers
    mesh.raycast = () => {};
    mesh.castShadow = mesh.receiveShadow = shadows;
    setInstanceCount(mesh, 0);
    batch = { mesh, items: [], owners: [] };
    batches.set(key, batch);
    group.add(mesh);
    return batch;
  }
  return {
    group,
    /** Draw `anchor`'s body in the batch for its look; returns the unregister. */
    register(anchor, geometry, props = EMPTY) {
      const entry = { anchor, geometry, batch: batchFor(geometry, props), depth: 0, version: -1, rootVersion: -1 };
      entries.add(entry);
      return () => entries.delete(entry);
    },
    setShadows(on) {
      shadows = !!on;
      for (const { mesh } of batches.values()) mesh.castShadow = mesh.receiveShadow = shadows;
    },
    update(camera = null) {
      tracker.begin();
      const rootVersion = tracker.update(group);
      inverse.copy(group.matrixWorld).invert();
      if (camera) {
        camera.updateWorldMatrix(true, false);
        frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        eye.setFromMatrixPosition(camera.matrixWorld);
        camera.getWorldDirection(forward);
      }
      for (const batch of batches.values()) batch.items.length = 0;
      for (const entry of entries) {
        const { anchor, geometry } = entry;
        // The anchor itself is invisible by design; what hides a body is a hidden
        // ancestor (the exterior while the lens is inside the cube, a cubie).
        if (!anchor.parent || !tracker.visible(anchor.parent)) continue;
        entry.version = tracker.update(anchor);
        const m = anchor.matrixWorld.elements;
        if (camera) {
          // A shadow map needs the casters the lens cannot see, as it had them
          // when each body was its own mesh, culled per camera.
          if (!shadows) {
            if (!geometry.boundingSphere) geometry.computeBoundingSphere();
            sphere.copy(geometry.boundingSphere).applyMatrix4(anchor.matrixWorld);
            if (!frustum.intersectsSphere(sphere)) continue;
          }
          entry.depth = (m[12] - eye.x) * forward.x + (m[13] - eye.y) * forward.y + (m[14] - eye.z) * forward.z;
        }
        entry.batch.items.push(entry);
      }
      for (const batch of batches.values()) {
        const { mesh, items, owners } = batch;
        if (camera) items.sort(byFarthestFirst);
        let dirty = false;
        for (let slot = 0; slot < items.length; slot++) {
          const entry = items[slot];
          if (owners[slot] === entry && entry.written === entry.version && entry.writtenRoot === rootVersion) continue;
          local.multiplyMatrices(inverse, entry.anchor.matrixWorld);
          mesh.setMatrixAt(slot, local);
          owners[slot] = entry;
          entry.written = entry.version;
          entry.writtenRoot = rootVersion;
          dirty = true;
        }
        owners.length = items.length;
        setInstanceCount(mesh, items.length);
        if (dirty) uploadInstancePrefix(mesh.instanceMatrix, items.length);
      }
    },
    dispose() {
      // Geometries are the shared cubieBodyGeometry cache (never disposed).
      for (const { mesh } of batches.values()) { mesh.material.dispose(); mesh.dispose(); }
      group.clear(); batches.clear(); entries.clear();
    }
  };
}
