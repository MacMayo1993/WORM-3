import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Module-level cached vectors — zero per-frame allocations ──────────────────
const _faceN     = new THREE.Vector3();
const _perp      = new THREE.Vector3();
const _arcDir    = new THREE.Vector3();
const _wigDir    = new THREE.Vector3();
const _arcFwdVec = new THREE.Vector3();
const _tangent   = new THREE.Vector3();
const _lookQuat  = new THREE.Quaternion();
const _fwdAxis   = new THREE.Vector3(0, 0, 1);
const _basePerp0 = new THREE.Vector3(0, 1, 0);
const _basePerp1 = new THREE.Vector3(1, 0, 0);
const _headPos   = new THREE.Vector3();
const _lookPos   = new THREE.Vector3();
const _segPos    = new THREE.Vector3();

// ── Module-level shared geometries ────────────────────────────────────────────
const wHeadGeo  = new THREE.SphereGeometry(0.22, 16, 14);
const wSegGeos  = [
  new THREE.SphereGeometry(0.21, 14, 12),
  new THREE.SphereGeometry(0.21, 12, 10),
  new THREE.SphereGeometry(0.21, 12, 10),
  new THREE.SphereGeometry(0.20, 10, 8),
  new THREE.SphereGeometry(0.20, 10, 8),
];
const wEyeGeo    = new THREE.SphereGeometry(0.055, 10, 10);
const wPupilGeo  = new THREE.SphereGeometry(0.030, 8, 8);
const wGlintGeo  = new THREE.SphereGeometry(0.013, 6, 6);
const wStemGeo   = new THREE.CylinderGeometry(0.012, 0.008, 0.22, 6);
const wTipGeo    = new THREE.SphereGeometry(0.028, 8, 8);
const wMouthGeo  = new THREE.TorusGeometry(0.052, 0.015, 7, 14, Math.PI);
// Shared inner-glow sphere — slightly smaller than each segment, additive blend
const wGlowGeo   = new THREE.SphereGeometry(0.19, 8, 8);

// ── Module-level shared materials ─────────────────────────────────────────────
// Richer outline: deep indigo-black reads better against dark cube faces
const outlineMat   = new THREE.MeshBasicMaterial({ color: '#06001a', side: THREE.BackSide, depthWrite: false });
const eyeWhiteMat  = new THREE.MeshStandardMaterial({ color: '#f0f8ff', roughness: 0.08, metalness: 0.1, emissive: '#c8e8ff', emissiveIntensity: 0.25, depthWrite: false });
const pupilMat     = new THREE.MeshStandardMaterial({ color: '#06030f', roughness: 0.0, metalness: 0.6, depthWrite: false });
// Wet-glass glint on pupils — small pure-white additive dot
const glintMat     = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const mouthMat     = new THREE.MeshStandardMaterial({ color: '#08200e', roughness: 0.5, emissive: '#001408', emissiveIntensity: 0.4, depthWrite: false });

const STEM_HALF     = 0.11;
const SEGMENT_COUNT = 5;

