import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _faceN  = new THREE.Vector3();
const _perp   = new THREE.Vector3();
const _arcDir = new THREE.Vector3();
const _wigDir = new THREE.Vector3();
const _tangent = new THREE.Vector3();

const SEG_COLORS   = ['#3be08a', '#2fd47e', '#24be72', '#1aa862', '#129650'];
const TIP_COLOR    = '#b0ffda';
const TIP_EMISSIVE = '#40ff99';

const wHeadGeo  = new THREE.SphereGeometry(0.35, 14, 12);
const wSegGeos  = [
  new THREE.SphereGeometry(0.30, 12, 10),
  new THREE.SphereGeometry(0.27, 10, 8),
  new THREE.SphereGeometry(0.25, 10, 8),
  new THREE.SphereGeometry(0.22, 8, 8),
  new THREE.SphereGeometry(0.21, 8, 8),
];
const wEyeGeo   = new THREE.SphereGeometry(0.080, 8, 8);
const wPupilGeo = new THREE.SphereGeometry(0.042, 6, 6);
const wStemGeo  = new THREE.CylinderGeometry(0.015, 0.011, 0.32, 6);
const wTipGeo   = new THREE.SphereGeometry(0.030, 6, 6);

const STEM_HALF     = 0.16;
const SEGMENT_COUNT = 5;

