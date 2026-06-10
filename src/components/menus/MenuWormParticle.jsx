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
const _basePerp0 = new THREE.Vector3(0, 1, 0); // reused, never mutated
const _basePerp1 = new THREE.Vector3(1, 0, 0); // reused, never mutated
const _headPos   = new THREE.Vector3();
const _lookPos   = new THREE.Vector3();
const _segPos    = new THREE.Vector3();
const _creasePos = new THREE.Vector3();
const _creaseTan = new THREE.Vector3();
const _creaseQ   = new THREE.Quaternion();
const _torusZ    = new THREE.Vector3(0, 0, 1);

// ── Module-level shared geometries ────────────────────────────────────────────
const wHeadGeo  = new THREE.SphereGeometry(0.22, 14, 12);
const wSegGeos  = [
  new THREE.SphereGeometry(0.21, 12, 10),
  new THREE.SphereGeometry(0.21, 10, 8),
  new THREE.SphereGeometry(0.21, 10, 8),
  new THREE.SphereGeometry(0.20, 8, 8),
  new THREE.SphereGeometry(0.20, 8, 8),
];
const wEyeGeo   = new THREE.SphereGeometry(0.050, 8, 8);
const wPupilGeo = new THREE.SphereGeometry(0.026, 6, 6);
const wStemGeo  = new THREE.CylinderGeometry(0.010, 0.007, 0.20, 6);
const wTipGeo   = new THREE.SphereGeometry(0.020, 6, 6);
const wMouthGeo  = new THREE.TorusGeometry(0.048, 0.013, 6, 12, Math.PI);
const wCreaseGeo = new THREE.TorusGeometry(0.17, 0.026, 8, 18);

// ── Module-level shared materials — identical across all worm instances ────────
const outlineMat  = new THREE.MeshBasicMaterial({ color: '#111111', side: THREE.BackSide, depthWrite: false, depthTest: false });
const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, depthWrite: false });
const pupilMat    = new THREE.MeshStandardMaterial({ color: '#0a0a14', roughness: 0.5, depthWrite: false });
const mouthMat    = new THREE.MeshStandardMaterial({ color: '#0d2410', roughness: 0.6, depthWrite: false });

const STEM_HALF     = 0.10;
const SEGMENT_COUNT = 5;

/**
 * MenuWormParticle — menu-only worm with zero per-frame allocations.
 * Emerges from a flip tile along an arc, then retreats back into the hole.
 * Curve points and the CatmullRomCurve3 are pre-allocated via useMemo.
 * All materials are either module-scope singletons or useMemo instances.
 */