const MenuWormParticle = ({ start, color1, startTime, onComplete }) => {
  const headGroupRef = useRef();
  const eyeLRef      = useRef();
  const eyeRRef      = useRef();
  const ant1StemRef  = useRef();
  const ant2StemRef  = useRef();
  const ant1TipRef   = useRef();
  const ant2TipRef   = useRef();
  const segRefs      = useRef([]);

  const duration      = 2.0;
  const retreatDur    = 2.0;
  const totalDuration = duration + retreatDur;

  const p = useMemo(() => ({
    arcPhase    : Math.random() * Math.PI,
    blinkInterval: 1.4 + Math.random() * 2.0,
    blinkDur    : 0.12,
    squishAmp   : 0.08 + Math.random() * 0.06,
    squishFreq  : 6 + Math.random() * 4,
    antennaPhase: Math.random() * Math.PI * 2,
  }), []);

  const curveData = useMemo(() => {
    const pts = Array.from({ length: 5 }, () => new THREE.Vector3());
    return { pts, curve: new THREE.CatmullRomCurve3(pts) };
  }, []);

  const faceColor = color1 || '#3be08a';

  // Derive a brighter highlight color for rim lighting
  const rimColor = useMemo(() => {
    const c = new THREE.Color(faceColor);
    c.multiplyScalar(1.6);
    return '#' + c.getHexString();
  }, [faceColor]);

  // Per-instance head / antenna materials
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: faceColor,
    roughness: 0.25,
    metalness: 0.05,
    emissive: faceColor,
    emissiveIntensity: 0.85,
    depthWrite: false,
  }), [faceColor]);

  const antennaMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: faceColor,
    roughness: 0.4,
    metalness: 0.0,
    emissive: faceColor,
    emissiveIntensity: 0.55,
    depthWrite: false,
  }), [faceColor]);

  // Tip: bright white + strong emissive = glowing orb look
  const tipMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: rimColor,
    emissiveIntensity: 3.2,
    roughness: 0.0,
    metalness: 0.0,
    depthWrite: false,
  }), [rimColor]);

  // Per-segment body materials — slightly cooler/deeper toward the tail
  const segMats = useMemo(() => Array.from({ length: SEGMENT_COUNT }, (_, i) => {
    // Shift hue slightly toward teal for tail segments for depth
    const c = new THREE.Color(faceColor);
    const hsl = {};
    c.getHSL(hsl);
    c.setHSL(hsl.h + i * 0.018, hsl.s * (1 - i * 0.04), hsl.l * (1 - i * 0.07));
    const hex = '#' + c.getHexString();
    return new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.28,
      metalness: 0.04,
      emissive: hex,
      emissiveIntensity: 0.55 - i * 0.07,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
  }), [faceColor]);

  // Inner additive glow per segment — sampled from same shifted colors
  const segGlowMats = useMemo(() => Array.from({ length: SEGMENT_COUNT }, (_, i) => {
    const c = new THREE.Color(faceColor);
    const hsl = {};
    c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, Math.min(1, hsl.l * 1.5));
    return new THREE.MeshBasicMaterial({
      color: '#' + c.getHexString(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }), [faceColor]);

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
    const progress = 1 - Math.pow(1 - tRaw, 3);
    const alpha   = Math.min(1, elapsed / 0.25);

    const inRetreat   = elapsed > duration;
    const retreatT    = inRetreat ? elapsed - duration : 0;
    const retreatProg = Math.min(1, retreatT / retreatDur);
    const easeRetract = retreatProg < 0.5
      ? 2 * retreatProg * retreatProg
      : 1 - Math.pow(-2 * retreatProg + 2, 2) / 2;
    const displayProgress = inRetreat ? 1 - easeRetract : progress;

    _faceN.set(...start).normalize();
    const basePerp = Math.abs(_faceN.y) < 0.8 ? _basePerp0 : _basePerp1;
    _perp.crossVectors(_faceN, basePerp).normalize();
    _arcFwdVec.crossVectors(_perp, _faceN).normalize();

    const cosP = Math.cos(p.arcPhase);
    const sinP = Math.sin(p.arcPhase);
    _arcDir.copy(_perp).multiplyScalar(cosP).addScaledVector(_arcFwdVec, sinP);
    _wigDir.copy(_perp).multiplyScalar(-sinP).addScaledVector(_arcFwdVec, cosP);

    const wLive = Math.sin(clockTime * 2.5) * 0.04;

    curveData.pts[0].set(0, 0, 0).addScaledVector(_faceN, 0.02);
    curveData.pts[1].set(0, 0, 0).addScaledVector(_faceN,  0.18);
    curveData.pts[2].set(0, 0, 0).addScaledVector(_faceN, 0.48).addScaledVector(_arcDir, 0.18).addScaledVector(_wigDir, wLive);
    curveData.pts[3].set(0, 0, 0).addScaledVector(_faceN, 0.58).addScaledVector(_arcDir, 0.36).addScaledVector(_wigDir, wLive * 1.2);
    curveData.pts[4].set(0, 0, 0).addScaledVector(_faceN, 0.62).addScaledVector(_arcDir, 0.52).addScaledVector(_wigDir, wLive * 1.6);
    curveData.curve.updateArcLengths();

    curveData.curve.getPoint(displayProgress, _headPos);
    curveData.curve.getPoint(Math.min(displayProgress + 0.06, 1), _lookPos);

    const retreatFade = inRetreat ? Math.max(0, Math.min(1, (retreatDur - retreatT) / 0.5)) : 1.0;

    // ── Head ──────────────────────────────────────────────────────────────────
    if (headGroupRef.current) {
      headGroupRef.current.visible = alpha > 0.02 && !(inRetreat && displayProgress < 0.10);
      headGroupRef.current.position.copy(_headPos);

      _tangent.subVectors(_lookPos, _headPos).normalize();
      if (_tangent.lengthSq() > 0.001) {
        _lookQuat.setFromUnitVectors(_fwdAxis, _tangent);
        headGroupRef.current.quaternion.slerp(_lookQuat, inRetreat ? 0.55 : 0.5);
      }

      const squish = Math.sin(clockTime * p.squishFreq) * p.squishAmp;
      headGroupRef.current.scale.set(1 + squish * 0.3, 1 - squish * 0.15, 1 + squish * 0.3);
    }

    // ── Blinking ──────────────────────────────────────────────────────────────
    const timeSinceBlink = clockTime - blinkTimerRef.current;
    if (!isBlinkingRef.current && timeSinceBlink > p.blinkInterval) {
      isBlinkingRef.current = true;
      blinkTimerRef.current = clockTime;
    }
    if (isBlinkingRef.current && timeSinceBlink > p.blinkDur) {
      isBlinkingRef.current = false;
    }
    const eyeScaleY = isBlinkingRef.current ? 0.07 : 1;
    if (eyeLRef.current) eyeLRef.current.scale.set(1, eyeScaleY, 1);
    if (eyeRRef.current) eyeRRef.current.scale.set(1, eyeScaleY, 1);

    // ── Antennae ──────────────────────────────────────────────────────────────
    const r = 0.3 + Math.sin(clockTime * 6 + p.antennaPhase) * 0.14;
    if (ant1StemRef.current) ant1StemRef.current.rotation.z = r;
    if (ant2StemRef.current) ant2StemRef.current.rotation.z = -r;
    if (ant1TipRef.current) {
      ant1TipRef.current.position.set(-0.09 + Math.sin(r) * STEM_HALF, 0.24 + Math.cos(r) * STEM_HALF, 0.08);
    }
    if (ant2TipRef.current) {
      ant2TipRef.current.position.set(0.09 - Math.sin(r) * STEM_HALF, 0.24 + Math.cos(r) * STEM_HALF, 0.08);
    }

    // ── Body segments ─────────────────────────────────────────────────────────
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = segRefs.current[i];
      if (!seg) continue;
      const lag  = (i + 1) / (SEGMENT_COUNT + 1);
      const segT = Math.max(0, Math.min(1, displayProgress * (1 - lag)));
      curveData.curve.getPoint(segT, _segPos);
      const wave  = Math.sin(clockTime * p.squishFreq - i * 0.8) * p.squishAmp;
      const taper = 1 - (i / (SEGMENT_COUNT - 1)) * 0.05;
      seg.position.copy(_segPos);
      seg.scale.set(taper * (1 + wave), taper * (1 - wave * 0.5), taper * (1 + wave));
      seg.visible = retreatFade > 0.02;
      if (seg.visible) {
        const baseOpacity = (0.95 - (i / SEGMENT_COUNT) * 0.12) * retreatFade;
        segMats[i].opacity = baseOpacity;
        // Inner glow fades faster toward tail and during retreat
        segGlowMats[i].opacity = baseOpacity * (0.30 - i * 0.04) * retreatFade;
      }
    }
  });

  return (
    <group position={start}>
      {/* ── Head group ────────────────────────────────────────────────────── */}
      <group ref={headGroupRef}>
        {/* Outline shell — slightly larger for crisper pop */}
        <mesh geometry={wHeadGeo} renderOrder={24} scale={[1.30, 1.30, 1.30]} material={outlineMat} />
        {/* Main head sphere */}
        <mesh geometry={wHeadGeo} renderOrder={26} material={headMat} />
        {/* Inner additive glow on head */}
        <mesh geometry={wGlowGeo} renderOrder={25}>
          <meshBasicMaterial
            color={faceColor} transparent opacity={0.22}
            depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}
          />
        </mesh>

        {/* Eyes — sclera with subtle blue-white emissive */}
        <mesh ref={eyeLRef} position={[-0.085, 0.105, 0.175]} geometry={wEyeGeo} renderOrder={28} material={eyeWhiteMat} />
        <mesh ref={eyeRRef} position={[ 0.085, 0.105, 0.175]} geometry={wEyeGeo} renderOrder={28} material={eyeWhiteMat} />
        {/* Pupils — near-black with metalness for depth */}
        <mesh position={[-0.085, 0.112, 0.208]} geometry={wPupilGeo} renderOrder={29} material={pupilMat} />
        <mesh position={[ 0.085, 0.112, 0.208]} geometry={wPupilGeo} renderOrder={29} material={pupilMat} />
        {/* Glint dots — small white additive flare offset on pupils */}
        <mesh position={[-0.072, 0.125, 0.224]} geometry={wGlintGeo} renderOrder={30} material={glintMat} />
        <mesh position={[ 0.098, 0.125, 0.224]} geometry={wGlintGeo} renderOrder={30} material={glintMat} />

        {/* Smile — slightly brighter for legibility */}
        <mesh position={[0, -0.030, 0.178]} rotation={[0.25, 0, Math.PI]} renderOrder={28} geometry={wMouthGeo} material={mouthMat} />

        {/* Antennae stems — lit + emissive */}
        <mesh ref={ant1StemRef} position={[-0.09, 0.24, 0.08]} rotation={[0, 0, 0.3]} geometry={wStemGeo} renderOrder={27} material={antennaMat} />
        <mesh ref={ant2StemRef} position={[ 0.09, 0.24, 0.08]} rotation={[0, 0,-0.3]} geometry={wStemGeo} renderOrder={27} material={antennaMat} />
        {/* Antenna tips — glowing orbs */}
        <mesh ref={ant1TipRef} position={[-0.06, 0.35, 0.08]} geometry={wTipGeo} renderOrder={28} material={tipMat} />
        <mesh ref={ant2TipRef} position={[ 0.06, 0.35, 0.08]} geometry={wTipGeo} renderOrder={28} material={tipMat} />
      </group>

      {/* ── Body segments ─────────────────────────────────────────────────── */}
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <group key={`seg-${i}`} ref={el => (segRefs.current[i] = el)}>
          <mesh geometry={wSegGeos[i]} renderOrder={24} scale={[1.30, 1.30, 1.30]} material={outlineMat} />
          <mesh renderOrder={26} geometry={wSegGeos[i]} material={segMats[i]} />
          {/* Per-segment inner glow */}
          <mesh renderOrder={25} geometry={wGlowGeo} material={segGlowMats[i]} />
        </group>
      ))}
    </group>
  );
};

export default MenuWormParticle;
