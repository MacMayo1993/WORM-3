import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();

const SEG_COLORS  = ['#3be08a', '#2fd47e', '#24be72', '#1aa862', '#129650'];
const TIP_COLOR   = '#b0ffda';
const TIP_EMISSIVE = '#40ff99';

const wHeadGeo  = new THREE.SphereGeometry(0.18, 12, 12);
const wSegGeos  = [
  new THREE.SphereGeometry(0.16, 12, 10),
  new THREE.SphereGeometry(0.14, 10, 8),
  new THREE.SphereGeometry(0.13, 10, 8),
  new THREE.SphereGeometry(0.12, 8, 8),
  new THREE.SphereGeometry(0.10, 8, 8),
];
const wEyeGeo   = new THREE.SphereGeometry(0.055, 8, 8);
const wPupilGeo = new THREE.SphereGeometry(0.030, 6, 6);
const wStemGeo  = new THREE.CylinderGeometry(0.012, 0.009, 0.22, 6);
const wTipGeo   = new THREE.SphereGeometry(0.022, 6, 6);

const SEGMENT_COUNT = 5;

const WormParticle = ({ start, end, color1: _c1, color2: _c2, startTime, currentTime, onComplete }) => {
  const headGroupRef = useRef();
  const eyeLRef      = useRef();
  const eyeRRef      = useRef();
  const ant1StemRef  = useRef();
  const ant2StemRef  = useRef();
  const ant1TipRef   = useRef();
  const ant2TipRef   = useRef();
  const segRefs      = useRef([]);

  const duration       = 3.2;
  const lingerDuration = 3.4;
  const totalDuration  = duration + lingerDuration;

  const p = useMemo(() => ({
    wiggleFreq   : 1.8 + Math.random() * 1.2,
    wiggleAmp    : 0.38 + Math.random() * 0.22,
    wigglePhase  : Math.random() * Math.PI * 2,
    blinkInterval: 1.6 + Math.random() * 2.0,
    blinkDur     : 0.12,
    squishAmp    : 0.10 + Math.random() * 0.08,
    squishFreq   : 7 + Math.random() * 5,
    antennaPhase : Math.random() * Math.PI * 2,
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
    const progress = tRaw < 0.5
      ? 16 * tRaw ** 5
      : 1 - (-2 * tRaw + 2) ** 5 / 2;

    const fadeIn  = Math.min(1, elapsed / 0.35);
    const fadeOut = elapsed <= duration
      ? 1 : Math.max(0, 1 - (elapsed - duration) / lingerDuration);
    const alpha = fadeIn * fadeOut;

    // S-curve path — identical to the original so the route through the cube is unchanged
    const vStart = _v1.set(...start);
    const vEnd   = _v2.set(...end);
    const dir    = _v3.subVectors(vEnd, vStart);
    const len    = dir.length();
    const dirNorm = dir.clone().normalize();
    _right.crossVectors(dirNorm, _up).normalize();
    if (_right.lengthSq() < 0.001) _right.set(1, 0, 0);

    const tw = clockTime * p.wiggleFreq + p.wigglePhase;
    const lateralAmp = Math.min(0.26, p.wiggleAmp * len * 0.14);
    const midpoint   = vStart.clone().lerp(vEnd, 0.5);
    const centerPull = midpoint.clone().multiplyScalar(-0.75);
    const maxPull    = Math.max(0.45, len * 0.28);
    if (centerPull.length() > maxPull) centerPull.setLength(maxPull);

    const curve = new THREE.CatmullRomCurve3([
      vStart.clone(),
      vStart.clone().lerp(vEnd, 0.22)
        .addScaledVector(_right, Math.sin(tw) * lateralAmp)
        .addScaledVector(_up, Math.cos(tw * 0.8) * lateralAmp * 0.25)
        .addScaledVector(centerPull, 0.45),
      midpoint.clone()
        .add(centerPull)
        .addScaledVector(_right, Math.sin(tw + Math.PI) * lateralAmp * 0.6),
      vStart.clone().lerp(vEnd, 0.78)
        .addScaledVector(_right, Math.sin(tw + Math.PI * 1.5) * lateralAmp)
        .addScaledVector(_up, Math.cos(tw * 0.8 + Math.PI * 0.3) * lateralAmp * 0.25)
        .addScaledVector(centerPull, 0.45),
      vEnd.clone(),
    ]);

    // Head group — position + orient once, children inherit
    const headPos = curve.getPoint(progress);
    const headFwd = curve.getPoint(Math.min(progress + 0.02, 1));
    _tangent.subVectors(headFwd, headPos).normalize();

    if (headGroupRef.current) {
      headGroupRef.current.visible = alpha > 0.02;
      headGroupRef.current.position.copy(headPos);
      if (_tangent.lengthSq() > 0.001) {
        headGroupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _tangent);
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

    // Antenna wiggle — local rotation, tips follow
    const antWiggle = Math.sin(clockTime * 6 + p.antennaPhase) * 0.12;
    const r1 = 0.3 + antWiggle;
    const r2 = 0.3 + antWiggle;
    if (ant1StemRef.current) ant1StemRef.current.rotation.z = r1;
    if (ant2StemRef.current) ant2StemRef.current.rotation.z = -r2;
    if (ant1TipRef.current) {
      ant1TipRef.current.position.set(-0.07 + Math.sin(r1) * 0.11, 0.15 + Math.cos(r1) * 0.11, 0.05);
    }
    if (ant2TipRef.current) {
      ant2TipRef.current.position.set(0.07 - Math.sin(r2) * 0.11, 0.15 + Math.cos(r2) * 0.11, 0.05);
    }

    // Body segments — smooth peristaltic wave, opacity fade
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = segRefs.current[i];
      if (!seg) continue;
      const lag     = (i + 1) / (SEGMENT_COUNT + 1) * 0.35;
      const segProg = Math.max(0, progress - lag);
      const segPos  = curve.getPoint(segProg);
      const wave    = Math.sin(clockTime * p.squishFreq - i * 0.9) * p.squishAmp;
      const taper   = 1 - (i / (SEGMENT_COUNT - 1)) * 0.45;
      seg.position.copy(segPos);
      seg.scale.set(taper * (1 + wave), taper * (1 - wave * 0.5), taper * (1 + wave));
      seg.material.opacity = (0.95 - (i / SEGMENT_COUNT) * 0.15) * alpha;
    }
  });

  return (
    <group>
      {/* ── Head group — all face features as children inherit the head transform ─ */}
      <group ref={headGroupRef}>
        <mesh geometry={wHeadGeo} renderOrder={7}>
          <meshStandardMaterial
            color={SEG_COLORS[0]} roughness={0.3} metalness={0}
            emissive={SEG_COLORS[0]} emissiveIntensity={0.35}
            depthWrite={false} depthTest={false} toneMapped={false}
          />
        </mesh>
        <mesh ref={eyeLRef} position={[-0.09, 0.06, 0.15]} geometry={wEyeGeo} renderOrder={8}>
          <meshStandardMaterial color="#ffffff" roughness={0.1}
            depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh ref={eyeRRef} position={[0.09, 0.06, 0.15]} geometry={wEyeGeo} renderOrder={8}>
          <meshStandardMaterial color="#ffffff" roughness={0.1}
            depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh position={[-0.09, 0.065, 0.185]} geometry={wPupilGeo} renderOrder={9}>
          <meshStandardMaterial color="#0a0a14" roughness={0.5}
            depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh position={[0.09, 0.065, 0.185]} geometry={wPupilGeo} renderOrder={9}>
          <meshStandardMaterial color="#0a0a14" roughness={0.5}
            depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.04, 0.14]} rotation={[0.25, 0, Math.PI]} renderOrder={8}>
          <torusGeometry args={[0.055, 0.015, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#0d2410" roughness={0.6}
            depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh ref={ant1StemRef} position={[-0.07, 0.15, 0.05]} rotation={[0, 0, 0.3]} geometry={wStemGeo} renderOrder={7}>
          <meshStandardMaterial color={SEG_COLORS[0]} roughness={0.5}
            emissive={SEG_COLORS[0]} emissiveIntensity={0.2}
            depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh ref={ant2StemRef} position={[0.07, 0.15, 0.05]} rotation={[0, 0, -0.3]} geometry={wStemGeo} renderOrder={7}>
          <meshStandardMaterial color={SEG_COLORS[0]} roughness={0.5}
            emissive={SEG_COLORS[0]} emissiveIntensity={0.2}
            depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh ref={ant1TipRef} position={[-0.07, 0.26, 0.05]} geometry={wTipGeo} renderOrder={8}>
          <meshStandardMaterial color={TIP_COLOR} emissive={TIP_EMISSIVE} emissiveIntensity={0.8}
            depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh ref={ant2TipRef} position={[0.07, 0.26, 0.05]} geometry={wTipGeo} renderOrder={8}>
          <meshStandardMaterial color={TIP_COLOR} emissive={TIP_EMISSIVE} emissiveIntensity={0.8}
            depthWrite={false} depthTest={false} toneMapped={false} />
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
            emissive={SEG_COLORS[i]} emissiveIntensity={0.2 - i * 0.025}
            transparent opacity={0}
            depthWrite={false} depthTest={false} toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};

export default WormParticle;
