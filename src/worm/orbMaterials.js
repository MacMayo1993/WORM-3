import * as THREE from 'three';

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
    shell: new THREE.MeshPhysicalMaterial({
      color: gemColor, emissive: gemColor, emissiveIntensity: isTarget ? 0.85 : 0.6,
      metalness: 0, roughness: 0.06, iridescence: 1, iridescenceIOR: 1.4,
      clearcoat: 1, clearcoatRoughness: 0.08,
      transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false
    }),
    innerCore: new THREE.MeshStandardMaterial({
      color: gemColor, emissive: gemColor, emissiveIntensity: isTarget ? 2.6 : 2.0,
      metalness: 0, roughness: 0.1, toneMapped: false
    }),
    innerGlow: basic(gemColor, 0.18, { blending: THREE.AdditiveBlending, side: THREE.BackSide }),
    // Great-circle parity halo — a smooth glowing ring in place of the old
    // wireframe octahedron. Additive so it reads as light, not a hard frame.
    cage: basic('#e8fbff', isTarget ? 0.55 : 0.42, { blending: THREE.AdditiveBlending }),
    // Second, cross-tilted halo so the antipodal signature reads from any angle
    // without any straight edges.
    cage2: basic('#dff8ff', isTarget ? 0.38 : 0.28, { blending: THREE.AdditiveBlending }),
    // Luminous axis connecting the antipodal poles — soft additive glow rod,
    // no longer a flat opaque cylinder.
    axis: basic('#ffffff', 0.5, { blending: THREE.AdditiveBlending }),
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

