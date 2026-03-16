// src/worm/WormTrail.jsx
// Visual worm body using connected spheres with glow effect
// Supports both surface mode and tunnel mode

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSegmentWorldPos, getTunnelWorldPos } from './wormLogic.js';

// Worm segment colors - gradient from head to tail
const HEAD_COLOR = '#00ff88';
const TAIL_COLOR = '#009944';
// Tunnel mode uses brighter neon colors
const HEAD_COLOR_TUNNEL = '#00ffaa';
const TAIL_COLOR_TUNNEL = '#00cc66';

// Pre-create color objects to avoid GC pressure
const HEAD_COLOR_OBJ = new THREE.Color(HEAD_COLOR);
const TAIL_COLOR_OBJ = new THREE.Color(TAIL_COLOR);
const HEAD_COLOR_TUNNEL_OBJ = new THREE.Color(HEAD_COLOR_TUNNEL);
const TAIL_COLOR_TUNNEL_OBJ = new THREE.Color(TAIL_COLOR_TUNNEL);

// Module-level shared geometry and scratch object.
// SphereGeometry / CylinderGeometry are plain CPU buffers — no GL context needed.
const _unitSphere = new THREE.SphereGeometry(1, 16, 16);
// Cylinder: fixed radii 0.15/0.18, unit height — scale Y per instance for length.
const _unitCylinder = new THREE.CylinderGeometry(0.15, 0.18, 1, 8);
// Single Object3D used as scratch for matrix math — never added to a scene.
const _dummy = new THREE.Object3D();
// Scratch vectors for tube orientation math — avoids per-iteration allocation.
const _UP = new THREE.Vector3(0, 1, 0);
const _tubeDir = new THREE.Vector3();
// Pre-allocated color pool — reused across renders to avoid GC pressure.
const _colorPool = Array.from({ length: 200 }, () => new THREE.Color());
// Maximum instanced segments. Set well above any realistic worm length to prevent
// InstancedMesh overflow (overflow is silent — instances beyond the cap are skipped).
const MAX_WORM_INSTANCES = 200;
// Face-normal direction for each dirKey — used to lift worm segments off tile surface
const FACE_NORMALS = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};
// How far (units) worm segments float above the tile surface to avoid clipping
const WORM_LIFT = 0.45;
// How much lift is removed when worm weight fully depresses a tile (matches MAX_PRESS_OFFSET)
const WORM_PRESS_REDUCTION = 0.06;

/**
 * @param {Object} props
 * @param {Array} props.segments - Worm segments (surface or tunnel positions)
 * @param {number} props.size - Cube size
 * @param {number} props.explosionFactor - Explosion animation factor
 * @param {boolean} props.alive - Is the worm alive
 * @param {string} props.mode - 'surface' or 'tunnel'
 */
