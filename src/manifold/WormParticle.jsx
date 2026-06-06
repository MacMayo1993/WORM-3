import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _faceN    = new THREE.Vector3();
const _perp     = new THREE.Vector3();
const _arcDir   = new THREE.Vector3();
const _wigDir   = new THREE.Vector3();
const _tangent  = new THREE.Vector3();
const _lookDir  = new THREE.Vector3();
const _camLocal = new THREE.Vector3();
const _lookQuat = new THREE.Quaternion();
const _wigQuat  = new THREE.Quaternion();
const _wigAxis  = new THREE.Vector3(0, 1, 0);
const _fwdAxis  = new THREE.Vector3(0, 0, 1);
const _flyOff   = new THREE.Vector3();

// Head only slightly larger; first two segs nearly same size as head
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
 * WormParticle — cartoon apple-worm emerge from flip hole.
 * Uses `color1` (the flipped face's color) for the whole body.
 * After emerging and looking at the camera, flies off screen instead
 * of fading — onComplete fires only once the worm is far out of view.
 */
const WormParticle = ({ start, end: _end, color1, color2: _c2, startTime, currentTime, onComplete }) => {
  const headGroupRef = useRef();
  const eyeLRef      = useRef();
  const eyeRRef      = useRef();
  const ant1StemRef  = useRef();
  const ant2StemRef  = useRef();
  const ant1TipRef   = useRef();
  const ant2TipRef   = useRef();
  const segRefs      = useRef([]);

  const duration      = 2.0;  // emerge from hole
  const lingerDur     = 4.2;  // linger + look at camera
  const flyDur        = 2.2;  // fly off screen (no fade)
  const totalDuration = duration + lingerDur + flyDur;

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

  useFrame((state) => {
    const clockTime = state.clock.getElapsedTime();
    const animTime  = currentTime !== undefined ? currentTime : clockTime;
    if (animTime < startTime) return;

    const elapsed = animTime - startTime;
    if (elapsed >= totalDuration) { onComplete?.(); return; }

    const tRaw     = Math.min(elapsed / duration, 1);
    const progress = 1 - Math.pow(1 - tRaw, 3); // ease-out cubic — head races out first

    // No fade-out: alpha only ramps up during emerge, stays full until off-screen
    const alpha = Math.min(1, elapsed / 0.25);

    const inLinger  = elapsed > duration && elapsed <= duration + lingerDur;
    const inFlyOff  = elapsed > duration + lingerDur;
    const flyT      = inFlyOff ? elapsed - duration - lingerDur : 0;

    // Face normal away from cube center
    _faceN.set(...start).normalize();
    const basePerp = Math.abs(_faceN.y) < 0.8
      ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    _perp.crossVectors(_faceN, basePerp).normalize();
    const arcFwdVec = new THREE.Vector3().crossVectors(_perp, _faceN).normalize();

    const cosP = Math.cos(p.arcPhase);
    const sinP = Math.sin(p.arcPhase);
    _arcDir.copy(_perp).multiplyScalar(cosP).addScaledVector(arcFwdVec, sinP);
    _wigDir.copy(_perp).multiplyScalar(-sinP).addScaledVector(arcFwdVec, cosP);

    const wLive = Math.sin(clockTime * 2.5) * (inLinger ? 0.09 : 0.05);

    const origin = new THREE.Vector3(...start);
    const wp0 = origin.clone().addScaledVector(_faceN, -0.20);
    const wp1 = origin.clone().addScaledVector(_faceN,  0.14);
    const wp2 = origin.clone()
      .addScaledVector(_faceN,  0.42).addScaledVector(_arcDir, 0.22).addScaledVector(_wigDir, wLive);
    const wp3 = origin.clone()
      .addScaledVector(_faceN,  0.54).addScaledVector(_arcDir, 0.42).addScaledVector(_wigDir, wLive * 1.5);
    const wp4 = origin.clone()
      .addScaledVector(_faceN,  0.38).addScaledVector(_arcDir, 0.56).addScaledVector(_wigDir, wLive * 2.0);

    const curve = new THREE.CatmullRomCurve3([wp0, wp1, wp2, wp3, wp4]);

    // Fly-off: accelerate in arcDir + slightly outward from face
    _flyOff.copy(_arcDir)
      .addScaledVector(_faceN, 0.4)
      .normalize()
      .multiplyScalar(flyT * flyT * 2.2);

    const headPos = curve.getPoint(progress).add(_flyOff);

    // ── Head ───────────────────────────────────────────────────────────────
    if (headGroupRef.current) {
      headGroupRef.current.visible = alpha > 0.02;
      headGroupRef.current.position.copy(headPos);

      if (inFlyOff) {
        // Face the fly direction
        _lookQuat.setFromUnitVectors(_fwdAxis,
          _arcDir.clone().addScaledVector(_faceN, 0.4).normalize());
        headGroupRef.current.quaternion.slerp(_lookQuat, 0.12);
      } else if (inLinger && headGroupRef.current.parent) {
        // Convert camera world pos to parent-local, look at it
        _camLocal.copy(state.camera.position);
        headGroupRef.current.parent.worldToLocal(_camLocal);
        _lookDir.subVectors(_camLocal, headPos).normalize();
        if (_lookDir.lengthSq() > 0.001) {
          _lookQuat.setFromUnitVectors(_fwdAxis, _lookDir);
          _wigQuat.setFromAxisAngle(_wigAxis, Math.sin(clockTime * 3.8) * 0.18);
          _lookQuat.multiply(_wigQuat);
          headGroupRef.current.quaternion.slerp(_lookQuat, 0.05);
        }
      } else {
        // Emerge: follow arc tangent
        const headFwd = curve.getPoint(Math.min(progress + 0.03, 1));
        _tangent.subVectors(headFwd, headPos.clone().sub(_flyOff)).normalize();
        if (_tangent.lengthSq() > 0.001) {
          headGroupRef.current.quaternion.setFromUnitVectors(_fwdAxis, _tangent);
        }
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
    const antSpeed = (inLinger || inFlyOff) ? 7.5 : 6;
    const antAmp   = (inLinger || inFlyOff) ? 0.18 : 0.12;
    const r = 0.3 + Math.sin(clockTime * antSpeed + p.antennaPhase) * antAmp;
    if (ant1StemRef.current) ant1StemRef.current.rotation.z = r;
    if (ant2StemRef.current) ant2StemRef.current.rotation.z = -r;
    if (ant1TipRef.current) {
      ant1TipRef.current.position.set(-0.09 + Math.sin(r) * STEM_HALF, 0.22 + Math.cos(r) * STEM_HALF, 0.08);
    }
    if (ant2TipRef.current) {
      ant2TipRef.current.position.set(0.09 - Math.sin(r) * STEM_HALF, 0.22 + Math.cos(r) * STEM_HALF, 0.08);
    }

    // ── Body segments — unfurl from hole, fly off as unit ─────────────────
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = segRefs.current[i];
      if (!seg) continue;
      const lag    = (i + 1) / (SEGMENT_COUNT + 1);
      const segT   = Math.max(0, progress * (1 - lag));
      const segPos = curve.getPoint(segT).add(_flyOff.clone());
      const wave   = Math.sin(clockTime * p.squishFreq - i * 0.8) * p.squishAmp;
      const taper  = 1 - (i / (SEGMENT_COUNT - 1)) * 0.18;
      seg.position.copy(segPos);
      seg.scale.set(taper * (1 + wave), taper * (1 - wave * 0.5), taper * (1 + wave));
      seg.material.opacity = 0.95 - (i / SEGMENT_COUNT) * 0.12; // full opacity, no fade
    }
  });

  const faceColor = color1 || '#3be08a';

  return (
    <group>
      {/* ── Head group ────────────────────────────────────────────────────── */}
      <group ref={headGroupRef}>
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
        {/* Tips: white with face-color emissive glow for bright contrast */}
        <mesh ref={ant1TipRef} position={[-0.06, 0.32, 0.08]} geometry={wTipGeo} renderOrder={8}>
          <meshStandardMaterial color="#ffffff" emissive={faceColor} emissiveIntensity={2.0}
            depthWrite={false} />
        </mesh>
        <mesh ref={ant2TipRef} position={[0.06, 0.32, 0.08]} geometry={wTipGeo} renderOrder={8}>
          <meshStandardMaterial color="#ffffff" emissive={faceColor} emissiveIntensity={2.0}
            depthWrite={false} />
        </mesh>
      </group>

      {/* ── Body segments — face color, no fade-out ───────────────────────── */}
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <mesh
          key={`seg-${i}`}
          renderOrder={6}
          ref={el => (segRefs.current[i] = el)}
          geometry={wSegGeos[i]}
        >
          <meshStandardMaterial
            color={faceColor} roughness={0.3} metalness={0}
            emissive={faceColor} emissiveIntensity={0.45 - i * 0.06}
            transparent opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

export default WormParticle;
