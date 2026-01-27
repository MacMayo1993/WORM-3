import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_COLORS } from '../utils/constants.js';
import { getStickerWorldPosFromMesh } from '../game/coordinates.js';
import { calculateSmartControlPoint } from '../utils/smartRouting.js';

// Cached vectors for reuse across all tunnel instances - avoids GC pressure
const _vStart = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();
const _trueUp = new THREE.Vector3();
const _offsetVec = new THREE.Vector3();
const _controlPoint = new THREE.Vector3();

const WormholeTunnel = ({ meshIdx1, meshIdx2, dirKey1, dirKey2, cubieRefs, intensity, flips, color1, color2, size }) => {
  const linesRef = useRef([]);
  const pulseT = useRef(Math.random() * Math.PI * 2);
  // Cache curve object to avoid recreation
  const curveRef = useRef(new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
  ));

  const strandConfig = useMemo(() => {
    const count = Math.min(Math.max(1, flips), 50);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 4;
      const radiusFactor = Math.sqrt(i / count);
      const side = i % 2 === 0 ? 1 : -1;
      return {
        id: i,
        angle,
        side,
        radius: (0.1 + radiusFactor * 0.25) * 1.25,
        baseOpacity: flips > 0 ? (0.4 + (1 - radiusFactor) * 0.6) : (0.2 + (1 - radiusFactor) * 0.4),
        lineWidth: Math.max(0.375, (1.5 - radiusFactor * 1.2) * 1.25),
        colors: new Float32Array(30 * 3),
        sparkOffset: Math.random() * Math.PI * 2
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      linesRef.current.forEach(line => {
        if (line?.geometry) line.geometry.dispose();
        if (line?.material) line.material.dispose();
      });
    };
  }, []);

  useFrame((state, delta) => {
    const mesh1 = cubieRefs[meshIdx1];
    const mesh2 = cubieRefs[meshIdx2];
    if (!mesh1 || !mesh2) return;

    const pos1 = getStickerWorldPosFromMesh(mesh1, dirKey1);
    const pos2 = getStickerWorldPosFromMesh(mesh2, dirKey2);
    if (!pos1 || !pos2) return;

    // Reuse cached vectors instead of creating new ones
    _vStart.set(pos1[0], pos1[1], pos1[2]);
    _vEnd.set(pos2[0], pos2[1], pos2[2]);

    pulseT.current += delta * (2 + intensity * 0.5);
    const pulse = Math.sin(pulseT.current) * 0.1 + 0.9;

    linesRef.current.forEach((line, i) => {
      if (!line) return;
      const config = strandConfig[i];

      if (line.material) {
        const sparkPulse = Math.sin(pulseT.current * 3 + config.sparkOffset);
        const spark = sparkPulse > 0.9 ? (sparkPulse - 0.9) * 10 : 0;
        line.material.opacity = config.baseOpacity * pulse * (1 + spark * 0.5);
      }

      // Get base control point (smartRouting now uses cached vectors too)
      const baseControlPoint = calculateSmartControlPoint(pos1, pos2, size, config.side);

      const offsetX = Math.cos(config.angle) * config.radius;
      const offsetY = Math.sin(config.angle) * config.radius;

      // Reuse cached vectors for direction calculations
      _dir.subVectors(_vEnd, _vStart).normalize();
      _up.set(0, 1, 0);
      _right.crossVectors(_dir, _up).normalize();
      _trueUp.crossVectors(_right, _dir).normalize();

      _offsetVec.set(0, 0, 0)
        .addScaledVector(_right, offsetX)
        .addScaledVector(_trueUp, offsetY);

      _controlPoint.copy(baseControlPoint).add(_offsetVec);

      // Reuse curve object by updating its control points
      curveRef.current.v0.copy(_vStart);
      curveRef.current.v1.copy(_controlPoint);
      curveRef.current.v2.copy(_vEnd);

      const points = curveRef.current.getPoints(29);

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
