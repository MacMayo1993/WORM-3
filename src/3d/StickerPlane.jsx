import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, FACE_COLORS, ANTIPODAL_COLOR } from '../utils/constants.js';
import { play, vibrate } from '../utils/audio.js';
import TallyMarks from '../manifold/TallyMarks.jsx';

// Particle system for flip effect
const FlipParticles = ({ active, color, onComplete }) => {
  const particlesRef = useRef([]);
  const groupRef = useRef();
  const progressRef = useRef(0);
  const velocitiesRef = useRef([]);
  const PARTICLE_COUNT = 24;

  // Initialize particle velocities on activation
  useEffect(() => {
    if (active) {
      progressRef.current = 0;
      velocitiesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 2.5 + Math.random() * 2.0;
        const size = 0.06 + Math.random() * 0.06; // Varied sizes
        return {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
          z: (Math.random() - 0.5) * 1.5,
          rotSpeed: (Math.random() - 0.5) * 15,
          size
        };
      });
    }
  }, [active]);

  useFrame((_, delta) => {
    if (!active || !groupRef.current) return;

    // Slower progression for longer-lasting particles
    progressRef.current += delta * 1.8;
    const p = progressRef.current;

    if (p >= 1) {
      onComplete?.();
      return;
    }

    // Ease out quart for explosive start, slow fade
    const easeOut = 1 - Math.pow(1 - p, 4);
    // Fade out slower - stay bright longer
    const opacity = Math.pow(1 - p, 0.5);

    particlesRef.current.forEach((mesh, i) => {
      if (!mesh) return;
      const vel = velocitiesRef.current[i];
      if (!vel) return;

      // Position - travel much farther
      mesh.position.x = vel.x * easeOut * 0.8;
      mesh.position.y = vel.y * easeOut * 0.8;
      mesh.position.z = vel.z * easeOut * 0.4 + 0.05;

      // Rotation
      mesh.rotation.z = vel.rotSpeed * p;

      // Scale - start big, shrink as they fly
      const baseScale = vel.size * (1 - easeOut * 0.5);
      mesh.scale.set(baseScale, baseScale, baseScale * 0.5);

      // Update opacity - bright and visible
      if (mesh.material) {
        mesh.material.opacity = opacity;
      }
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef} position={[0, 0, 0.05]}>
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={el => particlesRef.current[i] = el}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={1}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// Antipodal glow fill effect - glows from outside and fills inward
const AntipodalGlowFill = ({ active, color }) => {
  const ringRef = useRef();
  const innerGlowRef = useRef();
  const outerRingRef = useRef();
  const progressRef = useRef(0);

  // Reset progress when activated
  useEffect(() => {
    if (active) {
      progressRef.current = 0;
    }
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;

    // Progress the animation (matches flip speed)
    progressRef.current = Math.min(1, progressRef.current + delta * 5);
    const progress = progressRef.current;

    // Snappy easing - fast start, smooth end
    const snappyProgress = 1 - Math.pow(1 - progress, 3);

    // Update outer shrinking ring
    if (ringRef.current) {
      // Ring shrinks from outside (full size) to inside (zero)
      const ringScale = Math.max(0.01, 1 - snappyProgress);
      ringRef.current.scale.set(ringScale, ringScale, 1);

      // Pulsing glow opacity
      const glowPulse = Math.sin(progress * Math.PI * 4) * 0.3 + 0.7;
      ringRef.current.material.opacity = (1 - snappyProgress * 0.3) * glowPulse * 0.9;
    }

    // Update outer edge glow ring
    if (outerRingRef.current) {
      const edgeScale = Math.max(0.01, 1.1 - snappyProgress * 0.8);
      outerRingRef.current.scale.set(edgeScale, edgeScale, 1);
      outerRingRef.current.material.opacity = (1 - snappyProgress) * 0.6;
    }

    // Inner fill glow expands to fill the tile
    if (innerGlowRef.current) {
      const fillScale = snappyProgress * 0.95;
      innerGlowRef.current.scale.set(fillScale, fillScale, 1);
      // Fade in then out
      const fillOpacity = Math.sin(progress * Math.PI) * 0.7;
      innerGlowRef.current.material.opacity = fillOpacity;
    }
  });

  if (!active) return null;

  return (
    <group position={[0, 0, 0.025]}>
      {/* Outer edge glow - starts larger */}
      <mesh ref={outerRingRef}>
        <ringGeometry args={[0.4, 0.5, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Main shrinking glow ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[0.2, 0.45, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Inner expanding fill */}
      <mesh ref={innerGlowRef} position={[0, 0, -0.005]}>
        <circleGeometry args={[0.48, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

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
  const flipProgress = useRef(0);

  // State for triggering particle and glow effects (needs re-render)
  const [particlesActive, setParticlesActive] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
  const [currentGlowColor, setCurrentGlowColor] = useState(null);
  const [currentParticleColor, setCurrentParticleColor] = useState(null);

  const prevCurr = useRef(meta?.curr ?? 0);
  useEffect(() => {
    const curr = meta?.curr ?? 0;
    const prevVal = prevCurr.current;

    // Only trigger flip animation if the color actually changed to its antipodal
    if (curr !== prevVal && meta?.flips > 0 && ANTIPODAL_COLOR[prevVal] === curr) {
      // Store the colors for the flip animation
      // flipToColor is the ANTIPODAL color (what we're flipping TO)
      flipFromColor.current = FACE_COLORS[prevVal];
      flipToColor.current = FACE_COLORS[curr];
      spinT.current = 1;
      flipProgress.current = 0;

      // Set the glow color to the ANTIPODAL color (what we're becoming)
      // So if flipping FROM blue, we glow GREEN (the antipodal)
      setCurrentGlowColor(FACE_COLORS[curr]);
      setCurrentParticleColor(FACE_COLORS[curr]);
      setParticlesActive(true);
      setGlowActive(true);

      play('/sounds/flip.mp3');
      vibrate(16);
    }
    prevCurr.current = curr;
  }, [meta?.curr, meta?.flips]);

  useFrame((_, delta) => {
    // Flip animation with SNAPPY acceleration
    if (spinT.current > 0 && groupRef.current) {
      // Faster animation speed (5x instead of 4x) for snappier feel
      const dt = Math.min(delta * 5, spinT.current);
      spinT.current -= dt;
      const rawP = 1 - spinT.current;

      // Snappy ease-out-back easing for acceleration
      // Fast start, slight overshoot, smooth settle
      const easeOutBack = (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      };

      // Use different easing for different phases
      let p;
      if (rawP < 0.5) {
        // First half: accelerate quickly (ease-out quad)
        p = rawP * 2;
        p = 1 - (1 - p) * (1 - p);
        p = p * 0.5;
      } else {
        // Second half: snappy with slight overshoot
        p = (rawP - 0.5) * 2;
        p = easeOutBack(p);
        p = 0.5 + p * 0.5;
      }

      flipProgress.current = rawP;

      let angle;
      if (rawP < 0.5) {
        // First half: quick snap towards the flip
        angle = p * Math.PI;
      } else {
        // Second half: complete with snappy overshoot
        const overshoot = Math.sin((rawP - 0.5) * Math.PI * 2) * 0.2;
        angle = Math.PI + overshoot;
      }

      groupRef.current.rotation.y = rot[1] + angle;

      // Punchier scale animation - bigger at midpoint
      const scalePunch = Math.sin(rawP * Math.PI);
      const scale = 1 + scalePunch * 0.2;
      groupRef.current.scale.set(scale, scale, 1);

      // Animate color through the flip - switch at midpoint
      if (meshRef.current && flipFromColor.current && flipToColor.current) {
        if (rawP < 0.5) {
          meshRef.current.material.color.set(flipFromColor.current);
        } else {
          meshRef.current.material.color.set(flipToColor.current);
        }
      }

      if (spinT.current <= 0) {
        groupRef.current.rotation.y = rot[1];
        groupRef.current.scale.set(1, 1, 1);
        // Start shake animation after flip completes
        shakeT.current = 0.4;
        setGlowActive(false);
        flipFromColor.current = null;
        flipToColor.current = null;
        flipProgress.current = 0;
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
        <planeGeometry args={[0.85,0.85]} />
        <meshStandardMaterial
          color={baseColor}
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.05}
          envMapIntensity={0.3}
        />
      </mesh>

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

          {/* WORM creatures - number equals flip count (max 12) */}
          {Array.from({ length: Math.min(meta?.flips ?? 0, 12) }, (_, i) => {
            const count = Math.min(meta?.flips ?? 0, 12);
            const angle = (i / count) * Math.PI * 2;
            const radius = count <= 4 ? 0.25 : 0.28; // Spread out more if many worms
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const scale = count <= 4 ? 0.7 + (i % 2) * 0.1 : 0.6; // Smaller if crowded
            return (
              <Worm
                key={i}
                position={[x, y, 0]}
                rotation={angle}
                scale={scale}
              />
            );
          })}
        </>
      )}

      {/* Antipodal glow fill effect during flip */}
      <AntipodalGlowFill
        active={glowActive}
        color={currentGlowColor}
      />

      {/* Particle burst effect during flip */}
      <FlipParticles
        active={particlesActive}
        color={currentParticleColor}
        onComplete={() => setParticlesActive(false)}
      />

      {overlay && (
        <Text position={[0,0,0.03]} fontSize={0.17} color="black" anchorX="center" anchorY="middle">
          {overlay}
        </Text>
      )}
    </group>
  );
};

export default StickerPlane;
