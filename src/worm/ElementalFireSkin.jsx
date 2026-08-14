// src/worm/ElementalFireSkin.jsx
//
// The FIRE element's cube skin: the cube is actually on fire, using the exact
// flame the bombs use.
//
// It replaces a shader "lava" surface that drew molten runoff across each sticker.
// On a flat, brightly-patterned tile that read as orange squiggles — you could not
// tell it was meant to be lava at all. Fire is legible for the same reason the
// bomb detonations are: teardrop flame sprites, white-hot at the base, flickering
// and licking upward off the surface.
//
// Each of ElementalCubeSkin's cover cells carries FLAMES_PER_CELL sprites. They are
// children of the cell group, so they ride the live cubie transform with everything
// else in the skin; only their scale and lift are animated here, and every one of
// them shares a single material and the bombs' FLAME_TEX, so the whole burning cube
// costs one texture and one material no matter how many cells the board has.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FLAME_TEX } from './healerWorm/HealerBombs.jsx';
import { getSoftGlowTexture } from './healerWorm/elementalBadge.jsx';

const FLAMES_PER_CELL = 5;
// Flame footprint inside a 1×1 cell. Several small tongues per cell read as a
// burning surface; two big ones read as a candle sitting on the sticker.
const FLAME_W = 0.26;
const FLAME_H = 0.45;
// The sprite grows UP from its anchor rather than being centred on it, and the
// anchors sit along the low edge of the cell, so the fire licks up off the tile
// instead of floating over the middle of it.
const FLAME_CENTER = [0.5, 0.06];

// One shared material for every flame on the cube. Additive over the tile so the
// sticker colour and any special markings stay readable through the fire.
let _emberMat = null;
/**
 * The hot bed under the tongues. Without it each cell reads as a few discrete
 * flames sitting ON a tile; with it the tile itself looks like it is burning.
 */
function getEmberMaterial() {
  if (!_emberMat) {
    _emberMat = new THREE.SpriteMaterial({
      map: getSoftGlowTexture(),
      color: '#ff4a08',
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
  }
  return _emberMat;
}

let _fireMat = null;
function getFireMaterial() {
  if (!_fireMat) {
    _fireMat = new THREE.SpriteMaterial({
      map: FLAME_TEX,
      // The texture is white-hot at its base — sized for a bomb against a dark
      // scene. Additive over a bright sticker that clips straight to white, so
      // the flame is tinted warm and kept well under full opacity.
      color: '#ff5a12',
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
  }
  return _fireMat;
}

/**
 * The flames for ONE cover cell, in the cell's local frame (+Z is the outward
 * face normal, the tile roughly filling local XY).
 *
 * The claim/expiry ramp needs no wiring here: ElementalCubeSkin already scales the
 * cell group by it, and a sprite's on-screen size comes from its world scale, so
 * the fire wells up and dies down with the rest of the layer for free.
 */
export default function ElementalFireSkin({ seed = 0 }) {
  const spriteRefs = useRef([]);

  // Fixed per-flame jitter, derived from the cell's index so a given cell always
  // burns the same way (no reshuffling when the layer re-renders) while adjacent
  // cells stay out of phase with each other.
  const flames = useMemo(
    () =>
      Array.from({ length: FLAMES_PER_CELL }, (_, i) => {
        const h = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453;
        const r1 = h - Math.floor(h);
        const h2 = Math.sin((seed + 1) * 39.3468 + i * 11.135) * 24634.6345;
        const r2 = h2 - Math.floor(h2);
        return {
          x: (r1 - 0.5) * 0.78,
          y: -0.42 + r2 * 0.3,
          phase: (r1 + r2) * Math.PI * 2,
          rate: 7.5 + r2 * 6.5,
          scale: 0.55 + r2 * 0.75,
          sway: 0.04 + r2 * 0.05
        };
      }),
    [seed]
  );

  const emberRef = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < flames.length; i++) {
      const sp = spriteRefs.current[i];
      if (!sp) continue;
      const f = flames[i];
      const flick = 0.72 + 0.5 * Math.sin(t * f.rate + f.phase);
      sp.scale.set(FLAME_W * f.scale * (0.85 + 0.25 * flick), FLAME_H * f.scale * (0.8 + 0.45 * flick), 1);
      // Wander sideways as well as flickering — a tongue that only pulses in
      // place reads as a candle, not as fire moving over a surface.
      sp.position.x = f.x + Math.sin(t * f.rate * 0.32 + f.phase) * f.sway;
      // Lift off the surface with the flicker so the tongues look like they are
      // licking up rather than pinned flat to the sticker.
      sp.position.z = 0.12 + 0.07 * flick;
    }
    if (emberRef.current) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 3.1 + seed);
      emberRef.current.scale.set(0.95 * pulse, 0.62 * pulse, 1);
    }
  });

  const material = getFireMaterial();

  return (
    <group>
      <sprite ref={emberRef} material={getEmberMaterial()} position={[0, -0.12, 0.06]} scale={[0.95, 0.62, 1]} />
      {flames.map((f, i) => (
        <sprite
          key={i}
          material={material}
          center={FLAME_CENTER}
          position={[f.x, f.y, 0.12]}
          scale={[FLAME_W * f.scale, FLAME_H * f.scale, 1]}
          ref={(el) => {
            spriteRefs.current[i] = el;
          }}
        />
      ))}
    </group>
  );
}
