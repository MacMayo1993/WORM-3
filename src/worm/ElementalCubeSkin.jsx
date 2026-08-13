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
// local XY — so we simply place one at every surface sticker, oriented so local
// +Z points along that face's world normal, and the layer floats just above the
// existing sticker, translucent enough that the tile style stays readable.
//
// The surface-position set is fixed for a given cube size and the layer colour is
// uniform across faces, so the whole skin is static geometry — it never depends
// on `cubies`, never churns on a move, and looks identical whether a slice is
// mid-turn or not (uniform coverage). Memoised on size+element accordingly.

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
// Above this cube size the per-sticker volumes are a performance risk (6·size²
// translucent volumes), mirroring StickerPlane's own suppressVolumeFX cap.
const MAX_SKIN_SIZE = 5;

const DIRS = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
const _zAxis = new THREE.Vector3(0, 0, 1);

// Every outward-facing sticker position for a cube of this size.
function surfaceStickers(size) {
  const out = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        for (const dk of DIRS) {
          const visible =
            (dk === 'PX' && x === size - 1) || (dk === 'NX' && x === 0) ||
            (dk === 'PY' && y === size - 1) || (dk === 'NY' && y === 0) ||
            (dk === 'PZ' && z === size - 1) || (dk === 'NZ' && z === 0);
          if (!visible) continue;
          const wp = getStickerWorldPos(x, y, z, dk, size, 0);
          const n = FACE_NORMALS[dk] ?? FACE_NORMALS.PZ;
          const quat = new THREE.Quaternion().setFromUnitVectors(_zAxis, n);
          out.push({ key: `${x},${y},${z},${dk}`, pos: [wp[0], wp[1], wp[2]], quat });
        }
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
    () => (def && size <= MAX_SKIN_SIZE ? surfaceStickers(size) : []),
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
          <group ref={(el) => { growRefs.current[i] = el; }}>
            <Volume faceColor={def.color} />
          </group>
        </group>
      ))}
    </group>
  );
}
