// src/worm/ElementalCubeSkin.jsx
//
// The real elemental-orb effect: a semi-transparent layer of the element laid
// directly ON TOP of the cube, over whatever tile styles the faces already carry.
// When the worm claims a water orb the whole cube is sheathed in water and the
// worm reads as swimming through it; a grass orb sprouts blades from every face;
// fire licks up off every sticker; ice sheathes it in frost.
//
// Each element brings its own layer, all of them rendered in a cell's local +Z
// frame (the outward face normal, the tile roughly filling local XY): water and
// ice are a continuous animated surface (ElementalSurface), nature keeps the
// Living style's GrassBlades, and fire burns with the bombs' own flame sprites
// (ElementalFireSkin). All are translucent or additive, so the tile style stays
// readable underneath.
//
// ── What this file owns ──────────────────────────────────────────────────────
// One thing: driving every cover cell's transform, once per frame, for whichever
// element is active. Three decisions it used to make inline now come from shared
// modules, so adding an element does not add another branch here:
//
//   • WHICH renderer draws it → elementalRenderers.js (a lookup, not an if/set)
//   • HOW MUCH to draw        → elementalQuality.js (grid density, flame counts)
//   • HOW FAR through the wash → elementalLifecycle.js (the one fade envelope,
//     shared with the fill light and the particle field so they can no longer
//     disagree about when the element arrives and leaves)
//
// ── Density and cost ─────────────────────────────────────────────────────────
// Density is capped, not the effect: up to a grid×grid grid of cover cells per
// face, where grid comes from the quality tier (5 on desktop — unchanged — down to
// 3 on phones and under reduced motion). For cubes at or below that size that is
// exactly one volume per sticker (cellScale 1). For the bigger advertised modes
// (6×6, 7×7, 15×15) it coarsens to the same bounded ~6·grid² volumes, each scaled
// up to cover its cell so the whole cube is still sheathed — an optimized
// face-level fallback rather than dropping the effect. Cost is constant in cube
// size.
//
// Beyond that, the cells of an instanced renderer are one InstancedMesh: water,
// ice and fire each draw the entire sheathed cube in a SINGLE draw call, where fire
// alone used to cost ~900 (six sprites per cell) plus a per-cell frame callback.
// The loop below is the only per-frame CPU work any element does.
//
// The layer colour is uniform across faces and the sampled cells are fixed for a
// given size, so the geometry itself never churns on a move (memoised on
// size+element). Each cell's transform is driven every frame from its live cubie
// mesh, so the layer rides a turning slice with the tiles instead of hanging on
// the stationary rest grid; it falls back to the rest grid before the meshes
// exist. The claim/expiry fade is a uniform scale ramp (coverage + thickness),
// since scaling thickness alone would leave the top plane at full size and alpha.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { isMobile, prefersReducedMotion } from '../utils/device.js';
import { FACE_NORMALS } from './healerWorm/constants.js';
import { getElementalDef } from './healerWorm/elementalDefs.js';
import { resolveElementalRenderer } from './healerWorm/elementalRenderers.js';
import { resolveElementalQuality } from './healerWorm/elementalQuality.js';
import { elementalEnvelope } from './healerWorm/elementalLifecycle.js';
import { cellEdgeMask, cellSeed, cellSweepDelay, resolveSweepOrigin } from './healerWorm/elementalSeeds.js';
import { wormBuffs } from './wormBuffs.js';
import { readLiveTile } from './wormHelpers.js';
import GrassBlades from '../3d/styles/GrassBlades.jsx';
import ElementalFireSkin from './ElementalFireSkin.jsx';
import { ElementalSurfaceSkin } from './ElementalSurface.jsx';

// Per-face definition: the fixed axis pinned to the outer layer, plus the two
// in-plane axes the grid varies over.
const FACES = [
  { dk: 'PX', fixed: 'x', outer: (n) => n - 1, a: 'y', b: 'z' },
  { dk: 'NX', fixed: 'x', outer: () => 0, a: 'y', b: 'z' },
  { dk: 'PY', fixed: 'y', outer: (n) => n - 1, a: 'x', b: 'z' },
  { dk: 'NY', fixed: 'y', outer: () => 0, a: 'x', b: 'z' },
  { dk: 'PZ', fixed: 'z', outer: (n) => n - 1, a: 'x', b: 'y' },
  { dk: 'NZ', fixed: 'z', outer: () => 0, a: 'x', b: 'y' }
];
const _zAxis = new THREE.Vector3(0, 0, 1);
// Frame-loop scratch — no per-frame allocation.
const _livePos = new THREE.Vector3();
const _liveNorm = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();

