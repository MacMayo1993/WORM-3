// src/worm/ElementalCubeSkin.jsx
//
// The real elemental-orb effect: a semi-transparent layer of the element laid
// directly ON TOP of the cube, over whatever tile styles the faces already carry.
// When the worm claims a water orb the whole cube is sheathed in water and the
// worm reads as swimming through it; a grass orb sprouts blades from every face;
// lava wells up molten; ice sheathes it in frost.
//
// It reuses the exact per-sticker volume components the "Living" tile styles use
// (WaterVolume / LavaVolume / GrassBlades / IceVolume). Each renders in its
// sticker's local +Z frame (the outward face normal), the tile roughly filling
// local XY — so we place them across every face, oriented so local +Z points
// along that face's world normal, translucent enough that the tile style stays
// readable underneath.
//
// Density is capped, not the effect: up to a MAX_SKIN_GRID×MAX_SKIN_GRID grid of
// volumes per face. For cubes at or below that size that is exactly one volume
// per sticker (cellScale 1). For the bigger advertised modes (6×6, 7×7, 15×15)
// it coarsens to the same bounded ~6·grid² volumes, each scaled up to cover its
// cell so the whole cube is still sheathed — an optimized face-level fallback
// rather than dropping the effect. Cost is therefore constant in cube size.
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
import { FACE_NORMALS } from './healerWorm/constants.js';
import { getElementalDef } from './healerWorm/elementalDefs.js';
import { wormBuffs } from './wormBuffs.js';
import { readLiveTile } from './wormHelpers.js';
import GrassBlades from '../3d/styles/GrassBlades.jsx';
import { getElementalSurfaceGeo, getElementalSurfaceMaterial } from './ElementalSurface.jsx';

// Water / lava / ice are drawn as a continuous animated surface (ElementalSurface);
// grass keeps its dedicated blade mesh, which already sprouts convincingly.
const SURFACE_ELEMENTS = new Set(['water', 'lava', 'ice']);

const FADE_IN = 0.55;  // seconds for the layer to well up out of the faces
const FADE_OUT = 1.25; // matches ElementalAtmosphere — soften the end, no pop
// Cap on volumes-per-face-edge. At or below this the grid is one volume per real
// sticker; above it the face is covered by a coarser grid of scaled-up volumes,
// so total cost stays ~6·MAX_SKIN_GRID² regardless of cube size. 5 matches the
// point at which StickerPlane's own suppressVolumeFX stops per-sticker volumes.
const MAX_SKIN_GRID = 5;

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
const _liveQuat = new THREE.Quaternion();
const _restPos = new THREE.Vector3();

// Sampled cover cells for the element layer. Returns a gridN×gridN grid per face
// (gridN = min(size, MAX_SKIN_GRID)); each entry names a representative sticker in
// its cell (x/y/z/dirKey — used to read that cubie's LIVE transform each frame),
// a resting world position + orientation for before the meshes exist, and `cell`
// = how many stickers wide the cell is, so the volume can be scaled to cover it.
function surfaceStickers(size) {
  const gridN = Math.min(size, MAX_SKIN_GRID);
  const cell = size / gridN;                                   // 1 when gridN === size
  const sample = (j) => Math.min(size - 1, Math.floor((j + 0.5) * size / gridN));
  const out = [];
  for (const f of FACES) {
    for (let j = 0; j < gridN; j++) {
      for (let k = 0; k < gridN; k++) {
        const coord = { x: 0, y: 0, z: 0 };
        coord[f.fixed] = f.outer(size);
        coord[f.a] = sample(j);
        coord[f.b] = sample(k);
        const wp = getStickerWorldPos(coord.x, coord.y, coord.z, f.dk, size, 0);
        const n = FACE_NORMALS[f.dk] ?? FACE_NORMALS.PZ;
        const restQuat = new THREE.Quaternion().setFromUnitVectors(_zAxis, n);
        out.push({
          key: `${f.dk}-${j}-${k}`,
          x: coord.x, y: coord.y, z: coord.z, dirKey: f.dk,
          restPos: [wp[0], wp[1], wp[2]], restQuat, cell
        });
      }
    }
  }
  return out;
}

