// src/worm/ElementalCubeSkin.jsx
//
// The real elemental-orb effect: the element laid directly ON the cube, over
// whatever tile styles the faces already carry. Claim water and the cube sits inside
// a rounded shell of moving water; fire burns out of every seam and crowns the
// edges; nature grows a terrarium through the grout; ice encases the cube in a
// carved glacier shell; lightning turns the seams into live circuitry.
//
// ── What this file owns ──────────────────────────────────────────────────────
// One thing: driving every cover cell's transform, once per frame, for whichever
// element is active. The rest is looked up, so adding an element adds no branch:
//
//   • WHICH renderer draws it → elementalRenderers.js + the SKINS table below
//   • HOW MUCH to draw        → elementalQuality.js (grid density, flame counts)
//   • HOW FAR through the wash → elementalLifecycle.js (the one fade envelope,
//     shared with the fill light and the particle field)
//   • WHERE each cell ends    → elementalCells.js (exact world-unit extents)
//
// ── Density and cost ─────────────────────────────────────────────────────────
// Up to a grid×grid set of cover cells per face, where grid comes from the quality
// tier. At or below that size it is one cell per sticker; for the big boards a cell
// stands in for a patch of stickers, and its shader redraws the per-sticker seams
// inside it from the world-unit lattice. Cost is constant in cube size, and every
// skin draws the whole cube as one InstancedMesh (one draw call per material layer).
//
// ── The transform ────────────────────────────────────────────────────────────
// Each cell rides its representative sticker's LIVE cubie: position, normal AND
// roll. The roll matters now that skins anchor detail to specific seams and cube
// edges — a frame rebuilt from the normal alone (a shortest-arc rotation) twists
// about the normal during some slice turns, which would spin a cell's edge crown or
// seam flames round its middle while the slice moved. Composing the cubie's own
// rotation with the rest orientation turns the whole frame rigidly with the slice.
//
// The matrix is always unit scale. Cell size arrives as world-unit extents (an
// instanced attribute), and every claim/expiry ramp happens in the shaders off the
// shared envelope — squashing the matrix to fade a layer used to open square holes
// between cells, and could not express a sweep that travels across the cube.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { isMobile, prefersReducedMotion } from '../utils/device.js';
import { getElementalDef } from './healerWorm/elementalDefs.js';
import { resolveElementalRenderer } from './healerWorm/elementalRenderers.js';
import { resolveElementalQuality } from './healerWorm/elementalQuality.js';
import { elementalEnvelope } from './healerWorm/elementalLifecycle.js';
import { cellEdgeMask, cellSeed, cellSweepDelay, resolveSweepOrigin } from './healerWorm/elementalSeeds.js';
import { buildElementalCells } from './healerWorm/elementalCells.js';
import { wormBuffs } from './wormBuffs.js';
import { readLiveTile } from './wormHelpers.js';
import { publishWormUniforms, uClaimOrigin, uCubeHalf } from './healerWorm/elementalUniforms.js';
import { getWormStickerWorldPos } from './wormExpansion.js';
import ElementalGrassSkin from './ElementalGrassSkin.jsx';
import ElementalFireSkin from './ElementalFireSkin.jsx';
import { ElementalSurfaceSkin } from './ElementalSurface.jsx';

// Renderer key → component. A lookup, like the registry it mirrors.
const SKINS = {
  surface: ElementalSurfaceSkin,
  flames: ElementalFireSkin,
  blades: ElementalGrassSkin
};

const _zAxis = new THREE.Vector3(0, 0, 1);
const _unit = new THREE.Vector3(1, 1, 1);
// Frame-loop scratch — no per-frame allocation.
const _livePos = new THREE.Vector3();
const _liveNorm = new THREE.Vector3();
const _liveQuat = new THREE.Quaternion();
const _quat = new THREE.Quaternion();
const _fix = new THREE.Quaternion();
const _zWorld = new THREE.Vector3();
const _matrix = new THREE.Matrix4();

/**
 * Fill each cell's share of the claim sweep, so the element travels outward from
 * the tile the orb was taken on instead of appearing on all six faces at once.
 *
 * The origin arrives as a sticker (x/y/z/dirKey), which is not a cover cell: above
 * the grid cap several stickers share one cell. It is resolved to the cell on the
 * same face whose representative sticker is nearest, so the sweep still starts
 * under the worm on a 15×15.
 *
 * With no origin — a wash restored mid-session, or a claim the sim never recorded —
 * every delay is 0 and the whole cube arrives together.
 */
function writeSweep(cells, out, origin) {
  if (!origin) {
    out.fill(0);
    return;
  }
  const best = resolveSweepOrigin(cells, origin);
  for (let i = 0; i < cells.length; i++) {
    out[i] = cellSweepDelay(cells[i], best, cells[i].gridN);
  }
}

/**
 * Per-instance data the shaders read: where each cell sits on its face (rim, edge,
 * corner, seed), exactly how far it reaches (extent), which of its borders are the
 * cube's silhouette (edge), and its share of the claim sweep.
 */
function buildCellData(cells) {
  const n = cells.length;
  const cell = new Float32Array(n * 4);
  const extent = new Float32Array(n * 4);
  const edges = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    const m = cellEdgeMask(c.j, c.k, c.gridN);
    cell[i * 4] = m.rim;
    cell[i * 4 + 1] = m.edge;
    cell[i * 4 + 2] = m.corner;
    cell[i * 4 + 3] = cellSeed(c.faceKey, c.j, c.k, c.gridN);
    extent.set(c.extent, i * 4);
    edges.set(c.edge, i * 4);
  }
  return { cell, extent, edges, sweep: new Float32Array(n) };
}

