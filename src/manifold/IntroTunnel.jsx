import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { calculateSmartControlPoint } from '../utils/smartRouting.js';

// Cached vectors to avoid GC pressure
const _vStart = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();
const _trueUp = new THREE.Vector3();
const _offsetVec = new THREE.Vector3();
const _controlPoint = new THREE.Vector3();
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _cTemp = new THREE.Color();

const STRAND_COUNT = 25;

const IntroTunnel = ({
  start,
  end,
  color1,
  color2,
  opacity = 0.8,
  groupId: _groupId,
  formation = 1,
  size = 3,
  explosionFactor = 0,
}) => {
  const linesRef = useRef([]);
  const pulseT = useRef(Math.random() * Math.PI * 2);
  const curveRef = useRef(new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
  ));

  const strandConfig = useMemo(() => {
    return Array.from({ length: STRAND_COUNT }, (_, i) => {
      const angle = (i / STRAND_COUNT) * Math.PI * 4;
      const radiusFactor = Math.sqrt(i / STRAND_COUNT);
      const side = i % 2 === 0 ? 1 : -1;
      return {
        id: i,
        angle,
        side,
        radius: (0.1 + radiusFactor * 0.25) * 1.25,
        baseOpacity: 0.4 + (1 - radiusFactor) * 0.6,
        lineWidth: Math.max(0.375, (1.5 - radiusFactor * 1.2) * 1.25),
        sparkOffset: Math.random() * Math.PI * 2,
      };
    });
  }, []);

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
    _vStart.set(...start);
    _vEnd.set(...end);

    const t = state.clock.elapsedTime;

    // Surge signal — matches WormholeTunnel dynamics
    const raw = Math.sin(t * 1.5) * 0.45 + Math.sin(t * 2.7) * 0.3 + Math.sin(t * 0.6) * 0.25;
    const surge = Math.pow(Math.max(0, raw), 2.0);

    // Tug-of-war bias — oscillates to make tunnel curve dynamically
    const tugRaw = Math.sin(t * 1.5);
    const tugBias = tugRaw * (0.3 + surge * 0.4);

    pulseT.current += delta * 2.5;
    const pulse = Math.sin(pulseT.current) * 0.1 + 0.9;

    _c1.set(color1);
    _c2.set(color2);

    linesRef.current.forEach((line, i) => {
      if (!line) return;
      const config = strandConfig[i];

      // Opacity with surge glow and sparkle
      if (line.material) {
        const sparkPulse = Math.sin(pulseT.current * 3 + config.sparkOffset);
        const spark = sparkPulse > 0.9 ? (sparkPulse - 0.9) * 10 : 0;
        const surgeGlow = surge * 0.3;
        line.material.opacity =
          Math.min(1, config.baseOpacity * pulse * (1 + spark * 0.5) + surgeGlow) * opacity;
      }

      // Smart control point (matches WormholeTunnel routing) with tug-of-war shift
      const baseCP = calculateSmartControlPoint(start, end, size, config.side, explosionFactor);
      _controlPoint.copy(baseCP);

      if (Math.abs(tugBias) > 0.01) {
        const tugTarget = tugBias > 0 ? _vEnd : _vStart;
        _controlPoint.lerp(tugTarget, Math.abs(tugBias));
      }

      // Apply strand spiral offset
      const offsetX = Math.cos(config.angle) * config.radius;
      const offsetY = Math.sin(config.angle) * config.radius;

      _dir.subVectors(_vEnd, _vStart).normalize();
      _up.set(0, 1, 0);
      _right.crossVectors(_dir, _up).normalize();
      _trueUp.crossVectors(_right, _dir).normalize();

      _offsetVec.set(0, 0, 0)
        .addScaledVector(_right, offsetX)
        .addScaledVector(_trueUp, offsetY);

      _controlPoint.add(_offsetVec);

      curveRef.current.v0.copy(_vStart);
      curveRef.current.v1.copy(_controlPoint);
      curveRef.current.v2.copy(_vEnd);

      const points = curveRef.current.getPoints(29);
      const positions = line.geometry.attributes.position.array;

      for (let j = 0; j < points.length; j++) {
        // Formation animation — tunnel grows inward from both endpoints
        const u = j / 29;
        const distFromEnds = Math.min(u, 1 - u) * 2;

        if (distFromEnds < formation) {
          positions[j * 3]     = points[j].x;
          positions[j * 3 + 1] = points[j].y;
          positions[j * 3 + 2] = points[j].z;
        } else {
          const useStart = u < 0.5;
          const ep = useStart ? _vStart : _vEnd;
          positions[j * 3]     = ep.x;
          positions[j * 3 + 1] = ep.y;
          positions[j * 3 + 2] = ep.z;
        }
      }
      line.geometry.attributes.position.needsUpdate = true;

      // Color transference: traveling energy pulses with tug-of-war gradient shift
      const colors = line.geometry.attributes.color.array;

      const pulseSpeed    = 1.2 + surge * 2.5;
      const pulseWidth    = 0.10 + (1 - surge) * 0.05;
      const pulseIntensity = 0.6 + surge * 0.4;

      const rawP1 = (((t * pulseSpeed + config.sparkOffset)           % 1.0) + 1.0) % 1.0;
      const rawP2 = (((t * pulseSpeed * 0.7 + config.sparkOffset + 0.5) % 1.0) + 1.0) % 1.0;

      const p1 = tugRaw > 0 ? rawP1 : 1.0 - rawP1;
      const p2 = tugRaw > 0 ? rawP2 : 1.0 - rawP2;

      for (let j = 0; j < 30; j++) {
        const u = j / 29;
        const shiftedU = Math.max(0, Math.min(1, u + tugBias * 0.6));
        _cTemp.lerpColors(_c1, _c2, shiftedU);

        const d1 = Math.abs(u - p1);
        const d2 = Math.abs(u - p2);
        const b1 = Math.exp(-(d1 * d1) / (2 * pulseWidth * pulseWidth));
        const b2 = Math.exp(-(d2 * d2) / (2 * pulseWidth * pulseWidth)) * 0.6;
        const brightness = Math.min(1, (b1 + b2) * pulseIntensity);

        if (brightness > 0.01) {
          _cTemp.r += (1 - _cTemp.r) * brightness;
          _cTemp.g += (1 - _cTemp.g) * brightness;
          _cTemp.b += (1 - _cTemp.b) * brightness;
        }

        colors[j * 3]     = _cTemp.r;
        colors[j * 3 + 1] = _cTemp.g;
        colors[j * 3 + 2] = _cTemp.b;
      }
      line.geometry.attributes.color.needsUpdate = true;
    });
  });

  return (
    <group>
      {strandConfig.map((strand) => (
        <line key={strand.id} ref={el => linesRef.current[strand.id] = el}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={30}
              array={new Float32Array(30 * 3)}
              itemSize={3}
              usage={THREE.DynamicDrawUsage}
            />
            <bufferAttribute
              attach="attributes-color"
              count={30}
              array={new Float32Array(30 * 3)}
              itemSize={3}
              usage={THREE.DynamicDrawUsage}
            />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={strand.baseOpacity * opacity}
            linewidth={strand.lineWidth}
          />
        </line>
      ))}
    </group>
  );
};

export default IntroTunnel;