/**
 * WormParticle — worm that grows OUT of a flip hole (apple-worm style).
 * The tail is anchored at `start` (the face center), the head emerges
 * along an arc perpendicular to the face, creating the cartoon look of
 * a worm popping out of a hole.  `end` is accepted but unused.
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

  // Emerge in 2 s, then linger 3 s visible before fading
  const duration       = 2.0;
  const lingerDuration = 3.0;
  const totalDuration  = duration + lingerDuration;

  const p = useMemo(() => {
    // Stable arc direction in the face plane — randomise once per instance
    const arcPhase = Math.random() * Math.PI * 2;
    return {
      arcPhase,
      blinkInterval: 1.4 + Math.random() * 2.0,
      blinkDur     : 0.12,
      squishAmp    : 0.08 + Math.random() * 0.07,
      squishFreq   : 6  + Math.random() * 4,
      antennaPhase : Math.random() * Math.PI * 2,
    };
  }, []);

  const blinkTimerRef = useRef(0);
  const isBlinkingRef = useRef(false);

  useFrame(({ clock }) => {
    const clockTime = clock.getElapsedTime();
    const animTime  = currentTime !== undefined ? currentTime : clockTime;
    if (animTime < startTime) return;

    const elapsed = animTime - startTime;
    if (elapsed >= totalDuration) { onComplete?.(); return; }

    // Ease-out progress (head races out, body unfurls behind)
    const tRaw     = Math.min(elapsed / duration, 1);
    const progress = 1 - Math.pow(1 - tRaw, 3); // ease-out cubic

    const fadeIn  = Math.min(1, elapsed / 0.25);
    const fadeOut = elapsed <= duration
      ? 1 : Math.max(0, 1 - (elapsed - duration) / lingerDuration);
    const alpha = fadeIn * fadeOut;

    // ── Face geometry ─────────────────────────────────────────────────────
    // faceNormal points away from cube center
    _faceN.set(...start).normalize();

    // Build two stable perpendiculars to faceNormal
    const basePerp = Math.abs(_faceN.y) < 0.8
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    _perp.crossVectors(_faceN, basePerp).normalize();
    const arcFwdVec = new THREE.Vector3().crossVectors(_perp, _faceN).normalize();

    // Rotate arc direction by arcPhase so each worm faces a different way
    const cosP = Math.cos(p.arcPhase);
    const sinP = Math.sin(p.arcPhase);
    _arcDir.copy(_perp).multiplyScalar(cosP).addScaledVector(arcFwdVec, sinP);
    _wigDir.copy(_perp).multiplyScalar(-sinP).addScaledVector(arcFwdVec, cosP);

    // Gentle alive wiggle (small, doesn't change the arc shape much)
    const wLive = Math.sin(clockTime * 2.5) * 0.07;

    const origin = new THREE.Vector3(...start);

    // ── Arc path: wp0 inside cube (hidden), head arcs outward ─────────────
    // wp0: tail anchor — inside cube, hidden by depth test
    // wp1: just outside face surface
    // wp2: emerging and curving sideways
    // wp3: peak extension, nice arc
    // wp4: head linger position (like the apple-worm cartoon pose)
    const wp0 = origin.clone().addScaledVector(_faceN, -0.25);
    const wp1 = origin.clone().addScaledVector(_faceN,  0.20);
    const wp2 = origin.clone()
      .addScaledVector(_faceN,  0.60)
      .addScaledVector(_arcDir, 0.30)
      .addScaledVector(_wigDir, wLive);
    const wp3 = origin.clone()
      .addScaledVector(_faceN,  0.80)
      .addScaledVector(_arcDir, 0.58)
      .addScaledVector(_wigDir, wLive * 1.5);
    const wp4 = origin.clone()
      .addScaledVector(_faceN,  0.58)
      .addScaledVector(_arcDir, 0.80)
      .addScaledVector(_wigDir, wLive * 2.2);

    const curve = new THREE.CatmullRomCurve3([wp0, wp1, wp2, wp3, wp4]);

    // ── Head ──────────────────────────────────────────────────────────────
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

    // ── Blinking ──────────────────────────────────────────────────────────
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

    // ── Antenna wiggle ────────────────────────────────────────────────────
    const r = 0.3 + Math.sin(clockTime * 6 + p.antennaPhase) * 0.12;
    if (ant1StemRef.current) ant1StemRef.current.rotation.z = r;
    if (ant2StemRef.current) ant2StemRef.current.rotation.z = -r;
    if (ant1TipRef.current) {
      ant1TipRef.current.position.set(
        -0.15 + Math.sin(r) * STEM_HALF, 0.35 + Math.cos(r) * STEM_HALF, 0.12
      );
    }
    if (ant2TipRef.current) {
      ant2TipRef.current.position.set(
        0.15 - Math.sin(r) * STEM_HALF, 0.35 + Math.cos(r) * STEM_HALF, 0.12
      );
    }

    // ── Body segments — unfurl from hole behind the head ──────────────────
    // Segment 0 is just behind the head; segment 4 is the tail still in the hole.
    // depthTest:true means tail segments inside the cube are auto-hidden.
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = segRefs.current[i];
      if (!seg) continue;

      // Spread segments so they fill the arc: tail always near wp0
      const lag = (i + 1) / (SEGMENT_COUNT + 1);
      // At progress=1 the tail (lag=1) is at curve point 0 (inside cube, hidden).
      // segT maps lag into the curve: as progress→1 head→1 and tail→0.
      const segT = Math.max(0, progress * (1 - lag));
      const segPos = curve.getPoint(segT);

      const wave  = Math.sin(clockTime * p.squishFreq - i * 0.8) * p.squishAmp;
      const taper = 1 - (i / (SEGMENT_COUNT - 1)) * 0.42;

      seg.position.copy(segPos);
      seg.scale.set(taper * (1 + wave), taper * (1 - wave * 0.5), taper * (1 + wave));
      seg.material.opacity = (0.95 - (i / SEGMENT_COUNT) * 0.15) * alpha;
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
        <mesh ref={eyeLRef} position={[-0.12, 0.16, 0.26]} geometry={wEyeGeo} renderOrder={8}>
          <meshStandardMaterial color="#ffffff" roughness={0.1} depthWrite={false} />
        </mesh>
        <mesh ref={eyeRRef} position={[0.12, 0.16, 0.26]} geometry={wEyeGeo} renderOrder={8}>
          <meshStandardMaterial color="#ffffff" roughness={0.1} depthWrite={false} />
        </mesh>
        <mesh position={[-0.12, 0.17, 0.31]} geometry={wPupilGeo} renderOrder={9}>
          <meshStandardMaterial color="#0a0a14" roughness={0.5} depthWrite={false} />
        </mesh>
        <mesh position={[0.12, 0.17, 0.31]} geometry={wPupilGeo} renderOrder={9}>
          <meshStandardMaterial color="#0a0a14" roughness={0.5} depthWrite={false} />
        </mesh>
        <mesh position={[0, -0.05, 0.27]} rotation={[0.25, 0, Math.PI]} renderOrder={8}>
          <torusGeometry args={[0.075, 0.021, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#0d2410" roughness={0.6} depthWrite={false} />
        </mesh>
        <mesh ref={ant1StemRef} position={[-0.15, 0.35, 0.12]} rotation={[0, 0, 0.3]} geometry={wStemGeo} renderOrder={7}>
          <meshStandardMaterial color={SEG_COLORS[0]} roughness={0.5}
            emissive={SEG_COLORS[0]} emissiveIntensity={0.4} depthWrite={false} />
        </mesh>
        <mesh ref={ant2StemRef} position={[0.15, 0.35, 0.12]} rotation={[0, 0, -0.3]} geometry={wStemGeo} renderOrder={7}>
          <meshStandardMaterial color={SEG_COLORS[0]} roughness={0.5}
            emissive={SEG_COLORS[0]} emissiveIntensity={0.4} depthWrite={false} />
        </mesh>
        <mesh ref={ant1TipRef} position={[-0.10, 0.50, 0.12]} geometry={wTipGeo} renderOrder={8}>
          <meshStandardMaterial color={TIP_COLOR} emissive={TIP_EMISSIVE} emissiveIntensity={1.2}
            depthWrite={false} />
        </mesh>
        <mesh ref={ant2TipRef} position={[0.10, 0.50, 0.12]} geometry={wTipGeo} renderOrder={8}>
          <meshStandardMaterial color={TIP_COLOR} emissive={TIP_EMISSIVE} emissiveIntensity={1.2}
            depthWrite={false} />
        </mesh>
      </group>

      {/* ── Body segments — tail stays in hole (hidden by depth), head is out ─ */}
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <mesh
          key={`seg-${i}`}
          renderOrder={6}
          ref={el => (segRefs.current[i] = el)}
          geometry={wSegGeos[i]}
        >
          <meshStandardMaterial
            color={SEG_COLORS[i]} roughness={0.3} metalness={0}
            emissive={SEG_COLORS[i]} emissiveIntensity={0.5 - i * 0.07}
            transparent opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

export default WormParticle;