// Sampled cover cells for the element layer. Returns a gridN×gridN grid per face
// (gridN = min(size, quality grid cap)); each entry names a representative sticker
// in its cell (x/y/z/dirKey — used to read that cubie's LIVE transform each frame),
// a resting world position + orientation for before the meshes exist, and `cell`
// = how many stickers wide the cell is, so the volume can be scaled to cover it.
function surfaceStickers(size, maxGrid) {
  const gridN = Math.min(size, maxGrid);
  const sample = (j) => Math.min(size - 1, Math.floor((j + 0.5) * size / gridN));
  // The sampled sticker index for each grid line, plus the width (in sticker
  // units) each coarse cell must span to reach the midpoints toward its
  // neighbours. floor() sampling clusters unevenly for sizes that do not divide
  // by gridN (6–9), so a single fixed size/gridN width leaves whole rows bare —
  // e.g. on a 7×7 it samples {0,2,3,4,6} at width 1.4, and rows 1 and 5 fall in
  // the gaps. Sizing each cell from its own neighbour spacing tiles the face with
  // no gaps; the resulting overlaps are thin and harmless (the surface layer is
  // depthWrite:false and world-sampled, grass just reads denser). At/below the
  // cap every span is 1, exactly one volume per sticker, unchanged.
  const idx = [];
  for (let j = 0; j < gridN; j++) idx.push(sample(j));
  const span = idx.map((p, j) => {
    const halfLeft = j === 0 ? p + 0.5 : (p - idx[j - 1]) / 2;
    const halfRight = j === gridN - 1 ? (size - 1 - p) + 0.5 : (idx[j + 1] - p) / 2;
    return 2 * Math.max(halfLeft, halfRight);
  });
  const out = [];
  for (const f of FACES) {
    for (let j = 0; j < gridN; j++) {
      for (let k = 0; k < gridN; k++) {
        const coord = { x: 0, y: 0, z: 0 };
        coord[f.fixed] = f.outer(size);
        coord[f.a] = idx[j];
        coord[f.b] = idx[k];
        const wp = getStickerWorldPos(coord.x, coord.y, coord.z, f.dk, size, 0);
        const n = FACE_NORMALS[f.dk] ?? FACE_NORMALS.PZ;
        const restQuat = new THREE.Quaternion().setFromUnitVectors(_zAxis, n);
        // Uniform per-cell scale (the larger of the two in-plane spans): the
        // z→normal quaternion carries an arbitrary in-plane roll, so a single
        // scale that covers the wider axis stays gap-free however local X/Y land.
        const cell = Math.max(span[j], span[k]);
        out.push({
          key: `${f.dk}-${j}-${k}`,
          faceKey: f.dk, j, k, gridN,
          x: coord.x, y: coord.y, z: coord.z, dirKey: f.dk,
          restPos: [wp[0], wp[1], wp[2]], restQuat, cell
        });
      }
    }
  }
  return out;
}

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
 * every delay is 0 and the whole cube arrives together, which is the old behaviour.
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

