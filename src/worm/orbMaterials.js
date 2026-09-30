import * as THREE from 'three';

/**
 * Which colour each part of a parity orb wears. The band is the manifold the orb
 * sits on (its colour, and its tile style on patterned boards); the gem body is
 * that face's antipodal partner. On a white face: yellow gem, white band.
 * MOBI's carried orbs (mobiOrbAppearance.js) follow the same rule.
 */
export function orbColorRoles(faceColor, antipodalColor) {
  return { gem: antipodalColor, band: faceColor };
}

// A lit rim on the glass shell: the gem's own colour blooms at its silhouette and
// the glass thickens there, so a smaller orb still reads crisply against any tile
// and from the far chase camera. One shared program for every shell (fixed cache
// key); orbReveal chains its dissolve on top of this patch.
export const ORB_RIM_STRENGTH = 1.35;
function addOrbRim(material) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float orbRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.4);
  totalEmissiveRadiance += emissive * orbRim * ${ORB_RIM_STRENGTH.toFixed(2)};
  diffuseColor.a = mix(diffuseColor.a, 1.0, orbRim * 0.55);`);
  };
  material.customProgramCacheKey = () => 'parity-orb-rim';
  return material;
}

// Shared shader variants stay resident across respawns. Uniform animation uses
// the global clock, and elevated/glow states get separate sets so they cannot
// recolor ordinary pickups. Mesh transforms retain their individual phases.
const _orbMatCache = new Map();
export function getOrbMaterials(gemColor, bandColor, isTarget, elevated = false, isGlowWorm = false) {
  const key = `${gemColor}_${bandColor}_${isTarget ? 't' : 'n'}_${elevated ? 'rainbow' : 'plain'}_${isGlowWorm ? 'glow' : 'normal'}`;
  const hit = _orbMatCache.get(key);
  if (hit) return hit;
  const basic = (color, opacity, extra) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, ...extra });
  const set = {
    shell: addOrbRim(new THREE.MeshPhysicalMaterial({
      color: gemColor, emissive: gemColor, emissiveIntensity: isTarget ? 0.85 : 0.6,
      metalness: 0, roughness: 0.06, iridescence: 1, iridescenceIOR: 1.4,
      clearcoat: 1, clearcoatRoughness: 0.08,
      transparent: true, opacity: 0.72, depthWrite: false, toneMapped: false
    })),
    innerCore: new THREE.MeshStandardMaterial({
      color: gemColor, emissive: gemColor, emissiveIntensity: isTarget ? 2.6 : 2.0,
      metalness: 0, roughness: 0.1, toneMapped: false
    }),
    innerGlow: basic(gemColor, 0.18, { blending: THREE.AdditiveBlending, side: THREE.BackSide }),
    // Great-circle parity halo — a smooth glowing ring in place of the old
    // wireframe octahedron. Additive so it reads as light, not a hard frame.
    // Linear RGB and opacity live in the merged cage's RGBA vertex attribute;
    // alpha stays separate from RGB so display-space additive blending is exact.
    cage: basic('#ffffff', 1, { blending: THREE.AdditiveBlending, vertexColors: true }),
    nodeGem: new THREE.MeshBasicMaterial({ color: gemColor, toneMapped: false }),
    nodeBand: new THREE.MeshBasicMaterial({ color: bandColor, toneMapped: false }),
    band: new THREE.MeshStandardMaterial({
      color: bandColor, emissive: bandColor, emissiveIntensity: isTarget ? 1.8 : 1.2,
      metalness: 0.15, roughness: 0.06, side: THREE.DoubleSide
    }),
    ringA: new THREE.MeshBasicMaterial({ color: gemColor, transparent: true, opacity: 0.42, depthWrite: false }),
    ringB: new THREE.MeshBasicMaterial({ color: bandColor, transparent: true, opacity: 0.34, depthWrite: false }),
    ringC: new THREE.MeshBasicMaterial({ color: gemColor, transparent: true, opacity: 0.28, depthWrite: false }),
    lockRing: new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0.30,
      blending: THREE.AdditiveBlending, depthWrite: false
    }),
    reduced: new THREE.MeshStandardMaterial({
      color: gemColor, emissive: gemColor, emissiveIntensity: 1.4,
      roughness: 0.18, metalness: 0.05, toneMapped: false
    })
  };
  _orbMatCache.set(key, set);
  return set;
}