const MenuWormParticle = ({ start, color1, startTime, onComplete }) => {
  const headGroupRef = useRef();
  const eyeLRef      = useRef();
  const eyeRRef      = useRef();
  const ant1StemRef  = useRef();
  const ant2StemRef  = useRef();
  const ant1TipRef   = useRef();
  const ant2TipRef   = useRef();
  const segRefs      = useRef([]);
  const creaseRefs   = useRef([]);
  const segTCache    = useRef(new Array(SEGMENT_COUNT).fill(0));

  const duration      = 2.0;
  const retreatDur    = 2.0;
  const totalDuration = duration + retreatDur;

  const p = useMemo(() => ({
    arcPhase    : Math.random() * Math.PI,  // [0,π] keeps arc in upward hemisphere for side faces
    blinkInterval: 1.4 + Math.random() * 2.0,
    blinkDur    : 0.12,
    squishAmp   : 0.08 + Math.random() * 0.06,
    squishFreq  : 6 + Math.random() * 4,
    antennaPhase: Math.random() * Math.PI * 2,
  }), []);

  // Pre-allocated curve — mutated in place each frame, never recreated
  const curveData = useMemo(() => {
    const pts = Array.from({ length: 5 }, () => new THREE.Vector3());
    return { pts, curve: new THREE.CatmullRomCurve3(pts) };
  }, []);

  const faceColor = color1 || '#3be08a';

  // Per-instance materials — cloned from base, keyed on faceColor
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: faceColor, roughness: 0.3, metalness: 0,
    emissive: faceColor, emissiveIntensity: 0.7, depthWrite: false,
  }), [faceColor]);

  const antennaMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: faceColor, roughness: 0.5,
    emissive: faceColor, emissiveIntensity: 0.4, depthWrite: false,
  }), [faceColor]);

  const tipMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff', emissive: faceColor, emissiveIntensity: 2.0, depthWrite: false,
  }), [faceColor]);

  // One material per segment — transparent, opacity mutated in useFrame
  const segMats = useMemo(() => Array.from({ length: SEGMENT_COUNT }, (_, i) =>
    new THREE.MeshStandardMaterial({
      color: faceColor, roughness: 0.3, metalness: 0,
      emissive: faceColor, emissiveIntensity: 0.45 - i * 0.06,
      transparent: true, opacity: 0, depthWrite: false,
    })
  ), [faceColor]);

  // Per-instance crease materials so opacity can be controlled per-frame
  const creaseMats = useMemo(() => Array.from({ length: SEGMENT_COUNT }, () =>
    new THREE.MeshBasicMaterial({ color: '#080808', depthWrite: false, depthTest: false, transparent: true, opacity: 0.9 })
  ), []);

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

    // Face normal + stable perpendicular basis — no allocations
    _faceN.set(...start).normalize();
    const basePerp = Math.abs(_faceN.y) < 0.8 ? _basePerp0 : _basePerp1;
    _perp.crossVectors(_faceN, basePerp).normalize();
    _arcFwdVec.crossVectors(_perp, _faceN).normalize();

    const cosP = Math.cos(p.arcPhase);
    const sinP = Math.sin(p.arcPhase);
    _arcDir.copy(_perp).multiplyScalar(cosP).addScaledVector(_arcFwdVec, sinP);
    _wigDir.copy(_perp).multiplyScalar(-sinP).addScaledVector(_arcFwdVec, cosP);

    const wLive = Math.sin(clockTime * 2.5) * 0.04;

    // Mutate pre-allocated curve points — zero allocations
    // pts[0] sits just above the surface so the worm is always visible (never inside the cube)
    curveData.pts[0].set(0, 0, 0).addScaledVector(_faceN, 0.02);
    curveData.pts[1].set(0, 0, 0).addScaledVector(_faceN,  0.18);
    curveData.pts[2].set(0, 0, 0).addScaledVector(_faceN, 0.48).addScaledVector(_arcDir, 0.18).addScaledVector(_wigDir, wLive);
    curveData.pts[3].set(0, 0, 0).addScaledVector(_faceN, 0.58).addScaledVector(_arcDir, 0.36).addScaledVector(_wigDir, wLive * 1.2);
    curveData.pts[4].set(0, 0, 0).addScaledVector(_faceN, 0.62).addScaledVector(_arcDir, 0.52).addScaledVector(_wigDir, wLive * 1.6);
    curveData.curve.updateArcLengths();

    // Sample curve into pre-allocated vectors
    curveData.curve.getPoint(displayProgress, _headPos);
    curveData.curve.getPoint(Math.min(displayProgress + 0.06, 1), _lookPos);

    // Fade worm out as it converges back into the hole during retreat
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
    const eyeScaleY = isBlinkingRef.current ? 0.08 : 1;
    if (eyeLRef.current) eyeLRef.current.scale.set(1, eyeScaleY, 1);
    if (eyeRRef.current) eyeRRef.current.scale.set(1, eyeScaleY, 1);

    // ── Antennae ──────────────────────────────────────────────────────────────
    const r = 0.3 + Math.sin(clockTime * 6 + p.antennaPhase) * 0.12;
    if (ant1StemRef.current) ant1StemRef.current.rotation.z = r;
    if (ant2StemRef.current) ant2StemRef.current.rotation.z = -r;
    if (ant1TipRef.current) {
      ant1TipRef.current.position.set(-0.09 + Math.sin(r) * STEM_HALF, 0.22 + Math.cos(r) * STEM_HALF, 0.08);
    }
    if (ant2TipRef.current) {
      ant2TipRef.current.position.set(0.09 - Math.sin(r) * STEM_HALF, 0.22 + Math.cos(r) * STEM_HALF, 0.08);
    }

    // ── Body segments — opacity via direct material mutation ──────────────────
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = segRefs.current[i];
      if (!seg) continue;
      const lag  = (i + 1) / (SEGMENT_COUNT + 1);
      const segT = Math.max(0, Math.min(1, displayProgress * (1 - lag)));
      segTCache.current[i] = segT;
      curveData.curve.getPoint(segT, _segPos);
      const wave  = Math.sin(clockTime * p.squishFreq - i * 0.8) * p.squishAmp;
      const taper = 1 - (i / (SEGMENT_COUNT - 1)) * 0.05;
      seg.position.copy(_segPos);
      seg.scale.set(taper * (1 + wave), taper * (1 - wave * 0.5), taper * (1 + wave));
      seg.visible = retreatFade > 0.02;
      if (seg.visible) segMats[i].opacity = (0.95 - (i / SEGMENT_COUNT) * 0.12) * retreatFade;
    }

    // ── Joint creases — dark torus rings at each segment boundary ────────────
    for (let ci = 0; ci < SEGMENT_COUNT; ci++) {
      const crease = creaseRefs.current[ci];
      if (!crease) continue;
      const tA   = ci === 0 ? displayProgress : segTCache.current[ci - 1];
      const tB   = segTCache.current[ci];
      const tMid = (tA + tB) / 2;
      curveData.curve.getPoint(tMid, _creasePos);
      curveData.curve.getTangent(tMid, _creaseTan).normalize();
      if (_creaseTan.lengthSq() > 0.0001) _creaseQ.setFromUnitVectors(_torusZ, _creaseTan);
      crease.position.copy(_creasePos);
      crease.quaternion.copy(_creaseQ);
      crease.visible = retreatFade > 0.02;
      if (crease.visible) creaseMats[ci].opacity = retreatFade * 0.88;
    }
  });

  return (
    <group position={start}>
      {/* ── Head group ────────────────────────────────────────────────────── */}
      <group ref={headGroupRef}>
        <mesh geometry={wHeadGeo} renderOrder={25} scale={[1.28, 1.28, 1.28]} material={outlineMat} />
        <mesh geometry={wHeadGeo} renderOrder={27} material={headMat} />
        <mesh ref={eyeLRef} position={[-0.08, 0.10, 0.17]} geometry={wEyeGeo} renderOrder={28} material={eyeWhiteMat} />
        <mesh ref={eyeRRef} position={[0.08, 0.10, 0.17]} geometry={wEyeGeo} renderOrder={28} material={eyeWhiteMat} />
        <mesh position={[-0.08, 0.11, 0.20]} geometry={wPupilGeo} renderOrder={29} material={pupilMat} />
        <mesh position={[0.08, 0.11, 0.20]} geometry={wPupilGeo} renderOrder={29} material={pupilMat} />
        <mesh position={[0, -0.032, 0.17]} rotation={[0.25, 0, Math.PI]} renderOrder={28} geometry={wMouthGeo} material={mouthMat} />
        <mesh ref={ant1StemRef} position={[-0.09, 0.22, 0.08]} rotation={[0, 0, 0.3]} geometry={wStemGeo} renderOrder={27} material={antennaMat} />
        <mesh ref={ant2StemRef} position={[0.09, 0.22, 0.08]} rotation={[0, 0, -0.3]} geometry={wStemGeo} renderOrder={27} material={antennaMat} />
        <mesh ref={ant1TipRef} position={[-0.06, 0.32, 0.08]} geometry={wTipGeo} renderOrder={28} material={tipMat} />
        <mesh ref={ant2TipRef} position={[0.06, 0.32, 0.08]} geometry={wTipGeo} renderOrder={28} material={tipMat} />
      </group>

      {/* ── Body segments ─────────────────────────────────────────────────── */}
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <group key={`seg-${i}`} ref={el => (segRefs.current[i] = el)}>
          <mesh geometry={wSegGeos[i]} renderOrder={25} scale={[1.28, 1.28, 1.28]} material={outlineMat} />
          <mesh renderOrder={26} geometry={wSegGeos[i]} material={segMats[i]} />
        </group>
      ))}

      {/* ── Joint creases — dark torus rings that visually separate segments ── */}
      {Array.from({ length: SEGMENT_COUNT }, (_, ci) => (
        <mesh key={`crease-${ci}`} ref={el => (creaseRefs.current[ci] = el)}
          geometry={wCreaseGeo} renderOrder={26} material={creaseMats[ci]} />
      ))}
    </group>
  );
};

export default MenuWormParticle;
