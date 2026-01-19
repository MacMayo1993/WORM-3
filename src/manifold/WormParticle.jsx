import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';

const WormParticle = ({ start, end, color1, color2, startTime, currentTime, onComplete }) => {
  const particleRef = useRef();
  const trailRef = useRef();
  const glowRef = useRef();

  const duration = 1.5;
  const progress = useMemo(() => {
    if (currentTime < startTime) return 0;
    const elapsed = currentTime - startTime;
    if (elapsed >= duration) {
      if (onComplete && elapsed < duration + 0.1) onComplete();
      return 1;
    }
    const t = elapsed / duration;
    return t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }, [currentTime, startTime, duration, onComplete]);

  const { position, color } = useMemo(() => {
    const vStart = new THREE.Vector3(...start);
    const vEnd = new THREE.Vector3(...end);
    const midPoint = new THREE.Vector3().addVectors(vStart, vEnd).multiplyScalar(0.5);

    const dir = new THREE.Vector3().subVectors(vEnd, vStart).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const offset = right.multiplyScalar(0.2);
    const controlPoint = midPoint.clone().add(offset);

    const curve = new THREE.QuadraticBezierCurve3(vStart, controlPoint, vEnd);
    const point = curve.getPoint(progress);

    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    const mixedColor = new THREE.Color().lerpColors(c1, c2, progress);

    return {
      position: [point.x, point.y, point.z],
      color: mixedColor
    };
  }, [start, end, color1, color2, progress]);

  const pulseScale = 1 + Math.sin(currentTime * 10) * 0.2;

  if (progress >= 1) return null;

  return (
    <group position={position}>
      <mesh ref={particleRef} scale={[pulseScale, pulseScale, pulseScale]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh ref={glowRef} scale={[pulseScale * 1.5, pulseScale * 1.5, pulseScale * 1.5]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh scale={[0.8, 0.8, 0.8]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
};

export default WormParticle;
