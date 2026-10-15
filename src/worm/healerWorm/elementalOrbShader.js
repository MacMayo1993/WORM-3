// src/worm/healerWorm/elementalOrbShader.js
//
// The material set behind the elemental pickup's *body* — the shaped glass body the
// crest badge floats over. Four layers, all sharing one vertex stage:
//
//   core  — the element itself, churning inside the sphere (object-space field,
//           slowly rotated in-shader so the interior turns even while the orb
//           holds still). Normal-blended, so water reads deep and fire reads solid.
//   shell — the glass around it: fresnel rim, a thin-film band and a specular
//           hotspot, additively blended so the middle stays clear and only the
//           edge lights up. This is what makes it read as a sphere rather than a
//           flat glowing disc.
//   inner — a back-side additive bloom just under the shell, so the core appears
//           to be lit from within rather than pasted on.
//   hull  — a slightly inflated back-face copy in the element's dark ink. Behind
//           the body it is a dark backing (the sticker under a translucent orb
//           used to show through and tint it, so Water on a blue tile or Earth on
//           a green one vanished), and past the silhouette it is an ink outline,
//           the same inked look as the worm's handmade pieces.
//
// Each element has its own body shape (elementalOrbShapes.js); the vertex stage
// animates the two that move: fire licks into tongues, the tornado sways.
//
// `uMode` is a uniform, not a #define, so every element shares one compiled
// program: spawning an offering (four orbs at once, every 12s) never triggers a
// shader compile after the first one.
//
// The material set is cached per element and never disposed. It used to be built
// per orb instance and disposed on unmount, on the assumption that three's program
// cache would keep one program alive across spawns. It does not: `releaseProgram`
// decrements a use count and destroys the program when the last material using it
// is disposed, so every offering — one every ELEMENTAL_SPAWN_INTERVAL seconds —
// recompiled and relinked these three shaders from scratch, forever. Shader linking
// is synchronous, so on a phone that read as the game freezing every 12 seconds.
//
// An offering places at most one orb per element, so one set per element is all
// that is ever live and `uAlpha` has a single writer. The cache is bounded by the
// six elements, matching how ElementalSurface and HealerBombs hold their own
// long-lived materials.

import * as THREE from 'three';

/** Element → shader branch. Matches ELEMENTAL_TYPES order but is looked up by key. */
export const ELEMENT_MODE = { water: 0, fire: 1, grass: 2, ice: 3, lightning: 4, air: 5 };

const varyings = /* glsl */ `
  uniform float uTime;
  uniform int uMode;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform vec3 uInk;
  uniform float uAlpha;
  varying vec3 vLocal;
  varying vec3 vNormalW;
  varying vec3 vViewW;
`;

