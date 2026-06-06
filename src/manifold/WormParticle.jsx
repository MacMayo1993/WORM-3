import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _faceN    = new THREE.Vector3();
const _perp     = new THREE.Vector3();
const _arcDir   = new THREE.Vector3();
const _wigDir   = new THREE.Vector3();
const _tangent  = new THREE.Vector3();
const _lookQuat = new THREE.Quaternion();
const _fwdAxis  = new THREE.Vector3(0, 0, 1);

const wHeadGeo  = new THREE.SphereGeometry(0.22, 14, 12);
const wSegGeos  = [
  new THREE.SphereGeometry(0.21, 12, 10),
  new THREE.SphereGeometry(0.21, 10, 8),
  new THREE.SphereGeometry(0.19, 10, 8),
  new THREE.SphereGeometry(0.18, 8, 8),
  new THREE.SphereGeometry(0.16, 8, 8),
];
const wEyeGeo   = new THREE.SphereGeometry(0.050, 8, 8);
const wPupilGeo = new THREE.SphereGeometry(0.026, 6, 6);
const wStemGeo  = new THREE.CylinderGeometry(0.010, 0.007, 0.20, 6);
const wTipGeo   = new THREE.SphereGeometry(0.020, 6, 6);

const STEM_HALF     = 0.10;
const SEGMENT_COUNT = 5;

/**
 * WormParticle — emerges from a flip tile along an arc, then retreats
 * back into the hole in reverse. No fly-off; the hole swallows it whole.
 */
