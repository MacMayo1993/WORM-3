import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _faceN   = new THREE.Vector3();
const _perp    = new THREE.Vector3();
const _arcDir  = new THREE.Vector3();
const _wigDir  = new THREE.Vector3();
const _tangent = new THREE.Vector3();

const SEG_COLORS   = ['#3be08a', '#2fd47e', '#24be72', '#1aa862', '#129650'];
const TIP_COLOR    = '#b0ffda';
const TIP_EMISSIVE = '#40ff99';

// Uniform segment sizing — head only slightly larger than body
const wHeadGeo  = new THREE.SphereGeometry(0.22, 14, 12);
const wSegGeos  = [
  new THREE.SphereGeometry(0.20, 12, 10),
  new THREE.SphereGeometry(0.20, 10, 8),
  new THREE.SphereGeometry(0.19, 10, 8),
  new THREE.SphereGeometry(0.18, 8, 8),
  new THREE.SphereGeometry(0.17, 8, 8),
];
const wEyeGeo   = new THREE.SphereGeometry(0.050, 8, 8);
const wPupilGeo = new THREE.SphereGeometry(0.026, 6, 6);
const wStemGeo  = new THREE.CylinderGeometry(0.010, 0.007, 0.20, 6);
const wTipGeo   = new THREE.SphereGeometry(0.020, 6, 6);

const STEM_HALF     = 0.10;
const SEGMENT_COUNT = 5;

/**
 * WormParticle — cartoon apple-worm style: tail anchored at the flip
 * hole, head grows outward along a face-perpendicular arc so the worm
 * appears to emerge from the cube one segment at a time.
 * The `end` prop is accepted but unused; each worm lives on its own face.
 */
