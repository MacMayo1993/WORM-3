import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion } from '../../utils/device.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { wormBuffs } from '../wormBuffs.js';
import { FACE_NORMALS } from './constants.js';

// Small curved leaves, with a central fold so tumbling catches the scene light.
const leafGeometry = (() => {
  const points = [], indices = [];
  for (let row = 0; row <= 6; row++) {
    const t = row / 6;
    for (const side of [-1, 0, 1]) {
      points.push(side * Math.sin(t * Math.PI) * 0.055, t * 0.21,
        t * t * 0.055 + (1 - Math.abs(side)) * Math.sin(t * Math.PI) * 0.018);
    }
  }
  for (let row = 0; row < 6; row++) for (let col = 0; col < 2; col++) {
    const a = row * 3 + col, b = a + 3;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
})();
const COUNT = 18;
const leafMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.6, metalness: 0 });
leafMaterial.userData.elementalInstanced = true;
export function getNatureLeafMaterial() { return leafMaterial; }

export default function NatureClaimLeaves({ progressRef }) {
  const meshRef = useRef();
  const reduced = prefersReducedMotion();
  const data = useMemo(() => {
    const normal = (FACE_NORMALS[wormBuffs.elementalOrigin?.dirKey] ?? FACE_NORMALS.PY).clone();
    const right = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    right.normalize();
    const forward = new THREE.Vector3().crossVectors(normal, right).normalize();
    return { normal, right, forward, dummy: new THREE.Object3D(), color: new THREE.Color() };
  }, []);
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || useGameStore.getState().wormPaused) return;
    mesh.visible = !reduced;
    if (reduced) return;
    const t = Math.min(1, progressRef.current / 1.1);
    const spread = 1 - Math.pow(1 - t, 2);
    const { normal, right, forward, dummy, color } = data;
    for (let i = 0; i < COUNT; i++) {
      const seed = (i * 0.618034) % 1;
      const angle = i * 2.399963 + t * (0.6 + seed);
      const radius = spread * (0.4 + seed * 0.7);
      dummy.position.copy(normal).multiplyScalar(0.12 + Math.sin(t * Math.PI * 0.8) * (0.25 + seed * 0.4))
        .addScaledVector(right, Math.cos(angle) * radius)
        .addScaledVector(forward, Math.sin(angle) * radius);
      dummy.rotation.set(i * 0.7 + t * 4, i * 1.3 - t * 5, angle);
      dummy.scale.setScalar((0.55 + seed * 0.7) * (1 - t * t));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.20 + seed * 0.12, 0.65, 0.42 + seed * 0.18);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={meshRef} args={[leafGeometry, leafMaterial, COUNT]} visible={false} dispose={null} frustumCulled={false} raycast={() => null} />;
}
