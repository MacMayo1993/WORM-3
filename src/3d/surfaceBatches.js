import * as THREE from 'three';
import { createWorldTransformTracker } from './worldTransformTracker.js';
import { ensureInstanceColor, setInstanceCount, uploadInstancePrefix } from './instanceUploads.js';
import { frameWorldVersion, isRestingFrameAnchor, nextCullStamp, tileInView } from './tileFrames.js';

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

// `transparent` batches are decals laid flat on tiles that never overlap one another
// (the worm's footprint): one sorted draw for all of them is the same picture as one
// per tile. Opaque batches refuse transparent materials, which need their own sorting.
export function createSurfaceBatches(capacity = 2048, materialFor = material => material, { transparent = false } = {}) {
  const group = new THREE.Group();
  group.name = transparent ? 'TileSurfaceDecals' : 'TileSurfaceBatches';
  const entries = new Set(), batches = new Map();
  const tracker = createWorldTransformTracker();
  const inverse = new THREE.Matrix4(), local = new THREE.Matrix4(), color = new THREE.Color();
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  // An entry keeps its batch until its draw order changes or the pool is disposed
  // (React's StrictMode replay reuses a disposed pool): no key lookup per frame.
  let generation = 0;
  // Built once per entry (and again only if its draw order changes): a key per
  // tile per frame was thousands of string concatenations on Mega.
  // An anchor that casts a shadow (a LEGO stud) draws in a batch that does.
  const keyOf = entry => {
    const { anchor, geometry, material, colorRef, seedRef, dataRef } = entry;
    if (entry.keyOrder !== anchor.renderOrder || entry.keyShadow !== anchor.castShadow) {
      entry.keyOrder = anchor.renderOrder;
      entry.keyShadow = anchor.castShadow;
      entry.key = `${geometry.uuid}:${material.uuid}:${!!colorRef}:${!!seedRef}:${!!dataRef}:${anchor.renderOrder}:${anchor.castShadow}`;
    }
    return entry.key;
  };
  const batchOf = entry => {
    const { anchor } = entry;
    if (entry.batchGeneration === generation && entry.keyOrder === anchor.renderOrder && entry.keyShadow === anchor.castShadow) return entry.batch;
    const key = keyOf(entry);
    let batch = batches.get(key);
    entry.batchGeneration = generation;
    if (batch) return (entry.batch = batch);
    const { geometry, material, colorRef, seedRef, dataRef } = entry;
    const own = seedRef || dataRef;
    const mesh = new THREE.InstancedMesh(own ? seededGeometry(geometry, capacity, !!seedRef, !!dataRef) : geometry, materialFor(material), capacity);
    mesh.name = `TileSurfaceBatch:${entry.name || geometry.type}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = anchor.renderOrder;
    mesh.castShadow = anchor.castShadow;
    mesh.raycast = () => {};
    // The colour buffer's arrival switches programs: allocate it with the mesh.
    if (colorRef) ensureInstanceColor(mesh);
    setInstanceCount(mesh, 0);
    batch = { mesh, count: 0, owners: [], own: !!own,
      seeds: seedRef ? mesh.geometry.attributes.aInstanceSeed : null, data: dataRef ? mesh.geometry.attributes.aInstanceData : null };
    batches.set(key, batch);
    group.add(mesh);
    return (entry.batch = batch);
  };
  return {
    group,
    // `name` labels the batch; the anchor's own name by default. The batch's mesh is
    // made here, not on the entry's first visible frame, so a run's warm-up (which
    // compiles hidden objects too) links its program: an effect that waits hidden on
    // every tile, like the footprint, would otherwise link in the frame it first shows.
    // A resting tile passes its `frames` (tileFrames.js), so a still anchor is not
    // compared every frame (frameWorldVersion).
    register(anchor, geometry, material, colorRef, seedRef = null, dataRef = null, name = anchor.name, frames = null) {
      if (material.transparent && !transparent) throw Error('Transparent tile surfaces retain individual sorting');
      const entry = { anchor, geometry, material, colorRef, seedRef, dataRef, name, frames, data: [NaN, NaN, NaN, NaN] };
      entries.add(entry);
      batchOf(entry);
      return () => entries.delete(entry);
    },
    update(camera = null) {
      tracker.begin();
      const rootVersion = tracker.track(group, false);
      inverse.copy(group.matrixWorld).invert();
      const stamp = nextCullStamp();
      if (camera) {
        camera.updateWorldMatrix(true, false);
        frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      }
      for (const batch of batches.values()) { batch.count = 0; batch.matrixDirty = batch.colorDirty = batch.seedDirty = batch.dataDirty = false; }
      for (const entry of entries) {
        const { anchor, geometry, colorRef, seedRef, dataRef, frames } = entry;
        // A hidden anchor draws nothing whatever its ancestors are doing: decide that
        // before any cache lookup (most footprints are hidden on most frames).
        if (!anchor.parent || !anchor.visible) continue;
        let version;
        const resting = isRestingFrameAnchor(frames, anchor);
        if (resting) {
          const hostVersion = tracker.track(frames.tile.parent);
          if (hostVersion < 0) continue;
          version = frameWorldVersion(entry, frames, anchor, hostVersion);
          // A resting tile's entries share one test of the tile's own bounds.
          if (camera && !tileInView(frames, frustum, stamp)) continue;
        } else {
          version = tracker.track(anchor);
          if (version < 0) continue;
        }
        if (camera && !resting) {
          // The world bounds move only with the anchor; the camera moves every frame.
          if (entry.sphereVersion !== version) {
            if (!geometry.boundingSphere) geometry.computeBoundingSphere();
            (entry.sphere ??= new THREE.Sphere()).copy(geometry.boundingSphere).applyMatrix4(anchor.matrixWorld);
            entry.sphereVersion = version;
          }
          if (!frustum.intersectsSphere(entry.sphere)) continue;
        }
        const batch = batchOf(entry);
        const slot = batch.count++;
        if (slot >= capacity) throw Error('Tile surface batch capacity exceeded');
        const moved = batch.owners[slot] !== entry;
        if (moved || entry.worldVersion !== version || entry.rootVersion !== rootVersion) {
          local.multiplyMatrices(inverse, anchor.matrixWorld);
          batch.mesh.setMatrixAt(slot, local);
          batch.matrixDirty = true;
        }
        if (colorRef) {
          // Most tiles pass a hex string; parsing it is a regex per tile per frame.
          const source = colorRef.current;
          if (typeof source !== 'string' || source !== entry.colorSource) {
            color.set(source);
            entry.colorSource = source;
            entry.cr = color.r; entry.cg = color.g; entry.cb = color.b;
          } else color.setRGB(entry.cr, entry.cg, entry.cb);
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
      group.clear(); batches.clear(); generation++;
    }
  };
}
