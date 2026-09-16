import * as THREE from 'three';
import { WORM_FACE_PROFILES } from './wormFaceExpression.js';

// Shared by gameplay and previews. Children inherit the face's surface basis.
export function finishWormEyes(eyes, pupils, character = 'classic', mouth = null) {
  const profile = WORM_FACE_PROFILES[character] || WORM_FACE_PROFILES.classic;
  const irisGeo = new THREE.TorusGeometry(0.82, 0.26, 8, character === 'prism' ? 4 : 24);
  const lidGeo = new THREE.TorusGeometry(1.02, 0.115, 6, 20, Math.PI);
  const glintGeo = new THREE.SphereGeometry(1, 8, 6);
  const irisMat = new THREE.MeshStandardMaterial({ color: profile.iris, emissive: profile.iris,
    emissiveIntensity: character === 'glow' ? 0.65 : 0.22, roughness: 0.25, metalness: 0.12, toneMapped: false });
  const lidMat = new THREE.MeshBasicMaterial({ color: profile.lid });
  const glintMat = new THREE.MeshBasicMaterial({ color: '#fffdf2', toneMapped: false });
  const attachments = [];
  for (let i = 0; i < 2; i++) {
    if (!eyes[i] || !pupils[i]) continue;
    const lid = new THREE.Mesh(lidGeo, lidMat);
    lid.position.set(0, 0.12, 0.62);
    lid.scale.y = 0.88;
    eyes[i].userData.wormBrow = lid;
    eyes[i].add(lid); attachments.push(lid);
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.z = 0.64;
    pupils[i].add(iris); attachments.push(iris);
    const glint = new THREE.Mesh(glintGeo, glintMat);
    glint.position.set(-0.32, 0.35, 1.15); glint.scale.set(0.23, 0.23, 0.12);
    pupils[i].add(glint); attachments.push(glint);

  }
  // A sculpted opening with an inset tooth line reads better than a thin arc.
  const originalMouth = mouth?.geometry;
  let smileGeometry, teethGeometry;
  if (mouth) {
    const smile = new THREE.Shape();
    smile.moveTo(-1, 0); smile.quadraticCurveTo(0, 0.20, 1, 0);
    smile.quadraticCurveTo(0.8, 1.10, 0, 1.10); smile.quadraticCurveTo(-0.8, 1.10, -1, 0);
    smileGeometry = new THREE.ShapeGeometry(smile, 16);
    mouth.geometry = smileGeometry;
    const tooth = new THREE.Shape();
    tooth.moveTo(-0.77, 0.16); tooth.quadraticCurveTo(0, 0.32, 0.77, 0.16);
    tooth.lineTo(0.59, 0.47); tooth.quadraticCurveTo(0, 0.58, -0.59, 0.47); tooth.closePath();
    teethGeometry = new THREE.ShapeGeometry(tooth, 12);
    const teeth = new THREE.Mesh(teethGeometry, glintMat);
    teeth.position.z = 0.04;
    mouth.add(teeth); attachments.push(teeth);
  }
  return () => {
    attachments.forEach(part => part.removeFromParent());
    eyes.forEach(eye => { if (eye) delete eye.userData.wormBrow; });
    if (mouth) mouth.geometry = originalMouth;
    [irisGeo, lidGeo, glintGeo, irisMat, lidMat, glintMat, smileGeometry, teethGeometry].forEach(resource => resource?.dispose());
  };
}

// Keep the head/collision envelope unchanged. A small neck and graduated tail
// give the body a silhouette instead of a string of equal beads.
export function wormBodyTaper(index, count, character) {
  if (index === 0 || character === 'book' || character === 'mobi') return 1;
  const tail = Math.max(0, Math.min(1, (index - Math.max(1, count - 5)) / 4));
  return (index === 1 ? 0.88 : 1) * (1 - tail * (character === 'inch' ? 0.18 : 0.32));
}