export default function ElementalCubeSkin({ size = 3 }) {
  const element = useGameStore((s) => s.wormElementalTheme);
  const def = element ? getElementalDef(element) : null;
  const isSurface = !!def && SURFACE_ELEMENTS.has(element);
  // Shared geometry + material for the surface elements — every tile references
  // the same pair, so the whole layer is a few GPU objects regardless of count.
  const surfaceGeo = useMemo(() => (isSurface ? getElementalSurfaceGeo() : null), [isSurface]);
  const surfaceMat = useMemo(
    () => (isSurface ? getElementalSurfaceMaterial(element, def.color, def.accent) : null),
    [isSurface, element, def]
  );

  // One ref per cell to the outer group. The frame loop drives its full transform
  // so the layer rides the live cubie meshes (mid-rotation slices included) rather
  // than sitting on the stationary rest grid.
  const tileRefs = useRef([]);
  const fadeRef = useRef(0);
  const lastElementRef = useRef(null);
  if (lastElementRef.current !== element) {
    lastElementRef.current = element;
    fadeRef.current = 0;
    tileRefs.current = [];
  }

  const stickers = useMemo(
    () => (def ? surfaceStickers(size) : []),
    [def, size]
  );

  useFrame((_, delta) => {
    if (!def) return;
    fadeRef.current = Math.min(1, fadeRef.current + delta / FADE_IN);
    // Ramp back down over the buff's final second so the layer sinks away instead
    // of vanishing. wormBuffs mirrors the sim clock, so it freezes on pause/tunnel.
    const remaining = Math.min(1, wormBuffs.elementalT / FADE_OUT);
    const f = Math.min(fadeRef.current, remaining);
    // Uniform grow drives BOTH coverage and thickness, so the layer visibly wells
    // up from nothing and shrinks away — changing scale.z alone would leave the top
    // plane at full size and full shader alpha the whole time, never fading. Floor
    // keeps a sliver so a zero-scale matrix never produces NaN normals.
    const g = Math.max(0.01, f * f * (3 - 2 * f));

    const refs = tileRefs.current;
    for (let i = 0; i < refs.length; i++) {
      const grp = refs[i];
      const s = stickers[i];
      if (!grp || !s) continue;
      // Follow the live cubie transform (rides a turning slice); fall back to the
      // rest grid before the meshes exist.
      if (readLiveTile(s, _livePos, _liveNorm)) {
        grp.position.copy(_livePos);
        _liveQuat.setFromUnitVectors(_zAxis, _liveNorm);
        grp.quaternion.copy(_liveQuat);
      } else {
        grp.position.copy(_restPos.fromArray(s.restPos));
        grp.quaternion.copy(s.restQuat);
      }
      grp.scale.set(s.cell * g, s.cell * g, g);
    }
  });

  if (!def || stickers.length === 0) return null;

  return (
    <group>
      {stickers.map((s, i) => (
        // Transform (position/quaternion/scale) is set entirely in the frame loop;
        // the rest values here just avoid a one-frame flash at the origin.
        <group
          key={s.key}
          ref={(el) => { tileRefs.current[i] = el; }}
          position={s.restPos}
          quaternion={s.restQuat}
          scale={[s.cell * 0.01, s.cell * 0.01, 0.01]}
        >
          {isSurface ? (
            // Continuous animated element surface, lifted just off the sticker.
            <mesh geometry={surfaceGeo} material={surfaceMat} position={[0, 0, 0.03]} raycast={() => null} />
          ) : (
            <GrassBlades faceColor={def.color} />
          )}
        </group>
      ))}
    </group>
  );
}