export default function ElementalCubeSkin({ size = 3 }) {
  const element = useGameStore((s) => s.wormElementalTheme);
  const def = element ? getElementalDef(element) : null;
  // An unknown element resolves to null and the skin draws nothing rather than
  // silently borrowing another element's look.
  const renderer = useMemo(() => resolveElementalRenderer(element, getElementalDef), [element]);
  const Skin = renderer ? SKINS[renderer.key] ?? null : null;

  // Device budget. Read once per mount: the tier only depends on facts that do not
  // change mid-session, and re-resolving it per frame would churn the cell memo.
  const quality = useMemo(
    () => resolveElementalQuality({ mobile: isMobile, reducedMotion: prefersReducedMotion(), cubeSize: size }),
    [size]
  );

  const cells = useMemo(() => (Skin ? buildElementalCells(size, quality.skinGrid) : []), [Skin, size, quality.skinGrid]);
  const cellData = useMemo(() => buildCellData(cells), [cells]);

  // Every skin writes one matrix per cover cell into its single instanced mesh.
  const instRef = useRef(null);
  const elapsedRef = useRef(0);
  const lastElementRef = useRef(null);
  const lastOriginRef = useRef(undefined);
  if (lastElementRef.current !== element) {
    lastElementRef.current = element;
    elapsedRef.current = 0;
    instRef.current = null;
    lastOriginRef.current = undefined;
  }

  useFrame((_, delta) => {
    if (!Skin) return;
    if (useGameStore.getState().wormPaused) return;
    if (lastOriginRef.current !== wormBuffs.elementalOrigin) elapsedRef.current = 0;
    elapsedRef.current += Math.min(delta, 0.1);
    // One envelope, shared with the fill light and the particles. wormBuffs mirrors
    // the sim clock, so it freezes on pause and during tunnel transit.
    const env = elementalEnvelope({ element, elapsed: elapsedRef.current, remaining: wormBuffs.elementalT });

    // The claim sweep's starting point. The sim snapshots the tile the orb was
    // taken on and never mutates it, so an identity check is enough to notice a new
    // claim — this recomputes once per wash, not per frame.
    if (lastOriginRef.current !== wormBuffs.elementalOrigin) {
      lastOriginRef.current = wormBuffs.elementalOrigin;
      // Under reduced motion nothing travels across the cube: every cell arrives
      // together, as one uniform fade and grow, instead of a front sweeping out
      // from the claimed tile.
      const origin = quality.animate ? wormBuffs.elementalOrigin : null;
      writeSweep(cells, cellData.sweep, origin);
      const attr = instRef.current?.geometry?.getAttribute?.('aSweep');
      if (attr) attr.needsUpdate = true;
      // The same origin as a world point, for the shell skins' continuous flood.
      if (origin) {
        const wp = getWormStickerWorldPos(origin.x, origin.y, origin.z, origin.dirKey, size, 0);
        uClaimOrigin.value.set(wp[0], wp[1], wp[2], 1);
      } else {
        uClaimOrigin.value.set(0, 0, 0, 0);
      }
    }
    uCubeHalf.value = size / 2;

    // An InstancedMesh's capacity is fixed at construction. During the frame an
    // element swap or a size change commits, the ref can still hold the outgoing
    // mesh, so match on capacity before writing into it — a stale one is skipped
    // for a frame rather than throwing out of range mid-loop.
    const inst = instRef.current?.count === cells.length ? instRef.current : null;
    if (!inst) return;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (readLiveTile(c, _livePos, _liveNorm, _liveQuat)) {
        // The cubie's rigid turn applied to the rest frame: the cell rolls exactly
        // as its slice does.
        _quat.copy(_liveQuat).multiply(c.restQuat);
        // Keep +Z pinned to the live normal. They agree whenever the mesh is the
        // source of both, so this is normally a no-op; it only corrects a reading
        // that disagrees (a mesh mid-update), by the smallest rotation that does.
        _zWorld.copy(_zAxis).applyQuaternion(_quat);
        if (_zWorld.dot(_liveNorm) < 0.99999) {
          _fix.setFromUnitVectors(_zWorld, _liveNorm);
          _quat.premultiply(_fix);
        }
      } else {
        // Before the meshes exist: the stationary rest grid.
        _livePos.fromArray(c.restPos);
        _quat.copy(c.restQuat);
      }
      _matrix.compose(_livePos, _quat, _unit);
      inst.setMatrixAt(i, _matrix);
    }
    inst.instanceMatrix.needsUpdate = true;

    // One set of uniform writes carries the envelope, the worm and the wash clock
    // to every layer of the skin; no per-instance work is needed for any of them.
    // The worm uniforms are shared objects, so one publish reaches every material;
    // reduced motion switches every proximity response off with them.
    publishWormUniforms(quality.animate);
    const mats = Array.isArray(inst.material) ? inst.material : [inst.material];
    for (let m = 0; m < mats.length; m++) {
      const u = mats[m]?.uniforms;
      if (!u) continue;
      if (u.uEnv) u.uEnv.value.set(env.intensity, env.claim, env.release, quality.animate ? 1 : 0);
      if (u.uElapsed) u.uElapsed.value = quality.animate ? elapsedRef.current : 0;
    }
  });

  if (!Skin || cells.length === 0) return null;

  return (
    <Skin
      // Keyed on everything that changes the instance count or the geometry: an
      // InstancedMesh's capacity is fixed at construction, so a size change has to
      // build a new one rather than resize.
      key={`${element}-${cells.length}-${quality.tier}-${quality.animate ? 1 : 0}`}
      meshRef={instRef}
      element={element}
      color={def.color}
      accent={def.accent}
      count={cells.length}
      cellData={cellData}
      quality={quality}
    />
  );
}
