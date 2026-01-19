import React, { useMemo } from 'react';
import * as THREE from 'three';

const ArrivalBurst = ({ position, color, startTime, currentTime }) => {
  const elapsed = currentTime - startTime;
  const duration = 0.5;
  const progress = Math.min(elapsed / duration, 1);

  const particleCount = 12;
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 0.5 + Math.random() * 0.5;
      return {
        id: i,
        angle,
        speed,
        elevation: (Math.random() - 0.5) * Math.PI * 0.5
      };
    });
  }, []);

  if (progress >= 1) return null;

  return (
    <group position={position}>
      {particles.map((p) => {
        const distance = progress * p.speed;
        const x = Math.cos(p.angle) * Math.cos(p.elevation) * distance;
        const y = Math.sin(p.elevation) * distance;
        const z = Math.sin(p.angle) * Math.cos(p.elevation) * distance;
        const scale = (1 - progress) * 0.8;

        return (
          <mesh key={p.id} position={[x, y, z]} scale={[scale, scale, scale]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={1 - progress}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export default ArrivalBurst;
