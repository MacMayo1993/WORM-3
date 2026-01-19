import React, { useState, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ChaosWave = ({ from, to, color = "#ff0080", onComplete }) => {
  const [progress, setProgress] = useState(0);
  const meshRef = useRef();

  useFrame((_, delta) => {
    setProgress(p => {
      const newP = p + delta * 3;
      if (newP >= 1) {
        if (onComplete) onComplete();
        return 1;
      }
      return newP;
    });
  });

  useEffect(() => {
    if (progress >= 1) {
      const timer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);

  if (progress >= 1) return null;

  const fromVec = new THREE.Vector3(...from);
  const toVec = new THREE.Vector3(...to);
  const pos = fromVec.lerp(toVec, progress);

  return (
    <mesh ref={meshRef} position={pos.toArray()}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={Math.max(0, 1 - progress)}
        emissive={color}
        emissiveIntensity={2}
      />
    </mesh>
  );
};

export default ChaosWave;
