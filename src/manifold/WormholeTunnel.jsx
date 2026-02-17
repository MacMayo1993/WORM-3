import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_COLORS, FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';
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
// Cached colors for per-frame transference animation
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _cTemp = new THREE.Color();

const WormholeTunnel = ({ meshIdx1, meshIdx2, dirKey1, dirKey2, cubieRefs, intensity, flips, color1, color2, size, explosionFactor = 0 }) => {
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

    _vStart.set(pos1[0], pos1[1], pos1[2]);
    _vEnd.set(pos2[0], pos2[1], pos2[2]);

    const t = state.clock.elapsedTime;
    const dead = flips >= FLIP_CAP;

    // Heartbeat-synced breathing: half-life multiplier drives the rate
    const halfLife = getHalfLifeMultiplier(flips);
    const breathRate = dead ? 0 : halfLife;

    // Surge signal — synced with tile persistent tremor, scaled by heartbeat rate
    const surgeFreq = 1.5 * Math.max(1, breathRate);
    const raw = Math.sin(t * surgeFreq) * 0.45 + Math.sin(t * surgeFreq * 1.8) * 0.3 + Math.sin(t * surgeFreq * 0.4) * 0.25;
    const surge = dead ? 0 : Math.pow(Math.max(0, raw), 2.0);

    // Tug-of-war bias: oscillates at heartbeat frequency, amplified during surge
    const tugRaw = dead ? 0 : Math.sin(t * surgeFreq);
    const tugBias = tugRaw * (0.3 + surge * 0.4);

    pulseT.current += delta * (2 + intensity * 0.5) * Math.max(1, breathRate);
    const pulse = dead ? 0.3 : Math.sin(pulseT.current) * 0.1 + 0.9;

    // Set up colors for transference animation — dead tunnels desaturate to gray
    if (dead) {
      _c1.set('#555555');
      _c2.set('#444444');
    } else {
      _c1.set(color1);
      _c2.set(color2);
    }

    linesRef.current.forEach((line, i) => {
      if (!line) return;
      const config = strandConfig[i];

      // Opacity with surge glow boost — dead tunnels dim to faint gray
      if (line.material) {
        if (dead) {
          line.material.opacity = 0.12;
        } else {
          const sparkPulse = Math.sin(pulseT.current * 3 + config.sparkOffset);
          const spark = sparkPulse > 0.9 ? (sparkPulse - 0.9) * 10 : 0;
          const surgeGlow = surge * 0.3;
          line.material.opacity = Math.min(1, config.baseOpacity * pulse * (1 + spark * 0.5) + surgeGlow);
        }
      }

      // Smart control point with tug-of-war shift (scaled for explosion)
      const baseControlPoint = calculateSmartControlPoint(pos1, pos2, size, config.side, explosionFactor);
      _controlPoint.copy(baseControlPoint);

      // Tug of war: lerp control point toward the "winning" endpoint
      // During surge the curve lunges dramatically; at rest it's a subtle lean
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
        positions[j * 3] = points[j].x;
        positions[j * 3 + 1] = points[j].y;
        positions[j * 3 + 2] = points[j].z;
      }
      line.geometry.attributes.position.needsUpdate = true;

      // --- Color transference: traveling energy pulses with tug-of-war gradient shift ---
      const colors = line.geometry.attributes.color.array;

      // Pulse speed and tightness scale with surge — faster, sharper bolts during breakthrough
      const pulseSpeed = 1.2 + surge * 2.5;
      const pulseWidth = 0.10 + (1 - surge) * 0.05;
      const pulseIntensity = 0.6 + surge * 0.4;

      // Two traveling pulses per strand, staggered in phase and speed
      const rawP1 = (((t * pulseSpeed + config.sparkOffset) % 1.0) + 1.0) % 1.0;
      const rawP2 = (((t * pulseSpeed * 0.7 + config.sparkOffset + 0.5) % 1.0) + 1.0) % 1.0;

      // Pulse direction follows the tug — energy flows toward the side being pulled
      const p1 = tugRaw > 0 ? rawP1 : 1.0 - rawP1;
      const p2 = tugRaw > 0 ? rawP2 : 1.0 - rawP2;

      for (let j = 0; j < 30; j++) {
        const u = j / 29;

        // Tug-of-war gradient shift: dominant side's color bleeds further along the tunnel
        const shiftedU = Math.max(0, Math.min(1, u + tugBias * 0.6));
        _cTemp.lerpColors(_c1, _c2, shiftedU);

        // Gaussian energy pulse brightness
        const d1 = Math.abs(u - p1);
        const d2 = Math.abs(u - p2);
        const b1 = Math.exp(-(d1 * d1) / (2 * pulseWidth * pulseWidth));
        const b2 = Math.exp(-(d2 * d2) / (2 * pulseWidth * pulseWidth)) * 0.6;
        const brightness = Math.min(1, (b1 + b2) * pulseIntensity);

        // Brighten toward white for energy flash effect
        if (brightness > 0.01) {
          _cTemp.r += (1 - _cTemp.r) * brightness;
          _cTemp.g += (1 - _cTemp.g) * brightness;
          _cTemp.b += (1 - _cTemp.b) * brightness;
        }

        colors[j * 3] = _cTemp.r;
        colors[j * 3 + 1] = _cTemp.g;
        colors[j * 3 + 2] = _cTemp.b;
      }
      line.geometry.attributes.color.needsUpdate = true;
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
              usage={THREE.DynamicDrawUsage}
            />
            <bufferAttribute
              attach="attributes-color"
              count={30}
              array={strand.colors}
              itemSize={3}
              usage={THREE.DynamicDrawUsage}
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