// Shared vertex stage. The orb's own group carries a uniform scale, so the plain
// mat3(modelMatrix) normal transform is exact here (no normal matrix needed). The
// displacement leaves normals as authored: at the size an orb is drawn the
// difference does not read, and the hull runs the same stage so its outline
// follows the moving silhouette.
const vertexShader = /* glsl */ `
  ${varyings}
  void main() {
    vLocal = position;
    vec3 pos = position;
    if (uMode == 1) {
      // Flame: the tongues climb and sway, more the higher they reach, so the
      // crown's outline flickers.
      float h = smoothstep(-0.2, 0.6, pos.y);
      float a = atan(pos.z, pos.x);
      pos.y += h * h * 0.08 * sin(uTime * 5.0 + a * 3.0);
      pos.x += sin(uTime * 3.1 + pos.y * 4.0) * 0.07 * h * h;
      pos.z += cos(uTime * 2.7 + pos.y * 3.0) * 0.04 * h * h;
    } else if (uMode == 5) {
      // Tornado: the narrow foot whips about under a steadier mouth.
      float foot = 0.5 - pos.y;
      pos.x += sin(uTime * 2.6 + pos.y * 3.0) * 0.07 * foot;
      pos.z += cos(uTime * 2.2 + pos.y * 2.5) * 0.05 * foot;
    }
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Cheap trig field — no noise texture, no derivatives. Three octaves is enough
// structure at the size an orb occupies on screen.
const fieldFns = /* glsl */ `
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
`;

const coreFragment = /* glsl */ `
  precision highp float;
  ${varyings}
  ${fieldFns}

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(vViewW);
    // Rim term. Squared, so the falloff hugs the silhouette instead of washing
    // the whole ball out.
    float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.0);
    float t = uTime;
    // The interior turns on its own axis, independent of the orb's own spin, so
    // the element keeps churning even when the orb is held still.
    vec3 p = rotY(vLocal, t * 0.32) * 3.4;
    float f = field(p, t);

    vec3 col;
    float alpha;

    // Every interior is kept dense (alpha near 1 at the centre): a see-through
    // body takes on the sticker behind it, which is what made the elements hard
    // to tell apart on a scrambled cube.
    if (uMode == 0) {
      // Water: deep blue with a sloshing waterline and bright caustic webs.
      float wave = sin(p.x * 3.0 + t * 1.6) * 0.18 + sin(p.z * 2.5 - t * 1.2) * 0.14;
      float below = 1.0 - smoothstep(-0.12, 0.12, p.y - wave);
      float c = abs(sin(p.x * 2.6 + t * 0.9) + sin(p.y * 3.1 - t * 1.1) + sin(p.z * 2.3 + t * 0.7));
      float caustic = pow(1.0 - clamp(c * 0.6, 0.0, 1.0), 4.0);
      vec3 deep = vec3(0.02, 0.10, 0.36);
      col = mix(deep, uColor * 0.85, below * 0.55 + 0.15);
      col += uAccent * caustic * (0.35 + 0.55 * below);
      col += uAccent * exp(-abs(p.y - wave) * 12.0) * 0.7;
      alpha = 0.88 + fres * 0.12;
    } else if (uMode == 1) {
      // Fire: a white-gold heart under orange tongues, darkening to red at the tips.
      float flame = sin(p.x * 6.0 + sin(p.y * 3.0 - t * 2.6)) + sin(p.z * 5.0 - t * 1.4);
      float tongues = smoothstep(-0.8, 0.8, flame - p.y * 0.5);
      float heart = exp(-dot(vLocal.xz, vLocal.xz) * 18.0) * smoothstep(0.45, -0.3, vLocal.y);
      col = mix(vec3(0.55, 0.05, 0.02), uColor * 1.1, tongues);
      col = mix(col, uAccent * 1.15, clamp(heart * 1.3, 0.0, 1.0));
      alpha = 0.9 + tongues * 0.1;
    } else if (uMode == 2) {
      // Earth: grey-brown stone, a cap of moss, and glowing green seams of life.
      float shade = 0.55 + 0.45 * clamp(dot(normalize(vNormalW), normalize(vec3(0.4, 0.9, 0.3))), 0.0, 1.0);
      vec3 stone = mix(vec3(0.42, 0.34, 0.26), vec3(0.66, 0.58, 0.47), 0.5 + 0.5 * sin(f * 1.3));
      float moss = smoothstep(0.14, 0.26, vLocal.y + 0.06 * sin(f * 2.0));
      col = mix(stone, uColor * 0.85, moss) * shade;
      float seam = 1.0 - smoothstep(0.0, 0.14, abs(f - 0.6));
      col += uColor * seam * (1.0 - moss) * (0.7 + 0.3 * sin(t * 1.5));
      alpha = 0.98;
    } else if (uMode == 3) {
      // Ice: hard facets, each lit flat, over a cold blue depth with frost cracks.
      float facet = clamp(dot(normalize(vNormalW), normalize(vec3(0.3, 0.8, 0.5))), 0.0, 1.0);
      vec3 depth = vec3(0.16, 0.42, 0.72);
      col = mix(depth, vec3(0.88, 0.97, 1.0), facet * 0.75 + fres * 0.25);
      float crack = 1.0 - smoothstep(0.0, 0.08, abs(sin(p.x * 2.2 + p.y * 1.7) + sin(p.z * 2.6 - p.y)));
      col += vec3(1.0) * crack * 0.35;
      col += uAccent * pow(0.5 + 0.5 * sin(vLocal.y * 9.0 - t * 1.6), 16.0) * 0.4;
      alpha = 0.86 + fres * 0.14;
    } else if (uMode == 5) {
      // Air: pale streamers spiralling up the funnel, fast.
      float angle = atan(vLocal.z, vLocal.x + 0.00001);
      float spiral = pow(0.5 + 0.5 * sin(angle * 3.0 - vLocal.y * 14.0 - t * 7.0), 3.0);
      vec3 base = mix(vec3(0.20, 0.52, 0.55), uColor, 0.45);
      col = mix(base, uAccent, spiral * 0.85 + fres * 0.15);
      alpha = 0.72 + spiral * 0.28;
    } else {
      // ── Lightning: a dark conductive body with white-hot filaments running
      // through it, discharging in bursts rather than pulsing evenly. The core is
      // kept deliberately dark so the filaments have something to be bright
      // against — an evenly-lit violet ball reads as a plasma globe, not a charge.
      float filament = 1.0 - smoothstep(0.0, 0.30, abs(f));
      // Discharge gate: mostly quiet, with brief bursts. floor(t*n) re-rolls the
      // burst a few times a second, which is what makes it read as arcing rather
      // than as a sine glow.
      float burst = pow(0.5 + 0.5 * sin(t * 3.1 + floor(t * 5.0) * 8.13), 6.0);
      float veins = filament * (0.45 + 1.0 * burst);
      col = mix(uColor * 0.16, uColor * 0.7, 0.5 + 0.5 * sin(f * 1.6));
      col += uAccent * veins * 1.30;
      // The spike tips carry the charge.
      col += uAccent * smoothstep(0.3, 0.5, length(vLocal)) * (0.4 + 0.6 * burst);
      alpha = 0.92 + veins * 0.08;
    }

    gl_FragColor = vec4(clamp(col, 0.0, 1.4), clamp(alpha, 0.0, 1.0) * uAlpha);
  }
