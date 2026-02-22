import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Global scratchpad: 0 memory allocation during the game loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _color = new THREE.Color();
const _quat = new THREE.Quaternion();

const WormParticle = ({ start, end, color1, color2, startTime, currentTime, onComplete }) => {
  const headRef = useRef();
  const trailGeoRef = useRef();
  const segmentRefs = useRef([]);
  const eyeLeftRef = useRef();
  const eyeRightRef = useRef();
  const tongueRef = useRef();

  const duration = 2.2;
  const trailLength = 25;
  const segmentCount = 8;

  // Personality: Random traits set once on mount
  const personality = useMemo(() => ({
    wiggleSpeed: 1.5 + Math.random() * 2.0,
    eyeSize: 0.05 + Math.random() * 0.03,
    tongueLength: 0.1 + Math.random() * 0.08,
    blinkChance: 0.005 + Math.random() * 0.01,
    squishAmount: 0.2 + Math.random() * 0.2,
  }), []);

  const points = useMemo(() => new Float32Array(trailLength * 3), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  
  // Animation state
  const isBlinking = useRef(false);
  const blinkTimer = useRef(0);

  useFrame(({ clock }) => {
    const clockTime = clock.getElapsedTime();
    // Use prop currentTime for animation timing (synced with WelcomeScreen)
    // Fall back to clock time if prop not provided
    const animTime = currentTime !== undefined ? currentTime : clockTime;
    if (animTime < startTime) return;

    const elapsed = animTime - startTime;
    if (elapsed >= duration) {
      if (onComplete) onComplete();
      return;
    }

    // 1. Progress & Path
    const t = elapsed / duration;
    const progress = t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

    const vStart = _v1.set(...start);
    const vEnd = _v2.set(...end);
    const dir = _v3.subVectors(vEnd, vStart).normalize();
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();

    const wiggle = Math.sin(progress * Math.PI * 5 + clockTime * personality.wiggleSpeed) * 0.3;
    const mid = new THREE.Vector3().addVectors(vStart, vEnd).multiplyScalar(0.5);
    const control = mid.add(right.clone().multiplyScalar(wiggle));
    const curve = new THREE.QuadraticBezierCurve3(vStart, control, vEnd);

    // 2. Update Trail
    for (let i = 0; i < trailLength; i++) {
      const p = curve.getPoint((i / (trailLength - 1)) * progress);
      points[i * 3] = p.x;
      points[i * 3 + 1] = p.y;
      points[i * 3 + 2] = p.z;
    }
    trailGeoRef.current.attributes.position.needsUpdate = true;

    // 3. Update Head & Mascot Color
    const headPos = curve.getPoint(progress);
    headRef.current.position.copy(headPos);
    headRef.current.lookAt(vEnd); // Head faces movement direction

    _color.set(color1).lerp(_v1.set(color2), progress);
    _color.offsetHSL(0.1 * Math.sin(clockTime * 3), 0, 0);

    // 4. Body Segments
    segmentRefs.current.forEach((seg, i) => {
      if (!seg) return;
      const segLag = (i / segmentCount) * 0.18;
      const segProg = Math.max(0, progress - segLag);
      const pos = curve.getPoint(segProg);
      
      const sPulse = (1 + Math.sin(clockTime * 8 + i) * personality.squishAmount) * (1 - i / segmentCount * 0.4);
      seg.position.copy(pos);
      seg.scale.set(sPulse * 1.2, sPulse * 0.85, sPulse * 1.2);
      seg.material.color.copy(_color).offsetHSL(i * 0.04, 0, 0);
    });

    // 5. Facial Expressions (Blinking & Tongue)
    if (!isBlinking.current && Math.random() < personality.blinkChance) {
      isBlinking.current = true;
      blinkTimer.current = clockTime;
      [eyeLeftRef, eyeRightRef].forEach(ref => ref.current && (ref.current.scale.y = 0.1));
    }
    if (isBlinking.current && clockTime - blinkTimer.current > 0.12) {
      isBlinking.current = false;
      [eyeLeftRef, eyeRightRef].forEach(ref => ref.current && (ref.current.scale.y = 1));
    }

    if (tongueRef.current) {
      tongueRef.current.scale.z = 1 + Math.sin(clockTime * 15) * 0.4;
      tongueRef.current.rotation.y = Math.sin(clockTime * 10) * 0.2;
    }
  });

  return (
    <group>
      <line>
        <bufferGeometry ref={trailGeoRef}>
          <bufferAttribute attach="attributes-position" count={trailLength} array={points} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial transparent opacity={0.3} color={color2} />
      </line>

      {/* Segments */}
      {Array.from({ length: segmentCount }).map((_, i) => (
        <mesh key={i} ref={(el) => (segmentRefs.current[i] = el)}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial roughness={0.4} />
        </mesh>
      ))}

      {/* Head */}
      <group ref={headRef}>
        <mesh>
          <sphereGeometry args={[0.22, 20, 20]} />
          <meshStandardMaterial roughness={0.3} metalness={0.2} color={color1} />
        </mesh>

        {/* Googly Eyes */}
        <group position={[0, 0.08, 0.12]}>
          <mesh ref={eyeLeftRef} position={[-0.1, 0, 0]}>
            <sphereGeometry args={[personality.eyeSize, 12, 12]} />
            <meshBasicMaterial color="white" />
            <mesh position={[0, 0, 0.04]}>
              <sphereGeometry args={[personality.eyeSize * 0.5, 8, 8]} />
              <meshBasicMaterial color="black" />
            </mesh>
          </mesh>
          <mesh ref={eyeRightRef} position={[0.1, 0, 0]}>
            <sphereGeometry args={[personality.eyeSize, 12, 12]} />
            <meshBasicMaterial color="white" />
            <mesh position={[0, 0, 0.04]}>
              <sphereGeometry args={[personality.eyeSize * 0.5, 8, 8]} />
              <meshBasicMaterial color="black" />
            </mesh>
          </mesh>
        </group>

        {/* Tongue - Pivot at the base */}
        <mesh ref={tongueRef} position={[0, -0.08, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.03, personality.tongueLength, 8]} />
          <meshBasicMaterial color="#ff6688" />
        </mesh>

        <mesh position={[0, -0.04, 0.2]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.05, 0.01, 8, 16, Math.PI]} />
          <meshBasicMaterial color="black" />
        </mesh>
      </group>
    </group>
  );
};

export default WormParticle;
