// src/worm/healerWorm/elementalBadge.jsx
//
// The elemental power-up's on-board emblem: a camera-facing enamel gym badge that
// carries the element's OWN icon (the exact silhouette elementalDefs ships and the
// HUD chip draws), so the pickup and the HUD read as one badge system.
//
// This is the pure visual, built in local space with +Z facing outward. The caller
// (ElementalOrb in orbSystems) positions it, billboards it to the camera, spins the
// spark ring, and drives the lifetime fade — every material here is transparent and
// tagged with a design opacity (userData.baseOpacity) so that fade can scale from it
// without clobbering the per-material values.

import { useMemo } from 'react';
import * as THREE from 'three';
import { getElementalDef } from './elementalDefs.js';

// Faceted octagon medal (radialSegments 8), sized to read at a 15×15 tile.
const _badgeGeos = {
  rim: new THREE.CylinderGeometry(0.40, 0.40, 0.085, 8),
  keyline: new THREE.CylinderGeometry(0.35, 0.35, 0.096, 8),
  enamel: new THREE.CylinderGeometry(0.315, 0.315, 0.105, 8),
  pinstripe: new THREE.TorusGeometry(0.325, 0.012, 6, 8), // octagon accent line at the enamel edge
  emblem: new THREE.PlaneGeometry(0.46, 0.46),
  gloss: new THREE.CircleGeometry(0.30, 16),
  halo: new THREE.TorusGeometry(0.47, 0.022, 8, 8),
  spark: new THREE.SphereGeometry(0.032, 8, 8),
};

const SPARK_ANGLES = [0, 1, 2, 3].map((i) => (i / 4) * Math.PI * 2);
const SPARK_RADIUS = 0.44;

// The element's icon, rasterised once per type into a glowing emblem texture. Reuses
// elementalDefs' iconPath (24×24 viewBox) so the 3D badge and the HUD chip show the
// identical silhouette. Cached module-level (≤4 textures), built lazily on first use
// so a headless import never touches the canvas API.
const _emblemTexCache = {};
function getEmblemTexture(type) {
  if (_emblemTexCache[type] !== undefined) return _emblemTexCache[type];
  const def = getElementalDef(type);
  if (!def || typeof document === 'undefined') { _emblemTexCache[type] = null; return null; }
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const pad = 46;
  const scale = (S - pad * 2) / 24;
  ctx.translate(pad, pad);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const light = def.accent || '#ffffff';
  const p = new Path2D(def.iconPath);
  // Coloured outer glow so the emblem reads as lit enamel, not a flat decal.
  ctx.shadowColor = def.color;
  ctx.shadowBlur = 7;
  ctx.fillStyle = light;
  ctx.fill(p);
  // Stroke too: the leaf/snowflake icons are open line paths with no fill area, and a
  // stroke bolds the filled ones enough to read at a small on-screen size.
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = light;
  ctx.stroke(p);
  if (def.iconAccent) {
    const pa = new Path2D(def.iconAccent);
    ctx.shadowBlur = 4;
    ctx.fillStyle = def.color;
    ctx.fill(pa);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _emblemTexCache[type] = tex;
  return tex;
}

// Tag a mesh with its design opacity so the parent's lifetime fade scales from it.
const bo = (v) => (m) => { if (m) m.userData.baseOpacity = v; };

/**
 * The badge, in local space (+Z outward). `sparksRef`, if given, is attached to the
 * orbiting spark ring so the caller can spin it.
 */
export function ElementalBadge({ type, color, sparksRef }) {
  const def = getElementalDef(type);
  const accent = def?.accent || '#ffffff';
  const emblemTex = useMemo(() => getEmblemTexture(type), [type]);
  return (
    <group>
      {/* Outer glow ring in the element colour */}
      <mesh geometry={_badgeGeos.halo} ref={bo(0.72)}>
        <meshBasicMaterial color={color} transparent opacity={0.72} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Gold octagon rim */}
      <mesh geometry={_badgeGeos.rim} rotation={[Math.PI / 2, 0, 0]} ref={bo(1)}>
        <meshStandardMaterial color="#ffd45e" emissive="#ff9f1c" emissiveIntensity={0.85} metalness={0.8} roughness={0.16} transparent opacity={1} toneMapped={false} />
      </mesh>
      {/* Dark keyline so the rim pops off any face colour */}
      <mesh geometry={_badgeGeos.keyline} position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]} ref={bo(1)}>
        <meshStandardMaterial color="#1c1108" metalness={0.3} roughness={0.5} transparent opacity={1} />
      </mesh>
      {/* Element-coloured enamel field */}
      <mesh geometry={_badgeGeos.enamel} position={[0, 0, 0.024]} rotation={[Math.PI / 2, 0, 0]} ref={bo(1)}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} metalness={0.22} roughness={0.2} transparent opacity={1} toneMapped={false} />
      </mesh>
      {/* Bright octagon pinstripe at the enamel edge */}
      <mesh geometry={_badgeGeos.pinstripe} position={[0, 0, 0.086]} ref={bo(0.9)}>
        <meshBasicMaterial color={accent} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Soft domed gloss */}
      <mesh geometry={_badgeGeos.gloss} position={[0, 0.02, 0.088]} ref={bo(0.14)}>
        <meshBasicMaterial color={accent} transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* The element's own icon, stamped and glowing */}
      {emblemTex && (
        <mesh geometry={_badgeGeos.emblem} position={[0, 0, 0.092]} ref={bo(1)}>
          <meshBasicMaterial map={emblemTex} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {/* Orbiting element sparks — the caller spins this group */}
      <group ref={sparksRef}>
        {SPARK_ANGLES.map((a, i) => (
          <mesh key={i} geometry={_badgeGeos.spark} position={[Math.cos(a) * SPARK_RADIUS, Math.sin(a) * SPARK_RADIUS, 0.05]} ref={bo(0.95)}>
            <meshBasicMaterial color={accent} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