export default function ElementalCubeSkin({ size = 3 }) {
  const element = useGameStore((s) => s.wormElementalTheme);
  const def = element ? getElementalDef(element) : null;
  // A lookup, not a branch. An unknown element resolves to null and the skin draws
  // nothing rather than silently borrowing another element's look.
  const renderer = useMemo(() => resolveElementalRenderer(element, getElementalDef), [element]);

  // Device budget. Read once per mount: the tier only depends on facts that do not
  // change mid-session, and re-resolving it per frame would churn the cell memo.
  const quality = useMemo(
    () => resolveElementalQuality({ mobile: isMobile, reducedMotion: prefersReducedMotion(), cubeSize: size }),
    [size]
  );

  const isSurface = renderer?.key === 'surface';
  const isFire = renderer?.key === 'flames';

  const cells = useMemo(
    () => (renderer ? surfaceStickers(size, quality.skinGrid) : []),
    [renderer, size, quality.skinGrid]
  );

  // Per-instance cube-scale data, the thing that lets one flat quad know it is part
  // of a cube: where the cell sits (rim / edge / corner), its stable seed, and its
  // share of the claim sweep. `cell` is fixed for a given board; `sweep` is rewritten
  // once per claim, when the origin tile arrives.
  const cellData = useMemo(() => {
    const cell = new Float32Array(cells.length * 4);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const m = cellEdgeMask(c.j, c.k, c.gridN);
      cell[i * 4] = m.rim;
      cell[i * 4 + 1] = m.edge;
      cell[i * 4 + 2] = m.corner;
      cell[i * 4 + 3] = cellSeed(c.faceKey, c.j, c.k, c.gridN);
    }
    return { cell, sweep: new Float32Array(cells.length) };
  }, [cells]);

  // Instanced renderers write through instanceMatrix; the per-cell fallback writes
  // group transforms. Only one of the two is ever populated.
  const instRef = useRef(null);
  const groupRefs = useRef([]);
  const elapsedRef = useRef(0);
  const lastElementRef = useRef(null);
  const lastOriginRef = useRef(undefined);
  if (lastElementRef.current !== element) {
    lastElementRef.current = element;
    elapsedRef.current = 0;
    groupRefs.current = [];
    instRef.current = null;
    lastOriginRef.current = undefined;
  }

  useFrame((_, delta) => {
    if (!renderer) return;
    elapsedRef.current += delta;
    // One envelope, shared with the fill light and the particles. wormBuffs mirrors
    // the sim clock, so it freezes on pause and during tunnel transit.
    const env = elementalEnvelope({ elapsed: elapsedRef.current, remaining: wormBuffs.elementalT });
    // Uniform grow drives BOTH coverage and thickness, so the layer visibly wells
    // up from nothing and shrinks away — changing scale.z alone would leave the top
    // plane at full size and full shader alpha the whole time, never fading.
    const g = env.grow;

    // The claim sweep's starting point. The sim snapshots the tile the orb was
    // taken on and never mutates it, so an identity check is enough to notice a new
    // claim — this recomputes once per wash, not per frame.
    if (lastOriginRef.current !== wormBuffs.elementalOrigin) {
      lastOriginRef.current = wormBuffs.elementalOrigin;
      writeSweep(cells, cellData.sweep, wormBuffs.elementalOrigin);
      const geo = instRef.current?.geometry;
      const attr = geo?.getAttribute?.('aSweep');
      if (attr) attr.needsUpdate = true;
    }

    // An InstancedMesh's capacity is fixed at construction. During the frame an
    // element swap or a size change commits, the ref can still hold the outgoing
    // mesh, so match on capacity before writing into it — a stale one is skipped
    // for a frame rather than throwing out of range mid-loop.
    const inst = instRef.current?.count === cells.length ? instRef.current : null;
    const groups = groupRefs.current;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      // Follow the live cubie transform (rides a turning slice); fall back to the
      // rest grid before the meshes exist.
      if (readLiveTile(c, _livePos, _liveNorm)) {
        _quat.setFromUnitVectors(_zAxis, _liveNorm);
      } else {
        _livePos.fromArray(c.restPos);
        _quat.copy(c.restQuat);
      }
      // Billboarded renderers take their on-screen size from world scale, so the
      // surface layers' squashed (cell, cell, grow) scale would distort them; they
      // get a uniform scale that still carries both cell size and the ramp.
      if (renderer.uniformScale) _scale.setScalar(c.cell * g);
      else _scale.set(c.cell * g, c.cell * g, g);

      if (inst) {
        _matrix.compose(_livePos, _quat, _scale);
        inst.setMatrixAt(i, _matrix);
      } else {
        const grp = groups[i];
        if (!grp) continue;
        grp.position.copy(_livePos);
        grp.quaternion.copy(_quat);
        grp.scale.copy(_scale);
      }
    }
    if (inst) {
      inst.instanceMatrix.needsUpdate = true;
      // One uniform write per frame carries the whole envelope to both shaders —
      // they read it to gate the sweep and the dissolve, so no per-instance work is
      // needed for either.
      const u = inst.material?.uniforms?.uEnv;
      if (u) u.value.set(env.intensity, env.claim, env.release, 0);
    }
  });

  if (!renderer || cells.length === 0) return null;

  if (isSurface) {
    return (
      // Keyed on the instance count: an InstancedMesh's capacity is fixed at
      // construction, so a size change has to build a new one rather than resize.
      <ElementalSurfaceSkin
        key={`${element}-${cells.length}`}
        meshRef={instRef}
        element={element}
        color={def.color}
        accent={def.accent}
        count={cells.length}
        cellData={cellData}
      />
    );
  }

  if (isFire) {
    return (
      <ElementalFireSkin
        key={`fire-${cells.length}-${quality.flamesPerCell}`}
        meshRef={instRef}
        count={cells.length}
        flamesPerCell={quality.flamesPerCell}
        cellData={cellData}
      />
    );
  }

  // Per-cell fallback: nature's blade mesh still owns a real child per cell.
  return (
    <group>
      {cells.map((c, i) => (
        // Transform (position/quaternion/scale) is set entirely in the frame loop;
        // the rest values here just avoid a one-frame flash at the origin.
        <group
          key={c.key}
          ref={(el) => { groupRefs.current[i] = el; }}
          position={c.restPos}
          quaternion={c.restQuat}
          scale={[c.cell * 0.01, c.cell * 0.01, 0.01]}
        >
          <GrassBlades faceColor={def.color} />
        </group>
      ))}
    </group>
  );
}
