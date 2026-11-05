// src/worm/healerWorm/elementalOrbShader.js
//
// The material pair behind the elemental pickup's relic (elementalOrbShapes.js):
//
//   body — the relic itself, lit like a painted, glazed toy: a soft two-tone cel
//          light from a key above and beside the lens, a rim in the element's
//          light, a tight specular glint on the glossy ones, and the element's own
//          life running through it (water's caustics and current, fire's rising
//          heat, ice's glints, the bolt's arcs, air's streamers). Lighting is in
//          view space, so a relic is lit the same from every camera and reads like
//          its HUD icon wherever the worm is on the cube. Opaque, depth-written, so
//          the island's tree and the cluster's crystals occlude each other.
//   hull — the same shape drawn back-face only and pushed out along `aSmooth`, in
//          the element's dark ink: an outline round the silhouette, the inked look
//          of the worm's handmade pieces, and a dark edge that keeps the relic off
//          any sticker colour under it.
//
// Every relic used to be four layers (core, glass shell, inner bloom, hull) of a
// scaled copy of one shape. A uniform scale only outlines a convex shape round its
// origin, and the glass stack made every element a pane of tinted glass.
//
// `uMode` is a uniform, not a #define, so every element shares the same two
// programs: spawning an offering never triggers a shader compile after the first.
//
// The material set is cached per element and never disposed. Disposing the last
// material that uses a program makes three destroy it, so building a set per orb
// and disposing it on unmount relinked these shaders on every offering, which on a
// phone read as the game freezing every 12 seconds. An offering places at most one
// orb per element, so one set per element is all that is ever live and `uAlpha`
// has a single writer.

import * as THREE from 'three';

/** Element → shader branch. Matches ELEMENTAL_TYPES order but is looked up by key. */
export const ELEMENT_MODE = { water: 0, fire: 1, grass: 2, ice: 3, lightning: 4, air: 5 };

/** How far the ink hull stands off the body, in the relic's local units. */
export const ORB_OUTLINE = 0.034;

const varyings = /* glsl */ `
  uniform float uTime;
  uniform int uMode;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform vec3 uInk;
  uniform float uAlpha;
  uniform float uOutline;
  varying vec3 vLocal;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying float vPart;
`;