const WormParticle = ({ start, end: _end, color1, color2: _c2, startTime, onComplete }) => {
  const headGroupRef = useRef();
  const eyeLRef      = useRef();
  const eyeRRef      = useRef();
  const ant1StemRef  = useRef();
  const ant2StemRef  = useRef();
  const ant1TipRef   = useRef();
  const ant2TipRef   = useRef();
  const segRefs      = useRef([]);   // groups — position + scale
  const segMeshRefs  = useRef([]);   // meshes — material opacity

  const duration      = 2.0;   // emerge from hole
  const retreatDur    = 2.0;   // slide back in — mirrors the emergence
  const totalDuration = duration + retreatDur;

  const p = useMemo(() => ({
    arcPhase    : Math.random() * Math.PI * 2,
    blinkInterval: 1.4 + Math.random() * 2.0,
    blinkDur    : 0.12,
    squishAmp   : 0.08 + Math.random() * 0.06,
    squishFreq  : 6 + Math.random() * 4,
    antennaPhase: Math.random() * Math.PI * 2,
  }), []);

  const blinkTimerRef   = useRef(0);
  const isBlinkingRef   = useRef(false);
  const hasCompletedRef = useRef(false);

  useFrame((state) => {
    const clockTime = state.clock.getElapsedTime();
    if (clockTime < startTime) return;

    const elapsed = clockTime - startTime;
    if (elapsed >= totalDuration) {
      if (!hasCompletedRef.current) { hasCompletedRef.current = true; onComplete?.(); }
      return;
    }

    const tRaw    = Math.min(elapsed / duration, 1);
    const progress = 1 - Math.pow(1 - tRaw, 3); // ease-out cubic
    const alpha   = Math.min(1, elapsed / 0.25);

    // After emergence, retreat: displayProgress goes 1→0 (back into hole)
    const inRetreat      = elapsed > duration;
    const retreatT       = inRetreat ? elapsed - duration : 0;
    const retreatProg    = Math.min(1, retreatT / retreatDur);
    const easeRetract    = retreatProg < 0.5
      ? 2 * retreatProg * retreatProg                // ease-in start
      : 1 - Math.pow(-2 * retreatProg + 2, 2) / 2;  // ease-out finish
    const displayProgress = inRetreat ? 1 - easeRetract : progress;

    // Face normal from tile center position
    _faceN.set(...start).normalize();
    const basePerp = Math.abs(_faceN.y) < 0.8
      ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    _perp.crossVectors(_faceN, basePerp).normalize();
    const arcFwdVec = new THREE.Vector3().crossVectors(_perp, _faceN).normalize();

    const cosP = Math.cos(p.arcPhase);
    const sinP = Math.sin(p.arcPhase);
    _arcDir.copy(_perp).multiplyScalar(cosP).addScaledVector(arcFwdVec, sinP);
    _wigDir.copy(_perp).multiplyScalar(-sinP).addScaledVector(arcFwdVec, cosP);

    const wLive = Math.sin(clockTime * 2.5) * 0.04;

    // Arc: emerges perpendicular to face then curves along arcDir.
    // wp3→wp4 keeps faceN component rising so the head doesn't droop back down.
    const wp0 = new THREE.Vector3().addScaledVector(_faceN, -0.20);
    const wp1 = new THREE.Vector3().addScaledVector(_faceN,  0.18);
    const wp2 = new THREE.Vector3()
      .addScaledVector(_faceN, 0.48).addScaledVector(_arcDir, 0.18).addScaledVector(_wigDir, wLive);
    const wp3 = new THREE.Vector3()
      .addScaledVector(_faceN, 0.58).addScaledVector(_arcDir, 0.36).addScaledVector(_wigDir, wLive * 1.2);
    const wp4 = new THREE.Vector3()
      .addScaledVector(_faceN, 0.62).addScaledVector(_arcDir, 0.52).addScaledVector(_wigDir, wLive * 1.6);

    const curve = new THREE.CatmullRomCurve3([wp0, wp1, wp2, wp3, wp4]);

    const headPos = curve.getPoint(displayProgress);

    // ── Head ───────────────────────────────────────────────────────────────
    if (headGroupRef.current) {
      headGroupRef.current.visible = alpha > 0.02;
      headGroupRef.current.position.copy(headPos);

      // Always face forward along arc tangent so the head stays upright
      // even during retreat (worm backs into hole, head looking out).
      const lookAhead = curve.getPoint(Math.min(displayProgress + 0.06, 1));
      _tangent.subVectors(lookAhead, headPos).normalize();
      if (_tangent.lengthSq() > 0.001) {
        _lookQuat.setFromUnitVectors(_fwdAxis, _tangent);
        headGroupRef.current.quaternion.slerp(_lookQuat, inRetreat ? 0.25 : 0.5);
      }

      const squish = Math.sin(clockTime * p.squishFreq) * p.squishAmp;
      headGroupRef.current.scale.set(1 + squish * 0.3, 1 - squish * 0.15, 1 + squish * 0.3);
    }

    // ── Blinking ───────────────────────────────────────────────────────────
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

    // ── Antennae ───────────────────────────────────────────────────────────
    const r = 0.3 + Math.sin(clockTime * 6 + p.antennaPhase) * 0.12;
    if (ant1StemRef.current) ant1StemRef.current.rotation.z = r;
    if (ant2StemRef.current) ant2StemRef.current.rotation.z = -r;
    if (ant1TipRef.current) {
      ant1TipRef.current.position.set(-0.09 + Math.sin(r) * STEM_HALF, 0.22 + Math.cos(r) * STEM_HALF, 0.08);
    }
    if (ant2TipRef.current) {
      ant2TipRef.current.position.set(0.09 - Math.sin(r) * STEM_HALF, 0.22 + Math.cos(r) * STEM_HALF, 0.08);
    }

    // ── Body segments ─────────────────────────────────────────────────────
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = segRefs.current[i];
      if (!seg) continue;
      const lag  = (i + 1) / (SEGMENT_COUNT + 1);
      // Segments always trail behind the head along the arc
      const segT = Math.max(0, Math.min(1, displayProgress * (1 - lag)));
      const segPos = curve.getPoint(segT);
      const wave   = Math.sin(clockTime * p.squishFreq - i * 0.8) * p.squishAmp;
      const taper  = 1 - (i / (SEGMENT_COUNT - 1)) * 0.18;
      seg.position.copy(segPos);
      seg.scale.set(taper * (1 + wave), taper * (1 - wave * 0.5), taper * (1 + wave));
      const segMesh = segMeshRefs.current[i];
      if (segMesh?.material) segMesh.material.opacity = 0.95 - (i / SEGMENT_COUNT) * 0.12;
    }
  });

  const faceColor = color1 || '#3be08a';

  return (
    <group position={start}>
      {/* ── Head group ──────────────────────────────────────────────────── */}
      <group ref={headGroupRef}>
        {/* Cartoon outline */}
        <mesh geometry={wHeadGeo} renderOrder={5} scale={[1.16, 1.16, 1.16]}>
          <meshBasicMaterial color="#111111" side={THREE.BackSide} depthWrite={false} />
        </mesh>
        <mesh geometry={wHeadGeo} renderOrder={7}>
          <meshStandardMaterial
            color={faceColor} roughness={0.3} metalness={0}
            emissive={faceColor} emissiveIntensity={0.7}
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
          <meshStandardMaterial color={faceColor} roughness={0.5}
            emissive={faceColor} emissiveIntensity={0.4} depthWrite={false} />
        </mesh>
        <mesh ref={ant2StemRef} position={[0.09, 0.22, 0.08]} rotation={[0, 0, -0.3]} geometry={wStemGeo} renderOrder={7}>
          <meshStandardMaterial color={faceColor} roughness={0.5}
            emissive={faceColor} emissiveIntensity={0.4} depthWrite={false} />
        </mesh>
        <mesh ref={ant1TipRef} position={[-0.06, 0.32, 0.08]} geometry={wTipGeo} renderOrder={8}>
          <meshStandardMaterial color="#ffffff" emissive={faceColor} emissiveIntensity={2.0}
            depthWrite={false} />
        </mesh>
        <mesh ref={ant2TipRef} position={[0.06, 0.32, 0.08]} geometry={wTipGeo} renderOrder={8}>
          <meshStandardMaterial color="#ffffff" emissive={faceColor} emissiveIntensity={2.0}
            depthWrite={false} />
        </mesh>
      </group>

      {/* ── Body segments ─────────────────────────────────────────────────── */}
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <group key={`seg-${i}`} ref={el => (segRefs.current[i] = el)}>
          <mesh geometry={wSegGeos[i]} renderOrder={5} scale={[1.16, 1.16, 1.16]}>
            <meshBasicMaterial color="#111111" side={THREE.BackSide} depthWrite={false} />
          </mesh>
          <mesh ref={el => (segMeshRefs.current[i] = el)} renderOrder={6} geometry={wSegGeos[i]}>
            <meshStandardMaterial
              color={faceColor} roughness={0.3} metalness={0}
              emissive={faceColor} emissiveIntensity={0.45 - i * 0.06}
              transparent opacity={0}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export default WormParticle;
