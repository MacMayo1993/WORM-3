import * as THREE from 'three';

// Unit-radius assets: detail stays inside the existing surface/collision envelope.
// Gameplay instances and picker meshes use the same recipe, with no extra body draws.
export function createCharacterGeometry(character) {
  const prism = character === 'prism';
  const geometry = prism ? new THREE.IcosahedronGeometry(1, 1) : new THREE.SphereGeometry(1, character === 'inch' ? 20 : 16, 16);
  if (!prism && character !== 'inch') return geometry;
  const p = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (prism) {
      // Broad jewel planes alternate in value; the moving spectrum supplies hue.
      const shade = 0.70 + (Math.floor(i / 3) % 5) * 0.075;
      colors.push(shade, shade, 1);
    } else {
      const rib = 0.94 + 0.06 * Math.cos(z * Math.PI * 6);
      p.setXYZ(i, x * rib, y * rib, z);
      const stripe = Math.abs(y - 0.18) < 0.15;
      const belly = y < -0.35;
      colors.push(belly ? 0.72 : 1, stripe ? 0.94 : belly ? 0.78 : 1, stripe ? 0.48 : belly ? 0.52 : 0.88);
    }
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function applyCharacterFinish(material, character) {
  const prism = character === 'prism', inch = character === 'inch';
  material.vertexColors = prism || inch;
  if (prism || inch || character === 'book') {
    material.roughness = prism ? 0.19 : inch ? 0.48 : 0.38;
    material.clearcoat = prism ? 1 : 0.45;
    material.clearcoatRoughness = 0.16;
    material.emissiveIntensity = prism ? 0.07 : 0.035;
    material.userData.pulse = null;
    if (prism) {
      material.metalness = 0.28;
      material.iridescence = 0.8;
      material.flatShading = true;
      // Opaque crystal avoids a transmission render pass on mobile.
      material.transmission = 0;
    }
  }
  material.needsUpdate = true;
}

export function prismColor(out, index, time) {
  return out.setHSL((0.52 + index * 0.095 + time * 0.035) % 1, 0.78, 0.53);
}

// Small face accessories attach to the existing face frame, so hats, cube
// rotations and tunnel traversal carry them with the head automatically.
export function createCharacterAccents(character) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: character === 'book' ? '#b98739' : '#c4df70', roughness: 0.36, metalness: character === 'book' ? 0.65 : 0.05 });
  const parts = [];
  const add = (geo, x, y, z) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z); group.add(mesh); parts.push(mesh); return mesh;
  };
  if (character === 'book') {
    // Bridge and temple arms connect the existing round spectacle rims.
    add(new THREE.TorusGeometry(0.085, 0.024, 5, 10, Math.PI), 0, 0.20, 0.96);
    for (const side of [-1, 1]) {
      const arm = add(new THREE.CylinderGeometry(0.024, 0.024, 0.48, 5), side * 0.68, 0.20, 0.68);
      arm.rotation.x = Math.PI / 2;
    }
  } else if (character === 'inch') {
    for (const side of [-1, 1]) {
      const feeler = add(new THREE.CylinderGeometry(0.034, 0.055, 0.45, 6), side * 0.58, 0.77, 0.34);
      feeler.rotation.z = -side * 0.35;
      add(new THREE.SphereGeometry(0.10, 8, 6), side * 0.66, 0.98, 0.34);
    }
  } else if (character === 'prism') {
    material.color.set('#b9f4ff'); material.emissive.set('#37899c'); material.emissiveIntensity = 0.25;
    const gem = add(new THREE.OctahedronGeometry(0.19), 0, 0.63, 0.76);
    gem.scale.set(0.7, 1, 0.4);
  }
  return { group, dispose() { parts.forEach(p => p.geometry.dispose()); material.dispose(); } };
}

const faceDir = new THREE.Vector3(), right = new THREE.Vector3(), faceUp = new THREE.Vector3();
const basis = new THREE.Matrix4();
export function poseCharacterAccents(group, center, forward, up, radius) {
  faceDir.copy(up).multiplyScalar(0.62).addScaledVector(forward, 0.79).normalize();
  right.crossVectors(up, forward).normalize();
  faceUp.crossVectors(faceDir, right).normalize();
  basis.makeBasis(right, faceUp, faceDir);
  group.position.copy(center); group.quaternion.setFromRotationMatrix(basis); group.scale.setScalar(radius);
}
