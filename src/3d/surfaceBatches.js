import * as THREE from 'three';
import { createWorldTransformTracker } from './worldTransformTracker.js';
import { setInstanceCount, uploadInstancePrefix } from './instanceUploads.js';

// Opaque tile accessories share geometry/material draws but retain their own
// live anchors. Dense slots also remove hidden tiles from the submitted count.
//
// An entry may carry a stable per-instance seed (`seedRef.current`, a number), read
// by the material as `attribute float aInstanceSeed`. A shader that needs a value per
// piece must take it from there, not from instanceMatrix: the matrix moves with
// every slice turn, so anything hashed from it changes from frame to frame.
//
// An entry may also carry four numbers of its own (`dataRef.current`, an array of
// four), read as `attribute vec4 aInstanceData`: the flip portal's home colour and
// flip pressure travel this way, so one draw serves every portal on the cube.

// The batch's own view of a shared geometry: the same attribute objects (one GPU
// buffer each), plus the batch's seed and data attributes, so batches never write
// into the shared geometry.
const OWN_ATTRIBUTES = ['aInstanceSeed', 'aInstanceData'];
function instanceAttribute(capacity, itemSize) {
  const attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * itemSize), itemSize);
  attribute.setUsage(THREE.DynamicDrawUsage);
  return attribute;
}
function seededGeometry(geometry, capacity, seeded, withData) {
  const view = new THREE.BufferGeometry();
  view.setIndex(geometry.index);
  for (const [name, attribute] of Object.entries(geometry.attributes)) view.setAttribute(name, attribute);
  for (const group of geometry.groups) view.addGroup(group.start, group.count, group.materialIndex);
  view.boundingSphere = geometry.boundingSphere; view.boundingBox = geometry.boundingBox;
  if (seeded) view.setAttribute('aInstanceSeed', instanceAttribute(capacity, 1));
  if (withData) view.setAttribute('aInstanceData', instanceAttribute(capacity, 4));
  return view;
}

export function createSurfaceBatches(capacity = 2048, materialFor = material => material) {
  const group = new THREE.Group();
  group.name = 'TileSurfaceBatches';
  const entries = new Set(), batches = new Map();
  const tracker = createWorldTransformTracker();
  const inverse = new THREE.Matrix4(), local = new THREE.Matrix4(), color = new THREE.Color();
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), sphere = new THREE.Sphere();
  return {
    group,
    register(anchor, geometry, material, colorRef, seedRef = null, dataRef = null) {
      if (material.transparent) throw Error('Transparent tile surfaces retain individual sorting');
      const entry = { anchor, geometry, material, colorRef, seedRef, dataRef, data: [NaN, NaN, NaN, NaN] };
      entries.add(entry);
      return () => entries.delete(entry);
    },
    update(camera = null) {
      tracker.begin();
      const rootVersion = tracker.update(group);
      inverse.copy(group.matrixWorld).invert();
      if (camera) {
        camera.updateWorldMatrix(true, false);
        frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      }
      for (const batch of batches.values()) { batch.count = 0; batch.matrixDirty = batch.colorDirty = batch.seedDirty = batch.dataDirty = false; }
      for (const entry of entries) {
        const { anchor, geometry, material, colorRef, seedRef, dataRef } = entry;
        if (!anchor.parent || !tracker.visible(anchor)) continue;
        const version = tracker.update(anchor);
        if (camera) {
          if (!geometry.boundingSphere) geometry.computeBoundingSphere();
          sphere.copy(geometry.boundingSphere).applyMatrix4(anchor.matrixWorld);
          if (!frustum.intersectsSphere(sphere)) continue;
        }
        // Built once per entry (and again only if its draw order changes): a key
        // per tile per frame was thousands of string concatenations on Mega.
        if (entry.keyOrder !== anchor.renderOrder) {
          entry.keyOrder = anchor.renderOrder;
          entry.key = `${geometry.uuid}:${material.uuid}:${!!colorRef}:${!!seedRef}:${!!dataRef}:${anchor.renderOrder}`;
        }
        const key = entry.key;
        let batch = batches.get(key);
        if (!batch) {
          const own = seedRef || dataRef;
          const mesh = new THREE.InstancedMesh(own ? seededGeometry(geometry, capacity, !!seedRef, !!dataRef) : geometry, materialFor(material), capacity);
          mesh.name = `TileSurfaceBatch:${anchor.name || geometry.type}`;
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          mesh.frustumCulled = false;
          mesh.renderOrder = anchor.renderOrder;
          mesh.raycast = () => {};
          batch = { mesh, count: 0, owners: [], own: !!own,
            seeds: seedRef ? mesh.geometry.attributes.aInstanceSeed : null, data: dataRef ? mesh.geometry.attributes.aInstanceData : null };
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
        if (seedRef && (moved || entry.seed !== seedRef.current)) {
          entry.seed = seedRef.current;
          batch.seeds.array[slot] = entry.seed;
          batch.seedDirty = true;
        }
        if (dataRef) {
          const next = dataRef.current, held = entry.data, array = batch.data.array, at = slot * 4;
          for (let i = 0; i < 4; i++) {
            const value = next[i] ?? 0;
            if (moved || held[i] !== value) { held[i] = array[at + i] = value; batch.dataDirty = true; }
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
        if (batch.seedDirty) uploadInstancePrefix(batch.seeds, count);
        if (batch.dataDirty) uploadInstancePrefix(batch.data, count);
      }
    },
    dispose() {
      // Geometries and materials belong to the provider or shared tile caches. A
      // seeded batch's geometry view is its own: detach the shared attributes first,
      // so disposing it frees only its seed and data buffers.
      for (const { mesh, own } of batches.values()) {
        mesh.dispose();
        if (!own) continue;
        const view = mesh.geometry;
        for (const name of Object.keys(view.attributes)) if (!OWN_ATTRIBUTES.includes(name)) view.deleteAttribute(name);
        view.setIndex(null);
        view.dispose();
      }
      group.clear(); batches.clear();
    }
  };
}
