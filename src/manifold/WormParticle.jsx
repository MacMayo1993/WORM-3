import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Global scratchpad — zero allocations in the game loop ───────────────────
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();

// ─── Shared geometries (one per shape, never recreated) ──────────────────────
// Smaller head — avoid the "bulbous tip" look by keeping it close to segment size
const headGeo        = new THREE.SphereGeometry(0.15, 12, 12);
// Segments same width as head; tapering handled via scale in the frame loop
const segGeo         = new THREE.SphereGeometry(0.13, 10, 8);
const eyeGeo         = new THREE.SphereGeometry(0.055, 8, 8);
const pupilGeo       = new THREE.SphereGeometry(0.032, 6, 6);
// Antennae — two stalks + glowing tips clearly identify this as a worm head
const antennaStemGeo = new THREE.CapsuleGeometry(0.007, 0.09, 4, 8);
const antennaTipGeo  = new THREE.SphereGeometry(0.022, 6, 6);
const glowGeo        = new THREE.SphereGeometry(0.24, 8, 8);
const trailDotGeo    = new THREE.SphereGeometry(0.04, 6, 6);

const SEGMENT_COUNT = 8;
const TRAIL_DOTS    = 12;
const TRAIL_SPACING = 0.07;

// ─── WormParticle ─────────────────────────────────────────────────────────────
/**
 * A bioluminescent worm that:
 *  1. Travels along a sinuous S-curve (CatmullRomCurve3) from `start` to `end`
 *  2. Has a round head with googly eyes + two wiggling antennae (no tongue)
 *  3. Body segments taper toward the tail with alternating color bands
 *  4. Leaves a glowing additive-blend particle trail
 *  5. Head glow halo pulses on beat
 */
