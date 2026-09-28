import * as THREE from 'three';

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
const solid = { transparent: true, depthWrite: false, toneMapped: false };

export function createPickupMaterials() {
  return {
    core: new THREE.MeshBasicMaterial(additive),
    halo: new THREE.MeshBasicMaterial({ ...additive, side: THREE.BackSide }),
    ring: new THREE.MeshBasicMaterial({ ...solid, side: THREE.DoubleSide }),
    ringWhite: new THREE.MeshBasicMaterial({ ...solid, side: THREE.DoubleSide }),
    sparks: new THREE.MeshBasicMaterial(solid),
    motes: new THREE.MeshBasicMaterial(solid),
  };
}

export function resetPickupMaterials(materials, color = '#ffd700') {
  for (const [key, material] of Object.entries(materials)) {
    material.color.set(['halo', 'ring', 'motes'].includes(key) ? color : '#ffffff');
    material.opacity = 1;
  }
}

const disposeSet = set => Object.values(set).forEach(material => material.dispose());

// Each overlapping burst owns its colours/opacity. Only finished sets are reused.
// A separate warm set pins the programs even when all live bursts disappear.
export function createPickupMaterialPool(maxIdle = 8) {
  const warm = createPickupMaterials(), idle = [], active = new Set();
  return {
    warm,
    acquire() {
      const set = idle.pop() ?? createPickupMaterials();
      resetPickupMaterials(set); active.add(set);
      return set;
    },
    release(set) {
      if (!active.delete(set)) return;
      if (idle.length < maxIdle) idle.push(set);
      else disposeSet(set);
    },
    dispose() {
      for (const set of [...idle, ...active, warm]) disposeSet(set);
      idle.length = 0; active.clear();
    },
    get size() { return { active: active.size, idle: idle.length }; },
  };
}

export function pickupWarmupMeshes(materials, geometry) {
  return Object.entries(materials).map(([key, material]) => {
    if (key !== 'sparks' && key !== 'motes') return new THREE.Mesh(geometry, material);
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    if (key === 'sparks') mesh.setColorAt(0, new THREE.Color('#ffffff'));
    return mesh;
  });
}
