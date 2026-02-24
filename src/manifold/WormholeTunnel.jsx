import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_COLORS, FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';
import { getStickerWorldPosFromMesh } from '../game/coordinates.js';
import { calculateSmartControlPoint } from '../utils/smartRouting.js';
import { flipBurstMap } from '../3d/styles/TileStyleMaterials.jsx';

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

// Octagon constants — strands grow 1 → 8 as flips increase, capping at a full octagonal ring
const OCTAGON_MAX = 8;
// Ring radius at each tile face (world units). Cubies are ~1 unit wide, so 0.30 keeps
// the ring comfortably within the sticker face across all supported cube sizes (2–5).
const OCT_RADIUS = 0.30;

// Danger zone starts at flip 9 (octagon complete) and escalates to FLIP_CAP-1
const DANGER_START = 9;
const DANGER_RANGE = FLIP_CAP - 1 - DANGER_START; // 16

const WormholeTunnel = ({ gridId1, gridId2, meshIdx1, meshIdx2, dirKey1, dirKey2, cubieRefs, intensity, flips, color1, color2, size, explosionFactor = 0, _maxStrands = 50 }) => {
  const linesRef = useRef([]);
  const pulseT = useRef(Math.random() * Math.PI * 2);
  // Cache curve object to avoid recreation
  const curveRef = useRef(new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
  ));

  // Strands fill out the octagon one-by-one as flips increase (1 → 8), then hold at 8.
  // Each strand is placed at its fixed octagon angle so that at flip 8 the ring is complete.
  const strandCount = Math.min(Math.max(1, flips), OCTAGON_MAX);

  const strandConfig = useMemo(() => {
    return Array.from({ length: strandCount }, (_, i) => ({
      id: i,
      // Evenly spaced around a full circle at octagon vertex positions
      angle: (i / OCTAGON_MAX) * Math.PI * 2,
      radius: OCT_RADIUS,
      // Slight alternation (bright / dim) gives the ring visual depth without randomness
      baseOpacity: 0.5 + (i % 2) * 0.1,
      lineWidth: 1.5,
      colors: new Float32Array(30 * 3),
      // Stagger sparks so they don't all fire simultaneously around the ring
      sparkOffset: (i / OCTAGON_MAX) * Math.PI * 2
    }));
  }, [strandCount]);

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

    // Surge signal — composite waveform scaled by heartbeat rate
    const surgeFreq = 1.5 * Math.max(1, breathRate);
    const raw = Math.sin(t * surgeFreq) * 0.45 + Math.sin(t * surgeFreq * 1.8) * 0.3 + Math.sin(t * surgeFreq * 0.4) * 0.25;
    const surge = dead ? 0 : Math.pow(Math.max(0, raw), 2.0);

    // Tug-of-war bias: drives color gradient shift and shared tube lean
    const tugRaw = dead ? 0 : Math.sin(t * surgeFreq);
    const tugBias = tugRaw * (0.3 + surge * 0.4);

    pulseT.current += delta * (2 + intensity * 0.5) * Math.max(1, breathRate);
    const pulse = dead ? 0.3 : Math.sin(pulseT.current) * 0.1 + 0.9;

    // --- Danger zone: flips 9-24 → dangerT goes 0 → 1 ---
    // At flip 9 the octagon ring is complete; beyond this the tunnel escalates toward death.
    const dangerT = flips >= DANGER_START && !dead ? Math.max(0, Math.min(1, (flips - DANGER_START) / DANGER_RANGE)) : 0;

    // Danger flash signal: rapid strobe that accelerates as death approaches.
    // At dangerT≈0: ~2 Hz subtle shimmer. At dangerT=1 (flip 24): ~18 Hz near-strobe.
    const dangerFlashFreq = dangerT > 0 ? 2 + dangerT * 16 : 0;
    const dangerFlash = dangerT > 0 ? Math.max(0, Math.sin(t * dangerFlashFreq * Math.PI * 2)) * dangerT : 0;

    // Set up base colors — dead tunnels desaturate to gray
    if (dead) {
      _c1.set('#555555');
      _c2.set('#444444');
    } else {
      _c1.set(color1);
      _c2.set(color2);
    }

    // Flip burst — sin(rawP*π) gives a 0→1→0 envelope cresting at the squish midpoint
    const burstRaw = Math.max(flipBurstMap.get(gridId1) ?? 0, flipBurstMap.get(gridId2) ?? 0);
    const burstEnv = Math.sin(burstRaw * Math.PI);

    // --- Shared control point (computed once; all 8 strands follow the same route) ---
    const baseControlPoint = calculateSmartControlPoint(pos1, pos2, size, null, explosionFactor);
    _controlPoint.copy(baseControlPoint);

    // Tug-of-war: the whole tube leans toward the dominant endpoint during surges.
    // Removed per-strand divergence — all strands stay parallel as a cohesive tube.
    if (Math.abs(tugBias) > 0.01) {
      const tugTarget = tugBias > 0 ? _vEnd : _vStart;
      _controlPoint.lerp(tugTarget, Math.abs(tugBias));
    }

    // Flip burst: arch rises toward camera as identities swap
    if (burstEnv > 0.001) {
      _controlPoint.y += burstEnv * 1.4;
      _controlPoint.z += burstEnv * 0.5;
    }

    // --- Octagon ring frame (computed once per frame, shared by all strands) ---
    // Build a stable perpendicular basis aligned with the tunnel axis.
    _dir.subVectors(_vEnd, _vStart).normalize();
    _up.set(0, 1, 0);
    _right.crossVectors(_dir, _up);
    if (_right.lengthSq() < 0.001) {
      // dir is nearly parallel to world Y — fall back to Z as reference
      _up.set(0, 0, 1);
      _right.crossVectors(_dir, _up);
    }
    _right.normalize();
    _trueUp.crossVectors(_right, _dir).normalize();

    // Danger color-saturation boost factor (applied per vertex)
    const colorSatBoost = dangerT * 0.5; // 0 at flip 8, up to 0.5 at flip 24
    const flashWhite = dangerFlash * 0.85; // white wash that pulses toward death

    linesRef.current.forEach((line, i) => {
      if (!line) return;
      const config = strandConfig[i];

      // Opacity — dead tunnels dim to faint gray, danger zone adds brightness surges
      if (line.material) {
        if (dead) {
          line.material.opacity = 0.12;
        } else {
          const sparkPulse = Math.sin(pulseT.current * 3 + config.sparkOffset);
          const spark = sparkPulse > 0.9 ? (sparkPulse - 0.9) * 10 : 0;
          const surgeGlow = surge * 0.3;
          const flipGlow = burstEnv * 0.9;
          // Danger: each flash peak spikes opacity; base opacity rises with dangerT
          const dangerOpacity = dangerT > 0 ? dangerFlash * 0.5 + dangerT * 0.15 : 0;
          line.material.opacity = Math.min(1, config.baseOpacity * pulse * (1 + spark * 0.5) + surgeGlow + flipGlow + dangerOpacity);
        }
      }

      // --- Octagon ring offset for this strand ---
      // All three Bezier points receive the same perpendicular displacement so the
      // 8 strands run as parallel arcs forming a clean octagonal tube cross-section.
      const cosA = Math.cos(config.angle);
      const sinA = Math.sin(config.angle);
      _offsetVec.set(0, 0, 0)
        .addScaledVector(_right, cosA * config.radius)
        .addScaledVector(_trueUp, sinA * config.radius);

      curveRef.current.v0.copy(_vStart).add(_offsetVec);
      curveRef.current.v1.copy(_controlPoint).add(_offsetVec);
      curveRef.current.v2.copy(_vEnd).add(_offsetVec);

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

      const pulseSpeed = 1.2 + surge * 2.5;
      const pulseWidth = 0.10 + (1 - surge) * 0.05;
      const pulseIntensity = 0.6 + surge * 0.4;

      const rawP1 = (((t * pulseSpeed + config.sparkOffset) % 1.0) + 1.0) % 1.0;
      const rawP2 = (((t * pulseSpeed * 0.7 + config.sparkOffset + 0.5) % 1.0) + 1.0) % 1.0;

      // Pulse direction follows the tug — energy flows toward the dominant side
      const p1 = tugRaw > 0 ? rawP1 : 1.0 - rawP1;
      const p2 = tugRaw > 0 ? rawP2 : 1.0 - rawP2;

      for (let j = 0; j < 30; j++) {
        const u = j / 29;

        // Tug-of-war gradient shift: dominant side's color bleeds further along tunnel
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

        // Danger zone: boost color saturation then overlay the strobe flash
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
