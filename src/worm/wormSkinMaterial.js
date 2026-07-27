// src/worm/wormSkinMaterial.js
// Builds the worm body's MeshPhysicalMaterial from a skin's FX profile
// (wormSkinFX.js). Framework-agnostic (plain three.js) so the exact same
// factory drives all three worm renderers: the instanced Healer body
// (WormBody.jsx), the per-segment Platformer body (CrawlerCharacter.jsx), and
// the vanilla-three store preview (WormPreviewRenderer.js) — one visual
// recipe, no drift between what you buy and what you play.
//
// Bump styles are all baked into ONE compiled shader program (selected at
// runtime by the uStyle uniform) rather than one program per style, so
// swapping skins in the store preview never pays a shader-recompile stall.
import * as THREE from 'three';
import { BUMP_STYLES } from './wormSkinFX.js';

const NOISE_GLSL = `
  float wormHash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float wormNoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = wormHash13(i + vec3(0.0, 0.0, 0.0));
    float n100 = wormHash13(i + vec3(1.0, 0.0, 0.0));
    float n010 = wormHash13(i + vec3(0.0, 1.0, 0.0));
    float n110 = wormHash13(i + vec3(1.0, 1.0, 0.0));
    float n001 = wormHash13(i + vec3(0.0, 0.0, 1.0));
    float n101 = wormHash13(i + vec3(1.0, 0.0, 1.0));
    float n011 = wormHash13(i + vec3(0.0, 1.0, 1.0));
    float n111 = wormHash13(i + vec3(1.0, 1.0, 1.0));
    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z);
  }
`;

const DISPLACE_GLSL = `
  #ifdef USE_INSTANCING
    vec3 wormSeed = instanceMatrix[3].xyz * 3.0;
  #else
    vec3 wormSeed = vec3(uSeed, uSeed * 1.7, uSeed * 2.3);
  #endif
  float wormDisp = 0.0;
  if (uStyle > 0.5 && uStyle < 1.5) {
    // bump — organic craggy/pustule noise, cubed for sharper peaks
    float n = wormNoise3(transformed * uFreq + wormSeed + uTime * uSpeed * 0.25);
    wormDisp = pow(n, 3.0) * uAmp;
  } else if (uStyle > 1.5 && uStyle < 2.5) {
    // facet — quantized noise for chunky crystalline steps (static, no time term)
    float n = wormNoise3(transformed * uFreq + wormSeed);
    wormDisp = (floor(n * 5.0) / 5.0) * uAmp;
  } else if (uStyle > 2.5) {
    // ripple — smooth traveling wave, no noise
    wormDisp = sin(dot(transformed, vec3(1.0)) * uFreq + uTime * uSpeed + wormSeed.x) * uAmp;
  }
  transformed += objectNormal * wormDisp;
`;

/**
 * Create a fresh worm-body material with the displacement shader wired in.
 * Callers then apply a skin's FX profile via applySkinMaterialProfile().
 * One material per mesh use (instanced body / per-segment mesh / preview
 * bead) — cheap at worm-body polycounts, and lets independent per-segment
 * color/emissive tweaks (prism cycling, glow pulses) keep working untouched.
 */
export function createWormSkinMaterial(options = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    toneMapped: false,
    ...options,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uAmp = { value: 0 };
    shader.uniforms.uFreq = { value: 1 };
    shader.uniforms.uSpeed = { value: 1 };
    shader.uniforms.uStyle = { value: 0 };
    shader.uniforms.uSeed = { value: material.userData.seed ?? 0 };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nuniform float uTime;\nuniform float uAmp;\nuniform float uFreq;\nuniform float uSpeed;\nuniform float uStyle;\nuniform float uSeed;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${DISPLACE_GLSL}`);

    material.userData.shader = shader;
  };

  return material;
}

/**
 * Apply a skin's FX profile (material PBR properties + bump recipe) to a
 * material created by createWormSkinMaterial(). Safe to call again on skin
 * change — flatShading toggles trigger a one-time recompile (needsUpdate),
 * everything else is a plain uniform/property update.
 *
 * @param {THREE.Material} material
 * @param {object} fx - result of getSkinFX(skinId)
 * @param {number} seed - per-mesh variation seed for non-instanced use (e.g. segment index)
 */
export function applySkinMaterialProfile(material, fx, seed = 0) {
  const m = fx.material || {};
  material.metalness = m.metalness ?? 0;
  material.roughness = m.roughness ?? 0.4;
  material.clearcoat = m.clearcoat ?? 0;
  material.clearcoatRoughness = m.clearcoatRoughness ?? 0.2;
  material.sheen = m.sheen ?? 0;
  material.sheenRoughness = m.sheenRoughness ?? 0.5;
  material.sheenColor = material.sheenColor || new THREE.Color();
  material.sheenColor.set(0xffffff);
  material.transmission = m.transmission ?? 0;
  material.ior = m.ior ?? 1.5;
  material.thickness = m.thickness ?? 0;
  material.iridescence = m.iridescence ?? 0;
  material.iridescenceIOR = m.iridescenceIOR ?? 1.3;
  material.emissiveIntensity = m.emissiveIntensity ?? 0.22;

  const flat = !!m.flatShading;
  if (material.flatShading !== flat) {
    material.flatShading = flat;
    material.needsUpdate = true;
  }

  material.userData.seed = seed;
  material.userData.pulse = fx.pulse ? { base: material.emissiveIntensity, amp: fx.pulse.amp, speed: fx.pulse.speed } : null;

  const bump = fx.bump || { style: 'none' };
  const shader = material.userData.shader;
  if (shader) {
    shader.uniforms.uStyle.value = BUMP_STYLES[bump.style] ?? 0;
    shader.uniforms.uAmp.value = bump.amp ?? 0;
    shader.uniforms.uFreq.value = bump.freq ?? 1;
    shader.uniforms.uSpeed.value = bump.speed ?? 1;
    shader.uniforms.uSeed.value = seed;
  }
}

/**
 * Call once per frame per material (after applySkinMaterialProfile) to drive
 * time-based displacement and emissive pulsing.
 */
export function updateWormSkinMaterialTime(material, elapsed) {
  const shader = material.userData.shader;
  if (shader) shader.uniforms.uTime.value = elapsed;
  const pulse = material.userData.pulse;
  if (pulse) {
    material.emissiveIntensity = pulse.base * (1 + Math.sin(elapsed * pulse.speed + (material.userData.seed || 0)) * pulse.amp);
  }
}
