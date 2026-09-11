import * as THREE from 'three';

// Shared anatomical finish, installed once per head (never per body segment).
// Features are children of the existing eyes/pupils and inherit face orientation.
export function finishWormEyes(eyes, pupils) {
  const irisGeo = new THREE.TorusGeometry(0.90, 0.24, 6, 24);
  const lidGeo = new THREE.TorusGeometry(0.96, 0.075, 6, 24, Math.PI);
  const glintGeo = new THREE.SphereGeometry(1, 8, 6);
  const irisMat = new THREE.MeshPhysicalMaterial({ color: '#459a87', roughness: 0.24, clearcoat: 1, metalness: 0.15 });
  const lidMat = new THREE.MeshStandardMaterial({ color: '#34433f', roughness: 0.48 });
  const glintMat = new THREE.MeshBasicMaterial({ color: '#fffdf2', toneMapped: false });
  const attachments = [];
  for (let i = 0; i < 2; i++) {
    if (!eyes[i] || !pupils[i]) continue;
    const lid = new THREE.Mesh(lidGeo, lidMat);
    lid.position.z = 0.56;
    eyes[i].add(lid); attachments.push(lid);
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.z = 0.15;
    pupils[i].add(iris); attachments.push(iris);
    const glint = new THREE.Mesh(glintGeo, glintMat);
    glint.position.set(-0.30, 0.32, 1.03); glint.scale.set(0.18, 0.18, 0.10);
    pupils[i].add(glint); attachments.push(glint);
  }
  return () => {
    attachments.forEach(part => part.removeFromParent());
    [irisGeo, lidGeo, glintGeo, irisMat, lidMat, glintMat].forEach(resource => resource.dispose());
  };
}

// Keep the head/collision envelope unchanged. A small neck and graduated tail
// give the body a silhouette instead of a string of equal beads.
export function wormBodyTaper(index, count, character) {
  if (index === 0 || character === 'book' || character === 'mobi') return 1;
  const tail = Math.max(0, Math.min(1, (index - Math.max(1, count - 5)) / 4));
  return (index === 1 ? 0.88 : 1) * (1 - tail * (character === 'inch' ? 0.18 : 0.32));
}