// Shared vertex stage. The fire and the tornado move their outline, so the hull
// runs the same displacement and keeps hugging the moving silhouette.
const vertexShader = /* glsl */ `
  ${varyings}
  attribute float aPart;
  attribute vec3 aSmooth;
  void main() {
    vLocal = position;
    vPart = aPart;
    vec3 pos = position;
    if (uMode == 0) {
      // Water: the droplet wobbles like a held bead of liquid.
      float w = sin(uTime * 3.2 + pos.y * 7.0) * 0.5 + sin(uTime * 2.1 - atan(pos.z, pos.x) * 2.0) * 0.5;
      pos += aSmooth * w * 0.018;
    } else if (uMode == 1) {
      // Flame: the tongues climb and sway, more the higher they reach, so the
      // crown's outline flickers.
      float h = smoothstep(-0.25, 0.6, pos.y);
      float a = atan(pos.z, pos.x);
      pos.y += h * h * 0.07 * sin(uTime * 5.0 + a * 3.0);
      pos.x += sin(uTime * 3.1 + pos.y * 4.0) * 0.06 * h * h;
      pos.z += cos(uTime * 2.7 + pos.y * 3.0) * 0.04 * h * h;
    } else if (uMode == 4) {
      // Lightning: a buzz that comes in bursts, as the charge does.
      float burst = step(0.82, fract(sin(floor(uTime * 9.0) * 12.9898) * 43758.5453));
      pos.x += sin(uTime * 61.0 + pos.y * 20.0) * 0.012 * burst;
    } else if (uMode == 5) {
      // Tornado: the narrow foot whips about under a steadier mouth.
      float foot = 0.5 - pos.y;
      pos.x += sin(uTime * 2.6 + pos.y * 3.0) * 0.07 * foot;
      pos.z += cos(uTime * 2.2 + pos.y * 2.5) * 0.05 * foot;
    }
    #ifdef ORB_HULL
      pos += aSmooth * uOutline;
    #endif
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

// Literal colours below are written as display (sRGB) values and decoded, so they
// can be tuned by eye against the palette; the output is encoded on the way out.
const bodyFragment = /* glsl */ `
  precision highp float;
  ${varyings}

  vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
  vec3 rotY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }
  float field(vec3 p, float t) {
    return sin(p.x * 1.7 + t * 1.10)
         + sin(p.z * 2.1 - t * 0.90)
         + sin(p.y * 1.5 + t * 0.70)
         + 0.5 * sin((p.x + p.y + p.z) * 2.6 - t * 1.30);
  }
  // Soft two-tone cel: a hard-ish terminator, never black on the shadow side.
  float cel(float d, float lo) { return mix(lo, 1.0, smoothstep(-0.05, 0.3, d)); }

  void main() {
    vec3 n = normalize(vNormalV);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(vViewV);
    vec3 L = normalize(vec3(-0.45, 0.8, 0.55));
    float ndl = dot(n, L);
    float facing = clamp(dot(n, v), 0.0, 1.0);
    float fres = pow(1.0 - facing, 2.5);
    float spec = pow(max(dot(reflect(-L, n), v), 0.0), 48.0);
    float t = uTime;
    vec3 p = vLocal;
    int part = int(vPart + 0.5);

    vec3 col;
    vec3 rim = uAccent;
    float rimAmt = 0.55;
    float specAmt = 0.0;

    if (uMode == 0) {
      // ── Water: deep at the heart, bright at the skin, a current winding up
      // through it and caustic webs drifting over it.
      vec3 q = rotY(p, t * 0.6) * 4.0;
      float c = abs(sin(q.x * 1.3 + t * 0.9) + sin(q.y * 1.6 - t * 1.2) + sin(q.z * 1.2 + t * 0.7));
      float caustic = pow(1.0 - clamp(c * 0.55, 0.0, 1.0), 5.0);
      float current = smoothstep(0.55, 1.0, sin(atan(p.z, p.x) * 2.0 + p.y * 9.0 - t * 3.0));
      vec3 deep = srgb(vec3(0.03, 0.22, 0.58));
      col = mix(deep, uColor, 0.25 + 0.55 * fres + 0.25 * smoothstep(-0.5, 0.5, p.y));
      col *= cel(ndl, 0.78);
      col += uAccent * (caustic * 0.65 + current * 0.18);
      specAmt = 1.2;
      rimAmt = 0.7;
    } else if (uMode == 1) {
      // ── Fire: self-lit. White-gold where the lens looks straight in, orange,
      // then red licking out at the silhouette and the tips, with heat rising.
      float rise = sin(p.x * 9.0 + sin(p.y * 6.0 - t * 7.0) * 1.5) * 0.5 + sin(p.z * 8.0 - t * 4.0) * 0.5;
      float heat = clamp(facing * 1.02 - smoothstep(-0.1, 0.65, p.y) * 0.55 + rise * 0.12 - float(part) * 0.18, 0.0, 1.0);
      vec3 ember = srgb(vec3(0.62, 0.06, 0.02));
      col = mix(ember, uColor, smoothstep(0.08, 0.45, heat));
      col = mix(col, srgb(vec3(1.0, 0.82, 0.36)), smoothstep(0.55, 0.88, heat));
      col = mix(col, vec3(1.0, 0.97, 0.86), smoothstep(0.93, 1.0, heat));
      rim = srgb(vec3(1.0, 0.35, 0.08));
      rimAmt = 0.35;
    } else if (uMode == 2) {
      // ── Earth: the island. Rock, grass, bark and leaves, cel-lit, with a snow
      // cap on the peak and a seam of green life glowing in the rock.
      if (part == 0) {
        float strata = 0.5 + 0.5 * sin(p.y * 38.0 + sin(p.x * 9.0) * 1.5);
        col = mix(srgb(vec3(0.42, 0.31, 0.22)), srgb(vec3(0.6, 0.5, 0.4)), strata * 0.6);
        col = mix(col, vec3(0.95), smoothstep(0.36, 0.4, p.y));
        float seam = 1.0 - smoothstep(0.0, 0.05, abs(sin(atan(p.z, p.x) * 3.0 + p.y * 6.0)));
        col += uColor * seam * (1.0 - smoothstep(-0.3, 0.0, p.y)) * (0.55 + 0.45 * sin(t * 1.6));
      } else if (part == 1) {
        col = uColor * 0.8;
        col = mix(col, srgb(vec3(0.45, 0.32, 0.2)), (1.0 - smoothstep(0.045, 0.075, p.y)) * 0.85);
      } else if (part == 2) {
        col = srgb(vec3(0.45, 0.3, 0.18));
      } else {
        col = mix(uColor * 0.7, uAccent, 0.15 + 0.2 * smoothstep(0.2, 0.45, p.y));
      }
      col *= cel(ndl, 0.6);
      rim = mix(uAccent, uColor, 0.4);
      rimAmt = 0.4;
    } else if (uMode == 3) {
      // ── Ice: hard facets from glacial blue to white, frost cracks inside and
      // a glint that runs up the crystals.
      vec3 depth = srgb(vec3(0.1, 0.42, 0.85));
      col = mix(depth, srgb(vec3(0.82, 0.95, 1.0)), clamp(ndl * 0.5 + 0.18 + fres * 0.25, 0.0, 1.0));
      if (part == 1) col *= 0.9;
      vec3 q = p * 6.0;
      float crack = 1.0 - smoothstep(0.0, 0.07, abs(sin(q.x * 1.3 + q.y * 0.9) + sin(q.z * 1.6 - q.y * 0.5)));
      col = mix(col, vec3(1.0), crack * 0.35);
      float glint = pow(0.5 + 0.5 * sin(p.y * 10.0 - t * 2.4 + float(part) * 1.7), 24.0);
      col += uAccent * glint * 0.5;
      specAmt = 1.4;
      rimAmt = 0.6;
    } else if (uMode == 4) {
      // ── Lightning: a white-hot face over violet bevels, with arcs crawling
      // through it and the whole bolt flaring in bursts.
      vec3 q = rotY(p, t * 0.5) * 3.6;
      float f = field(q, t * 2.0);
      float arc = 1.0 - smoothstep(0.04, 0.2, abs(f));
      float burst = pow(0.5 + 0.5 * sin(t * 3.1 + floor(t * 5.0) * 8.13), 6.0);
      float face = smoothstep(0.55, 0.85, facing);
      vec3 bevel = srgb(vec3(0.3, 0.12, 0.78));
      vec3 body = srgb(vec3(0.58, 0.4, 1.0));
      vec3 charge = srgb(vec3(1.0, 0.94, 0.62));
      col = mix(bevel, mix(body, charge, 0.2 + 0.6 * burst), face);
      col *= cel(ndl, 0.7);
      col = mix(col, vec3(1.0), arc * (0.55 + 0.45 * burst));
      specAmt = 0.9;
      rimAmt = 0.8;
    } else {
      // ── Air: pale streamers spiralling up the funnel, fast.
      float angle = atan(p.z, p.x);
      float streak = pow(0.5 + 0.5 * sin(angle * 3.0 - p.y * 13.0 - t * 7.0), 4.0);
      float gust = pow(0.5 + 0.5 * sin(angle * 5.0 + p.y * 7.0 - t * 4.0), 6.0);
      vec3 base = mix(srgb(vec3(0.22, 0.6, 0.62)), uColor, 0.45);
      col = base * cel(ndl, 0.72);
      col = mix(col, uAccent, streak * 0.7 + gust * 0.25);
      specAmt = 0.5;
      rimAmt = 0.7;
    }

    col += rim * fres * rimAmt;
    col += vec3(1.0) * spec * specAmt;
    gl_FragColor = vec4(col, uAlpha);
    #include <colorspace_fragment>
  }
