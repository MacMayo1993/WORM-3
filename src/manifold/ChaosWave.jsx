/**
 * ChaosWave — lightning bolt that travels from one tile to the next.
 *
 * Visual language:
 *  • White jagged core bolt that DRAWS ITSELF along the propagation path
 *  • Electric-blue / cyan glow halo around the bolt (color depends on face)
 *  • Bright white spark HEAD riding the bolt tip — makes direction obvious
 *  • Blue ghost trail behind the head, shrinking + fading with distance
 *  • White seam-flash at the midpoint for cross-face (manifold gap) hops
 *  • Impact pop at the destination tile when the bolt arrives
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Shared geometries (no per-instance path data, safe to reuse) ─────────────
const headGeo = new THREE.SphereGeometry(0.11, 8, 8);
const ghostGeo = new THREE.SphereGeometry(0.065, 6, 6);
const impactGeo = new THREE.SphereGeometry(0.26, 8, 8);
const seamGlowGeo = new THREE.SphereGeometry(0.2, 8, 8);
// Large plane covering an entire cube face — reused across all cross-face bolts
const faceBloomGeo = new THREE.PlaneGeometry(7, 7);

// Reusable vectors — avoids per-frame GC pressure
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// ─── Constants ────────────────────────────────────────────────────────────────
const JITTER_SEGS = 10; // points in the jagged path (including endpoints)
const GHOST_COUNT = 4;
const GHOST_GAP = 0.09; // fraction of path length between ghost positions

// ─── Pure path helpers ────────────────────────────────────────────────────────

/**
 * Build a jagged polyline from `from` to `to` using random perpendicular jitter.
 * Jitter tapers to zero at both endpoints so the bolt always starts and ends
 * exactly on the tile surface positions.
 */
