// src/worm/healerWorm/fusionParticleMaterial.js
//
// The sprite for every reaction particle kind (fusionLooks.js), one program for all
// of them: the kind is a uniform, the colours ramp from a recipe's `tint` to `tint2`
// over each life. Steam and smoke are soft billowing puffs drawn normally (they hide
// what is behind them, as steam does); sparks, plasma, embers, frost and spores glow
// additively.

import { ShaderMaterial, Color, AdditiveBlending, NormalBlending } from 'three';

const vertexShader = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  attribute float aK;
  attribute float aSeed;
  uniform float uScale;
  varying float vAlpha;
  varying float vK;
  varying float vSeed;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vAlpha = aAlpha;
    vK = aK;
    vSeed = aSeed;
    gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 1.0, 220.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uTime;
  uniform int uKind;
  varying float vAlpha;
  varying float vK;
  varying float vSeed;

  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float spin = uTime * (0.4 + vSeed) + vSeed * 6.2832;
    vec2 q = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * p;
    float r = length(p);
    vec3 col = mix(uColorA, uColorB, vK);
    float a = 0.0;
    if (uKind == 0 || uKind == 1) {
      // Steam / smoke: a lumpy cauliflower puff with a soft, bright top.
      float lump = n2(q * 2.2 + vSeed * 9.0) * 0.55 + n2(q * 4.7 - vSeed * 5.0) * 0.3;
      float edge = 0.62 + lump * 0.45;
      a = 1.0 - smoothstep(edge - 0.32, edge, r);
      a *= 0.55 + 0.45 * lump;
      col *= mix(0.78, 1.08, clamp(0.5 - p.y * 0.5, 0.0, 1.0));
    } else if (uKind == 2) {
      // Sparks: a hot white point with a short glow.
      a = exp(-r * r * 18.0) + exp(-r * 5.0) * 0.35;
      col = mix(col, vec3(1.0), exp(-r * r * 30.0));
    } else if (uKind == 3) {
      // Petals: a tumbling teardrop with a darker vein.
      vec2 s = q * vec2(1.9, 1.0);
      float body = 1.0 - smoothstep(0.62, 0.78, length(s - vec2(0.0, -0.15)) + abs(s.x) * 0.25);
      a = body;
      col *= 0.82 + 0.25 * smoothstep(0.0, 0.25, abs(q.x));
    } else if (uKind == 4) {
      // Snow: a soft flake with a bright heart.
      a = 1.0 - smoothstep(0.35, 0.9, r);
      col = mix(col, vec3(1.0), exp(-r * 6.0));
    } else if (uKind == 5) {
      // Plasma: a glowing orb with a ring.
      a = exp(-r * r * 6.0) * 0.8 + exp(-pow((r - 0.62) / 0.1, 2.0)) * 0.6;
      col = mix(col, vec3(1.0), exp(-r * r * 20.0) * 0.8);
    } else if (uKind == 6) {
      // Embers: a stretched glowing fleck, white-hot at the core.
      a = exp(-dot(q * vec2(2.6, 0.9), q * vec2(2.6, 0.9)) * 3.0);
      col = mix(col, vec3(1.0, 0.95, 0.75), exp(-r * 6.0));
    } else if (uKind == 7) {
      // Spray: a droplet with a highlight.
      a = 1.0 - smoothstep(0.5, 0.8, r);
      col = mix(col, vec3(1.0), exp(-dot(p - vec2(-0.25, -0.3), p - vec2(-0.25, -0.3)) * 30.0));
    } else if (uKind == 8) {
      // Frost: a six-pointed crystal glint.
      float ang = atan(q.y, q.x);
      float ray = abs(sin(ang * 3.0)) * r;
      a = (1.0 - smoothstep(0.02, 0.09, ray)) * (1.0 - smoothstep(0.6, 0.95, r)) + exp(-r * r * 25.0);
    } else {
      // Spores: a soft glowing mote.
      a = exp(-r * r * 7.0);
      col = mix(col, vec3(1.0), exp(-r * r * 30.0) * 0.6);
    }
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * vAlpha * uOpacity);
  }
`;

const _cache = new Map();
/** One material per recipe (its tints and kind). Shared program across all of them. */
export function getFusionParticleMaterial(recipeId, look, cfg) {
  let mat = _cache.get(recipeId);
  if (!mat) {
    mat = new ShaderMaterial({
      uniforms: {
        uColorA: { value: new Color(look.tint) },
        uColorB: { value: new Color(look.tint2) },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uScale: { value: 500 },
        uKind: { value: cfg.id },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: cfg.additive ? AdditiveBlending : NormalBlending,
    });
    mat.userData.fusionPoints = true;
    _cache.set(recipeId, mat);
  }
  return mat;
}
