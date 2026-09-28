import * as THREE from 'three';
import { createWorldTransformTracker } from './worldTransformTracker.js';
import { setInstanceCount, uploadInstancePrefix } from './instanceUploads.js';

// Opaque tile accessories share geometry/material draws but retain their own
// live anchors. Dense slots also remove hidden tiles from the submitted count.
export function createSurfaceBatches(capacity = 2048) {
  const group = new THREE.Group();
  group.name = 'TileSurfaceBatches';
  const entries = new Set(), batches = new Map();
  const tracker = createWorldTransformTracker();
  const inverse = new THREE.Matrix4(), local = new THREE.Matrix4(), color = new THREE.Color();
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), sphere = new THREE.Sphere();
  let visibility = new WeakMap();
  function visible(object) {
    if (!object) return true;
    if (visibility.has(object)) return visibility.get(object);
    const value = object.visible && visible(object.parent);
    visibility.set(object, value);
    return value;
  }
  return {
    group,
    register(anchor, geometry, material, colorRef) {
      if (material.transparent) throw Error('Transparent tile surfaces retain individual sorting');
      const entry = { anchor, geometry, material, colorRef };
      entries.add(entry);
      return () => entries.delete(entry);
    },
    update(camera = null) {
      tracker.begin();
      visibility = new WeakMap();
      const rootVersion = tracker.update(group);
      inverse.copy(group.matrixWorld).invert();
      if (camera) {
        camera.updateWorldMatrix(true, false);
        frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      }
      for (const batch of batches.values()) { batch.count = 0; batch.matrixDirty = batch.colorDirty = false; }
      for (const entry of entries) {
        const { anchor, geometry, material, colorRef } = entry;
        if (!anchor.parent || !visible(anchor)) continue;
        const version = tracker.update(anchor);
        if (camera) {
          if (!geometry.boundingSphere) geometry.computeBoundingSphere();
          sphere.copy(geometry.boundingSphere).applyMatrix4(anchor.matrixWorld);
          if (!frustum.intersectsSphere(sphere)) continue;
        }
        const key = `${geometry.uuid}:${material.uuid}:${!!colorRef}`;
        let batch = batches.get(key);
        if (!batch) {
          const mesh = new THREE.InstancedMesh(geometry, material, capacity);
          mesh.name = `TileSurfaceBatch:${anchor.name || geometry.type}`;
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          mesh.frustumCulled = false;
          mesh.raycast = () => {};
          batch = { mesh, count: 0, owners: [] };
          batches.set(key, batch);
          group.add(mesh);
        }
        const slot = batch.count++;
        if (slot >= capacity) throw Error('Tile surface batch capacity exceeded');
        const moved = batch.owners[slot] !== entry;
        if (moved || entry.worldVersion !== version || entry.rootVersion !== rootVersion) {
          local.multiplyMatrices(inverse, anchor.matrixWorld);
          batch.mesh.setMatrixAt(slot, local);
          batch.matrixDirty = true;
        }
        if (colorRef) {
          color.set(colorRef.current);
          if (moved || entry.r !== color.r || entry.g !== color.g || entry.b !== color.b) {
            batch.mesh.setColorAt(slot, color);
            batch.colorDirty = true;
            entry.r = color.r; entry.g = color.g; entry.b = color.b;
          }
        }
        batch.owners[slot] = entry;
        entry.worldVersion = version; entry.rootVersion = rootVersion;
      }
      for (const batch of batches.values()) {
        const { mesh, count } = batch;
        setInstanceCount(mesh, count);
        batch.owners.length = count;
        if (batch.matrixDirty) uploadInstancePrefix(mesh.instanceMatrix, count);
        if (batch.colorDirty) uploadInstancePrefix(mesh.instanceColor, count);
      }
    },
    dispose() {
      // Geometries and materials belong to the provider or shared tile caches.
      for (const { mesh } of batches.values()) mesh.dispose();
      group.clear(); batches.clear();
    }
  };
}
