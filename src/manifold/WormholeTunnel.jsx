import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_COLORS } from '../utils/constants.js';
import { getStickerWorldPosFromMesh } from '../game/coordinates.js';
import { calculateSmartControlPoint } from '../utils/smartRouting.js';

const WormholeTunnel = ({ meshIdx1, meshIdx2, dirKey1, dirKey2, cubieRefs, intensity, flips, color1, color2, size }) => {
  const linesRef = useRef([]);
  const pulseT = useRef(Math.random() * Math.PI * 2);

  const strandConfig = useMemo(() => {
    const count = Math.min(Math.max(1, flips), 50);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 4;
      const radiusFactor = Math.sqrt(i / count);
      // Alternate sides: even indices go positive, odd go negative
      const side = i % 2 === 0 ? 1 : -1;
      return {
        id: i,
        angle,
        side, // Which side of the cube this strand curves towards
        radius: (0.1 + radiusFactor * 0.25) * 1.25, // 25% thicker
        baseOpacity: flips > 0 ? (0.4 + (1 - radiusFactor) * 0.6) : (0.2 + (1 - radiusFactor) * 0.4), // More vibrant
        lineWidth: Math.max(0.375, (1.5 - radiusFactor * 1.2) * 1.25), // 25% thicker lines
        colors: new Float32Array(30 * 3),
        sparkOffset: Math.random() * Math.PI * 2 // Random spark timing
      };
    });
  }, [flips]);

  useMemo(() => {
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    const tempColor = new THREE.Color();

    strandConfig.forEach(strand => {
      for (let j = 0; j < 30; j++) {
        const t = j / 29;
        tempColor.lerpColors(c1, c2, t);
        strand.colors[j * 3] = tempColor.r;
        strand.colors[j * 3 + 1] = tempColor.g;
        strand.colors[j * 3 + 2] = tempColor.b;
      }
    });
  }, [color1, color2, strandConfig]);

  useFrame((state, delta) => {
    const mesh1 = cubieRefs[meshIdx1];
    const mesh2 = cubieRefs[meshIdx2];
    if (!mesh1 || !mesh2) return;

    const pos1 = getStickerWorldPosFromMesh(mesh1, dirKey1);
    const pos2 = getStickerWorldPosFromMesh(mesh2, dirKey2);
    if (!pos1 || !pos2) return;

    const vStart = new THREE.Vector3(...pos1);
    const vEnd = new THREE.Vector3(...pos2);

    pulseT.current += delta * (2 + intensity * 0.5);
    const pulse = Math.sin(pulseT.current) * 0.1 + 0.9;

    linesRef.current.forEach((line, i) => {
      if (!line) return;
      const config = strandConfig[i];

      if (line.material) {
        // Add occasional electrical spark effect
        const sparkPulse = Math.sin(pulseT.current * 3 + config.sparkOffset);
        const spark = sparkPulse > 0.9 ? (sparkPulse - 0.9) * 10 : 0; // Random bright flashes
        line.material.opacity = config.baseOpacity * pulse * (1 + spark * 0.5);
      }

      // Calculate control point for this strand's side (balanced left/right)
      const baseControlPoint = calculateSmartControlPoint(pos1, pos2, size, config.side);

      const offsetX = Math.cos(config.angle) * config.radius;
      const offsetY = Math.sin(config.angle) * config.radius;

      const dir = new THREE.Vector3().subVectors(vEnd, vStart).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      const trueUp = new THREE.Vector3().crossVectors(right, dir).normalize();

      const offsetVec = new THREE.Vector3()
        .addScaledVector(right, offsetX)
        .addScaledVector(trueUp, offsetY);

      const controlPoint = baseControlPoint.clone().add(offsetVec);

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
              array={strand.colors}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={strand.baseOpacity}
            linewidth={strand.lineWidth}
          />
        </line>
      ))}
    </group>
  );
};

export default WormholeTunnel;
