import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';
import { flipBurstMap } from '../3d/styles/TileStyleMaterials.jsx';
import { calculateSmartControlPoint } from '../utils/smartRouting.js';

// Lightning bolt point count — jagged segments between the two tile endpoints
const LIGHTNING_PTS = 14;

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
const _spreadVec = new THREE.Vector3();
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const _cTemp = new THREE.Color();
const _lPt = new THREE.Vector3();   // scratch for lightning bolt point sampling

// Local-space outward face normals, keyed by dirKey
const FACE_NORM_LOCAL = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1]
};

// Octagon ring constants
const OCTAGON_MAX = 8;
// OCT_RADIUS: ring radius at each tile face (world units)
const OCT_RADIUS = 0.46;
// SPREAD_RADIUS: lateral fan radius at interior control points — each strand fans out
// to its own radial direction through the cube interior, routing along a different
// inter-cubie gap corridor (cubie gaps are at ±0.5 from each cubie centre).
// All 8 paths converge back to OCT_RADIUS at the destination, forming the stop sign.
const SPREAD_RADIUS = 0.5;

// Tile face offset from cubie centre to surface
const FACE_OFFSET = 0.52;

// Pre-allocated scratch arrays for calculateSmartControlPoint — avoids per-frame heap allocation
const _pos1Arr = [0, 0, 0];
const _pos2Arr = [0, 0, 0];

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

  // Deterministic routing side — derived from tile-pair identity so it never
  // changes as the cube rotates.  Using null here would let calculateSmartControlPoint
  // auto-detect sign from the world-space midpoint, which flips when the midpoint
  // crosses zero during rotation and makes the whole tube snap visibly.
  const side = useMemo(() => {
    const code = [...(gridId1 + gridId2)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return code % 2 === 0 ? 1 : -1;
  }, [gridId1, gridId2]);

  // Strands fill the octagon one-by-one (1 → 8) as flips increase
  const strandCount = Math.min(Math.max(1, flips), OCTAGON_MAX);

  const strandConfig = useMemo(() => {
    // Core strand: runs the central bezier axis (no radial offset) — gives the tube a solid spine
    const core = {
      id: 'core', isCore: true, angle: 0,
      baseOpacity: 0.82,
      lineWidth: 1.5,
      colors: new Float32Array(30 * 3),
      sparkOffset: 1.1,
    };
    // Outer ring strands
    const ring = Array.from({ length: strandCount }, (_, i) => ({
      id: i, isCore: false,
      angle: (i / OCTAGON_MAX) * Math.PI * 2,
      baseOpacity: 0.66 + (i % 2) * 0.08,
      lineWidth: 1.5,
      colors: new Float32Array(30 * 3),
      sparkOffset: (i / OCTAGON_MAX) * Math.PI * 2,
    }));
    return [core, ...ring];
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

  // Lightning bolt refs
  const lightningRef = useRef(null);
  const lightningJagsRef = useRef(new Float32Array(LIGHTNING_PTS * 2)); // (r, u) jag offsets per point
  const lightningFrameRef = useRef(-1);

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

    if (dead) {
      _c1.set('#555555');
      _c2.set('#444444');
    } else {
      _c1.set(color1);
      _c2.set(color2);
    }

    const burstRaw = Math.max(flipBurstMap.get(gridId1) ?? 0, flipBurstMap.get(gridId2) ?? 0);
    const burstEnv = Math.sin(burstRaw * Math.PI);

    // --- Shared control point (computed once; all 8 strands follow the same route) ---
    // side is a stable ±1 keyed to the tile-pair identity — never the world-space
    // midpoint sign, which flips as the cube rotates and snaps the tube across the cube.
    _pos1Arr[0] = _vStart.x; _pos1Arr[1] = _vStart.y; _pos1Arr[2] = _vStart.z;
    _pos2Arr[0] = _vEnd.x;   _pos2Arr[1] = _vEnd.y;   _pos2Arr[2] = _vEnd.z;
    const baseCP = calculateSmartControlPoint(_pos1Arr, _pos2Arr, size, side, _explosionFactor);
    _cp1.copy(baseCP);
    _cp2.copy(baseCP);

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

    linesRef.current.forEach((line, i) => {
      if (!line) return;
      const config = strandConfig[i];

      if (line.material) {
        if (dead) {
          line.material.opacity = 0.12;
        } else {
          const flipGlow = burstEnv * 0.5;
          const dangerOpacity = dangerT > 0 ? dangerT * 0.15 : 0;
          line.material.opacity = Math.min(1, config.baseOpacity * pulse + flipGlow + dangerOpacity);
        }
      }

      // Core strand runs the central bezier axis; ring strands fan to their radial offset.
      if (config.isCore) {
        curveRef.current.v0.copy(_vStart);
        curveRef.current.v1.copy(_cp1);
        curveRef.current.v2.copy(_cp2);
        curveRef.current.v3.copy(_vEnd);
      } else {
        // Orbital distribution: each strand bows outward in its own radial direction.
        // CPs at 35%/65% along start→end axis, pushed radially in the strand's angle.
        // No shared routing CP — avoids all 8 strands bunching to the same side.
        const cosA = Math.cos(config.angle);
        const sinA = Math.sin(config.angle);
        _offsetVec.set(0, 0, 0)
          .addScaledVector(_right, cosA * OCT_RADIUS)
          .addScaledVector(_trueUp, sinA * OCT_RADIUS);
        curveRef.current.v0.copy(_vStart).add(_offsetVec);
        curveRef.current.v3.copy(_vEnd).add(_offsetVec);
        // CP1 at 35% along start→end, bowed outward in this strand's radial direction
        curveRef.current.v1.copy(_vStart).lerp(_vEnd, 0.35 + tugBias * 0.12)
          .addScaledVector(_right, cosA * SPREAD_RADIUS)
          .addScaledVector(_trueUp, sinA * SPREAD_RADIUS);
        curveRef.current.v1.y += burstEnv * 0.9;
        // CP2 at 65%, same radial bow
        curveRef.current.v2.copy(_vStart).lerp(_vEnd, 0.65 + tugBias * 0.12)
          .addScaledVector(_right, cosA * SPREAD_RADIUS)
          .addScaledVector(_trueUp, sinA * SPREAD_RADIUS);
        curveRef.current.v2.y += burstEnv * 0.9;
      }

      const points = curveRef.current.getPoints(29);

      const positions = line.geometry.attributes.position.array;
      for (let j = 0; j < points.length; j++) {
        positions[j * 3] = points[j].x;
        positions[j * 3 + 1] = points[j].y;
        positions[j * 3 + 2] = points[j].z;
      }
      line.geometry.attributes.position.needsUpdate = true;

      // Pure tile color — tug-of-war gradient from color1 to color2, no white
      const colors = line.geometry.attributes.color.array;
      for (let j = 0; j < 30; j++) {
        const u = j / 29;
        const shiftedU = Math.max(0, Math.min(1, u + tugBias * 0.4));
        _cTemp.lerpColors(_c1, _c2, shiftedU);
        // Danger zone: saturate toward the tile's own hue only (no added white)
        if (dangerT > 0) {
          _cTemp.r = Math.min(1, _cTemp.r * (1 + dangerT * 0.5));
          _cTemp.g = Math.min(1, _cTemp.g * (1 + dangerT * 0.5));
          _cTemp.b = Math.min(1, _cTemp.b * (1 + dangerT * 0.5));
        }
        colors[j * 3]     = _cTemp.r;
        colors[j * 3 + 1] = _cTemp.g;
        colors[j * 3 + 2] = _cTemp.b;
      }
      line.geometry.attributes.color.needsUpdate = true;
    });

    // === Lightning bolt: fires along the central bezier when a flip burst is active ===
    const lightningLine = lightningRef.current;
    if (lightningLine) {
      if (burstEnv > 0.03 && !dead) {
        // Re-randomize jags at ~20 Hz for flicker — only when the bolt is visible
        const jagFrame = Math.floor(t * 20);
        if (jagFrame !== lightningFrameRef.current) {
          lightningFrameRef.current = jagFrame;
          const jags = lightningJagsRef.current;
          // Endpoints are always clamped to exact tile positions (no jag)
          jags[0] = 0; jags[1] = 0;
          jags[(LIGHTNING_PTS - 1) * 2] = 0; jags[(LIGHTNING_PTS - 1) * 2 + 1] = 0;
          for (let j = 1; j < LIGHTNING_PTS - 1; j++) {
            // Jag magnitude is largest near the middle of the bolt, tapers at ends
            const env = Math.sin((j / (LIGHTNING_PTS - 1)) * Math.PI);
            const spread = 0.38 * burstEnv * env;
            jags[j * 2]     = (Math.random() - 0.5) * spread * 2;
            jags[j * 2 + 1] = (Math.random() - 0.5) * spread * 2;
          }
        }

        // Set up the center bezier (no radial offset) for sampling
        curveRef.current.v0.copy(_vStart);
        curveRef.current.v1.copy(_cp1);
        curveRef.current.v2.copy(_cp2);
        curveRef.current.v3.copy(_vEnd);

        const lPos = lightningLine.geometry.attributes.position.array;
        const lCol = lightningLine.geometry.attributes.color.array;
        const jags = lightningJagsRef.current;

        for (let j = 0; j < LIGHTNING_PTS; j++) {
          const u = j / (LIGHTNING_PTS - 1);
          curveRef.current.getPoint(u, _lPt);
          const rx = jags[j * 2];
          const ry = jags[j * 2 + 1];
          lPos[j * 3]     = _lPt.x + _right.x * rx + _trueUp.x * ry;
          lPos[j * 3 + 1] = _lPt.y + _right.y * rx + _trueUp.y * ry;
          lPos[j * 3 + 2] = _lPt.z + _right.z * rx + _trueUp.z * ry;

          // Color: tile hue at the ends, hot white at the peak of burstEnv near the center
          _cTemp.lerpColors(_c1, _c2, u);
          const hotness = burstEnv * Math.sin(u * Math.PI) * 0.85;
          lCol[j * 3]     = Math.min(1, _cTemp.r + (1 - _cTemp.r) * hotness);
          lCol[j * 3 + 1] = Math.min(1, _cTemp.g + (1 - _cTemp.g) * hotness);
          lCol[j * 3 + 2] = Math.min(1, _cTemp.b + (1 - _cTemp.b) * hotness);
        }
        lightningLine.geometry.attributes.position.needsUpdate = true;
        lightningLine.geometry.attributes.color.needsUpdate = true;
        lightningLine.material.opacity = Math.min(0.97, burstEnv * 1.4);
        lightningLine.visible = true;
      } else {
        lightningLine.visible = false;
      }
    }
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

      {/* Lightning bolt — single jagged line fired along the bezier axis on flip */}
      <line ref={lightningRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={LIGHTNING_PTS}
            array={new Float32Array(LIGHTNING_PTS * 3)}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
          <bufferAttribute
            attach="attributes-color"
            count={LIGHTNING_PTS}
            array={new Float32Array(LIGHTNING_PTS * 3)}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0} depthWrite={false} />
      </line>
    </group>
  );
};

export default WormholeTunnel;
