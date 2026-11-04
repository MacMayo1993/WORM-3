// src/worm/healerWorm/elementalOrbMaterials.js
//
// Every texture and material an elemental offering draws besides its relic
// (elementalOrbShader.js): the floor sigil with its glyph and countdown, the
// motes, the drifting matter and the spawn shockwave (ElementalOrb). All are
// built lazily, once per element, and never disposed:
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

// ── Shared greyscale sprite ─────────────────────────────────────────────────
// White-on-transparent and tinted per material, so one texture serves every
// element (and the orb's particles and ground pool as well).

const _shared = { glow: undefined };

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

// ── Per-element glyph ───────────────────────────────────────────────────────
// The element's icon, rasterised once per type into a glowing glyph for the floor
// sigil. Reuses elementalDefs' iconPath (24×24 viewBox) so the sigil and the HUD
// chip show the identical silhouette.
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
  const pad = 40;
  const scale = (S - pad * 2) / 24;
  ctx.translate(pad, pad);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const light = def.accent || '#ffffff';
  const p = new Path2D(def.iconPath);

  // Three passes, widest and softest first: a coloured aura, a tighter halo, then
  // the crisp white-hot silhouette. One pass gave a flat decal; stacking them is
  // what makes the glyph read as light on the tile.
  const passes = [
    { blur: 18, width: 3.4, stroke: def.color, fill: def.color, alpha: 0.75 },
    { blur: 8, width: 2.4, stroke: def.color, fill: def.color, alpha: 1 },
    { blur: 2, width: 1.5, stroke: light, fill: light, alpha: 1 }
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

// Per-element drifting matter around the orb, mirroring ElementalAtmosphere's
// scene-scale field. `vy` is along the face normal (+ = away from the cube).
// Every element's `particle` key must be listed: an unknown one falls back to
// bubbles, which is how Lightning used to wear Water's.
export const PARTICLE_KINDS = {
  bubbles: { count: 26, vy: 0.42, sway: 0.1, size: 0.055, opacity: 0.75 },
  embers: { count: 30, vy: 0.55, sway: 0.09, size: 0.05, opacity: 0.95 },
  spores: { count: 24, vy: -0.16, sway: 0.14, size: 0.05, opacity: 0.7 },
  wind: { count: 22, vy: 0.18, sway: 0.85, size: 0.065, opacity: 0.55 },
  flakes: { count: 26, vy: -0.3, sway: 0.13, size: 0.055, opacity: 0.85 },
  ions: { count: 22, vy: 0.08, sway: 0.22, size: 0.05, opacity: 0.95 }
};

// The floor sigil under the relic, on the tile it is offered on: one decal that is
// a pool of the element's light, a dark ink track round it carrying the draining
// countdown arc (mirroring the HUD's ring), a dashed rune ring turning slowly
// inside that, and the element's glyph glowing at the centre. It replaces a
// separate pool, a countdown ring and the octagon medal that used to float over
// the body: that medal made every element the same badge, and three pieces of
// furniture round each relic made a full offering a clutter of outlines.
const sigilVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const sigilFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform vec3 uInk;
  uniform float uRemaining;
  uniform float uAlpha;
  uniform float uTime;
  uniform sampler2D uGlyph;
  uniform float uHasGlyph;
  varying vec2 vUv;

  // Paint c at coverage a over what is already there (straight alpha).
  void over(inout vec4 dst, vec3 c, float a) {
    float outA = a + dst.a * (1.0 - a);
    dst.rgb = (c * a + dst.rgb * dst.a * (1.0 - a)) / max(outA, 1e-4);
    dst.a = outA;
  }
  float band(float d, float lo, float hi, float aa) {
    return smoothstep(lo - aa, lo, d) * (1.0 - smoothstep(hi, hi + aa, d));
  }

  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c) * 2.0;
    float aa = fwidth(d) * 1.2;
    // Clockwise from twelve o'clock in the decal's own plane.
    float frac = fract(0.25 - atan(c.y, c.x) / 6.2831853);
    vec4 col = vec4(0.0);

    // A dark plate in the element's ink, so the glyph and the arc read on any
    // sticker colour, with a pool of the element's light welling up under the relic.
    over(col, uInk, (1.0 - smoothstep(0.78, 0.78 + aa, d)) * 0.62);
    over(col, uColor, exp(-d * d * 4.0) * 0.4);
    // Rune ring: ten dashes turning slowly.
    float dash = step(0.42, fract(frac * 10.0 + uTime * 0.04));
    over(col, mix(uColor, uAccent, 0.5), band(d, 0.66, 0.7, aa) * dash * 0.75);
    // Countdown: an ink track, lit where time remains.
    over(col, uInk, band(d, 0.77, 0.97, aa) * 0.8);
    float lit = step(frac, uRemaining);
    over(col, mix(uColor, uAccent, 0.25), band(d, 0.83, 0.93, aa) * mix(0.18, 1.0, lit));
    // The element's glyph, read straight off the tile.
    if (uHasGlyph > 0.5) {
      vec4 g = texture2D(uGlyph, c / 0.62 + 0.5);
      float inside = 1.0 - smoothstep(0.58, 0.62, d);
      over(col, g.rgb, g.a * inside * 0.9);
    }
    gl_FragColor = vec4(col.rgb, col.a * uAlpha);
    #include <colorspace_fragment>
  }
`;

// The orb's non-relic materials, held per element: R3F disposes JSX-declared
// materials on unmount, and disposing the last user of a program makes three
// destroy it, so every offering relinked them. Each entry backs exactly one mesh,
// so the lifetime fade (which writes material.opacity from the MESH's
// baseOpacity) keeps a single writer.
const _trimCache = new Map();
export function getOrbTrimMaterials(element, color, accent, particleSize) {
  const key = `${element}_${color}_${accent}`;
  const hit = _trimCache.get(key);
  if (hit) return hit;
  const def = getSpecialDef(element);
  const glow = getSoftGlowTexture();
  const glyph = getEmblemTexture(element);
  const set = {
    mote: new THREE.SpriteMaterial({
      map: glow, color: accent, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }),
    points: new THREE.PointsMaterial({
      map: glow, color: accent, size: particleSize, sizeAttenuation: true,
      transparent: true, opacity: 1, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    }),
    sigil: new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uAccent: { value: new THREE.Color(accent) },
        uInk: { value: new THREE.Color(def?.fogColor ?? '#0b0f1a') },
        uRemaining: { value: 1 },
        uAlpha: { value: 1 },
        uTime: { value: 0 },
        uGlyph: { value: glyph },
        uHasGlyph: { value: glyph ? 1 : 0 }
      },
      vertexShader: sigilVertex, fragmentShader: sigilFragment,
      transparent: true, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }),
    shock: new THREE.MeshBasicMaterial({
      color: accent, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    })
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
  const { color = '#ffffff', accent = '#ffffff', fogColor } = def;
  const relic = getElementalOrbMaterials(type, color, accent, fogColor);
  const trim = getOrbTrimMaterials(type, color, accent, PARTICLE_KINDS[def.particle]?.size ?? 0.055);
  return [relic.body, relic.hull, ...Object.values(trim)];
}