const WormParticle = ({
  start,
  end,
  color1,
  color2,
  startTime,
  currentTime,
  onComplete,
}) => {
  const headRef          = useRef();
  const headGlowRef      = useRef();
  const segRefs          = useRef([]);
  const eyeLeftRef       = useRef();
  const eyeRightRef      = useRef();
  const pupilLRef        = useRef();
  const pupilRRef        = useRef();
  const antenna1StemRef  = useRef();
  const antenna1TipRef   = useRef();
  const antenna2StemRef  = useRef();
  const antenna2TipRef   = useRef();
  const trailRefs        = useRef([]);
  const trailGeoRef      = useRef();

  const duration = 3.2;

  // ── Unique personality — stable across re-renders ─────────────────────────
  const p = useMemo(() => ({
    wiggleFreq   : 1.8 + Math.random() * 1.2,   // S-curve oscillation speed
    wiggleAmp    : 0.38 + Math.random() * 0.22,  // how wide the S-curves swing
    wigglePhase  : Math.random() * Math.PI * 2,
    blinkInterval: 1.4 + Math.random() * 2.0,
    blinkDur     : 0.12,
    squishAmp    : 0.12 + Math.random() * 0.10,
    squishFreq   : 8 + Math.random() * 6,
    glowPulseFreq: 2 + Math.random() * 2,
    eyeWobble    : 0.02 + Math.random() * 0.03,
    baseScale    : 0.85 + Math.random() * 0.3,
    speedVariance: 0.85 + Math.random() * 0.3,
    antennaPhase : Math.random() * Math.PI * 2,
    bandShift    : 0.07 + Math.random() * 0.06,  // hue shift between even/odd segments
  }), []);

  const blinkTimerRef = useRef(0);
  const isBlinkingRef = useRef(false);

  const trailPoints = useMemo(() => new Float32Array(40 * 3), []);

  // ── Frame loop ────────────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    const clockTime = clock.getElapsedTime();
    const animTime  = currentTime !== undefined ? currentTime : clockTime;
    if (animTime < startTime) return;

    const elapsed = animTime - startTime;
    if (elapsed >= duration) {
      onComplete?.();
      return;
    }

    // ── 1. Progress & S-curve path ───────────────────────────────────────────
    const t = (elapsed / duration) * p.speedVariance;
    const tClamped = Math.min(t, 1);
    // Quintic ease-in-out
    const progress = tClamped < 0.5
      ? 16 * tClamped ** 5
      : 1 - (-2 * tClamped + 2) ** 5 / 2;

    const vStart = _v1.set(...start);
    const vEnd   = _v2.set(...end);

    const dir = _v3.subVectors(vEnd, vStart);
    const len = dir.length();
    _right.crossVectors(dir.clone().normalize(), _up).normalize();
    if (_right.lengthSq() < 0.001) _right.set(1, 0, 0);

    // Build a CatmullRomCurve3 with alternating lateral waypoints so the worm
    // travels in a natural S-curve rather than a straight-line arc.
    // The waypoints shift each frame to animate the body ripple.
    const tw = clockTime * p.wiggleFreq + p.wigglePhase;
    const amp = p.wiggleAmp * len * 0.38;

    const wp0 = vStart.clone();
    const wp1 = vStart.clone().lerp(vEnd, 0.2)
      .addScaledVector(_right, Math.sin(tw) * amp)
      .addScaledVector(_up, Math.cos(tw * 0.8) * amp * 0.3);
    const wp2 = vStart.clone().lerp(vEnd, 0.45)
      .addScaledVector(_right, Math.sin(tw + Math.PI) * amp * 0.85);
    const wp3 = vStart.clone().lerp(vEnd, 0.7)
      .addScaledVector(_right, Math.sin(tw + Math.PI * 1.5) * amp * 0.65);
    const wp4 = vEnd.clone();

    const curve = new THREE.CatmullRomCurve3([wp0, wp1, wp2, wp3, wp4]);

    // ── 2. Color interpolation ────────────────────────────────────────────────
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    const currentColor = c1.clone().lerp(c2, progress);
    currentColor.offsetHSL(Math.sin(clockTime * 4) * 0.04, 0, 0);

    const glowColor = currentColor.clone();
    glowColor.r = Math.min(1, glowColor.r * 1.4 + 0.15);
    glowColor.g = Math.min(1, glowColor.g * 1.4 + 0.15);
    glowColor.b = Math.min(1, glowColor.b * 1.4 + 0.15);

    // ── 3. Head position & orientation ───────────────────────────────────────
    const headPos      = curve.getPoint(progress);
    const lookAheadPos = curve.getPoint(Math.min(progress + 0.02, 1));
    _tangent.subVectors(lookAheadPos, headPos).normalize();

    if (headRef.current) {
      headRef.current.position.copy(headPos);
      headRef.current.material.color.copy(currentColor);
      const s = p.baseScale * (1 + Math.sin(clockTime * p.squishFreq) * p.squishAmp * 0.25);
      headRef.current.scale.setScalar(s);
      if (_tangent.lengthSq() > 0.001) {
        headRef.current.setRotationFromQuaternion(
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), _tangent)
        );
      }
    }

    // ── 4. Head glow halo — reduced opacity so features are visible ───────────
    if (headGlowRef.current) {
      headGlowRef.current.position.copy(headPos);
      const glowPulse = 0.5 + Math.sin(clockTime * p.glowPulseFreq) * 0.35;
      headGlowRef.current.material.opacity = glowPulse * 0.22 * p.baseScale;
      headGlowRef.current.material.color.copy(glowColor);
      headGlowRef.current.scale.setScalar(p.baseScale * (1.35 + glowPulse * 0.2));
    }

    // ── 5. Body segments — peristaltic wave, clear taper, alternating bands ──
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = segRefs.current[i];
      if (!seg) continue;

      // More spread-out lag so individual segments are clearly visible
      const lag     = (i + 1) / (SEGMENT_COUNT + 1) * 0.40;
      const segProg = Math.max(0, progress - lag);
      const segPos  = curve.getPoint(segProg);
      const wave    = Math.sin(clockTime * p.squishFreq - i * 0.9) * p.squishAmp;
      // Taper: head-adjacent is full size, tail is half size
      const taper   = 1 - (i / (SEGMENT_COUNT - 1)) * 0.52;
      const scaleXZ = p.baseScale * taper * (1 + wave);
      const scaleY  = p.baseScale * taper * (1 - wave * 0.5);

      seg.position.copy(segPos);
      seg.scale.set(scaleXZ, scaleY, scaleXZ);

      // Alternating color bands (earthy, caterpillar-like)
      const segColor = c1.clone().lerp(c2, segProg);
      const bandOffset = i % 2 === 0 ? p.bandShift : -p.bandShift * 0.5;
      segColor.offsetHSL(bandOffset, 0.08 * (i % 2), -0.04 * (i % 2));
      seg.material.color.copy(segColor);
      seg.material.opacity = 0.90 - (i / SEGMENT_COUNT) * 0.25;
    }

    // ── 6. Glowing particle trail ─────────────────────────────────────────────
    for (let i = 0; i < TRAIL_DOTS; i++) {
      const dot = trailRefs.current[i];
      if (!dot) continue;
      const trailProg = Math.max(0, progress - (i + 1) * TRAIL_SPACING);
      if (trailProg <= 0) {
        dot.visible = false;
        continue;
      }
      dot.visible = true;
      const dotPos = curve.getPoint(trailProg);
      dot.position.copy(dotPos);
      const fade   = Math.max(0, 1 - (i + 1) / TRAIL_DOTS) * (1 - progress * 0.5);
      const tColor = c1.clone().lerp(c2, trailProg);
      dot.material.color.copy(tColor);
      dot.material.opacity = fade * 0.55;
      dot.scale.setScalar(Math.max(0.1, (1 - i / TRAIL_DOTS) * 0.8 * p.baseScale));
    }

    // ── 7. Glow tube trail (line) ──────────────────────────────────────────────
    if (trailGeoRef.current) {
      for (let j = 0; j < 40; j++) {
        const tp = Math.max(0, progress - j * 0.012);
        const pt = curve.getPoint(tp);
        trailPoints[j * 3]     = pt.x;
        trailPoints[j * 3 + 1] = pt.y;
        trailPoints[j * 3 + 2] = pt.z;
      }
      trailGeoRef.current.attributes.position.needsUpdate = true;
    }

    // ── 8. Head orientation helpers ────────────────────────────────────────────
    const headQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      _tangent.lengthSq() > 0.001 ? _tangent : new THREE.Vector3(0, 0, 1)
    );
    const faceRight = new THREE.Vector3(1, 0, 0).applyQuaternion(headQuat);
    const faceUp    = new THREE.Vector3(0, 1, 0).applyQuaternion(headQuat);

    const eyeForwardOffset = _tangent.clone().multiplyScalar(0.13 * p.baseScale);
    const eyeUpOffset      = faceUp.clone().multiplyScalar(0.07 * p.baseScale);
    const eyeLateralOffset = faceRight.clone().multiplyScalar(0.09 * p.baseScale);

    // ── 9. Blinking ────────────────────────────────────────────────────────────
    const timeSinceBlink = clockTime - blinkTimerRef.current;
    if (!isBlinkingRef.current && timeSinceBlink > p.blinkInterval) {
      isBlinkingRef.current = true;
      blinkTimerRef.current = clockTime;
    }
    if (isBlinkingRef.current && timeSinceBlink > p.blinkDur) {
      isBlinkingRef.current = false;
    }
    const eyeScaleY = isBlinkingRef.current ? 0.08 : 1;
    const eyeWobble = Math.sin(clockTime * 8) * p.eyeWobble;

    [eyeLeftRef, eyeRightRef].forEach((ref, side) => {
      if (!ref.current) return;
      const lateralSign = side === 0 ? 1 : -1;
      ref.current.position.copy(headPos)
        .add(eyeForwardOffset)
        .add(eyeUpOffset)
        .addScaledVector(eyeLateralOffset, lateralSign * 2);
      ref.current.scale.set(p.baseScale, p.baseScale * eyeScaleY, p.baseScale);
      ref.current.material.opacity = 0.95;
    });

    [pupilLRef, pupilRRef].forEach((ref, side) => {
      if (!ref.current) return;
      const lateralSign = side === 0 ? 1 : -1;
      ref.current.position.copy(headPos)
        .add(eyeForwardOffset)
        .addScaledVector(_tangent, 0.04 * p.baseScale)
        .add(eyeUpOffset)
        .addScaledVector(eyeLateralOffset, lateralSign * 2)
        .add(new THREE.Vector3(Math.sin(clockTime * 2.3) * p.eyeWobble, Math.cos(clockTime * 1.7) * p.eyeWobble + eyeWobble, 0));
      ref.current.scale.setScalar(p.baseScale * (isBlinkingRef.current ? 0.05 : 0.85));
      ref.current.material.opacity = 0.92;
    });

    // ── 10. Antennae — two wiggling stalks on top of head ─────────────────────
    // These are the key feature that makes this clearly a worm, not anything else.
    const antennaWiggle = Math.sin(clockTime * 6 + p.antennaPhase) * 0.05;
    const antennaBaseUp = faceUp.clone().multiplyScalar(0.15 * p.baseScale);
    const antennaFwd    = _tangent.clone().multiplyScalar(0.08 * p.baseScale);
    const stemHeight    = 0.12 * p.baseScale;

    // Left antenna
    if (antenna1StemRef.current) {
      const stemBase = headPos.clone().add(antennaBaseUp).add(antennaFwd)
        .addScaledVector(faceRight, 0.06 * p.baseScale);
      antenna1StemRef.current.position.copy(stemBase);
      const stemDir = faceUp.clone()
        .addScaledVector(faceRight, antennaWiggle)
        .addScaledVector(_tangent, 0.1)
        .normalize();
      antenna1StemRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), stemDir);
      antenna1StemRef.current.material.color.copy(currentColor);
      antenna1StemRef.current.material.opacity = 0.9;
      antenna1StemRef.current.scale.setScalar(p.baseScale);
    }
    if (antenna1TipRef.current) {
      antenna1TipRef.current.position.copy(headPos.clone()
        .add(antennaBaseUp)
        .addScaledVector(faceUp, stemHeight)
        .add(antennaFwd)
        .addScaledVector(faceRight, (0.06 + antennaWiggle * 0.8) * p.baseScale));
      antenna1TipRef.current.material.color.copy(glowColor);
      antenna1TipRef.current.material.opacity = 1.0;
      antenna1TipRef.current.scale.setScalar(p.baseScale);
    }

    // Right antenna
    if (antenna2StemRef.current) {
      const stemBase = headPos.clone().add(antennaBaseUp).add(antennaFwd)
        .addScaledVector(faceRight, -0.06 * p.baseScale);
      antenna2StemRef.current.position.copy(stemBase);
      const stemDir = faceUp.clone()
        .addScaledVector(faceRight, -antennaWiggle)
        .addScaledVector(_tangent, 0.1)
        .normalize();
      antenna2StemRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), stemDir);
      antenna2StemRef.current.material.color.copy(currentColor);
      antenna2StemRef.current.material.opacity = 0.9;
      antenna2StemRef.current.scale.setScalar(p.baseScale);
    }
    if (antenna2TipRef.current) {
      antenna2TipRef.current.position.copy(headPos.clone()
        .add(antennaBaseUp)
        .addScaledVector(faceUp, stemHeight)
        .add(antennaFwd)
        .addScaledVector(faceRight, -(0.06 + antennaWiggle * 0.8) * p.baseScale));
      antenna2TipRef.current.material.color.copy(glowColor);
      antenna2TipRef.current.material.opacity = 1.0;
      antenna2TipRef.current.scale.setScalar(p.baseScale);
    }
  });

  return (
    <group>
      {/* ── Glow tube trail ─────────────────────────────────────────────── */}
      <line>
        <bufferGeometry ref={trailGeoRef}>
          <bufferAttribute
            attach="attributes-position"
            count={40}
            array={trailPoints}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={color2}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>

      {/* ── Particle trail dots ──────────────────────────────────────────── */}
      {Array.from({ length: TRAIL_DOTS }, (_, i) => (
        <mesh
          key={`trail-${i}`}
          ref={el => (trailRefs.current[i] = el)}
          geometry={trailDotGeo}
          visible={false}
        >
          <meshBasicMaterial
            color={color1}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ── Body segments ────────────────────────────────────────────────── */}
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <mesh
          key={`seg-${i}`}
          ref={el => (segRefs.current[i] = el)}
          geometry={segGeo}
        >
          <meshBasicMaterial
            color={color1}
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ── Head glow halo ────────────────────────────────────────────────── */}
      <mesh ref={headGlowRef} geometry={glowGeo}>
        <meshBasicMaterial
          color={color1}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── Head ──────────────────────────────────────────────────────────── */}
      <mesh ref={headRef} geometry={headGeo}>
        <meshBasicMaterial
          color={color1}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── Eyes — white sclera (renderOrder ensures they draw over head) ─── */}
      <mesh ref={eyeLeftRef} geometry={eyeGeo} renderOrder={1}>
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={eyeRightRef} geometry={eyeGeo} renderOrder={1}>
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── Pupils ────────────────────────────────────────────────────────── */}
      <mesh ref={pupilLRef} geometry={pupilGeo} renderOrder={2}>
        <meshBasicMaterial
          color="#111111"
          transparent
          opacity={0}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={pupilRRef} geometry={pupilGeo} renderOrder={2}>
        <meshBasicMaterial
          color="#111111"
          transparent
          opacity={0}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── Antennae — left ───────────────────────────────────────────────── */}
      {/* These are the primary visual cue that this is a worm/insect head   */}
      <mesh ref={antenna1StemRef} geometry={antennaStemGeo}>
        <meshBasicMaterial
          color={color1}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={antenna1TipRef} geometry={antennaTipGeo}>
        <meshBasicMaterial
          color={color1}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── Antennae — right ──────────────────────────────────────────────── */}
      <mesh ref={antenna2StemRef} geometry={antennaStemGeo}>
        <meshBasicMaterial
          color={color1}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={antenna2TipRef} geometry={antennaTipGeo}>
        <meshBasicMaterial
          color={color1}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

export default WormParticle;
