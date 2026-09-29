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

/**
 * Where a character wears its skin's second colours along the body, shared by
 * the played worm and every preview. `out` arrives as the segment's base
 * colour; `index` is the drawn segment (the game passes its LOD write index so
 * bands keep alternating once the body is thinned). The head is never banded.
 */
export function characterSegmentPattern(out, character, skin, index, scratch) {
  if (index === 0) return out;
  // Dancer: candy stripes in the skin's light accent.
  if (character === 'wiggle' && index % 2 === 1) return out.lerp(scratch.set(skin.antenna), 0.5);
  // Brute: ribbed bands in the belly colour.
  if (character === 'inch' && index % 2 === 1) return out.lerp(scratch.set(skin.belly), 0.28);
  // Ranger: an earthworm's saddle, the paler band just behind the head.
  if (character === 'classic' && (index === 2 || index === 3)) return out.lerp(scratch.set(skin.antenna), 0.58);
  if (character === 'classic' && index > 3 && index % 2 === 0) return out.lerp(scratch.set(skin.belly), 0.18);
  return out;
}

// Face details attach to the existing face frame (+Z out of the face, +Y up
// it, units of head radius), so hats, cube rotations and tunnel traversal
// carry them with the head automatically. Each character gets one feature a
// thumbnail can read: the Ranger's and Dancer's rosy cheeks (and the Dancer's
// lashes, in finishWormEyes), the Scout's angler lure, the Brute's tusks, the
// Sage's spectacle arms, the Trickster's crystal horns.
const _normal = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
export function createCharacterAccents(character) {
  const group = new THREE.Group();
  const geometries = [], materials = [];
  const mat = (params, Type = THREE.MeshStandardMaterial) => { const m = new Type(params); materials.push(m); return m; };
  const geo = g => { geometries.push(g); return g; };
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.raycast = () => null; group.add(mesh); return mesh;
  };
  // A flat feature lying on the head sphere at direction (x, y, +z), facing out.
  const onSkin = (geometry, material, x, y, lift = 1.0) => {
    _normal.set(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y)));
    const mesh = add(geometry, material, _normal.x * lift, _normal.y * lift, _normal.z * lift);
    mesh.quaternion.setFromUnitVectors(_zAxis, _normal);
    return mesh;
  };
  let tint = null, update = null;

  if (character === 'classic' || character === 'wiggle') {
    const blush = mat({ color: '#ff7f9b', roughness: 0.6, transparent: true, opacity: 0.72, depthWrite: false });
    const cheek = geo(new THREE.SphereGeometry(1, 14, 8));
    for (const side of [-1, 1]) onSkin(cheek, blush, side * 0.6, -0.14, 0.985).scale.set(0.17, 0.12, 0.05);
    if (character === 'classic') {
      // A few freckles across each cheek, in the skin's deep belly colour.
      const freckle = mat({ color: '#2f5a3c', roughness: 0.7 });
      const dot = geo(new THREE.SphereGeometry(1, 6, 4));
      for (const side of [-1, 1]) for (const [x, y] of [[0.52, -0.05], [0.64, -0.08], [0.57, -0.19]]) onSkin(dot, freckle, side * x, y, 0.995).scale.set(0.024, 0.024, 0.012);
      tint = skin => freckle.color.set(skin.belly).multiplyScalar(0.55);
    }
  } else if (character === 'glow') {
    // An angler's lure: a stalk from the forehead arching out over the face,
    // ending in a bulb of the skin's glow colour.
    const stalkMat = mat({ color: '#2f6b57', roughness: 0.45 });
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.55, 0.78), new THREE.Vector3(0, 1.45, 1.1), new THREE.Vector3(0, 1.0, 1.72));
    add(geo(new THREE.TubeGeometry(curve, 18, 0.055, 6, false)), stalkMat, 0, 0, 0);
    const bulbMat = mat({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.3, roughness: 0.2, toneMapped: false });
    const bulb = add(geo(new THREE.SphereGeometry(0.21, 16, 12)), bulbMat, 0, 0.96, 1.76);
    const coreMat = mat({ color: '#ffffff', toneMapped: false }, THREE.MeshBasicMaterial);
    add(geo(new THREE.SphereGeometry(0.08, 10, 8)), coreMat, -0.05, 1.03, 1.9);
    tint = skin => { bulbMat.color.set(skin.glow); bulbMat.emissive.set(skin.glow); stalkMat.color.set(skin.belly).multiplyScalar(0.7); };
    update = time => { const s = 1 + Math.sin(time * 3.1) * 0.08; bulb.scale.setScalar(s); bulbMat.emissiveIntensity = 1.1 + Math.sin(time * 3.1) * 0.35; };
  } else if (character === 'book') {
    // Bridge and temple arms connect the existing round spectacle rims.
    const brass = mat({ color: '#b98739', roughness: 0.3, metalness: 0.65 });
    add(geo(new THREE.TorusGeometry(0.085, 0.024, 5, 10, Math.PI)), brass, 0, 0.20, 0.96);
    const arm = geo(new THREE.CylinderGeometry(0.024, 0.024, 0.48, 5));
    for (const side of [-1, 1]) add(arm, brass, side * 0.68, 0.20, 0.68).rotation.x = Math.PI / 2;
  } else if (character === 'inch') {
    const feelerMat = mat({ color: '#c4df70', roughness: 0.36, metalness: 0.05 });
    const feeler = geo(new THREE.CylinderGeometry(0.034, 0.055, 0.45, 6));
    const knob = geo(new THREE.SphereGeometry(0.10, 8, 6));
    for (const side of [-1, 1]) {
      add(feeler, feelerMat, side * 0.58, 0.77, 0.34).rotation.z = -side * 0.35;
      add(knob, feelerMat, side * 0.66, 0.98, 0.34);
    }
    // Two stubby tusks at the corners of the smile: the Brute's underbite.
    const ivory = mat({ color: '#fff3d6', roughness: 0.35 });
    const tusk = geo(new THREE.ConeGeometry(0.055, 0.17, 8));
    for (const side of [-1, 1]) {
      const t = add(tusk, ivory, side * 0.2, -0.3, 0.96);
      t.rotation.set(0.35, 0, -side * 0.28);
    }
    tint = skin => feelerMat.color.set(skin.antenna);
  } else if (character === 'prism') {
    const crystal = mat({ color: '#b9f4ff', emissive: '#37899c', emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.2, flatShading: true });
    const gem = add(geo(new THREE.OctahedronGeometry(0.19)), crystal, 0, 0.63, 0.76);
    gem.scale.set(0.7, 1, 0.4);
    // Crystal horns, set back on the crown's shoulders.
    const horn = geo(new THREE.OctahedronGeometry(0.2));
    for (const side of [-1, 1]) {
      const h = add(horn, crystal, side * 0.55, 0.78, 0.3);
      h.scale.set(0.5, 1.25, 0.5); h.rotation.z = -side * 0.5;
    }
  }
  return {
    group,
    /** Recolour the parts that follow the equipped skin. */
    setSkin(skin) { if (tint && skin) tint(skin); },
    /** Idle motion; time is frozen by callers for pause and reduced motion. */
    update(time) { update?.(time); },
    dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); }
  };
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
