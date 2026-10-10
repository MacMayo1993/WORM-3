// src/worm/healerWorm/elementalOrbMaterials.js
//
// Every texture and material an elemental offering draws besides its body shader
// (elementalOrbShader.js): the crest's canvas sprites and enamel set
// (ElementalBadge) and the orb's rings, motes, particles, pool and shockwave
// (ElementalOrb). All are built lazily, once per element, and never disposed:
// declared as JSX they belonged to R3F, which disposed them on unmount, and
// disposing the last material using a program makes three destroy it, so every
// offering relinked them. Kept out of the component modules so the WORM warm-up
// can compile them, and their arrival variants, before the first one spawns.

import * as THREE from 'three';
import { getSpecialDef } from './specialDefs.js';
import { getElementalOrbMaterials } from './elementalOrbShader.js';

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
  const def = getSpecialDef(type);
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

// One long-lived material set per element. Each entry backs exactly one mesh in the
// badge, so the parent's fade (which writes material.opacity from the MESH's
// baseOpacity) still has a single writer per material.
const _badgeMatCache = new Map();
export function getBadgeMaterials(type, color) {
  const def = getSpecialDef(type);
  const accent = def?.accent || '#ffffff';
  const key = `${type}_${color}`;
  const hit = _badgeMatCache.get(key);
  if (hit) return hit;
  const additive = (c, opacity, map) =>
    new THREE.MeshBasicMaterial({
      color: c, map: map ?? null, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
  const set = {
    bloom: additive(color, 0.55, getSoftGlowTexture()),
    rays: additive(accent, 0.22, getRayTexture()),
    rim: new THREE.MeshStandardMaterial({
      color: '#ffd45e', emissive: '#ff9f1c', emissiveIntensity: 0.85,
      metalness: 0.8, roughness: 0.16, transparent: true, opacity: 1, toneMapped: false
    }),
    keyline: new THREE.MeshStandardMaterial({ color: '#1c1108', metalness: 0.3, roughness: 0.5, transparent: true, opacity: 1 }),
    enamel: new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 1.0,
      metalness: 0.22, roughness: 0.2, transparent: true, opacity: 1, toneMapped: false
    }),
    pinstripe: additive(accent, 0.9),
    gloss: additive(accent, 0.14),
    emblem: new THREE.MeshBasicMaterial({ map: getEmblemTexture(type), transparent: true, depthWrite: false, toneMapped: false }),
    spark: additive(accent, 0.95)
  };
  _badgeMatCache.set(key, set);
  return set;
}

// Per-element drifting matter around the orb, mirroring ElementalAtmosphere's
// scene-scale field. `vy` is along the face normal (+ = away from the cube).
export const PARTICLE_KINDS = {
  bubbles: { count: 26, vy: 0.42, sway: 0.1, size: 0.055, opacity: 0.75 },
  embers: { count: 30, vy: 0.55, sway: 0.09, size: 0.05, opacity: 0.95 },
  spores: { count: 24, vy: -0.16, sway: 0.14, size: 0.05, opacity: 0.7 },
  flakes: { count: 26, vy: -0.3, sway: 0.13, size: 0.055, opacity: 0.85 }
};
// The orb's non-shader materials, held per element for the same reason the badge's
// are (see elementalBadge.jsx): R3F disposes JSX-declared materials on unmount, and
// disposing the last user of a program makes three destroy it, so every offering
// relinked them. Each entry backs exactly one mesh, so the lifetime fade — which
// writes material.opacity from the MESH's baseOpacity — keeps a single writer.
const _trimCache = new Map();
export function getOrbTrimMaterials(element, color, accent, particleSize) {
  const key = `${element}_${color}_${accent}`;
  const hit = _trimCache.get(key);
  if (hit) return hit;
  const glow = getSoftGlowTexture();
  const additive = (c, opacity, map) =>
    new THREE.MeshBasicMaterial({
      color: c, map: map ?? null, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
  const set = {
    ringA: additive(accent, 0.34),
    ringB: additive(color, 0.3),
    mote: new THREE.SpriteMaterial({
      map: glow, color: accent, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }),
    points: new THREE.PointsMaterial({
      map: glow, color: accent, size: particleSize, sizeAttenuation: true,
      transparent: true, opacity: 1, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    }),
    countdown: additive(color, 0.45),
    pool: additive(color, 0.42, glow),
    shock: additive(accent, 0.8)
  };
  _trimCache.set(key, set);
  return set;
}

// Every material an offering of `type` draws, fetched exactly as the orb fetches
// them, so the WORM warm-up can compile their arrival variants (orbReveal.js)
// before the first one spawns.
export function elementalOrbMaterials(type) {
  const def = getSpecialDef(type);
  if (!def) return [];
  const { color = '#ffffff', accent = '#ffffff' } = def;
  const body = getElementalOrbMaterials(type, color, accent);
  const trim = getOrbTrimMaterials(type, color, accent, PARTICLE_KINDS[def.particle]?.size ?? 0.055);
  const badge = getBadgeMaterials(type, color);
  return [body.core, body.shell, body.inner, ...Object.values(trim),
    ...Object.entries(badge).filter(([key, material]) => !['bloom', 'rays', 'emblem'].includes(key) || material.map).map(([, material]) => material)];
}

