import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';
import { flipBurstMap } from '../3d/styles/TileStyleMaterials.jsx';

// Cached vectors — no per-frame allocations
const _wPos1 = new THREE.Vector3();
const _wPos2 = new THREE.Vector3();
const _wQuat1 = new THREE.Quaternion();
const _wQuat2 = new THREE.Quaternion();
const _faceNorm1 = new THREE.Vector3(); // outward face normal in world space, tile 1
const _faceNorm2 = new THREE.Vector3(); // outward face normal in world space, tile 2
const _vStart = new THREE.Vector3();    // back-of-tile position, tile 1
const _vEnd = new THREE.Vector3();      // back-of-tile position, tile 2
const _cp1 = new THREE.Vector3();       // cubic interior control point 1
const _cp2 = new THREE.Vector3();       // cubic interior control point 2
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();
const _trueUp = new THREE.Vector3();
const _offsetVec = new THREE.Vector3();
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _cTemp = new THREE.Color();

// Local-space outward face normals, keyed by dirKey
const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1]
};

// Octagon ring constants
const OCTAGON_MAX = 8;
// OCT_RADIUS increased by 18% from 0.30 → 0.354 (ring radius at each tile face, world units)
const OCT_RADIUS = 0.354;

// Tile face offset from cubie centre to surface
const FACE_OFFSET = 0.52;

// Danger zone: escalates from flip 9 to FLIP_CAP-1
const DANGER_START = 9;
const DANGER_RANGE = FLIP_CAP - 1 - DANGER_START; // 16

