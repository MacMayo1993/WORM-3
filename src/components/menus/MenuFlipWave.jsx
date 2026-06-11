import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import MenuWormParticle from './MenuWormParticle.jsx';

// Shared geometries — created once for all MenuFlipWave instances
const sharedWaveRingGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
const sharedInnerRingGeometry = new THREE.RingGeometry(0.3, 0.6, 32);
const sharedFlashDisc = new THREE.CircleGeometry(0.52, 32);

const WORM_TOTAL_DURATION = 2.0 + 2.0; // must match MenuWormParticle duration + retreatDur

/**
 * Brief bright disc that pops open on the tile face when a flip triggers.
 */
const TileFlash = ({ startTime, color }) => {
  const discRef = useRef();
  const flashDur = 0.45;

  useFrame((state) => {
    if (!discRef.current) return;
    const t = Math.min(state.clock.getElapsedTime() - startTime, flashDur);
    const p = t / flashDur;
    const s = 0.3 + p * 1.4;
    discRef.current.scale.set(s, s, 1);
    discRef.current.material.opacity = (1 - p) * 1.1;
  });

  return (
    <mesh ref={discRef} scale={[0.3, 0.3, 1]} geometry={sharedFlashDisc}>
      <meshBasicMaterial
        color={color} transparent opacity={1.1}
        blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * MenuFlipWave — menu-only flip wave: expanding rings + TileFlash + MenuWormParticle.
 * Progress is tracked via useRef (never useState) so useFrame never triggers React re-renders.
 */
const MenuFlipWave = ({ origins, startTime, onComplete }) => {
  const progressRef = useRef(0);
  const ringsRef = useRef([]);
  const onCompleteCalledRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Fallback timeout in case worm's onComplete is never called
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!onCompleteCalledRef.current) {
        onCompleteCalledRef.current = true;
        onCompleteRef.current?.();
      }
    }, (WORM_TOTAL_DURATION + 0.3) * 1000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { ringsRef.current = []; };
  }, []);

  useFrame((_state, delta) => {
    if (progressRef.current >= 1) return;
    progressRef.current = Math.min(1, progressRef.current + delta * 1.2);
    const easeOut = 1 - Math.pow(1 - progressRef.current, 3);
    ringsRef.current.forEach((ring) => {
      if (!ring) return;
      const scale = easeOut * 4 + 0.5;
      ring.scale.setScalar(scale);
      if (ring.material) ring.material.opacity = (1 - easeOut) * 0.8;
    });
  });

  if (!origins || origins.length === 0) return null;

  const wormCompleted = () => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    onComplete?.();
  };

  return (
    <group>
      {origins.map((origin, idx) => (
        <group key={idx} position={origin.position} rotation={origin.rotation || [0, 0, 0]}>
          {/* Expanding ring — hidden initially so no flash on mount */}
          <mesh ref={el => ringsRef.current[idx] = el} geometry={sharedWaveRingGeometry} scale={[0.01, 0.01, 0.01]}>
            <meshBasicMaterial
              color={origin.color} transparent opacity={0}
              side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false}
            />
          </mesh>
          <mesh geometry={sharedInnerRingGeometry} scale={[0.01, 0.01, 0.01]}>
            <meshBasicMaterial
              color={origin.color} transparent opacity={0}
              side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false}
            />
          </mesh>
          <TileFlash startTime={startTime} color={origin.color} />
        </group>
      ))}

      {origins.map((origin, idx) => (
        <React.Fragment key={`worms-${idx}`}>
          <MenuWormParticle
            start={origin.position}
            color1={origin.color}
            startTime={startTime}
            onComplete={idx === 0 ? wormCompleted : undefined}
          />
          <MenuWormParticle
            start={origin.position}
            color1={origin.color}
            startTime={startTime}
          />
        </React.Fragment>
      ))}
    </group>
  );
};

export default MenuFlipWave;
