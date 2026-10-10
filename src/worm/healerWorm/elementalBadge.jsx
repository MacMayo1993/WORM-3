// src/worm/healerWorm/elementalBadge.jsx
//
// The elemental power-up's crest: a camera-facing enamel gym badge carrying the
// element's OWN icon (the exact silhouette elementalDefs ships and the HUD chip
// draws), so the pickup and the HUD read as one badge system.
//
// The crest is the *face* of the pickup, not the whole of it — ElementalOrb floats
// it on the near side of a glassy elemental sphere. Everything here is built in
// local space with +Z facing outward; the caller positions it, billboards it to the
// camera, spins the spark ring and the ray burst, and drives the lifetime fade.
// Every material is transparent and tagged with a design opacity
// (userData.baseOpacity) so that fade can scale from it without clobbering the
// per-material values.
//
// The canvas textures below (emblem / soft glow / ray burst) are built lazily and
// cached at module level — at most four emblems plus two shared greyscale sprites
// for the whole session — so a headless import never touches the canvas API.
//
// So are the MATERIALS, and for a sharper reason. Declared as JSX intrinsics they
// belong to R3F, which disposes them when the badge unmounts; disposing the last
// material using a program makes three destroy it, so every elemental offering
// relinked the full MeshStandardMaterial shader (~69KB of source) from scratch.
// Linking is synchronous, so on a phone that is the game freezing on a 12-second
// beat. One set per element, built once, never disposed.

import { useMemo } from 'react';
import * as THREE from 'three';
import { getBadgeMaterials } from './elementalOrbMaterials.js';

// Faceted octagon medal (radialSegments 8), sized to read at a 15×15 tile.
const _badgeGeos = {
  rim: new THREE.CylinderGeometry(0.4, 0.4, 0.085, 8),
  keyline: new THREE.CylinderGeometry(0.35, 0.35, 0.096, 8),
  enamel: new THREE.CylinderGeometry(0.315, 0.315, 0.105, 8),
  pinstripe: new THREE.TorusGeometry(0.325, 0.012, 6, 8), // octagon accent line at the enamel edge
  emblem: new THREE.PlaneGeometry(0.46, 0.46),
  gloss: new THREE.CircleGeometry(0.3, 16),
  // Soft sprites replace the old hard 8-segment halo torus, which read as a
  // visibly polygonal wire ring at close range.
  bloom: new THREE.PlaneGeometry(1.55, 1.55),
  rays: new THREE.PlaneGeometry(1.15, 1.15),
  spark: new THREE.SphereGeometry(0.032, 8, 8)
};

const SPARK_ANGLES = [0, 1, 2, 3, 4, 5].map((i) => (i / 6) * Math.PI * 2);
const SPARK_RADIUS = 0.46;

// Tag a mesh with its design opacity so the parent's lifetime fade scales from it.
const bo = (v) => (m) => {
  if (m) m.userData.baseOpacity = v;
};

/**
 * The crest, in local space (+Z outward).
 *
 * `sparksRef` is attached to the orbiting spark ring and `raysRef` to the star
 * burst behind the medal, so the caller can spin each at its own rate.
 */
export function ElementalBadge({ type, color, sparksRef, raysRef }) {
  const mats = useMemo(() => getBadgeMaterials(type, color), [type, color]);

  return (
    <group>
      {/* Soft element-coloured bloom behind everything — replaces the old faceted
          halo ring, which was visibly an octagon up close. */}
      {mats.bloom.map && <mesh geometry={_badgeGeos.bloom} material={mats.bloom} position={[0, 0, -0.02]} ref={bo(0.55)} />}
      {/* Slow star burst — the "this is an offering" shine. */}
      {mats.rays.map && (
        <group ref={raysRef}>
          <mesh geometry={_badgeGeos.rays} material={mats.rays} position={[0, 0, -0.015]} ref={bo(0.22)} />
        </group>
      )}
      {/* Gold octagon rim */}
      <mesh geometry={_badgeGeos.rim} material={mats.rim} rotation={[Math.PI / 2, 0, 0]} ref={bo(1)} />
      {/* Dark keyline so the rim pops off any face colour */}
      <mesh geometry={_badgeGeos.keyline} material={mats.keyline} position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]} ref={bo(1)} />
      {/* Element-coloured enamel field */}
      <mesh geometry={_badgeGeos.enamel} material={mats.enamel} position={[0, 0, 0.024]} rotation={[Math.PI / 2, 0, 0]} ref={bo(1)} />
      {/* Bright octagon pinstripe at the enamel edge */}
      <mesh geometry={_badgeGeos.pinstripe} material={mats.pinstripe} position={[0, 0, 0.086]} ref={bo(0.9)} />
      {/* Soft domed gloss */}
      <mesh geometry={_badgeGeos.gloss} material={mats.gloss} position={[0, 0.02, 0.088]} ref={bo(0.14)} />
      {/* The element's own icon, stamped and glowing */}
      {mats.emblem.map && <mesh geometry={_badgeGeos.emblem} material={mats.emblem} position={[0, 0, 0.092]} ref={bo(1)} />}
      {/* Orbiting element sparks — the caller spins this group */}
      <group ref={sparksRef}>
        {SPARK_ANGLES.map((a, i) => (
          <mesh
            key={i}
            geometry={_badgeGeos.spark}
            material={mats.spark}
            position={[Math.cos(a) * SPARK_RADIUS, Math.sin(a) * SPARK_RADIUS, 0.05]}
            ref={bo(0.95)}
          />
        ))}
      </group>
    </group>
  );
}