const WormParticle = ({ start, end: _end, color1: _c1, color2: _c2, startTime, currentTime, onComplete }) => {
  const headGroupRef = useRef();
  const eyeLRef      = useRef();
  const eyeRRef      = useRef();
  const ant1StemRef  = useRef();
  const ant2StemRef  = useRef();
  const ant1TipRef   = useRef();
  const ant2TipRef   = useRef();
  const segRefs      = useRef([]);

  // Emerge quickly, linger visibly, then fade
  const duration       = 2.0;
  const lingerDuration = 3.0;
  const totalDuration  = duration + lingerDuration;

  const p = useMemo(() => ({
    arcPhase    : Math.random() * Math.PI * 2,
    blinkInterval: 1.4 + Math.random() * 2.0,
    blinkDur    : 0.12,
    squishAmp   : 0.08 + Math.random() * 0.06,
    squishFreq  : 6 + Math.random() * 4,
    antennaPhase: Math.random() * Math.PI * 2,
  }), []);

  const blinkTimerRef = useRef(0);
  const isBlinkingRef = useRef(false);

  useFrame(({ clock }) => {
    const clockTime = clock.getElapsedTime();
    const animTime  = currentTime !== undefined ? currentTime : clockTime;
    if (animTime < startTime) return;

    const elapsed = animTime - startTime;
    if (elapsed >= totalDuration) { onComplete?.(); return; }

    const tRaw     = Math.min(elapsed / duration, 1);
    const progress = 1 - Math.pow(1 - tRaw, 3); // ease-out cubic

    const fadeIn  = Math.min(1, elapsed / 0.25);
    const fadeOut = elapsed <= duration
      ? 1 : Math.max(0, 1 - (elapsed - duration) / lingerDuration);
    const alpha = fadeIn * fadeOut;

    // Face normal points away from cube center
    _faceN.set(...start).normalize();

    // Two stable perpendiculars to faceNormal
    const basePerp = Math.abs(_faceN.y) < 0.8
      ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    _perp.crossVectors(_faceN, basePerp).normalize();
    const arcFwdVec = new THREE.Vector3().crossVectors(_perp, _faceN).normalize();

    // Rotate arc direction by arcPhase so each instance faces differently
    const cosP = Math.cos(p.arcPhase);
    const sinP = Math.sin(p.arcPhase);
    _arcDir.copy(_perp).multiplyScalar(cosP).addScaledVector(arcFwdVec, sinP);
    _wigDir.copy(_perp).multiplyScalar(-sinP).addScaledVector(arcFwdVec, cosP);

    const wLive = Math.sin(clockTime * 2.5) * 0.05;
    const origin = new THREE.Vector3(...start);

    // Arc: wp0 inside cube (hidden by depth), head arcs outward
    const wp0 = origin.clone().addScaledVector(_faceN, -0.20);
    const wp1 = origin.clone().addScaledVector(_faceN,  0.14);
    const wp2 = origin.clone()
      .addScaledVector(_faceN,  0.42)
      .addScaledVector(_arcDir, 0.22)
      .addScaledVector(_wigDir, wLive);
    const wp3 = origin.clone()
      .addScaledVector(_faceN,  0.54)
      .addScaledVector(_arcDir, 0.42)
      .addScaledVector(_wigDir, wLive * 1.5);
    const wp4 = origin.clone()
      .addScaledVector(_faceN,  0.38)
      .addScaledVector(_arcDir, 0.56)
      .addScaledVector(_wigDir, wLive * 2.0);

    const curve = new THREE.CatmullRomCurve3([wp0, wp1, wp2, wp3, wp4]);

    // Head
    const headPos = curve.getPoint(progress);
    const headFwd = curve.getPoint(Math.min(progress + 0.03, 1));
    _tangent.subVectors(headFwd, headPos).normalize();

    if (headGroupRef.current) {
      headGroupRef.current.visible = alpha > 0.02;
      headGroupRef.current.position.copy(headPos);
      if (_tangent.lengthSq() > 0.001) {
        headGroupRef.current.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1), _tangent
        );
      }
      const squish = Math.sin(clockTime * p.squishFreq) * p.squishAmp;
      headGroupRef.current.scale.set(1 + squish * 0.3, 1 - squish * 0.15, 1 + squish * 0.3);
    }

    // Blinking
    const timeSinceBlink = clockTime - blinkTimerRef.current;
    if (!isBlinkingRef.current && timeSinceBlink > p.blinkInterval) {
      isBlinkingRef.current = true;
      blinkTimerRef.current = clockTime;
    }
    if (isBlinkingRef.current && timeSinceBlink > p.blinkDur) {
      isBlinkingRef.current = false;
    }
    const eyeScaleY = isBlinkingRef.current ? 0.08 : 1;
    if (eyeLRef.current) eyeLRef.current.scale.set(1, eyeScaleY, 1);
    if (eyeRRef.current) eyeRRef.current.scale.set(1, eyeScaleY, 1);

    // Antenna wiggle
    const r = 0.3 + Math.sin(clockTime * 6 + p.antennaPhase) * 0.12;
    if (ant1StemRef.current) ant1StemRef.current.rotation.z = r;
    if (ant2StemRef.current) ant2StemRef.current.rotation.z = -r;
    if (ant1TipRef.current) {
      ant1TipRef.current.position.set(
        -0.09 + Math.sin(r) * STEM_HALF, 0.22 + Math.cos(r) * STEM_HALF, 0.08
      );
    }
    if (ant2TipRef.current) {
      ant2TipRef.current.position.set(
        0.09 - Math.sin(r) * STEM_HALF, 0.22 + Math.cos(r) * STEM_HALF, 0.08
      );
    }

    // Body segments — tail at wp0 (in hole, hidden), head at wp_progress
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = segRefs.current[i];
      if (!seg) continue;
      const lag  = (i + 1) / (SEGMENT_COUNT + 1);
      const segT = Math.max(0, progress * (1 - lag));
      const segPos = curve.getPoint(segT);
      const wave   = Math.sin(clockTime * p.squishFreq - i * 0.8) * p.squishAmp;
      const taper  = 1 - (i / (SEGMENT_COUNT - 1)) * 0.20; // gentle taper
      seg.position.copy(segPos);
      seg.scale.set(taper * (1 + wave), taper * (1 - wave * 0.5), taper * (1 + wave));
      seg.material.opacity = (0.95 - (i / SEGMENT_COUNT) * 0.12) * alpha;
    }
  });

  return (
    <group>
      {/* ── Head group ────────────────────────────────────────────────────── */}
      <group ref={headGroupRef}>
        <mesh geometry={wHeadGeo} renderOrder={7}>
          <meshStandardMaterial
            color={SEG_COLORS[0]} roughness={0.3} metalness={0}
            emissive={SEG_COLORS[0]} emissiveIntensity={0.7}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={eyeLRef} position={[-0.08, 0.10, 0.17]} geometry={wEyeGeo} renderOrder={8}>
          <meshStandardMaterial color="#ffffff" roughness={0.1} depthWrite={false} />
        </mesh>
        <mesh ref={eyeRRef} position={[0.08, 0.10, 0.17]} geometry={wEyeGeo} renderOrder={8}>
          <meshStandardMaterial color="#ffffff" roughness={0.1} depthWrite={false} />
        </mesh>
        <mesh position={[-0.08, 0.11, 0.20]} geometry={wPupilGeo} renderOrder={9}>
          <meshStandardMaterial color="#0a0a14" roughness={0.5} depthWrite={false} />
        </mesh>
        <mesh position={[0.08, 0.11, 0.20]} geometry={wPupilGeo} renderOrder={9}>
          <meshStandardMaterial color="#0a0a14" roughness={0.5} depthWrite={false} />
        </mesh>
        <mesh position={[0, -0.032, 0.17]} rotation={[0.25, 0, Math.PI]} renderOrder={8}>
          <torusGeometry args={[0.048, 0.013, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#0d2410" roughness={0.6} depthWrite={false} />
        </mesh>
        <mesh ref={ant1StemRef} position={[-0.09, 0.22, 0.08]} rotation={[0, 0, 0.3]} geometry={wStemGeo} renderOrder={7}>
          <meshStandardMaterial color={SEG_COLORS[0]} roughness={0.5}
            emissive={SEG_COLORS[0]} emissiveIntensity={0.4} depthWrite={false} />
        </mesh>
        <mesh ref={ant2StemRef} position={[0.09, 0.22, 0.08]} rotation={[0, 0, -0.3]} geometry={wStemGeo} renderOrder={7}>
          <meshStandardMaterial color={SEG_COLORS[0]} roughness={0.5}
            emissive={SEG_COLORS[0]} emissiveIntensity={0.4} depthWrite={false} />
        </mesh>
        <mesh ref={ant1TipRef} position={[-0.06, 0.32, 0.08]} geometry={wTipGeo} renderOrder={8}>
          <meshStandardMaterial color={TIP_COLOR} emissive={TIP_EMISSIVE} emissiveIntensity={1.2}
            depthWrite={false} />
        </mesh>
        <mesh ref={ant2TipRef} position={[0.06, 0.32, 0.08]} geometry={wTipGeo} renderOrder={8}>
          <meshStandardMaterial color={TIP_COLOR} emissive={TIP_EMISSIVE} emissiveIntensity={1.2}
            depthWrite={false} />
        </mesh>
      </group>

      {/* ── Body segments ─────────────────────────────────────────────────── */}
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <mesh
          key={`seg-${i}`}
          renderOrder={6}
          ref={el => (segRefs.current[i] = el)}
          geometry={wSegGeos[i]}
        >
          <meshStandardMaterial
            color={SEG_COLORS[i]} roughness={0.3} metalness={0}
            emissive={SEG_COLORS[i]} emissiveIntensity={0.5 - i * 0.06}
            transparent opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

export default WormParticle;