`;

// The ink hull: a flat dark fill drawn back-face only from the pushed-out copy, so
// it shows as an outline round the relic.
const hullFragment = /* glsl */ `
  precision highp float;
  ${varyings}
  void main() {
    gl_FragColor = vec4(uInk, uAlpha);
    #include <colorspace_fragment>
  }
`;

function makeUniforms(element, colorHex, accentHex, inkHex) {
  return {
    uTime: { value: 0 },
    uMode: { value: ELEMENT_MODE[element] ?? 0 },
    uColor: { value: new THREE.Color(colorHex) },
    uAccent: { value: new THREE.Color(accentHex) },
    uInk: { value: new THREE.Color(inkHex) },
    uAlpha: { value: 1 },
    uOutline: { value: ORB_OUTLINE }
  };
}

const _orbMatCache = new Map();

/**
 * The relic's two materials for one element, built once and kept.
 *
 * They share a single uniforms object, so the frame loop ticks `uTime` and the
 * lifetime fade writes `uAlpha` exactly once per orb per frame. There is
 * deliberately no dispose: see the note at the top of the file.
 */
export function getElementalOrbMaterials(element, colorHex, accentHex, inkHex = '#0b0f1a') {
  const key = `${element}_${colorHex}_${accentHex}_${inkHex}`;
  const hit = _orbMatCache.get(key);
  if (hit) return hit;

  const uniforms = makeUniforms(element, colorHex, accentHex, inkHex);
  // Transparent so the lifetime fade can dim it, but depth-written: the relic is
  // solid, and its pieces must hide one another.
  const base = { uniforms, vertexShader, transparent: true, depthWrite: true, toneMapped: false };
  const body = new THREE.ShaderMaterial({ ...base, fragmentShader: bodyFragment, side: THREE.FrontSide });
  const hull = new THREE.ShaderMaterial({ ...base, fragmentShader: hullFragment, side: THREE.BackSide, defines: { ORB_HULL: '' } });

  const set = { uniforms, body, hull };
  _orbMatCache.set(key, set);
  return set;
}