const WormholeTunnel = ({ gridId1, gridId2, meshIdx1, meshIdx2, dirKey1, dirKey2, cubieRefs, intensity, flips, color1, color2, size, _explosionFactor = 0, _maxStrands = 50 }) => {
  const linesRef = useRef([]);
  const pulseT = useRef(Math.random() * Math.PI * 2);

  // Cubic Bézier: v0 (back of tile 1), v1 (interior cp), v2 (interior cp), v3 (back of tile 2)
  // CubicBezierCurve3 routes through the cube interior — depth-test occlusion by the solid
  // cubie geometry naturally produces the "weave around blocks" appearance.
  const curveRef = useRef(new THREE.CubicBezierCurve3(
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
  ));

  // Strands fill the octagon one-by-one (1 → 8) as flips increase
  const strandCount = Math.min(Math.max(1, flips), OCTAGON_MAX);

  const strandConfig = useMemo(() => {
    return Array.from({ length: strandCount }, (_, i) => ({
      id: i,
      angle: (i / OCTAGON_MAX) * Math.PI * 2,
      radius: OCT_RADIUS,
      baseOpacity: 0.5 + (i % 2) * 0.1,
      lineWidth: 1.5,
      colors: new Float32Array(30 * 3),
      sparkOffset: (i / OCTAGON_MAX) * Math.PI * 2
    }));
  }, [strandCount]);

  useMemo(() => {
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    const tc = new THREE.Color();
    strandConfig.forEach(strand => {
      for (let j = 0; j < 30; j++) {
        const u = j / 29;
        tc.lerpColors(c1, c2, u);
        strand.colors[j * 3] = tc.r;
        strand.colors[j * 3 + 1] = tc.g;
        strand.colors[j * 3 + 2] = tc.b;
      }
    });
  }, [color1, color2, strandConfig]);

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

    // World positions and rotations of the two cubie meshes
    mesh1.getWorldPosition(_wPos1);
    mesh1.getWorldQuaternion(_wQuat1);
    mesh2.getWorldPosition(_wPos2);
    mesh2.getWorldQuaternion(_wQuat2);

    // Outward face normals transformed to world space
    const n1 = FACE_NORM_LOCAL[dirKey1];
    const n2 = FACE_NORM_LOCAL[dirKey2];
    _faceNorm1.set(n1[0], n1[1], n1[2]).applyQuaternion(_wQuat1);
    _faceNorm2.set(n2[0], n2[1], n2[2]).applyQuaternion(_wQuat2);

    // Back-of-tile positions: cubie centre displaced INWARD by FACE_OFFSET.
    // This places the tunnel start/end at the inner face of each sticker tile,
    // so strands emerge from behind the tile rather than from the visible surface.
    _vStart.copy(_wPos1).addScaledVector(_faceNorm1, -FACE_OFFSET);
    _vEnd.copy(_wPos2).addScaledVector(_faceNorm2, -FACE_OFFSET);

    const t = state.clock.elapsedTime;
    const dead = flips >= FLIP_CAP;

    const halfLife = getHalfLifeMultiplier(flips);
    const breathRate = dead ? 0 : halfLife;

    const surgeFreq = 1.5 * Math.max(1, breathRate);
    const raw = Math.sin(t * surgeFreq) * 0.45 + Math.sin(t * surgeFreq * 1.8) * 0.3 + Math.sin(t * surgeFreq * 0.4) * 0.25;
    const surge = dead ? 0 : Math.pow(Math.max(0, raw), 2.0);

    const tugRaw = dead ? 0 : Math.sin(t * surgeFreq);
    const tugBias = tugRaw * (0.3 + surge * 0.4);

    pulseT.current += delta * (2 + intensity * 0.5) * Math.max(1, breathRate);
    const pulse = dead ? 0.3 : Math.sin(pulseT.current) * 0.1 + 0.9;

    const dangerT = flips >= DANGER_START && !dead ? Math.max(0, Math.min(1, (flips - DANGER_START) / DANGER_RANGE)) : 0;
    const dangerFlashFreq = dangerT > 0 ? 2 + dangerT * 16 : 0;
    const dangerFlash = dangerT > 0 ? Math.max(0, Math.sin(t * dangerFlashFreq * Math.PI * 2)) * dangerT : 0;

    if (dead) {
      _c1.set('#555555');
      _c2.set('#444444');
    } else {
      _c1.set(color1);
      _c2.set(color2);
    }

    const burstRaw = Math.max(flipBurstMap.get(gridId1) ?? 0, flipBurstMap.get(gridId2) ?? 0);
    const burstEnv = Math.sin(burstRaw * Math.PI);

    // --- Interior cubic Bézier control points ---
    // Each CP dives inward from its tile's inner face along the (negated) face normal.
    // Depth scales with cube size so paths reach well into the interior for all sizes.
    // The two inward normals point toward each other (antipodal faces), producing a
    // symmetric S-curve that threads through the cube without arching around the outside.
    const inwardDepth = (size - 1) * 0.55 + 0.7;
    _cp1.copy(_vStart).addScaledVector(_faceNorm1, -inwardDepth);
    _cp2.copy(_vEnd).addScaledVector(_faceNorm2, -inwardDepth);

    // Tug-of-war: the whole tube gently leans toward the dominant endpoint.
    // Reduced multiplier (×0.35) keeps the lean subtle so interior routing is preserved.
    if (Math.abs(tugBias) > 0.01) {
      const tt = Math.abs(tugBias) * 0.35;
      const target = tugBias > 0 ? _vEnd : _vStart;
      _cp1.lerp(target, tt);
      _cp2.lerp(target, tt);
    }

    // Burst: both control points arch up/toward camera during a flip swap
    if (burstEnv > 0.001) {
      _cp1.y += burstEnv * 0.9;
      _cp2.y += burstEnv * 0.9;
      _cp1.z += burstEnv * 0.3;
      _cp2.z += burstEnv * 0.3;
    }

    // Octagon ring frame — perpendicular basis around the tunnel axis
    _dir.subVectors(_vEnd, _vStart).normalize();
    _up.set(0, 1, 0);
    _right.crossVectors(_dir, _up);
    if (_right.lengthSq() < 0.001) {
      _up.set(0, 0, 1);
      _right.crossVectors(_dir, _up);
    }
    _right.normalize();
    _trueUp.crossVectors(_right, _dir).normalize();

    const colorSatBoost = dangerT * 0.5;
    const flashWhite = dangerFlash * 0.85;

    linesRef.current.forEach((line, i) => {
      if (!line) return;
      const config = strandConfig[i];

      if (line.material) {
        if (dead) {
          line.material.opacity = 0.12;
        } else {
          const sparkPulse = Math.sin(pulseT.current * 3 + config.sparkOffset);
          const spark = sparkPulse > 0.9 ? (sparkPulse - 0.9) * 10 : 0;
          const surgeGlow = surge * 0.3;
          const flipGlow = burstEnv * 0.9;
          const dangerOpacity = dangerT > 0 ? dangerFlash * 0.5 + dangerT * 0.15 : 0;
          line.material.opacity = Math.min(1, config.baseOpacity * pulse * (1 + spark * 0.5) + surgeGlow + flipGlow + dangerOpacity);
        }
      }

      // Octagon ring offset — all 4 cubic Bézier points get the same perpendicular
      // displacement, so the 8 strands form a clean parallel octagonal tube cross-section.
      const cosA = Math.cos(config.angle);
      const sinA = Math.sin(config.angle);
      _offsetVec.set(0, 0, 0)
        .addScaledVector(_right, cosA * config.radius)
        .addScaledVector(_trueUp, sinA * config.radius);

      curveRef.current.v0.copy(_vStart).add(_offsetVec);
      curveRef.current.v1.copy(_cp1).add(_offsetVec);
      curveRef.current.v2.copy(_cp2).add(_offsetVec);
      curveRef.current.v3.copy(_vEnd).add(_offsetVec);

      const points = curveRef.current.getPoints(29);

      const positions = line.geometry.attributes.position.array;
      for (let j = 0; j < points.length; j++) {
        positions[j * 3] = points[j].x;
        positions[j * 3 + 1] = points[j].y;
        positions[j * 3 + 2] = points[j].z;
      }
      line.geometry.attributes.position.needsUpdate = true;

      // --- Color transference: traveling energy pulses with tug-of-war gradient ---
      const colors = line.geometry.attributes.color.array;

      const pulseSpeed = 1.2 + surge * 2.5;
      const pulseWidth = 0.10 + (1 - surge) * 0.05;
      const pulseIntensity = 0.6 + surge * 0.4;

      const rawP1 = (((t * pulseSpeed + config.sparkOffset) % 1.0) + 1.0) % 1.0;
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

        if (dangerT > 0) {
          _cTemp.r = Math.min(1, _cTemp.r * (1 + colorSatBoost) + flashWhite);
          _cTemp.g = Math.min(1, _cTemp.g * (1 + colorSatBoost) + flashWhite);
          _cTemp.b = Math.min(1, _cTemp.b * (1 + colorSatBoost) + flashWhite);
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
