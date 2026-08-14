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

import { useMemo } from 'react';
import * as THREE from 'three';
import { getElementalDef } from './elementalDefs.js';

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

const _canvas = (size) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return canvas;
};

const _finishTex = (canvas) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
};

// ── Shared greyscale sprites ────────────────────────────────────────────────
// Both are white-on-transparent and tinted per material, so one texture serves
// every element (and the orb's particles and ground pool as well).

const _shared = { glow: undefined, rays: undefined };

/** Soft radial falloff — the workhorse behind blooms, ground pools and motes. */
export function getSoftGlowTexture() {
  if (_shared.glow !== undefined) return _shared.glow;
  if (typeof document === 'undefined') {
    _shared.glow = null;
    return null;
  }
  const S = 128;
  const canvas = _canvas(S);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // Hot centre with a long tail — a plain linear ramp reads as a hard-edged disc.
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.06)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  _shared.glow = _finishTex(canvas);
  return _shared.glow;
}

/** Tapered light spokes — the slow rotating shine behind the medal. */
function getRayTexture() {
  if (_shared.rays !== undefined) return _shared.rays;
  if (typeof document === 'undefined') {
    _shared.rays = null;
    return null;
  }
  const S = 256;
  const R = S / 2;
  const canvas = _canvas(S);
  const ctx = canvas.getContext('2d');
  ctx.translate(R, R);
  const SPOKES = 12;
  for (let i = 0; i < SPOKES; i++) {
    // Alternating long/short spokes read as a star burst rather than a fan.
    const len = R * (i % 2 === 0 ? 0.98 : 0.62);
    const half = (Math.PI / SPOKES) * (i % 2 === 0 ? 0.30 : 0.18);
    const g = ctx.createRadialGradient(0, 0, R * 0.12, 0, 0, len);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const a = (i / SPOKES) * Math.PI * 2;
    ctx.arc(0, 0, len, a - half, a + half);
    ctx.closePath();
    ctx.fill();
  }
  _shared.rays = _finishTex(canvas);
  return _shared.rays;
}

// ── Per-element emblem ──────────────────────────────────────────────────────
// The element's icon, rasterised once per type into a glowing emblem texture.
// Reuses elementalDefs' iconPath (24×24 viewBox) so the 3D badge and the HUD chip
// show the identical silhouette.
const _emblemTexCache = {};
function getEmblemTexture(type) {
  if (_emblemTexCache[type] !== undefined) return _emblemTexCache[type];
  const def = getElementalDef(type);
  if (!def || typeof document === 'undefined') {
    _emblemTexCache[type] = null;
    return null;
  }
  const S = 320;
  const canvas = _canvas(S);
  const ctx = canvas.getContext('2d');
  const pad = 58;
  const scale = (S - pad * 2) / 24;
  ctx.translate(pad, pad);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const light = def.accent || '#ffffff';
  const p = new Path2D(def.iconPath);

  // Three passes, widest and softest first: a coloured aura, a tighter halo, then
  // the crisp white-hot silhouette. One pass gave a flat decal; stacking them is
  // what makes the emblem read as lit enamel.
  const passes = [
    { blur: 16, width: 3.0, stroke: def.color, fill: def.color, alpha: 0.55 },
    { blur: 8, width: 2.0, stroke: light, fill: light, alpha: 0.85 },
    { blur: 3, width: 1.25, stroke: '#ffffff', fill: light, alpha: 1 }
  ];
  for (const pass of passes) {
    ctx.globalAlpha = pass.alpha;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = pass.blur;
    ctx.fillStyle = pass.fill;
    ctx.fill(p);
    // Stroke too: the leaf/snowflake icons are open line paths with no fill area,
    // and a stroke bolds the filled ones enough to read at a small on-screen size.
    ctx.lineWidth = pass.width;
    ctx.strokeStyle = pass.stroke;
    ctx.stroke(p);
  }
  ctx.globalAlpha = 1;

  if (def.iconAccent) {
    const pa = new Path2D(def.iconAccent);
    ctx.shadowBlur = 5;
    ctx.shadowColor = def.color;
    ctx.fillStyle = def.color;
    ctx.fill(pa);
  }
  _emblemTexCache[type] = _finishTex(canvas);
  return _emblemTexCache[type];
}

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
  const def = getElementalDef(type);
  const accent = def?.accent || '#ffffff';
  const emblemTex = useMemo(() => getEmblemTexture(type), [type]);
  const glowTex = useMemo(() => getSoftGlowTexture(), []);
  const rayTex = useMemo(() => getRayTexture(), []);

  return (
    <group>
      {/* Soft element-coloured bloom behind everything — replaces the old faceted
          halo ring, which was visibly an octagon up close. */}
      {glowTex && (
        <mesh geometry={_badgeGeos.bloom} position={[0, 0, -0.02]} ref={bo(0.55)}>
          <meshBasicMaterial
            map={glowTex}
            color={color}
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {/* Slow star burst — the "this is an offering" shine. */}
      {rayTex && (
        <group ref={raysRef}>
          <mesh geometry={_badgeGeos.rays} position={[0, 0, -0.015]} ref={bo(0.22)}>
            <meshBasicMaterial
              map={rayTex}
              color={accent}
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
      {/* Gold octagon rim */}
      <mesh geometry={_badgeGeos.rim} rotation={[Math.PI / 2, 0, 0]} ref={bo(1)}>
        <meshStandardMaterial
          color="#ffd45e"
          emissive="#ff9f1c"
          emissiveIntensity={0.85}
          metalness={0.8}
          roughness={0.16}
          transparent
          opacity={1}
          toneMapped={false}
        />
      </mesh>
      {/* Dark keyline so the rim pops off any face colour */}
      <mesh geometry={_badgeGeos.keyline} position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]} ref={bo(1)}>
        <meshStandardMaterial color="#1c1108" metalness={0.3} roughness={0.5} transparent opacity={1} />
      </mesh>
      {/* Element-coloured enamel field */}
      <mesh geometry={_badgeGeos.enamel} position={[0, 0, 0.024]} rotation={[Math.PI / 2, 0, 0]} ref={bo(1)}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.0}
          metalness={0.22}
          roughness={0.2}
          transparent
          opacity={1}
          toneMapped={false}
        />
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
          <mesh
            key={i}
            geometry={_badgeGeos.spark}
            position={[Math.cos(a) * SPARK_RADIUS, Math.sin(a) * SPARK_RADIUS, 0.05]}
            ref={bo(0.95)}
          >
            <meshBasicMaterial color={accent} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