const makePath = (from, to, segs = JITTER_SEGS, jitter = 0.22) => {
  const f = new THREE.Vector3(...from);
  const t = new THREE.Vector3(...to);
  const along = new THREE.Vector3().subVectors(t, f);
  const len = along.length();

  if (len < 0.01) return [f.clone(), t.clone()]; // degenerate guard

  along.normalize();

  // Two stable perpendicular axes for 3-D jitter
  const ref = Math.abs(along.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const p1 = new THREE.Vector3().crossVectors(along, ref).normalize();
  const p2 = new THREE.Vector3().crossVectors(along, p1).normalize();

  const pts = [f.clone()];
  for (let i = 1; i < segs; i++) {
    const frac = i / segs;
    const pt = new THREE.Vector3().lerpVectors(f, t, frac);
    // sin-taper: max jitter at midpoint, zero at both ends
    const taper = Math.sin(frac * Math.PI);
    const j = jitter * taper * len;
    pt.addScaledVector(p1, (Math.random() - 0.5) * 2 * j);
    pt.addScaledVector(p2, (Math.random() - 0.5) * 2 * j);
    pts.push(pt);
  }
  pts.push(t.clone());
  return pts;
};

/**
 * Interpolate a position along a polyline at fraction t ∈ [0, 1].
 * Writes into `out` (THREE.Vector3) and returns it.
 */
const pathAt = (pts, t, out) => {
  const maxSeg = pts.length - 1;
  const s = Math.min(t * maxSeg, maxSeg - 1e-6);
  const si = Math.floor(s);
  out.lerpVectors(pts[si], pts[si + 1], s - si);
  return out;
};

// ─── Component ────────────────────────────────────────────────────────────────

const ChaosWave = ({ from, to, crossFace = false, onComplete }) => {
  const progressRef = useRef(0);
  const completedRef = useRef(false);

  const headRef = useRef();
  const ghostRefs = useRef([]);
  const coreRef = useRef();      // white bolt (line)
  const glowRef = useRef();      // blue/cyan halo (line, lags behind core)
  const impactRef = useRef();    // destination flash
  const seamRef = useRef();      // seam glow (cross-face only)
  const faceBloomRef = useRef(); // whole-face bloom overlay (cross-face only)

  // ── Stable jagged path — one generation per cascade ──────────────────────
  const path = useMemo(() => makePath(from, to), [from, to]);

  // ── Per-instance line geometries (unique path, so cannot be shared) ───────
  const coreGeo = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(path);
    g.setDrawRange(0, 0); // invisible until the first useFrame tick
    return g;
  }, [path]);

  const glowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(path);
    g.setDrawRange(0, 0);
    return g;
  }, [path]);

  // Dispose per-instance geometries when the component unmounts
  useEffect(() => () => { coreGeo.dispose(); glowGeo.dispose(); }, [coreGeo, glowGeo]);

  // ── Color palette ─────────────────────────────────────────────────────────
  // Same-face:   white core, electric-blue glow
  // Cross-face:  white core, cyan glow (the manifold "jump" feels colder)
  const glowColor = crossFace ? '#00ccff' : '#3377ff';
  const ghostColor = crossFace ? '#80eeff' : '#6699ff';

  // Cross-face bolts travel through the manifold gap → slight speed reduction
  // so the seam glow has time to read
  const speed = crossFace ? 1.8 : 2.5;

  // Infer source face position + orientation from the `from` sticker position.
  // The sticker's 0.52 offset along its face normal makes that axis dominant.
  const faceBloomProps = useMemo(() => {
    if (!crossFace) return null;
    const [fx, fy, fz] = from;
    const ax = Math.abs(fx), ay = Math.abs(fy), az = Math.abs(fz);
    if (ax >= ay && ax >= az) {
      return fx > 0
        ? { pos: [fx, 0, 0], rot: [0, Math.PI / 2, 0] }
        : { pos: [fx, 0, 0], rot: [0, -Math.PI / 2, 0] };
    }
    if (ay >= ax && ay >= az) {
      return fy > 0
        ? { pos: [0, fy, 0], rot: [-Math.PI / 2, 0, 0] }
        : { pos: [0, fy, 0], rot: [Math.PI / 2, 0, 0] };
    }
    return fz > 0
      ? { pos: [0, 0, fz], rot: [0, 0, 0] }
      : { pos: [0, 0, fz], rot: [0, Math.PI, 0] };
  }, [crossFace, from]);

  useFrame((_, delta) => {
    if (completedRef.current) return;

    const p = Math.min(1, progressRef.current + delta * speed);
    progressRef.current = p;

    const N = path.length;

    // ── Core white bolt: grow from source toward head via drawRange ──────────
    if (coreRef.current) {
      const count = Math.max(2, Math.ceil(p * (N - 1)) + 1);
      coreRef.current.geometry.setDrawRange(0, count);
      // Tail fades slightly after the head passes its half-way mark
      const tailFade = p < 0.5 ? 1.0 : Math.max(0.2, 1 - (p - 0.5) * 1.2);
      coreRef.current.material.opacity = tailFade * 0.9;
    }

    // ── Blue/cyan glow halo: same path, lags 0.08 s behind the core ─────────
    if (glowRef.current) {
      const gp = Math.max(0, p - 0.08);
      const gc = Math.max(2, Math.ceil(gp * (N - 1)) + 1);
      glowRef.current.geometry.setDrawRange(0, gc);
      glowRef.current.material.opacity = Math.max(0, 0.55 - p * 0.45);
    }

    // ── Spark head: bright white sphere at the bolt tip ───────────────────────
    if (headRef.current) {
      pathAt(path, p, _a);
      headRef.current.position.copy(_a);
      headRef.current.material.opacity = Math.max(0, 1 - p * 0.35);
    }

    // ── Ghost trail: shrinking + fading blue spheres behind the head ──────────
    for (let i = 0; i < GHOST_COUNT; i++) {
      const g = ghostRefs.current[i];
      if (!g) continue;
      const gp = Math.max(0, p - (i + 1) * GHOST_GAP);
      pathAt(path, gp, _b);
      g.position.copy(_b);
      const fade = Math.max(0, (1 - p * 0.55) * (1 - (i + 1) / (GHOST_COUNT + 1)));
      g.material.opacity = fade * 0.55;
      g.scale.setScalar(Math.max(0.1, 1 - (i + 1) * 0.18));
    }

    // ── Seam glow: white flash at the midpoint on cross-face hops ────────────
    // Gaussian peak when the head crosses the midpoint (p ≈ 0.5)
    if (crossFace && seamRef.current) {
      const d = Math.abs(p - 0.5);
      const intensity = Math.exp(-(d * d) / 0.025);
      seamRef.current.material.opacity = intensity * 0.75;
      seamRef.current.scale.setScalar(0.6 + intensity * 1.8);
    }

    // ── Face bloom: broad 30% additive wash over the whole source manifold face ─
    // Broader Gaussian than the seam glow, so the face lights up softly around
    // the seam crossing and fades before/after the bolt completes.
    if (crossFace && faceBloomRef.current) {
      const d = p - 0.5;
      const bloomIntensity = Math.exp(-(d * d) / 0.12);
      faceBloomRef.current.material.opacity = bloomIntensity * 0.3;
    }

    // ── Impact flash: sin-bell centered just before arrival ───────────────────
    // Rises from p=0.65, peaks at p=0.825, back to 0 at p=1.0
    if (impactRef.current) {
      const t0 = 0.65;
      const bang = p > t0 ? Math.sin(Math.min(1, (p - t0) / (1 - t0)) * Math.PI) : 0;
      impactRef.current.material.opacity = bang * (crossFace ? 0.85 : 0.6);
      impactRef.current.scale.setScalar(1 + bang * (crossFace ? 2.2 : 1.4));
    }

    if (p >= 1 && !completedRef.current) {
      completedRef.current = true;
      if (onComplete) onComplete();
    }
  });

  // Midpoint for the seam glow sphere (cross-face only)
  const midPos = useMemo(
    () => new THREE.Vector3(...from).lerp(new THREE.Vector3(...to), 0.5).toArray(),
    [from, to]
  );

  return (
    <group>
      {/* Blue/cyan glow halo — grows just behind the core bolt */}
      <line ref={glowRef} geometry={glowGeo}>
        <lineBasicMaterial
          color={glowColor}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>

      {/* White core bolt — grows from source tile toward destination */}
      <line ref={coreRef} geometry={coreGeo}>
        <lineBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>

      {/* Ghost trail — blue/cyan spheres following the spark head */}
      {Array.from({ length: GHOST_COUNT }, (_, i) => (
        <mesh key={i} ref={(el) => { ghostRefs.current[i] = el; }} geometry={ghostGeo}>
          <meshBasicMaterial
            color={ghostColor}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Spark head — bright white sphere at the leading edge of the bolt */}
      <mesh ref={headRef} geometry={headGeo}>
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Seam glow — white pulse at the manifold crossing (cross-face only) */}
      {crossFace && (
        <mesh ref={seamRef} geometry={seamGlowGeo} position={midPos}>
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Face bloom — 30% additive wash lighting the whole source manifold face */}
      {crossFace && faceBloomProps && (
        <mesh
          ref={faceBloomRef}
          geometry={faceBloomGeo}
          position={faceBloomProps.pos}
          rotation={faceBloomProps.rot}
        >
          <meshBasicMaterial
            color="#00ccff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>
      )}

      {/* Impact flash — glow burst at the destination tile on arrival */}
      <mesh ref={impactRef} geometry={impactGeo} position={to}>
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

export default ChaosWave;
