// src/worm/ElementalSurface.jsx
//
// A continuous element surface for the elemental-orb cube skin. The reused
// per-sticker Living-style volumes read as discrete tiles — a 0.78-wide box per
// sticker with grout gaps between them and an identical wave pattern on every
// one, so a "water" cube looked like a grid of static blue squares. This is a
// purpose-built replacement that fixes both problems:
//
//   • Full coverage. The quad is slightly larger than a cell (1.04) so adjacent
//     tiles overlap and the grout disappears — the element covers the whole face.
//   • Seamless motion. Every wave/caustic/crack is a function of WORLD position
//     (a varying fed from modelMatrix), so the pattern is one continuous field
//     across tile boundaries and around the cube instead of repeating per tile.
//     `uTime` is sharedUniforms.time, which CubeAssembly already ticks every
//     frame, so it flows on its own.
//
// One shared geometry and one shared material per element back every tile (the
// skin renders up to ~150 meshes but they all reference these), so the whole
// layer is a handful of GPU objects. This covers the two flat-surface elements,
// water and ice. Grass keeps its dedicated blade mesh, and fire is drawn with the
// bombs' flame sprites (ElementalFireSkin) — it used to have a "lava" branch here
// that painted molten runoff across each sticker and read as orange squiggles.

import * as THREE from 'three';
import { sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';

export const SURFACE_MODE = { water: 0, ice: 1 };

const _geoCache = { geo: null };
export function getElementalSurfaceGeo() {
  if (!_geoCache.geo) {
    // Slightly oversized so neighbouring tiles overlap (kills the grout), with
    // enough subdivisions for the water vertex ripple to read as a wavy surface.
    _geoCache.geo = new THREE.PlaneGeometry(1.04, 1.04, 18, 18);
  }
  return _geoCache.geo;
}

const vertexShader = /* glsl */`
  uniform float uTime;
  uniform int uMode;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vView;
  varying float vWave;

  // Continuous world-space wave field — shared by every tile, so the surface is
  // one body rather than a grid of identical squares.
  float wfield(vec3 p, float t) {
    return sin(p.x * 3.0 + t * 1.6)
         + sin(p.z * 3.4 - t * 1.3)
         + sin((p.x + p.z) * 2.2 + t * 0.9)
         + sin(p.y * 3.1 + t * 1.1);
  }

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    float w = wfield(wp.xyz, uTime);
    vWave = w;

    vec3 pos = position;
    if (uMode == 0) pos.z += w * 0.02;          // water surface ripple (local +Z = outward)
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform int uMode;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vView;
  varying float vWave;

  void main() {
    vec3 vd = normalize(vView);
    // Surface normal from the wave gradient (screen-space derivatives).
    float dx = dFdx(vWave);
    float dy = dFdy(vWave);
    vec3 n = normalize(vec3(-dx * 6.0, -dy * 6.0, 1.0));
    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2);
    float t = uTime;

    vec3 col;
    float alpha;

    if (uMode == 0) {
      // ── Water ────────────────────────────────────────────────────────────
      // Two drifting caustic bands over world space, plus a sun glint and a
      // bright fresnel rim, on a deep translucent blue.
      float c1 = sin(vWorld.x * 5.0 + vWorld.z * 4.0 + t * 1.4);
      float c2 = sin(vWorld.z * 6.0 - vWorld.x * 3.0 - t * 1.1);
      float caustic = pow(max(0.0, c1 * c2), 2.0);
      col = uColor * (0.55 + 0.25 * sin(vWave + t));
      col += uAccent * caustic * 0.6;
      vec3 lightDir = normalize(vec3(0.4, 0.8, 0.5));
      float spec = pow(max(dot(reflect(-lightDir, n), vd), 0.0), 40.0);
      col += vec3(1.0) * spec * 0.8;
      col = mix(col, uAccent, fres * 0.45);
      alpha = 0.5 + fres * 0.35 + caustic * 0.1;
    } else {
      // ── Ice ──────────────────────────────────────────────────────────────
      // Frosted facets + crack lines, bright at grazing angles.
      float facet = 0.5 + 0.5 * sin(vWorld.x * 7.0) * sin(vWorld.z * 7.0) * sin(vWorld.y * 7.0);
      float crack = smoothstep(0.92, 1.0, abs(sin(vWorld.x * 3.0 + vWorld.z * 3.0)));
      col = mix(uColor * 0.85, vec3(1.0), facet * 0.35 + fres * 0.45);
      col += vec3(1.0) * crack * 0.5;
      alpha = 0.6 + fres * 0.3;
    }

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), alpha);
  }
`;


const _matCache = new Map();
export function getElementalSurfaceMaterial(element, colorHex, accentHex) {
  const key = `${element}_${colorHex}_${accentHex}`;
  let mat = _matCache.get(key);
  if (!mat) {
    mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedUniforms.time,                 // ticked by CubeAssembly every frame
        uMode: { value: SURFACE_MODE[element] ?? 0 },
        uColor: { value: new THREE.Color(colorHex) },
        uAccent: { value: new THREE.Color(accentHex) }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      extensions: { derivatives: true }
    });
    _matCache.set(key, mat);
  }
  return mat;
}
