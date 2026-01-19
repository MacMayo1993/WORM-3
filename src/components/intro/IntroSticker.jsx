import React from 'react';
import * as THREE from 'three';

const IntroSticker = ({ pos, rot, color, emissive = 0, isBack = false }) => (
  <mesh position={pos} rotation={rot}>
    <planeGeometry args={[0.82, 0.82]} />
    <meshStandardMaterial
      color={color}
      roughness={isBack ? 0.4 : 0.18}
      metalness={isBack ? 0.1 : 0}
      side={THREE.DoubleSide}
      emissive={color}
      emissiveIntensity={isBack ? 0.08 : emissive}
      transparent={isBack}
      opacity={isBack ? 0.85 : 1}
    />
  </mesh>
);

export default IntroSticker;
