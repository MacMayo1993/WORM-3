import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Global scratchpad — zero allocations in the game loop ───────────────────
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();

// ─── Shared geometries (one per shape, never recreated) ──────────────────────
const headGeo    = new THREE.SphereGeometry(0.22, 16, 16);
const segGeo     = new THREE.SphereGeometry(0.17, 12, 10);
const eyeGeo     = new THREE.SphereGeometry(0.06, 8, 8);
const pupilGeo   = new THREE.SphereGeometry(0.038, 6, 6);
const tongueGeo  = new THREE.CapsuleGeometry(0.018, 0.12, 4, 8);
const tongueTipGeo = new THREE.SphereGeometry(0.028, 6, 6);
const glowGeo    = new THREE.SphereGeometry(0.32, 8, 8);  // soft glow halo
const trailDotGeo = new THREE.SphereGeometry(0.05, 6, 6);

const SEGMENT_COUNT  = 9;   // visible body segments
const TRAIL_DOTS     = 18;  // glowing particle trail behind worm
const TRAIL_SPACING  = 0.08; // fraction of path behind head

// ─── WormParticle ─────────────────────────────────────────────────────────────
/**
 * A glowing bioluminescent worm that:
 *  1. Travels from `start` to `end` along a wiggly Bezier path
 *  2. Has a large emissive head with googly eyes + flicking tongue
 *  3. Body segments scale/squish with a peristaltic wave
 *  4. Leaves a glowing additive-blend particle trail
 *  5. Head glow halo pulses on beat
 *  6. Uses meshBasicMaterial + AdditiveBlending so it always looks bright
 *     regardless of scene lighting
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
  const headRef       = useRef();
  const headGlowRef   = useRef();
  const segRefs       = useRef([]);
  const eyeLeftRef    = useRef();
  const eyeRightRef   = useRef();
  const pupilLRef     = useRef();
  const pupilRRef     = useRef();
  const tongue1Ref    = useRef();
  const tongue2Ref    = useRef();  // fork tip 1
  const tongue3Ref    = useRef();  // fork tip 2
  const trailRefs     = useRef([]);
  const trailGeoRef   = useRef();

  const duration = 2.2;

  // ── Unique personality — stable across re-renders ─────────────────────────
  const p = useMemo(() => ({
    wiggleFreq   : 3.5 + Math.random() * 2.5,    // wiggles per traversal
    wiggleAmp    : 0.28 + Math.random() * 0.18,  // lateral swing amplitude
    wigglePhase  : Math.random() * Math.PI * 2,
    blinkInterval: 1.4 + Math.random() * 2.0,    // seconds between blinks
    blinkDur     : 0.12,
    squishAmp    : 0.18 + Math.random() * 0.14,  // peristaltic scale pop
    squishFreq   : 8 + Math.random() * 6,
    tongueFreq   : 12 + Math.random() * 8,
    glowPulseFreq: 2 + Math.random() * 2,
    trailFade    : 0.6 + Math.random() * 0.3,
    eyeWobble    : 0.03 + Math.random() * 0.04,
    baseScale    : 0.85 + Math.random() * 0.3,   // some worms bigger/smaller
    speedVariance: 0.85 + Math.random() * 0.3,
  }), []);

  const blinkTimerRef = useRef(0);
  const isBlinkingRef = useRef(false);

  // ── Trail line (glow tube) ─────────────────────────────────────────────────
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

    // ── 1. Progress & curve ──────────────────────────────────────────────────
    const t = (elapsed / duration) * p.speedVariance;
    const tClamped = Math.min(t, 1);
    // Quintic ease-in-out
    const progress = tClamped < 0.5
      ? 16 * tClamped ** 5
      : 1 - (-2 * tClamped + 2) ** 5 / 2;

    const vStart = _v1.set(...start);
    const vEnd   = _v2.set(...end);

    // Wiggle control point (perpendicular to direction)
    const dir = _v3.subVectors(vEnd, vStart);
    const len = dir.length();
    _normal.copy(dir).normalize();
    _right.crossVectors(_normal, _up).normalize();
    if (_right.lengthSq() < 0.001) {
      _right.set(1, 0, 0);
    }

    const wiggleT   = progress * Math.PI * p.wiggleFreq + p.wigglePhase;
    const wiggle    = Math.sin(wiggleT) * p.wiggleAmp;
    const wiggleSin = Math.cos(wiggleT) * p.wiggleAmp * 0.4; // vertical component
    const mid = new THREE.Vector3().addVectors(vStart, vEnd).multiplyScalar(0.5);
    const controlPoint = mid.clone()
      .addScaledVector(_right, wiggle * len * 0.5)
      .addScaledVector(_up, wiggleSin * len * 0.3);

    const curve = new THREE.QuadraticBezierCurve3(vStart, controlPoint, vEnd);

    // ── 2. Color interpolation ────────────────────────────────────────────────
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    const currentColor = c1.clone().lerp(c2, progress);
    // Iridescent shimmer: slight hue shift over time
    currentColor.offsetHSL(Math.sin(clockTime * 4) * 0.04, 0, 0);

    // A brighter, slightly whitened version for the head glow
    const glowColor = currentColor.clone();
    glowColor.r = Math.min(1, glowColor.r * 1.5 + 0.2);
    glowColor.g = Math.min(1, glowColor.g * 1.5 + 0.2);
    glowColor.b = Math.min(1, glowColor.b * 1.5 + 0.2);

    // ── 3. Head position & orientation ───────────────────────────────────────
    const headPos = curve.getPoint(progress);
    const lookAheadPos = curve.getPoint(Math.min(progress + 0.02, 1));
    _tangent.subVectors(lookAheadPos, headPos).normalize();

    if (headRef.current) {
      headRef.current.position.copy(headPos);
      headRef.current.material.color.copy(currentColor);
      const s = p.baseScale * (1 + Math.sin(clockTime * p.squishFreq) * p.squishAmp * 0.3);
      headRef.current.scale.setScalar(s);
      // Orient head along travel direction
      if (_tangent.lengthSq() > 0.001) {
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          _tangent
        );
        headRef.current.setRotationFromQuaternion(quat);
      }
    }

    // ── 4. Head glow halo ─────────────────────────────────────────────────────
    if (headGlowRef.current) {
      headGlowRef.current.position.copy(headPos);
      const glowPulse = 0.6 + Math.sin(clockTime * p.glowPulseFreq) * 0.4;
      headGlowRef.current.material.opacity = glowPulse * 0.35 * p.baseScale;
      headGlowRef.current.material.color.copy(glowColor);
      const gs = p.baseScale * (1.5 + glowPulse * 0.3);
      headGlowRef.current.scale.setScalar(gs);
    }

    // ── 5. Body segments — peristaltic wave ───────────────────────────────────
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = segRefs.current[i];
      if (!seg) continue;

      const lag        = (i + 1) / (SEGMENT_COUNT + 1) * 0.22;
      const segProg    = Math.max(0, progress - lag);
      const segPos     = curve.getPoint(segProg);
      const wave       = Math.sin(clockTime * p.squishFreq - i * 0.8) * p.squishAmp;
      const taper      = 1 - (i / SEGMENT_COUNT) * 0.45;
      const scaleXZ    = p.baseScale * taper * (1 + wave);
      const scaleY     = p.baseScale * taper * (1 - wave * 0.6);

      seg.position.copy(segPos);
      seg.scale.set(scaleXZ, scaleY, scaleXZ);

      // Color shifts slightly down the body
      const segColor = c1.clone().lerp(c2, segProg);
      segColor.offsetHSL(i * 0.02, 0, 0);
      seg.material.color.copy(segColor);
      seg.material.opacity = 0.85 + Math.sin(clockTime * 3 + i) * 0.1;
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
      dot.material.opacity = fade * 0.7;
      const ds = (1 - i / TRAIL_DOTS) * 0.9 * p.baseScale;
      dot.scale.setScalar(Math.max(0.1, ds));
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

    // ── 8. Eyes — positioned relative to head ─────────────────────────────────
    // Compute face-right and face-up from head orientation
    const faceRight = _right.clone().applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), _tangent)
    );
    const faceUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), _tangent)
    );

    const eyeForwardOffset = _tangent.clone().multiplyScalar(0.18 * p.baseScale);
    const eyeUpOffset      = faceUp.clone().multiplyScalar(0.09 * p.baseScale);
    const eyeLateralOffset = faceRight.clone().multiplyScalar(0.11 * p.baseScale);

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
      const pupilWobble = new THREE.Vector3(
        Math.sin(clockTime * 2.3) * p.eyeWobble,
        Math.cos(clockTime * 1.7) * p.eyeWobble + eyeWobble,
        0
      );
      ref.current.position.copy(headPos)
        .add(eyeForwardOffset)
        .addScaledVector(_tangent, 0.04 * p.baseScale)  // slightly in front of eye
        .add(eyeUpOffset)
        .addScaledVector(eyeLateralOffset, lateralSign * 2)
        .add(pupilWobble);
      ref.current.scale.setScalar(p.baseScale * (isBlinkingRef.current ? 0.05 : 0.9));
    });

    // ── 9. Forked tongue ──────────────────────────────────────────────────────
    const tongueBase = headPos.clone()
      .add(eyeForwardOffset.clone().multiplyScalar(1.4))
      .addScaledVector(faceUp, -0.07 * p.baseScale);
    const tongueLash = Math.sin(clockTime * p.tongueFreq) * 0.15;
    const tongueFork = 0.04 * p.baseScale;

    if (tongue1Ref.current) {
      tongue1Ref.current.position.copy(tongueBase);
      tongue1Ref.current.lookAt(tongueBase.clone().add(_tangent));
      const ts = p.baseScale * (1 + tongueLash * 0.3);
      tongue1Ref.current.scale.setScalar(ts);
      tongue1Ref.current.material.opacity = 0.9;
    }

    const forkTip = tongueBase.clone().addScaledVector(_tangent, 0.1 * p.baseScale);
    if (tongue2Ref.current) {
      tongue2Ref.current.position.copy(forkTip)
        .addScaledVector(faceRight, tongueFork + Math.sin(clockTime * p.tongueFreq + 1) * 0.01);
      tongue2Ref.current.material.opacity = 0.85;
      tongue2Ref.current.scale.setScalar(p.baseScale);
    }
    if (tongue3Ref.current) {
      tongue3Ref.current.position.copy(forkTip)
        .addScaledVector(faceRight, -(tongueFork + Math.sin(clockTime * p.tongueFreq + 1) * 0.01));
      tongue3Ref.current.material.opacity = 0.85;
      tongue3Ref.current.scale.setScalar(p.baseScale);
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
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>

      {/* ── Particle trail dots ──────────────────────────────────────────── */}
      {Array.from({ length: TRAIL_DOTS }, (_, i) => (
        <mesh
          key={`trail-${i}`}
          ref={el => trailRefs.current[i] = el}
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
          ref={el => segRefs.current[i] = el}
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

      {/* ── Eyes — white sclera ───────────────────────────────────────────── */}
      <mesh ref={eyeLeftRef} geometry={eyeGeo}>
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={eyeRightRef} geometry={eyeGeo}>
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── Pupils — dark with a pupil-dilation shimmer ──────────────────── */}
      <mesh ref={pupilLRef} geometry={pupilGeo}>
        <meshBasicMaterial
          color="#111111"
          transparent
          opacity={0}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={pupilRRef} geometry={pupilGeo}>
        <meshBasicMaterial
          color="#111111"
          transparent
          opacity={0}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── Tongue shaft ─────────────────────────────────────────────────── */}
      <mesh ref={tongue1Ref} geometry={tongueGeo}>
        <meshBasicMaterial
          color="#ff4477"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ── Tongue fork tips ─────────────────────────────────────────────── */}
      <mesh ref={tongue2Ref} geometry={tongueTipGeo}>
        <meshBasicMaterial
          color="#ff6699"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={tongue3Ref} geometry={tongueTipGeo}>
        <meshBasicMaterial
          color="#ff6699"
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
