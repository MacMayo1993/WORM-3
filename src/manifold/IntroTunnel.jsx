import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const IntroTunnel = ({ start, end, color1, color2, opacity = 0.8, groupId }) => {
  const linesRef = useRef([]);
  const pulseT = useRef(Math.random() * Math.PI * 2);

  const strandConfig = useMemo(() => {
    const count = 20;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 4;
      const radiusFactor = Math.sqrt(i / count);
      return {
        id: i,
        angle,
        radius: 0.1 + radiusFactor * 0.25,
        baseOpacity: 0.3 + (1 - radiusFactor) * 0.5
      };
    });
  }, []);

  const colorArray = useMemo(() => {
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    const colors = new Float32Array(30 * 3);

    for (let j = 0; j < 30; j++) {
      const t = j / 29;
      const color = new THREE.Color().lerpColors(c1, c2, t);
      colors[j * 3] = color.r;
      colors[j * 3 + 1] = color.g;
      colors[j * 3 + 2] = color.b;
    }
    return colors;
  }, [color1, color2]);

  useFrame((_, delta) => {
    pulseT.current += delta * 2;
    const pulse = Math.sin(pulseT.current) * 0.1 + 0.9;

    linesRef.current.forEach((line, i) => {
      if (!line) return;
      const config = strandConfig[i];
      if (line.material) {
        line.material.opacity = config.baseOpacity * pulse * opacity;
      }

      const vStart = new THREE.Vector3(...start);
      const vEnd = new THREE.Vector3(...end);
      const midPoint = new THREE.Vector3().addVectors(vStart, vEnd).multiplyScalar(0.5);

      const offsetX = Math.cos(config.angle) * config.radius;
      const offsetY = Math.sin(config.angle) * config.radius;

      const dir = new THREE.Vector3().subVectors(vEnd, vStart).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      const trueUp = new THREE.Vector3().crossVectors(right, dir).normalize();

      const offsetVec = new THREE.Vector3()
        .addScaledVector(right, offsetX)
        .addScaledVector(trueUp, offsetY);

      const controlPoint = midPoint.clone().add(offsetVec);
      const curve = new THREE.QuadraticBezierCurve3(vStart, controlPoint, vEnd);
      const points = curve.getPoints(29);

      const positions = line.geometry.attributes.position.array;
      for (let j = 0; j < points.length; j++) {
        positions[j * 3] = points[j].x;
        positions[j * 3 + 1] = points[j].y;
        positions[j * 3 + 2] = points[j].z;
      }
      line.geometry.attributes.position.needsUpdate = true;
    });
  });

  return (
    <group>
      {strandConfig.map((strand, i) => (
        <line key={strand.id} ref={el => linesRef.current[i] = el}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={30}
              array={new Float32Array(30 * 3)}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-color"
              count={30}
              array={colorArray}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={strand.baseOpacity * opacity}
            linewidth={1.5}
          />
        </line>
      ))}
    </group>
  );
};

export default IntroTunnel;
