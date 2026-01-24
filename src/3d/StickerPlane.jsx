import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, FACE_COLORS, ANTIPODAL_COLOR } from '../utils/constants.js';
import { play, vibrate } from '../utils/audio.js';
import TallyMarks from '../manifold/TallyMarks.jsx';

// Worm component for disparity visualization
const Worm = ({ position, rotation, scale = 1 }) => {
  const wormRef = useRef();

  useFrame((state) => {
    if (wormRef.current) {
      // Wiggle animation
      const time = state.clock.elapsedTime;
      wormRef.current.rotation.z = Math.sin(time * 3 + rotation) * 0.2;
    }
  });

  return (
    <group position={position} ref={wormRef}>
      {/* Worm body - curved shape */}
      <mesh position={[0, 0, 0.015]}>
        <capsuleGeometry args={[0.02 * scale, 0.08 * scale, 4, 8]} />
        <meshBasicMaterial color="#bc6c25" />
      </mesh>
      {/* Worm head highlight */}
      <mesh position={[0, 0.05 * scale, 0.015]}>
        <sphereGeometry args={[0.025 * scale, 8, 8]} />
        <meshBasicMaterial color="#dda15e" />
      </mesh>
    </group>
  );
};

const StickerPlane = function StickerPlane({ meta, pos, rot=[0,0,0], overlay, mode }) {
  const groupRef = useRef();
  const meshRef = useRef();
  const ringRef = useRef();
  const glowRef = useRef();
  const spinT = useRef(0);
  const shakeT = useRef(0);
  const pulseT = useRef(0);
  const flipFromColor = useRef(null);
  const flipToColor = useRef(null);

  const prevCurr = useRef(meta?.curr ?? 0);
  useEffect(() => {
    const curr = meta?.curr ?? 0;
    const prevVal = prevCurr.current;

    // Only trigger flip animation if the color actually changed to its antipodal
    if (curr !== prevVal && meta?.flips > 0 && ANTIPODAL_COLOR[prevVal] === curr) {
      // Store the colors for the flip animation
      flipFromColor.current = FACE_COLORS[prevVal];
      flipToColor.current = FACE_COLORS[curr];
      spinT.current = 1;
      play('/sounds/flip.mp3');
      vibrate(16);
    }
    prevCurr.current = curr;
  }, [meta?.curr, meta?.flips]);

  useFrame((_, delta) => {
    // Flip animation
    if (spinT.current > 0 && groupRef.current) {
      const dt = Math.min(delta * 4, spinT.current);
      spinT.current -= dt;
      const p = 1 - spinT.current;

      let angle;
      if (p < 0.5) {
        // First half: rotate towards the "portal"
        angle = Math.sin(p * Math.PI * 2) * Math.PI;
      } else {
        // Second half: emerge from portal with overshoot
        const overshoot = Math.sin((p - 0.5) * Math.PI * 4) * 0.15;
        angle = Math.PI + overshoot;
      }

      groupRef.current.rotation.y = rot[1] + angle;

      const scale = 1 + Math.sin(p * Math.PI) * 0.15;
      groupRef.current.scale.set(scale, scale, 1);

      // Animate color through the flip
      if (meshRef.current && flipFromColor.current && flipToColor.current) {
        if (p < 0.5) {
          meshRef.current.material.color.set(flipFromColor.current);
        } else {
          meshRef.current.material.color.set(flipToColor.current);
        }
      }

      if (spinT.current <= 0) {
        groupRef.current.rotation.y = rot[1];
        groupRef.current.scale.set(1, 1, 1);
        // Start shake animation after flip completes
        shakeT.current = 0.5;
        flipFromColor.current = null;
        flipToColor.current = null;
      }
    }

    // Shake animation for parity indicator
    if (shakeT.current > 0 && groupRef.current) {
      const dt = Math.min(delta * 2, shakeT.current);
      shakeT.current -= dt;
      const intensity = shakeT.current * 2; // Decay from 1 to 0
      const shakeFreq = 25;
      const shakeX = Math.sin(shakeT.current * shakeFreq * Math.PI) * 0.03 * intensity;
      const shakeZ = Math.cos(shakeT.current * shakeFreq * Math.PI * 1.3) * 0.02 * intensity;
      groupRef.current.position.x = pos[0] + shakeX;
      groupRef.current.position.z = pos[2] + shakeZ;

      if (shakeT.current <= 0) {
        groupRef.current.position.set(pos[0], pos[1], pos[2]);
      }
    }

    pulseT.current += delta * 2.1;
    if (ringRef.current) {
      const s = 1 + (Math.sin(pulseT.current) * 0.08);
      ringRef.current.scale.setScalar(s);
    }

    if (glowRef.current) {
      const glowIntensity = 0.3 + Math.sin(pulseT.current * 1.5) * 0.2;
      glowRef.current.material.opacity = glowIntensity;
    }
  });

  const isSudokube = mode==='sudokube';
  const baseColor = isSudokube ? COLORS.white : (meta?.curr ? FACE_COLORS[meta.curr] : COLORS.black);
  const isWormhole = meta?.flips>0 && meta?.curr!==meta?.orig;
  const hasFlipHistory = meta?.flips > 0;

  const trackerRadius = Math.min(0.35, 0.06 + (meta?.flips ?? 0) * 0.012);
  const origColor = meta?.orig ? FACE_COLORS[meta.orig] : COLORS.black;
  const antipodalColor = meta?.orig ? FACE_COLORS[ANTIPODAL_COLOR[meta.orig]] : COLORS.black;

  // Check if colors are white - don't show white indicators on non-white tiles
  const currIsWhite = meta?.curr === 3;
  const origIsWhite = meta?.orig === 3;
  const antipodalIsWhite = ANTIPODAL_COLOR[meta?.orig] === 3;

  const shadowIntensity = Math.min(0.5, (meta?.flips ?? 0) * 0.03);

  return (
    <group position={pos} rotation={rot} ref={groupRef}>
      <mesh ref={meshRef}>
        <planeGeometry args={[0.82,0.82]} />
        <meshBasicMaterial
          color={baseColor}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Origin color circle - skip if it would be white on a non-white tile */}
      {!isSudokube && hasFlipHistory && !(origIsWhite && !currIsWhite) && (
        <mesh position={[0,0,0.01]}>
          <circleGeometry args={[trackerRadius,32]} />
          <meshBasicMaterial
            color={origColor}
            opacity={isWormhole ? 1.0 : 0.5}
            transparent={!isWormhole}
          />
        </mesh>
      )}

      {/* Tally Marks - skip if origColor is white on non-white tile */}
      {!isSudokube && hasFlipHistory && !(origIsWhite && !currIsWhite) && (
        <TallyMarks
          flips={meta?.flips ?? 0}
          radius={trackerRadius}
          origColor={origColor}
        />
      )}

      {/* Flipped tile border - skip white rings on non-white tiles */}
      {!isSudokube && hasFlipHistory && (
        <>
          {!(origIsWhite && !currIsWhite) && (
            <mesh position={[0,0,0.006]}>
              <ringGeometry args={[0.38, 0.41, 32]} />
              <meshBasicMaterial color={origColor} />
            </mesh>
          )}
          {!(antipodalIsWhite && !currIsWhite) && (
            <mesh position={[0,0,0.007]}>
              <ringGeometry args={[0.35, 0.38, 32]} />
              <meshBasicMaterial color={antipodalColor} />
            </mesh>
          )}
        </>
      )}

      {!isSudokube && isWormhole && (
        <>
          <mesh ref={ringRef} position={[0,0,0.02]}>
            <ringGeometry args={[0.36,0.40,32]} />
            <meshBasicMaterial color="#dda15e" transparent opacity={0.85} />
          </mesh>
          <mesh ref={glowRef} position={[0,0,0.015]}>
            <circleGeometry args={[0.44,32]} />
            <meshBasicMaterial
              color="#bc6c25"
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          {/* WORM creatures crawling on disparity stickers */}
          <Worm position={[0.25, 0.25, 0]} rotation={0} scale={0.8} />
          <Worm position={[-0.25, 0.25, 0]} rotation={Math.PI / 4} scale={0.7} />
          <Worm position={[0.25, -0.25, 0]} rotation={Math.PI / 2} scale={0.75} />
          <Worm position={[-0.25, -0.25, 0]} rotation={Math.PI * 0.75} scale={0.7} />
        </>
      )}

      {overlay && (
        <Text position={[0,0,0.03]} fontSize={0.17} color="black" anchorX="center" anchorY="middle">
          {overlay}
        </Text>
      )}
    </group>
  );
};

export default StickerPlane;
