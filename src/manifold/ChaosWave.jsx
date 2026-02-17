import React, { useState, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Shared geometries — created once, reused by all instances
const sharedSphereGeo = new THREE.SphereGeometry(0.15, 16, 16);
const sharedGhostGeo = new THREE.SphereGeometry(0.12, 12, 12);
const sharedGapGlowGeo = new THREE.SphereGeometry(0.22, 16, 16);

// Temp vectors for per-frame math (avoids GC pressure)
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _mid = new THREE.Vector3();

const GHOST_COUNT = 5;
const GHOST_SPACING = 0.12; // fraction of path behind the head

const ChaosWave = ({ from, to, crossFace = false, color = '#ff0080', onComplete }) => {
  const [progress, setProgress] = useState(0);
  const meshRef = useRef();
  const ghostRefs = useRef([]);
  const gapGlowRef = useRef();
  const beamRef = useRef();
  const completedRef = useRef(false);

  // Pre-compute beam line points (from → to)
  const beamPoints = useMemo(() => {
    const f = new THREE.Vector3(...from);
    const t = new THREE.Vector3(...to);
    const pts = [];
    const segments = 12;
    for (let i = 0; i <= segments; i++) {
      pts.push(new THREE.Vector3().lerpVectors(f, t, i / segments));
    }
    return pts;
  }, [from, to]);

  const beamGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(beamPoints);
  }, [beamPoints]);

  // The midpoint between from/to — the "gap" between tiles/manifolds
  const midpoint = useMemo(() => {
    return new THREE.Vector3(...from).lerp(new THREE.Vector3(...to), 0.5);
  }, [from, to]);

  // Use a slightly slower speed for cross-face (manifold gap) transitions
  // so the gap illumination is more visible
  const speed = crossFace ? 2.2 : 3.0;

  useFrame((_, delta) => {
    if (completedRef.current) return;

    const newP = Math.min(1, progress + delta * speed);
    setProgress(newP);

    _from.set(...from);
    _to.set(...to);

    // Main head position
    _pos.lerpVectors(_from, _to, newP);
    if (meshRef.current) {
      meshRef.current.position.copy(_pos);
      meshRef.current.material.opacity = Math.max(0, 1 - newP * 0.6);
    }

    // Ghost echoes trail behind the head
    for (let i = 0; i < GHOST_COUNT; i++) {
      const ghost = ghostRefs.current[i];
      if (!ghost) continue;
      const ghostT = Math.max(0, newP - (i + 1) * GHOST_SPACING);
      _pos.lerpVectors(_from, _to, ghostT);
      ghost.position.copy(_pos);
      // Each successive ghost is more faded and slightly smaller
      const fade = Math.max(0, (1 - newP * 0.5) * (1 - (i + 1) / (GHOST_COUNT + 1)));
      ghost.material.opacity = fade * 0.5;
      const s = 1 - (i + 1) * 0.12;
      ghost.scale.setScalar(s);
    }

    // Gap glow — brightest when the head is near the midpoint
    if (gapGlowRef.current) {
      _mid.copy(midpoint);
      gapGlowRef.current.position.copy(_mid);
      // Gaussian brightness centered on progress=0.5
      const distFromMid = Math.abs(newP - 0.5);
      const gapIntensity = Math.exp(-(distFromMid * distFromMid) / 0.04);
      // Cross-face gaps glow brighter and wider
      const gapScale = crossFace ? 1.8 + gapIntensity * 1.5 : 1.0 + gapIntensity * 0.8;
      gapGlowRef.current.scale.setScalar(gapScale);
      gapGlowRef.current.material.opacity = gapIntensity * (crossFace ? 0.6 : 0.35);
    }

    // Beam trail — fade in then out
    if (beamRef.current) {
      const beamOpacity = newP < 0.15
        ? newP / 0.15 * 0.35
        : Math.max(0, 0.35 * (1 - (newP - 0.15) / 0.85));
      beamRef.current.material.opacity = beamOpacity;
    }

    if (newP >= 1 && !completedRef.current) {
      completedRef.current = true;
      if (onComplete) onComplete();
    }
  });

  if (progress >= 1 && completedRef.current) return null;

  const ghostColor = crossFace ? '#c060ff' : color;

  return (
    <group>
      {/* Beam trail line connecting from → to */}
      <line ref={beamRef} geometry={beamGeometry}>
        <lineBasicMaterial
          color={crossFace ? '#a040ff' : color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>

      {/* Gap glow — illuminates the seam between tiles/manifolds */}
      <mesh ref={gapGlowRef} geometry={sharedGapGlowGeo} position={midpoint.toArray()}>
        <meshBasicMaterial
          color={crossFace ? '#d080ff' : '#ff80c0'}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Ghost echo trail — faded copies trailing behind the head */}
      {Array.from({ length: GHOST_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { ghostRefs.current[i] = el; }}
          geometry={sharedGhostGeo}
        >
          <meshBasicMaterial
            color={ghostColor}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Main lightning head */}
      <mesh ref={meshRef} geometry={sharedSphereGeo}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={1}
          emissive={color}
          emissiveIntensity={2}
        />
      </mesh>
    </group>
  );
};

export default ChaosWave;
