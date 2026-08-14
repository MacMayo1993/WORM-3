// src/worm/healerWorm/elementalOrbShader.js
//
// The material set behind the elemental pickup's *body* — the glassy sphere the
// crest badge floats on. Three layers, all driven by one small shader pair:
//
//   core  — the element itself, churning inside the sphere (object-space field,
//           slowly rotated in-shader so the interior turns even while the orb
//           holds still). Normal-blended, so water reads deep and lava reads solid.
//   shell — the glass around it: fresnel rim, a thin-film band and a specular
//           hotspot, additively blended so the middle stays clear and only the
//           edge lights up. This is what makes it read as a sphere rather than a
//           flat glowing disc.
//   inner — a back-side additive bloom just under the shell, so the core appears
//           to be lit from within rather than pasted on.
//
// `uMode` is a uniform, not a #define, so all four elements share one compiled
// program: spawning an offering (four orbs at once, every 12s) never triggers a
// shader compile after the first one.
//
// Materials are built per orb instance and disposed with it — see ElementalOrb —
// because each orb drives its own `uAlpha` for the lifetime fade. Three's program
// cache keys on shader source, so per-instance materials are still one program.

import * as THREE from 'three';

/** Element → shader branch. Matches ELEMENTAL_TYPES order but is looked up by key. */
export const ELEMENT_MODE = { water: 0, lava: 1, grass: 2, ice: 3 };

const varyings = /* glsl */ `
  uniform float uTime;
  uniform int uMode;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uAlpha;
  varying vec3 vLocal;
  varying vec3 vNormalW;
  varying vec3 vViewW;
`;

// Shared vertex stage. The orb's own group carries a uniform scale, so the plain
// mat3(modelMatrix) normal transform is exact here (no normal matrix needed).
const vertexShader = /* glsl */ `
  ${varyings}
  void main() {
    vLocal = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
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

    if (uMode == 0) {
      // ── Water: drifting caustic net over a deep body, brightening at the rim.
      float caustic = pow(max(0.0, sin(p.x * 2.3 + f) * sin(p.z * 2.5 - f)), 3.0);
      col = mix(uColor * 0.30, uColor, 0.5 + 0.5 * sin(f));
      col += uAccent * caustic * 0.95;
      col = mix(col, uAccent, fres * 0.4);
      alpha = 0.46 + fres * 0.34 + caustic * 0.22;
    } else if (uMode == 1) {
      // ── Lava: dark crust plates broken by molten veins, flickering.
      float crust = smoothstep(0.25, 1.40, abs(f));
      float vein = 1.0 - smoothstep(0.0, 0.38, abs(f));
      float flicker = 0.84 + 0.16 * sin(t * 6.5 + p.x * 3.0 - p.y * 2.2);
      col = mix(uColor * 1.10, vec3(0.10, 0.025, 0.015), crust * 0.82);
      col += uAccent * vein * flicker * 1.15;
      col += uColor * fres * 0.45;
      alpha = 0.74 + fres * 0.26;
    } else if (uMode == 2) {
      // ── Nature: mottled canopy with fine blade striations over it. The bands
      // are *summed*, not multiplied — a product of sines sits near zero almost
      // everywhere and flattens the whole sphere to one shade of green.
      float canopy = 0.5 * sin(p.x * 2.2 + t * 0.50) + 0.5 * sin(p.y * 1.9 - t * 0.40) + 0.5 * sin(p.z * 2.4 + t * 0.45);
      float blade = sin(p.y * 7.5 + canopy * 2.2);
      float vein = smoothstep(0.55, 0.99, abs(blade));
      col = mix(uColor * 0.26, uColor * 1.08, 0.5 + 0.5 * sin(canopy * 1.4));
      col += uAccent * vein * 0.6;
      col = mix(col, uAccent, fres * 0.28);
      alpha = 0.64 + fres * 0.32;
    } else {
      // ── Ice: frozen facets shot through with cracks, glassy at the edge. Same
      // summed-band reasoning as nature above.
      float facet = 0.5 + 0.5 * sin(0.9 * sin(p.x * 2.4) + 0.9 * sin(p.y * 2.7) + 0.9 * sin(p.z * 2.2));
      float seam = sin(p.x * 2.1 + p.z * 2.5 + sin(p.y * 1.8) * 1.6);
      float crack = smoothstep(0.80, 1.0, abs(seam));
      col = mix(uColor * 0.50, vec3(0.92, 0.98, 1.0), facet * 0.55 + fres * 0.45);
      col += vec3(1.0) * crack * 0.65;
      alpha = 0.52 + fres * 0.40;
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

function makeUniforms(element, colorHex, accentHex) {
  return {
    uTime: { value: 0 },
    uMode: { value: ELEMENT_MODE[element] ?? 0 },
    uColor: { value: new THREE.Color(colorHex) },
    uAccent: { value: new THREE.Color(accentHex) },
    uAlpha: { value: 1 }
  };
}

/**
 * Build the orb body's three materials for one element.
 *
 * They share a single uniforms object, so the frame loop ticks `uTime` and the
 * lifetime fade writes `uAlpha` exactly once per orb per frame rather than three
 * times. Call `dispose()` when the orb unmounts.
 */
export function makeElementalOrbMaterials(element, colorHex, accentHex) {
  const uniforms = makeUniforms(element, colorHex, accentHex);
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

  return {
    uniforms,
    core,
    shell,
    inner,
    dispose() {
      core.dispose();
      shell.dispose();
      inner.dispose();
    }
  };
}
