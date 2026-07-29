// StickerInstances.jsx
// Batches simple (solid-colour) sticker planes into a single THREE.InstancedMesh,
// collapsing up to 150 individual draw calls (5×5 cube) to one.
//
// Architecture:
//   StickerInstanceProvider  – context provider + imperative InstancedMesh manager.
//   useStickerInstances      – hook for StickerPlane to join the batch.
//
// Each StickerPlane that qualifies as "simple" (solid colour, no shader, no biome,
// no hollow/glass/sudokube, no face texture) calls register() in useLayoutEffect
// and receives an integer instanceId.  From then on:
//   • Its main <mesh> is not rendered (saves the individual draw call).
//   • The manager's useFrame (priority 1, after StickerPlane's priority 0) reads
//     innerGroupRef.matrixWorld and writes the correct world transform into the
//     InstancedMesh slot every frame — including flip-squish scale and tremor.
//   • instanceColorRef is kept current by StickerPlane; the manager uploads it
//     via setColorAt each frame.
//
// When a sticker becomes "complex" (isInstancedRef.current = false) the manager
// zeros its slot so the individual mesh can take over without overlap.

import { createContext, useContext, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Context ─────────────────────────────────────────────────────────────────

export const StickerInstanceContext = createContext(null);

/** Hook consumed by StickerPlane to access the batch manager. */
export const useStickerInstances = () => useContext(StickerInstanceContext);

// ─── Constants ────────────────────────────────────────────────────────────────

// 15×15 Mega Mode has 6×225 = 1,350 exterior stickers; 2,048 leaves headroom
// for transitions where old and new instances briefly coexist.
const MAX_INSTANCES = 2048;

// Reusable zero-scale matrix for hiding unused / non-instanced slots.
const _zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Wrap CubeAssembly's content with this provider.  It creates one
 * THREE.InstancedMesh for all solid-colour sticker quads and adds it directly
 * to the Three.js scene root (world space) so sticker world matrices can be
 * applied without any parent-transform offset.
 */
export function StickerInstanceProvider({ children }) {
  const { scene } = useThree();

  // ── InstancedMesh ───────────────────────────────────────────────────────────
  // Created synchronously (useMemo) so that StickerPlane's useLayoutEffect can
  // safely call register() — which accesses instanceMesh — before this
  // component's own useLayoutEffect adds the mesh to the scene.  React calls
  // children's useLayoutEffects before parents', so the ordering is:
  //   StickerPlane.useLayoutEffect  → register()  (mesh already exists)
  //   StickerInstanceProvider.useLayoutEffect → scene.add(mesh)
  //   browser paint → R3F first useFrame → WebGL render  (everything ready)
  const instanceMesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.85, 0.85);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.3,
      metalness: 0.05,
      envMapIntensity: 0.3,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, MAX_INSTANCES);
    // Render all MAX_INSTANCES slots; unused ones are zeroed out (invisible).
    mesh.count = MAX_INSTANCES;
    mesh.frustumCulled = false; // world-space AABB would be wrong anyway
    mesh.name = 'StickerInstanceMesh';
    // Disable raycasting — zero-scale matrices produce degenerate inverse matrices
    // that cause Infinity/NaN values in the ray, leading to unpredictable hit results.
    // This mesh is purely visual; no pointer interaction is needed.
    mesh.raycast = () => { };
    for (let i = 0; i < MAX_INSTANCES; i++) mesh.setMatrixAt(i, _zeroMatrix);
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, []);

  // Add to scene root.  Remove on unmount.
  // NOTE: geometry and material are NOT disposed here.  In React 18 Strict Mode
  // (development), useLayoutEffect cleanup runs between the first and second
  // effect invocations.  Disposing here would corrupt the still-live mesh
  // before the second run re-adds it: instanced colors would be lost, making
  // all solid stickers invisible for the lifetime of the session.
  // The Three.js resources are freed implicitly when the WebGL context is
  // destroyed (i.e. when the persistent Canvas unmounts at app shutdown).
  useLayoutEffect(() => {
    scene.add(instanceMesh);
    return () => {
      scene.remove(instanceMesh);
    };
  }, [scene, instanceMesh]);

  // ── Slot registry ───────────────────────────────────────────────────────────
  // id → { groupRef, colorRef, isInstancedRef, slot }
  const registryRef = useRef(new Map());
  const nextIdRef = useRef(0);
  // Slots are handed out from the top of this stack and returned on unregister.
  const freeSlotsRef = useRef(
    Array.from({ length: MAX_INSTANCES }, (_, i) => MAX_INSTANCES - 1 - i)
  );
  // Set of slot indices that have already had _zeroMatrix written this render
  // cycle.  Prevents re-uploading an already-blank matrix every frame for slots
  // that are registered but currently non-instanced (biome, shader, glass, etc.).
  const zeroedSlotsRef = useRef(new Set());
  // Per-slot cached RGB — 3 floats per slot.  Compared before each setColorAt
  // call; skipped when unchanged to avoid redundant GPU uploads every frame.
  // Initialised to NaN so the first upload always fires (NaN !== anything).
  const lastColorsRef = useRef(new Float32Array(MAX_INSTANCES * 3).fill(NaN));
  // Per-slot cached world matrix — 16 floats per slot.  Compared before each
  // setMatrixAt; the matrix write (and the whole-buffer instanceMatrix GPU
  // re-upload it triggers) is skipped when a sticker's transform is unchanged
  // since last frame — the common case when the cube sits at rest.  Float64
  // (not Float32) so the stored elements match matrixWorld.elements bit-for-bit;
  // cube matrices come from rotations/sqrt and aren't float32-exact, so a float32
  // cache would mis-compare every frame and never skip.  NaN-seeded so the first
  // upload always fires.
  const lastMatricesRef = useRef(new Float64Array(MAX_INSTANCES * 16).fill(NaN));

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Register a sticker with the batch manager.
   *
   * @param {React.RefObject<THREE.Group>} groupRef
   *   Ref to the INNER UV-rotation group of StickerPlane (includes uvRotationAngle).
   *   Its matrixWorld gives the exact world transform of the sticker quad.
   * @param {React.RefObject<THREE.Color>} colorRef
   *   Ref to a THREE.Color kept current by StickerPlane.
   * @param {React.RefObject<boolean>} isInstancedRef
   *   Ref set to true when this sticker should be batched, false to fall back to
   *   its own mesh.  Checked every frame by the manager.
   * @returns {number} instanceId  (pass to unregister on unmount)
   */
  const register = useCallback((groupRef, colorRef, isInstancedRef) => {
    const slot = freeSlotsRef.current.pop();
    if (slot === undefined) {
      console.warn('[StickerInstances] slot pool exhausted — sticker will not be batched');
      return -1;
    }
    const id = nextIdRef.current++;
    registryRef.current.set(id, { groupRef, colorRef, isInstancedRef, slot });
    // Seed the per-instance color so the first frame shows the correct colour.
    if (colorRef.current) {
      instanceMesh.setColorAt(slot, colorRef.current);
      if (instanceMesh.instanceColor) instanceMesh.instanceColor.needsUpdate = true;
      // Cache the seeded color so the first useFrame skips the redundant upload.
      const base = slot * 3;
      const lc = lastColorsRef.current;
      lc[base] = colorRef.current.r;
      lc[base + 1] = colorRef.current.g;
      lc[base + 2] = colorRef.current.b;
    }
    return id;
  }, [instanceMesh]);

  /** Remove a sticker from the batch and recycle its slot. */
  const unregister = useCallback((id) => {
    const entry = registryRef.current.get(id);
    if (!entry) return;
    instanceMesh.setMatrixAt(entry.slot, _zeroMatrix);
    instanceMesh.instanceMatrix.needsUpdate = true;
    zeroedSlotsRef.current.delete(entry.slot);
    registryRef.current.delete(id);
    freeSlotsRef.current.push(entry.slot);
    // Invalidate the cached color so the recycled slot uploads correctly on first use.
    const base = entry.slot * 3;
    lastColorsRef.current[base] = NaN;
    lastColorsRef.current[base + 1] = NaN;
    lastColorsRef.current[base + 2] = NaN;
    // Invalidate the cached matrix too — we just wrote _zeroMatrix into the slot,
    // so a future owner (or reactivation) must re-upload its real matrix.
    const mbase = entry.slot * 16;
    lastMatricesRef.current.fill(NaN, mbase, mbase + 16);
  }, [instanceMesh]);

  // ── Per-frame update ────────────────────────────────────────────────────────
  // Priority 0 (default). Frame ordering is guaranteed as follows:
  //   -1  CubeAssembly transform useFrame — writes g.position / g.quaternion
  //        on cubieRefs for live-drag and GSAP snap animations
  //    0  StickerPlane useFrames — write flip-squish / shake to innerGroupRef
  //    0  THIS callback runs after StickerPlane because StickerPlane is a
  //        deeper descendant: its useLayoutEffect fires first (children before
  //        parents), inserting it into the priority-0 subscriber list first.
  //        R3F's stable sort preserves that order within the same priority band.
  //
  // By the time updateWorldMatrix(true, false) is called here, both the cubie
  // parent transforms (-1 band) and the inner group transforms (earlier priority-0
  // StickerPlane callbacks) are already applied for this frame.
  //
  // IMPORTANT: Do NOT use priority > 0 here. In R3F v8, any useFrame with a
  // positive priority increments an internal counter that disables gl.render()
  // entirely, causing the scene to stop rendering (black screen).
  useFrame(() => {
    if (registryRef.current.size === 0) return;

    let matDirty = false;
    let colDirty = false;

    for (const [, { groupRef, colorRef, isInstancedRef, slot }] of registryRef.current) {
      if (!isInstancedRef.current || !groupRef.current) {
        // Sticker is handled by its own mesh — blank the slot once so no
        // ghost instance lingers.  Skip if already zeroed to avoid uploading
        // an unchanged buffer every frame (common in biome/shader/glass modes).
        if (!zeroedSlotsRef.current.has(slot)) {
          instanceMesh.setMatrixAt(slot, _zeroMatrix);
          // Invalidate the matrix cache: the slot now holds _zeroMatrix, so when
          // this sticker reactivates its real (possibly unchanged) matrix must be
          // re-uploaded rather than skipped as "unchanged".
          const mbase = slot * 16;
          lastMatricesRef.current.fill(NaN, mbase, mbase + 16);
          matDirty = true;
          zeroedSlotsRef.current.add(slot);
        }
        continue;
      }

      // Slot is active — clear any previous "already zeroed" mark so a future
      // non-instanced transition will write _zeroMatrix exactly once again.
      zeroedSlotsRef.current.delete(slot);

      // updateWorldMatrix(updateParents=true) walks up the scene graph to
      // incorporate GSAP-driven cubie rotations and TrackballControls camera
      // rotation that occurred this frame before our callback.
      groupRef.current.updateWorldMatrix(true, false);
      // Upload the world matrix only when it has actually changed since last frame.
      // At rest (no drag / GSAP turn / flip-squish) the recomputed matrix is
      // bit-identical, so this skips both the setMatrixAt buffer copy and the
      // whole-buffer instanceMatrix GPU re-upload that needsUpdate forces.
      const me = groupRef.current.matrixWorld.elements;
      const mbase = slot * 16;
      const lm = lastMatricesRef.current;
      let mChanged = false;
      for (let k = 0; k < 16; k++) {
        if (lm[mbase + k] !== me[k]) { mChanged = true; break; }
      }
      if (mChanged) {
        instanceMesh.setMatrixAt(slot, groupRef.current.matrixWorld);
        lm.set(me, mbase);
        matDirty = true;
      }

      // Upload the current colour only when it has changed since the last frame.
      // Comparing the raw r/g/b floats is cheaper than a setColorAt + GPU upload
      // every frame when colors are stable (which is the common case at rest).
      if (colorRef.current) {
        const base = slot * 3;
        const lc = lastColorsRef.current;
        const { r, g, b } = colorRef.current;
        if (lc[base] !== r || lc[base + 1] !== g || lc[base + 2] !== b) {
          instanceMesh.setColorAt(slot, colorRef.current);
          lc[base] = r;
          lc[base + 1] = g;
          lc[base + 2] = b;
          colDirty = true;
        }
      }
    }

    if (matDirty) instanceMesh.instanceMatrix.needsUpdate = true;
    if (colDirty && instanceMesh.instanceColor) instanceMesh.instanceColor.needsUpdate = true;
  });

  const ctx = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <StickerInstanceContext.Provider value={ctx}>
      {children}
    </StickerInstanceContext.Provider>
  );
}