`;

const shellFragment = /* glsl */ `
  precision highp float;
  ${varyings}

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(vViewW);
    float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
    // Thin-film shimmer riding the rim, so the glass has some life in it.
    float band = 0.5 + 0.5 * sin(fres * 14.0 + uTime * 1.4);
    vec3 col = mix(uColor, uAccent, clamp(fres * 0.9, 0.0, 1.0));
    col += vec3(band * 0.06);
    // Fixed key light: one tight hotspot sells "polished sphere" better than any
    // amount of extra rim. Kept small — widened, it smears into a diagonal streak
    // across the whole orb rather than reading as a highlight.
    vec3 L = normalize(vec3(0.45, 0.85, 0.55));
    float spec = pow(max(dot(reflect(-L, n), v), 0.0), 90.0);
    col += vec3(1.0) * spec * 0.75;
    float alpha = 0.05 + fres * 0.72 + spec * 0.45;
    gl_FragColor = vec4(clamp(col, 0.0, 1.6), clamp(alpha, 0.0, 1.0) * uAlpha);
  }
`;

// Back-side bloom under the shell: no detail, just an inward-facing glow that
// gives the core something to sit inside.
const innerFragment = /* glsl */ `
  precision highp float;
  ${varyings}

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(vViewW);
    // Back faces: the normal points away, so the rim term is the mirror of the
    // shell's and peaks where the sphere is thickest to look through.
    float rim = pow(clamp(-dot(n, v), 0.0, 1.0), 1.6);
    vec3 col = mix(uColor, uAccent, 0.35) * (0.55 + 0.45 * sin(uTime * 1.1));
    gl_FragColor = vec4(col, rim * 0.30 * uAlpha);
  }
`;

// The ink hull: a flat dark fill, drawn back-face only from a slightly inflated
// copy, so it shows as a backing behind the body and an outline around it.
const hullFragment = /* glsl */ `
  precision highp float;
  ${varyings}

  void main() {
    gl_FragColor = vec4(uInk, 0.92 * uAlpha);
  }
`;

function makeUniforms(element, colorHex, accentHex, inkHex) {
  return {
    uTime: { value: 0 },
    uMode: { value: ELEMENT_MODE[element] ?? 0 },
    uColor: { value: new THREE.Color(colorHex) },
    uAccent: { value: new THREE.Color(accentHex) },
    uInk: { value: new THREE.Color(inkHex) },
    uAlpha: { value: 1 }
  };
}

const _orbMatCache = new Map();

/**
 * The orb body's three materials for one element, built once and kept.
 *
 * They share a single uniforms object, so the frame loop ticks `uTime` and the
 * lifetime fade writes `uAlpha` exactly once per orb per frame rather than three
 * times. There is deliberately no dispose: see the note at the top of the file.
 */
export function getElementalOrbMaterials(element, colorHex, accentHex, inkHex = '#0b0f1a') {
  const key = `${element}_${colorHex}_${accentHex}_${inkHex}`;
  const hit = _orbMatCache.get(key);
  if (hit) return hit;

  const uniforms = makeUniforms(element, colorHex, accentHex, inkHex);
  const base = { uniforms, vertexShader, transparent: true, depthWrite: false, toneMapped: false };

  const core = new THREE.ShaderMaterial({ ...base, fragmentShader: coreFragment, side: THREE.FrontSide });
  const shell = new THREE.ShaderMaterial({
    ...base,
    fragmentShader: shellFragment,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending
  });
  const inner = new THREE.ShaderMaterial({
    ...base,
    fragmentShader: innerFragment,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });

  const hull = new THREE.ShaderMaterial({ ...base, fragmentShader: hullFragment, side: THREE.BackSide });

  const set = { uniforms, core, shell, inner, hull };
  _orbMatCache.set(key, set);
  return set;
}
