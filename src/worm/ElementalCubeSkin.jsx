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
// The layer colour is uniform across faces and the sampled positions are fixed
// for a given size, so the whole skin is static geometry — it never depends on
// `cubies`, never churns on a move, and looks identical whether a slice is
// mid-turn or not. Memoised on size+element accordingly.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { FACE_NORMALS } from './healerWorm/constants.js';
import { getElementalDef } from './healerWorm/elementalDefs.js';
import { wormBuffs } from './wormBuffs.js';
import WaterVolume from '../3d/styles/WaterVolume.jsx';
import LavaVolume from '../3d/styles/LavaVolume.jsx';
import GrassBlades from '../3d/styles/GrassBlades.jsx';
import IceVolume from '../3d/styles/IceVolume.jsx';

// Which volume component skins the cube for each element.
const ELEMENT_VOLUME = {
  water: WaterVolume,
  lava: LavaVolume,
  grass: GrassBlades,
  ice: IceVolume
};

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

// Sampled cover positions for the element layer. Returns a gridN×gridN grid per
// face (gridN = min(size, MAX_SKIN_GRID)); each entry carries the world position
// of a representative sticker in its cell and `cell` = how many stickers wide the
// cell is, so the volume there can be scaled to cover it.
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
        const quat = new THREE.Quaternion().setFromUnitVectors(_zAxis, n);
        out.push({ key: `${f.dk}-${j}-${k}`, pos: [wp[0], wp[1], wp[2]], quat, cell });
      }
    }
  }
  return out;
}

export default function ElementalCubeSkin({ size = 3 }) {
  const element = useGameStore((s) => s.wormElementalTheme);
  const def = element ? getElementalDef(element) : null;
  const Volume = element ? ELEMENT_VOLUME[element] : null;

  // Collected refs to each sticker's inner (pre-orientation) group. Scaling their
  // local Z grows the layer straight out of the face — water rises, grass sprouts.
  const growRefs = useRef([]);
  const fadeRef = useRef(0);
  const lastElementRef = useRef(null);
  if (lastElementRef.current !== element) {
    lastElementRef.current = element;
    fadeRef.current = 0;
    growRefs.current = [];
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
    // Ease so it wells up smoothly. Keep a sliver of thickness so it never fully
    // flattens into z-fighting with the tile while still visible.
    const grow = 0.04 + 0.96 * f * f * (3 - 2 * f);
    const refs = growRefs.current;
    for (let i = 0; i < refs.length; i++) {
      if (refs[i]) refs[i].scale.z = grow;
    }
  });

  if (!def || !Volume || stickers.length === 0) return null;

  return (
    <group>
      {stickers.map((s, i) => (
        <group key={s.key} position={s.pos} quaternion={s.quat}>
          {/* In-plane scale (x,y) covers the cell on big cubes; the frame loop
              drives only z, so the layer wells up without disturbing coverage. */}
          <group ref={(el) => { growRefs.current[i] = el; }} scale={[s.cell, s.cell, 0.04]}>
            <Volume faceColor={def.color} />
          </group>
        </group>
      ))}
    </group>
  );
}