export default function WormTrail({ segments, size, explosionFactor = 0, alive = true, mode = 'surface' }) {
  const headMeshRef = useRef();
  const headGlowRef = useRef();
  const bodyMeshRef = useRef();
  const tubeMeshRef = useRef();
  const timeRef = useRef(0);

  const isTunnelMode = mode === 'tunnel';
  const headColorObj = isTunnelMode ? HEAD_COLOR_TUNNEL_OBJ : HEAD_COLOR_OBJ;
  const tailColorObj = isTunnelMode ? TAIL_COLOR_TUNNEL_OBJ : TAIL_COLOR_OBJ;

  // ── Derived data (memoised to avoid recomputation on unrelated re-renders) ──

  const positions = useMemo(() => segments.map(seg => {
    if (isTunnelMode && seg.tunnel) {
      return getTunnelWorldPos(seg.tunnel, seg.t, size, explosionFactor);
    }
    const base = getSegmentWorldPos(seg, size, explosionFactor);
    // Push outward along the face normal so the worm sits visibly ON the cube.
    // Reduce lift by WORM_PRESS_REDUCTION so the worm sinks with the depressed tile.
    const normal = FACE_NORMALS[seg.dirKey] || [0, 0, 1];
    const lift = WORM_LIFT - WORM_PRESS_REDUCTION;
    return [
      base[0] + normal[0] * lift,
      base[1] + normal[1] * lift,
      base[2] + normal[2] * lift,
    ];
  }), [segments, size, explosionFactor, isTunnelMode]);

  const segmentColors = useMemo(() => segments.map((seg, i) => {
    // Reuse a pooled Color object — avoids allocation on every worm-move render.
    const c = _colorPool[i] ?? new THREE.Color();
    if (seg.color) return c.set(seg.color);
    const t = segments.length > 1 ? i / (segments.length - 1) : 0;
    return c.copy(headColorObj).lerp(tailColorObj, t);
  }), [segments, headColorObj, tailColorObj]);

  const bodyCount = Math.max(0, positions.length - 1); // segments index 1..n
  const tubeCount = bodyCount; // one tube between every pair of adjacent segments

  // ── Update both body-sphere and tube InstancedMeshes in a single effect ───
  // Merged from two separate effects to halve the React reconciliation overhead.
  useEffect(() => {
    const bodyMesh = bodyMeshRef.current;
    const tubeMesh = tubeMeshRef.current;
    const transparent = !alive;
    const opacity = alive ? 1 : 0.5;

    // ── Body spheres ──
    if (bodyMesh) {
      bodyMesh.material.transparent = transparent;
      bodyMesh.material.opacity = opacity;
      bodyMesh.material.needsUpdate = true;

      for (let i = 1; i < positions.length; i++) {
        const idx = i - 1;
        const pos = positions[i];
        const isTail = i === positions.length - 1;
        const t = positions.length > 1 ? i / (positions.length - 1) : 0;
        const radius = isTail ? 0.2 : 0.28 - t * 0.08;

        _dummy.position.set(pos[0], pos[1], pos[2]);
        _dummy.scale.setScalar(radius);
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        bodyMesh.setMatrixAt(idx, _dummy.matrix);
        bodyMesh.setColorAt(idx, segmentColors[i]);
      }

      for (let i = bodyCount; i < bodyMesh.count; i++) {
        _dummy.position.set(0, 0, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        bodyMesh.setMatrixAt(i, _dummy.matrix);
      }

      bodyMesh.instanceMatrix.needsUpdate = true;
      if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    }

    // ── Connecting tubes ──
    if (tubeMesh) {
      tubeMesh.material.transparent = transparent;
      tubeMesh.material.opacity = opacity;
      tubeMesh.material.needsUpdate = true;

      let tubeIdx = 0;
      for (let i = 1; i < positions.length; i++) {
        const pos = positions[i];
        const prev = positions[i - 1];
        const dx = pos[0] - prev[0];
        const dy = pos[1] - prev[1];
        const dz = pos[2] - prev[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 0.1 || dist > 2) {
          _dummy.position.set(0, 0, 0);
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          tubeMesh.setMatrixAt(tubeIdx, _dummy.matrix);
          tubeIdx++;
          continue;
        }

        _dummy.position.set((pos[0] + prev[0]) / 2, (pos[1] + prev[1]) / 2, (pos[2] + prev[2]) / 2);
        _tubeDir.set(dx, dy, dz).normalize();
        _dummy.quaternion.setFromUnitVectors(_UP, _tubeDir);
        _dummy.scale.set(1, dist * 0.8, 1);
        _dummy.updateMatrix();
        tubeMesh.setMatrixAt(tubeIdx, _dummy.matrix);
        tubeMesh.setColorAt(tubeIdx, segmentColors[i]);
        tubeIdx++;
      }

      for (let i = tubeIdx; i < tubeMesh.count; i++) {
        _dummy.position.set(0, 0, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        tubeMesh.setMatrixAt(i, _dummy.matrix);
      }

      tubeMesh.instanceMatrix.needsUpdate = true;
      if (tubeMesh.instanceColor) tubeMesh.instanceColor.needsUpdate = true;
    }
  }, [positions, segmentColors, bodyCount, alive]);

  // ── Per-frame: animate head pulse + glow ─────────────────────────────────
  useFrame((_state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (headMeshRef.current && positions.length > 0) {
      // Pulse the head sphere scale
      const pulseScale = 0.35 * (1 + Math.sin(t * 8) * 0.1);
      headMeshRef.current.scale.setScalar(pulseScale);
    }

    if (headGlowRef.current) {
      headGlowRef.current.material.opacity = (isTunnelMode ? 0.3 : 0.2) + Math.sin(t * 8) * 0.1;
    }
  });

  if (segments.length === 0) return null;

  const headPos = positions[0];
  const headColor = segmentColors[0] || HEAD_COLOR_OBJ;

  return (
    <group>
      {/* ── Head: kept as individual meshes (unique glow + eyes) ── */}
      <group position={headPos}>
        {/* Head body sphere — scale driven by useFrame; shares module-level geometry */}
        <mesh ref={headMeshRef} geometry={_unitSphere}>
          <meshStandardMaterial
            color={headColor}
            emissive={headColor}
            emissiveIntensity={0.8}
            transparent={!alive}
            opacity={alive ? 1 : 0.5}
          />
        </mesh>

        {/* Head glow halo */}
        {alive && (
          <mesh ref={headGlowRef}>
            <sphereGeometry args={[isTunnelMode ? 0.63 : 0.525, 16, 16]} />
            <meshBasicMaterial
              color={headColor}
              transparent
              opacity={0.2}
              side={THREE.BackSide}
            />
          </mesh>
        )}

        {/* Eyes */}
        <mesh position={[0.12, 0.1, 0.25]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.12, 0.1, 0.25]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Pupils */}
        <mesh position={[0.12, 0.1, 0.32]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        <mesh position={[-0.12, 0.1, 0.32]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
      </group>

      {/* ── Body segments: 1 draw call for all spheres ── */}
      {bodyCount > 0 && (
        <instancedMesh ref={bodyMeshRef} args={[_unitSphere, null, MAX_WORM_INSTANCES]} frustumCulled={false}>
          {/* color="#ffffff" so instanceColor passes through unmodified */}
          <meshStandardMaterial
            color="#ffffff"
            emissive="#000000"
            emissiveIntensity={0}
            vertexColors
          />
        </instancedMesh>
      )}

      {/* ── Connecting tubes: 1 draw call for all cylinders ── */}
      {tubeCount > 0 && (
        <instancedMesh ref={tubeMeshRef} args={[_unitCylinder, null, MAX_WORM_INSTANCES]} frustumCulled={false}>
          <meshStandardMaterial
            color="#ffffff"
            emissive="#000000"
            emissiveIntensity={0}
            vertexColors
          />
        </instancedMesh>
      )}
    </group>
  );
}
