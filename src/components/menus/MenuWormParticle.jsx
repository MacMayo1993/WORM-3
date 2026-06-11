import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Module-level cached vectors — zero per-frame allocations ──────────────────
const _faceN       = new THREE.Vector3();
const _perp        = new THREE.Vector3();
const _arcDir      = new THREE.Vector3();
const _wigDir      = new THREE.Vector3();
const _arcFwdVec   = new THREE.Vector3();
const _tangent     = new THREE.Vector3();
const _lookQuat    = new THREE.Quaternion();
const _fwdAxis     = new THREE.Vector3(0, 0, 1);
const _basePerp0   = new THREE.Vector3(0, 1, 0);
const _basePerp1   = new THREE.Vector3(1, 0, 0);
const _headPos     = new THREE.Vector3();
const _lookPos     = new THREE.Vector3();
const _segPos      = new THREE.Vector3();
const _worldNormal = new THREE.Vector3();
const _camDir      = new THREE.Vector3();

// ── Module-level shared geometries ────────────────────────────────────────────
const wHeadGeo  = new THREE.SphereGeometry(0.185, 14, 12);
const wSegGeos  = [
  new THREE.SphereGeometry(0.175, 12, 10),
  new THREE.SphereGeometry(0.175, 10, 8),
  new THREE.SphereGeometry(0.175, 10, 8),
  new THREE.SphereGeometry(0.165, 8, 8),
  new THREE.SphereGeometry(0.165, 8, 8),
];
const wEyeGeo   = new THREE.SphereGeometry(0.050, 8, 8);
const wPupilGeo = new THREE.SphereGeometry(0.026, 6, 6);
const wStemGeo  = new THREE.CylinderGeometry(0.010, 0.007, 0.20, 6);
const wTipGeo   = new THREE.SphereGeometry(0.020, 6, 6);
const wMouthGeo = new THREE.TorusGeometry(0.048, 0.013, 6, 12, Math.PI);
const wGlintGeo = new THREE.SphereGeometry(0.013, 5, 5);
const wGlintMat = new THREE.MeshBasicMaterial({
  color: '#ffffff', transparent: true, opacity: 0.90,
  depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
});

// ── Module-level shared materials ────────────────────────────────────────────
const outlineMat  = new THREE.MeshBasicMaterial({ color: '#06001a', side: THREE.BackSide, depthWrite: false });
const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, emissive: '#c8e8ff', emissiveIntensity: 0.25, depthWrite: false });
const pupilMat    = new THREE.MeshStandardMaterial({ color: '#0a0a14', metalness: 0.6, roughness: 0.0, depthWrite: false });
const mouthMat    = new THREE.MeshStandardMaterial({ color: '#0d2410', roughness: 0.6, depthWrite: false });

const STEM_HALF     = 0.10;
const SEGMENT_COUNT = 5;
const SEG_SPACING   = 0.22;  // physical arc-length gap between segments
const TRANSIT_DUR   = 3.0;   // seconds for a full face-to-face transit

/**
 * MenuWormParticle — menu-only worm.
 *
 * Without `end` prop: emerges from one tile along a short arc, retreats back.
 * With `end` prop:    shoots from the start face, arcs around the outside of the
 *                     cube (choosing a random equatorial direction via arcPhase),
 *                     and enters the antipodal end face — showing the wormhole connection.
 */
const MenuWormParticle = ({ start, end, color1, startTime, onComplete, arcPhase: arcPhaseProp }) => {
  const rootGroupRef = useRef();
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
  const totalDuration = end ? TRANSIT_DUR + 0.15 : duration + retreatDur;

  const p = useMemo(() => ({
    arcPhase    : arcPhaseProp !== undefined ? arcPhaseProp : Math.random() * Math.PI,  // [0,π] → upper hemisphere arcs only
    blinkInterval: 1.4 + Math.random() * 2.0,
    blinkDur    : 0.12,
    squishAmp   : 0.08 + Math.random() * 0.06,
    squishFreq  : 6 + Math.random() * 4,
    antennaPhase: Math.random() * Math.PI * 2,
  }), []);

  // Pre-allocated curve for emerge/retreat mode — mutated in place each frame
  const curveData = useMemo(() => {
    const pts = Array.from({ length: 5 }, () => new THREE.Vector3());
    return { pts, curve: new THREE.CatmullRomCurve3(pts) };
  }, []);

  // Fixed arc for transit mode — all points in group-relative space
  // (rootGroupRef sits at 'start', so absolute = start + relative).
  //
  // 7-point path that traces the great circle from face A to face B through arcDir,
  // with R=4.5 to safely clear cube corners (~2.6 from center to corner).
  const transitCurve = useMemo(() => {
    if (!end) return null;
    const startVec = new THREE.Vector3(...start);
    const endVec   = new THREE.Vector3(...end);
    const startN   = startVec.clone().normalize();
    const endN     = endVec.clone().normalize();

    const basePerp = Math.abs(startN.y) < 0.8 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const perp   = new THREE.Vector3().crossVectors(startN, basePerp).normalize();
    const arcFwd = new THREE.Vector3().crossVectors(perp, startN).normalize();
    const arcDir = new THREE.Vector3()
      .addScaledVector(perp, Math.cos(p.arcPhase))
      .addScaledVector(arcFwd, Math.sin(p.arcPhase))
      .normalize();

    const R      = 4.5;   // large arc — clears cube corners (≈2.6 from center)
    const launch = 1.2;   // shoot out before curving
    const sink   = 0.6;   // dive past far face surface

    const relEnd = endVec.clone().sub(startVec);

    // Great-circle sample: P(θ) = (startN·cosθ + arcDir·sinθ).normalize() · R  (group-relative)
    const gcp = (theta) =>
      new THREE.Vector3()
        .addScaledVector(startN, Math.cos(theta))
        .addScaledVector(arcDir, Math.sin(theta))
        .normalize()
        .multiplyScalar(R)
        .sub(startVec);

    const pts = [
      new THREE.Vector3(0, 0, 0),                          // P0: face A surface
      startN.clone().multiplyScalar(launch),               // P1: shoot out
      gcp(Math.PI / 4),                                    // P2: 45° on arc
      gcp(Math.PI / 2),                                    // P3: apex (90°)
      gcp(3 * Math.PI / 4),                                // P4: 135° on arc
      endN.clone().multiplyScalar(launch).add(relEnd),     // P5: approach face B
      endN.clone().multiplyScalar(-sink).add(relEnd),      // P6: dive INTO face B
    ];

    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    curve.arcLengthDivisions = 300;
    curve.updateArcLengths();
    return curve;
  }, [start, end]); // p.arcPhase from stable closure

  const faceColor = color1 || '#3be08a';

  const headMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: faceColor, roughness: 0.25, metalness: 0.05,
    emissive: faceColor, emissiveIntensity: 0.7, depthWrite: false,
  }), [faceColor]);

  const antennaMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: faceColor, roughness: 0.5,
    emissive: faceColor, emissiveIntensity: 0.4, depthWrite: false,
  }), [faceColor]);

  const tipMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff', emissive: faceColor, emissiveIntensity: 3.2, depthWrite: false,
  }), [faceColor]);

  const segMats = useMemo(() => Array.from({ length: SEGMENT_COUNT }, (_, i) =>
    new THREE.MeshStandardMaterial({
      color: faceColor, roughness: 0.25, metalness: 0.05,
      emissive: faceColor, emissiveIntensity: 0.45 - i * 0.06,
      transparent: true, opacity: 0, depthWrite: false,
    })
  ), [faceColor]);

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

    // Face normal — used by culling and the emerge/retreat path
    _faceN.set(...start).normalize();

    // Cull emerge/retreat worms when their face points away from camera.
    // Transit worms arc outside the cube so they skip culling entirely.
    if (!end) {
      const cubeMatrix = rootGroupRef.current?.parent?.parent?.matrixWorld;
      if (cubeMatrix) {
        _worldNormal.copy(_faceN).transformDirection(cubeMatrix);
        state.camera.getWorldDirection(_camDir);
        if (_worldNormal.dot(_camDir) > 0.1) {
          if (headGroupRef.current) headGroupRef.current.visible = false;
          for (let i = 0; i < SEGMENT_COUNT; i++) {
            if (segRefs.current[i]) segRefs.current[i].visible = false;
          }
          return;
        }
      }
    }

    // ── Shared: blinking ─────────────────────────────────────────────────────
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

    // ── Shared: antenna sway ─────────────────────────────────────────────────
    const r = 0.3 + Math.sin(clockTime * 6 + p.antennaPhase) * 0.12;
    if (ant1StemRef.current) ant1StemRef.current.rotation.z = r;
    if (ant2StemRef.current) ant2StemRef.current.rotation.z = -r;
    if (ant1TipRef.current)
      ant1TipRef.current.position.set(-0.09 + Math.sin(r) * STEM_HALF, 0.22 + Math.cos(r) * STEM_HALF, 0.08);
    if (ant2TipRef.current)
      ant2TipRef.current.position.set( 0.09 - Math.sin(r) * STEM_HALF, 0.22 + Math.cos(r) * STEM_HALF, 0.08);

    // ── TRANSIT MODE — worm travels around cube from start face to end face ───
    if (end && transitCurve) {
      const tRaw  = Math.min(elapsed / TRANSIT_DUR, 1);
      const eased = tRaw < 0.5 ? 2 * tRaw * tRaw : -1 + (4 - 2 * tRaw) * tRaw;

      const fadeIn  = Math.min(elapsed / 0.30, 1.0);
      const fadeOut = tRaw > 0.88 ? Math.max(0, (1 - tRaw) / 0.12) : 1.0;
      const alpha   = fadeIn * fadeOut;

      const totalLen = transitCurve.getLength();

      // Wiggle: sinusoidal lateral body wave — floor of 0.25 so they always wriggle
      transitCurve.getTangentAt(Math.min(eased, 0.99), _tangent);
      const wigUp = Math.abs(_tangent.y) < 0.9 ? _basePerp0 : _basePerp1;
      _wigDir.crossVectors(_tangent, wigUp).normalize();
      const wigAmp  = 0.38;
      const wigFreq = 5.5;
      const wigRamp = 0.25 + 0.75 * Math.sin(Math.PI * tRaw);

      transitCurve.getPointAt(eased, _headPos);
      transitCurve.getPointAt(Math.min(eased + 0.018, 1), _lookPos);
      _headPos.addScaledVector(_wigDir, Math.sin(clockTime * wigFreq) * wigAmp * wigRamp);

      if (headGroupRef.current) {
        headGroupRef.current.visible = alpha > 0.01;
        headGroupRef.current.position.copy(_headPos);
        _tangent.subVectors(_lookPos, _headPos).normalize();
        if (_tangent.lengthSq() > 0.001) {
          _lookQuat.setFromUnitVectors(_fwdAxis, _tangent);
          headGroupRef.current.quaternion.slerp(_lookQuat, 0.5);
        }
        const squish = Math.sin(clockTime * p.squishFreq) * p.squishAmp;
        headGroupRef.current.scale.set(
          (1 + squish * 0.3) * alpha,
          (1 - squish * 0.15) * alpha,
          (1 + squish * 0.3) * alpha,
        );
      }

      const headArcDist = eased * totalLen;
      for (let i = 0; i < SEGMENT_COUNT; i++) {
        const seg = segRefs.current[i];
        if (!seg) continue;
        const segDist = Math.max(0, headArcDist - (i + 1) * SEG_SPACING);
        transitCurve.getPointAt(segDist / totalLen, _segPos);
        // Each segment phase-shifted so the body undulates like a swimming snake
        _segPos.addScaledVector(_wigDir, Math.sin(clockTime * wigFreq - (i + 1) * 0.7) * wigAmp * wigRamp);
        const wave  = Math.sin(clockTime * p.squishFreq - i * 0.8) * p.squishAmp;
        const taper = 1 - (i / (SEGMENT_COUNT - 1)) * 0.05;
        seg.position.copy(_segPos);
        seg.scale.set(taper * (1 + wave), taper * (1 - wave * 0.5), taper * (1 + wave));
        seg.visible = alpha > 0.01;
        if (seg.visible) segMats[i].opacity = (0.95 - (i / SEGMENT_COUNT) * 0.12) * alpha;
      }
      return;
    }

    // ── EMERGE / RETREAT MODE — worm pops out of one tile and retreats back ───
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

    const basePerp = Math.abs(_faceN.y) < 0.8 ? _basePerp0 : _basePerp1;
    _perp.crossVectors(_faceN, basePerp).normalize();
    _arcFwdVec.crossVectors(_perp, _faceN).normalize();

    const cosP = Math.cos(p.arcPhase);
    const sinP = Math.sin(p.arcPhase);
    _arcDir.copy(_perp).multiplyScalar(cosP).addScaledVector(_arcFwdVec, sinP);
    _wigDir.copy(_perp).multiplyScalar(-sinP).addScaledVector(_arcFwdVec, cosP);

    const wLive = Math.sin(clockTime * 3.0) * 0.09;

    curveData.pts[0].set(0, 0, 0).addScaledVector(_faceN, 0.02);
    curveData.pts[1].set(0, 0, 0).addScaledVector(_faceN,  0.18);
    curveData.pts[2].set(0, 0, 0).addScaledVector(_faceN, 0.48).addScaledVector(_arcDir, 0.18).addScaledVector(_wigDir, wLive);
    curveData.pts[3].set(0, 0, 0).addScaledVector(_faceN, 0.58).addScaledVector(_arcDir, 0.36).addScaledVector(_wigDir, wLive * 1.2);
    curveData.pts[4].set(0, 0, 0).addScaledVector(_faceN, 0.62).addScaledVector(_arcDir, 0.52).addScaledVector(_wigDir, wLive * 1.6);
    curveData.curve.updateArcLengths();

    curveData.curve.getPoint(displayProgress, _headPos);
    curveData.curve.getPoint(Math.min(displayProgress + 0.06, 1), _lookPos);

    const retreatFade = inRetreat ? Math.max(0, Math.min(1, (retreatDur - retreatT) / 0.5)) : 1.0;

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
      if (seg.visible) segMats[i].opacity = (0.95 - (i / SEGMENT_COUNT) * 0.12) * retreatFade;
    }
  });

  return (
    <group ref={rootGroupRef} position={start}>
      {/* ── Head group ────────────────────────────────────────────────────── */}
      <group ref={headGroupRef}>
        <mesh geometry={wHeadGeo} renderOrder={25} scale={[1.30, 1.30, 1.30]} material={outlineMat} />
        <mesh geometry={wHeadGeo} renderOrder={27} material={headMat} />
        <mesh ref={eyeLRef} position={[-0.08, 0.10, 0.17]} geometry={wEyeGeo} renderOrder={28} material={eyeWhiteMat} />
        <mesh ref={eyeRRef} position={[0.08, 0.10, 0.17]} geometry={wEyeGeo} renderOrder={28} material={eyeWhiteMat} />
        <mesh position={[-0.08, 0.11, 0.20]} geometry={wPupilGeo} renderOrder={29} material={pupilMat} />
        <mesh position={[0.08, 0.11, 0.20]} geometry={wPupilGeo} renderOrder={29} material={pupilMat} />
        <mesh position={[-0.093, 0.122, 0.213]} geometry={wGlintGeo} renderOrder={30} material={wGlintMat} />
        <mesh position={[0.093, 0.122, 0.213]} geometry={wGlintGeo} renderOrder={30} material={wGlintMat} />
        <mesh position={[0, -0.032, 0.17]} rotation={[0.25, 0, Math.PI]} renderOrder={28} geometry={wMouthGeo} material={mouthMat} />
        <mesh ref={ant1StemRef} position={[-0.09, 0.22, 0.08]} rotation={[0, 0, 0.3]} geometry={wStemGeo} renderOrder={27} material={antennaMat} />
        <mesh ref={ant2StemRef} position={[0.09, 0.22, 0.08]} rotation={[0, 0, -0.3]} geometry={wStemGeo} renderOrder={27} material={antennaMat} />
        <mesh ref={ant1TipRef} position={[-0.06, 0.32, 0.08]} geometry={wTipGeo} renderOrder={28} material={tipMat} />
        <mesh ref={ant2TipRef} position={[0.06, 0.32, 0.08]} geometry={wTipGeo} renderOrder={28} material={tipMat} />
      </group>

      {/* ── Body segments ─────────────────────────────────────────────────── */}
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <group key={`seg-${i}`} ref={el => (segRefs.current[i] = el)}>
          <mesh geometry={wSegGeos[i]} renderOrder={25} scale={[1.30, 1.30, 1.30]} material={outlineMat} />
          <mesh renderOrder={26} geometry={wSegGeos[i]} material={segMats[i]} />
        </group>
      ))}
    </group>
  );
};

export default MenuWormParticle;
