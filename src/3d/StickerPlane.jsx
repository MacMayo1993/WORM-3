import React, { useRef, useEffect, useLayoutEffect, useMemo, useImperativeHandle, useState } from 'react';
import { easeInOutCubic } from '../utils/easing.js';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, FACE_COLORS, ANTIPODAL_COLOR, FLIP_CAP } from '../utils/constants.js';
import { play, vibrate } from '../utils/audio.js';
import TallyMarks from '../manifold/TallyMarks.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { FACE_CITIES, CITY_CONFIG } from '../modes/CityBiomeMode.js';
import CityBuildings from './CityBuildings.jsx';
import { BiomeGLBCluster, isGLBActive, isGLBFullFace } from './BiomeGLBCluster.jsx';
import { SeamPulseOverlay } from './SeamPulseOverlay.jsx';
import { getTileStyleMaterial, getGlassMaterial, sharedTremorState, flipBurstMap } from './styles/TileStyleMaterials.jsx';
import { useStickerInstances } from './StickerInstances.jsx';
import { getManifoldGridId } from '../game/coordinates.js';
import GrassBlades from './styles/GrassBlades.jsx';
import WaterVolume from './styles/WaterVolume.jsx';
import LavaVolume from './styles/LavaVolume.jsx';
import IceVolume from './styles/IceVolume.jsx';
import GalaxyVolume from './styles/GalaxyVolume.jsx';
import NeuralVolume from './styles/NeuralVolume.jsx';
import CircuitVolume from './styles/CircuitVolume.jsx';
import WoodVolume from './styles/WoodVolume.jsx';
import { BIOME_GROUND_TEXTURES } from './BiomeGroundTextures.js';
import { resolveColors } from '../utils/colorSchemes.js';

// Shared geometries for all particle/glow systems (created once, reused globally)
const sharedParticleGeometry = new THREE.PlaneGeometry(1, 1);
const sharedOuterRingGeometry = new THREE.RingGeometry(0.4, 0.5, 16);
const sharedMainRingGeometry = new THREE.RingGeometry(0.2, 0.45, 16);
const sharedInnerCircleGeometry = new THREE.CircleGeometry(0.48, 16);
// Shared sticker plane geometry for stickers that don't need per-instance UV customisation.
// (Stickers with face textures — Sudokube mode — still create their own geometry so UVs can
// be patched per-sticker via geoRef.  All others share this one buffer.)
const _sharedStickerGeo = new THREE.PlaneGeometry(0.85, 0.85);
// Shared ring/circle geometries for wormhole and flip-history indicators (created once, reused globally).
const sharedRing38_41 = new THREE.RingGeometry(0.38, 0.41, 16); // orig-color border ring
const sharedRing35_38 = new THREE.RingGeometry(0.35, 0.38, 16); // antipodal-color border ring
const sharedRing36_40 = new THREE.RingGeometry(0.36, 0.40, 16); // wormhole pulsing ring
const sharedCircle44 = new THREE.CircleGeometry(0.44, 16);       // wormhole glow fill
// Scratch Object3D for FlipParticles matrix math — never added to a scene.
const _particleDummy = new THREE.Object3D();
// Scratch vectors for biome edge-on fade — allocated once, reused every frame.
const _normal = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();

// Shared geometries for ParityBreakthrough — one set allocated at module level,
// reused across all flipped-sticker instances (avoids per-sticker GPU buffer uploads).
const _pbBackGlowGeo = new THREE.PlaneGeometry(0.84, 0.84);
const _pbThroughGlowGeo = new THREE.PlaneGeometry(0.82, 0.82);
const _pbEdgeHGeo = new THREE.PlaneGeometry(0.84, 0.08); // top + bottom bars
const _pbEdgeVGeo = new THREE.PlaneGeometry(0.08, 0.84); // left + right bars
// Pre-allocated crack geometries (8 possible sizes, indexed in the same order as the
// CRACK_DATA array below).
const _pbCrackGeos = [
  new THREE.PlaneGeometry(0.38, 0.018),
  new THREE.PlaneGeometry(0.42, 0.016),
  new THREE.PlaneGeometry(0.34, 0.017),
  new THREE.PlaneGeometry(0.36, 0.015),
  new THREE.PlaneGeometry(0.24, 0.014),
  new THREE.PlaneGeometry(0.28, 0.013),
  new THREE.PlaneGeometry(0.20, 0.012),
  new THREE.PlaneGeometry(0.22, 0.012),
];
// Crack definitions — stable module-level constant so useMemo can reference it.
const _PB_CRACKS_BASE = [
  { pos: [0.12, 0.40, 0.004], rot: 0.08, geoIdx: 0 },
  { pos: [-0.08, -0.39, 0.004], rot: -0.12, geoIdx: 1 },
  { pos: [0.39, 0.06, 0.004], rot: 1.52, geoIdx: 2 },
  { pos: [-0.38, -0.05, 0.004], rot: 1.62, geoIdx: 3 },
];
const _PB_CRACKS_L2 = [
  { pos: [0.22, -0.18, 0.004], rot: 0.75, geoIdx: 4 },
  { pos: [-0.18, 0.24, 0.004], rot: -0.6, geoIdx: 5 },
];
const _PB_CRACKS_L3 = [
  { pos: [0.05, 0.12, 0.004], rot: 1.1, geoIdx: 6 },
  { pos: [-0.1, -0.15, 0.004], rot: -0.9, geoIdx: 7 },
];
// Grid-edge glow bar positions — stable module-level constant.
const _PB_GRID_EDGES = [
  { pos: [0, 0.44, -0.005], horiz: true },   // top
  { pos: [0, -0.44, -0.005], horiz: true },  // bottom
  { pos: [0.44, 0, -0.005], horiz: false },  // right
  { pos: [-0.44, 0, -0.005], horiz: false }, // left
];

// Shared geometries for Worm segments (scale=1, the common default).
const _wormGeoHead = new THREE.SphereGeometry(0.022, 8, 8);
const _wormGeoSeg1 = new THREE.SphereGeometry(0.018, 6, 6);
const _wormGeoSeg2 = new THREE.SphereGeometry(0.017, 6, 6);
const _wormGeoSeg3 = new THREE.SphereGeometry(0.015, 6, 6);
const _wormGeoTail = new THREE.SphereGeometry(0.011, 6, 6);

// Frame-shaped sticker Shape for hollow cube mode (square with rectangular hole).
// Store the Shape, not the Geometry — each sticker creates its own ShapeGeometry
// instance via declarative <shapeGeometry>, so R3F can safely dispose per-instance.
// Stable city cache — keyed on origDir + origPos which are truly permanent.
// Populated on first render before any rotation can corrupt meta.orig.

const _stickerFrameShape = (() => {
  const outer = 0.425; // half of 0.85 sticker size
  const inner = 0.34;  // inner hole half-size — wider opening, thinner colour border
  const shape = new THREE.Shape();
  shape.moveTo(-outer, -outer);
  shape.lineTo(outer, -outer);
  shape.lineTo(outer, outer);
  shape.lineTo(-outer, outer);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-inner, -inner);
  hole.lineTo(-inner, inner);
  hole.lineTo(inner, inner);
  hole.lineTo(inner, -inner);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
})();

// Particle system for flip effect — single InstancedMesh, 1 draw call for all 12 particles.
// Uses forwardRef + useImperativeHandle so the parent calls ref.trigger(color) imperatively
// instead of toggling useState, which caused a full StickerPlane re-render on every flip.
const FlipParticles = React.forwardRef((_props, ref) => {
  const meshRef = useRef();
  const progressRef = useRef(0);
  const velocitiesRef = useRef([]);
  const isActiveRef = useRef(false);
  const PARTICLE_COUNT = 12;

  // Expose .trigger(color) — called imperatively from the parent's useEffect.
  useImperativeHandle(ref, () => ({
    trigger(color) {
      if (isActiveRef.current) return; // already animating — ignore re-entrant call
      isActiveRef.current = true;
      progressRef.current = 0;
      velocitiesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 2.5 + Math.random() * 2.0;
        return {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
          z: (Math.random() - 0.5) * 1.5,
          rotSpeed: (Math.random() - 0.5) * 15,
          size: 0.06 + Math.random() * 0.06
        };
      });
      if (meshRef.current?.material) {
        meshRef.current.material.color.set(color);
        meshRef.current.material.opacity = 1;
      }
    }
  }), []);

  // Zero-scale all instances on mount so they're invisible before first activation.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    _particleDummy.scale.set(0, 0, 0);
    _particleDummy.updateMatrix();
    for (let i = 0; i < PARTICLE_COUNT; i++) mesh.setMatrixAt(i, _particleDummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !isActiveRef.current) return;

    progressRef.current += delta * 1.8;
    const p = progressRef.current;

    if (p >= 1) {
      isActiveRef.current = false;
      // Collapse all instances to hide them.
      _particleDummy.scale.set(0, 0, 0);
      _particleDummy.updateMatrix();
      for (let i = 0; i < PARTICLE_COUNT; i++) mesh.setMatrixAt(i, _particleDummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.material) mesh.material.opacity = 0;
      return;
    }

    const easeOut = 1 - Math.pow(1 - p, 4);
    const opacity = Math.pow(1 - p, 0.5);
    if (mesh.material) mesh.material.opacity = opacity;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const vel = velocitiesRef.current[i];
      if (!vel) continue;
      _particleDummy.position.set(vel.x * easeOut * 0.8, vel.y * easeOut * 0.8, vel.z * easeOut * 0.4);
      _particleDummy.rotation.set(0, 0, vel.rotSpeed * p);
      const baseScale = vel.size * (1 - easeOut * 0.5);
      _particleDummy.scale.set(baseScale, baseScale, baseScale * 0.5);
      _particleDummy.updateMatrix();
      mesh.setMatrixAt(i, _particleDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Single instancedMesh — 1 draw call replaces 12 individual meshes.
  return (
    <instancedMesh
      ref={meshRef}
      args={[sharedParticleGeometry, null, PARTICLE_COUNT]}
      position={[0, 0, 0.05]}
    >
      <meshBasicMaterial
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  );
});

// Antipodal glow fill effect - glows from outside and fills inward
// Uses persistent meshes with shared geometries
const AntipodalGlowFill = ({ active, color }) => {
  const ringRef = useRef();
  const innerGlowRef = useRef();
  const outerRingRef = useRef();
  const progressRef = useRef(0);
  const isActiveRef = useRef(false);

  // Create materials immediately so they are available on the first render.
  // Using useRef(new Material()) guarantees mesh.material is set correctly by
  // R3F on the very first render — useEffect runs after render so refs initialized
  // to null leave meshes with null material (skipped by Three.js renderer).
  const outerMatRef = useRef(new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const ringMatRef = useRef(new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const innerMatRef = useRef(new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));

  useEffect(() => {
    return () => {
      outerMatRef.current?.dispose();
      ringMatRef.current?.dispose();
      innerMatRef.current?.dispose();
    };
  }, []);

  // Handle activation
  useEffect(() => {
    if (active && !isActiveRef.current) {
      isActiveRef.current = true;
      progressRef.current = 0;
      // Update colors
      if (outerMatRef.current) outerMatRef.current.color.set(color);
      if (ringMatRef.current) ringMatRef.current.color.set(color);
      if (innerMatRef.current) innerMatRef.current.color.set(color);
    } else if (!active) {
      isActiveRef.current = false;
      // Hide materials
      if (outerMatRef.current) outerMatRef.current.opacity = 0;
      if (ringMatRef.current) ringMatRef.current.opacity = 0;
      if (innerMatRef.current) innerMatRef.current.opacity = 0;
    }
  }, [active, color]);

  useFrame((_, delta) => {
    if (!isActiveRef.current) return;

    progressRef.current = Math.min(1, progressRef.current + delta * 5);
    const progress = progressRef.current;
    const snappyProgress = 1 - Math.pow(1 - progress, 3);

    if (ringRef.current) {
      const ringScale = Math.max(0.01, 1 - snappyProgress);
      ringRef.current.scale.set(ringScale, ringScale, 1);
      const glowPulse = Math.sin(progress * Math.PI * 4) * 0.3 + 0.7;
      ringMatRef.current.opacity = (1 - snappyProgress * 0.3) * glowPulse * 0.9;
    }

    if (outerRingRef.current) {
      const edgeScale = Math.max(0.01, 1.1 - snappyProgress * 0.8);
      outerRingRef.current.scale.set(edgeScale, edgeScale, 1);
      outerMatRef.current.opacity = (1 - snappyProgress) * 0.6;
    }

    if (innerGlowRef.current) {
      const fillScale = snappyProgress * 0.95;
      innerGlowRef.current.scale.set(fillScale, fillScale, 1);
      const fillOpacity = Math.sin(progress * Math.PI) * 0.7;
      innerMatRef.current.opacity = fillOpacity;
    }
  });

  // Always render, just hidden when not active
  return (
    <group position={[0, 0, 0.025]}>
      <mesh ref={outerRingRef} geometry={sharedOuterRingGeometry} material={outerMatRef.current} scale={[0, 0, 0]} />
      <mesh ref={ringRef} geometry={sharedMainRingGeometry} material={ringMatRef.current} scale={[0, 0, 0]} />
      <mesh ref={innerGlowRef} position={[0, 0, -0.005]} geometry={sharedInnerCircleGeometry} material={innerMatRef.current} scale={[0, 0, 0]} />
    </group>
  );
};

// Persistent "parity breaking through" effect for flipped tiles.
// Square glow fills the full cubie face (0.98×0.98 > 0.85 sticker) so the
// original color's light shines outward through the black grid lines.
const ParityBreakthrough = ({ origColor, flipCount }) => {
  const backGlowRef = useRef();
  const throughGlowRef = useRef();
  const cracksRef = useRef([]);
  const edgesRef = useRef([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const intensity = Math.min(0.4 + flipCount * 0.25, 1.5);

    // Surge is pre-computed once per frame by CubeAssembly via updateSharedTremor.
    // Reading the shared value avoids 3×sin + pow + max per ParityBreakthrough
    // instance (one per wormhole sticker) every frame.
    const surge = sharedTremorState.surge;

    // Back glow — fills the cubie face, light bleeds through grid gaps
    if (backGlowRef.current) {
      backGlowRef.current.material.opacity = (0.2 + surge * 0.5) * intensity;
      const s = 1.0 + surge * 0.08;
      backGlowRef.current.scale.set(s, s, 1);
    }

    // Through-glow on front face during surges
    if (throughGlowRef.current) {
      throughGlowRef.current.material.opacity = surge * 0.25 * intensity;
    }

    // Grid-edge glow bars — these sit right at the sticker borders to
    // simulate light pouring through the grid lines
    edgesRef.current.forEach((ref) => {
      if (!ref) return;
      ref.material.opacity = (0.15 + surge * 0.55) * intensity;
    });

    // Surface cracks pulse with staggered timing
    cracksRef.current.forEach((ref, i) => {
      if (!ref) return;
      const crackPulse = Math.pow(Math.max(0, Math.sin(t * 2.0 + i * 1.3)), 3.0);
      ref.material.opacity = (0.08 + crackPulse * 0.5 + surge * 0.35) * intensity;
    });
  });

  // Cracks scale with flips — more damage = more fractures.
  // Uses module-level _PB_CRACKS_* constants (no per-render allocation).
  const cracks = useMemo(() => {
    const base = [..._PB_CRACKS_BASE];
    if (flipCount >= 2) base.push(..._PB_CRACKS_L2);
    if (flipCount >= 3) base.push(..._PB_CRACKS_L3);
    return base;
  }, [flipCount]);

  return (
    <group>
      {/* Back glow — kept within sticker bounds (0.84 < 0.85 sticker) so the opaque
          sticker fully occludes it via depth test. Corners of a 0.98-wide plane would
          poke through the RoundedBox corner curves (radius=0.08) into empty space,
          creating visible blobs at cube corners where 3 tiles converge. */}
      <mesh ref={backGlowRef} position={[0, 0, -0.018]}>
        <primitive object={_pbBackGlowGeo} attach="geometry" />
        <meshBasicMaterial
          color={origColor}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
          depthWrite={false}
        />
      </mesh>

      {/* Grid-edge glow bars — light pouring through the black grid lines */}
      {_PB_GRID_EDGES.map((edge, i) => (
        <mesh
          key={`edge-${i}`}
          ref={el => edgesRef.current[i] = el}
          position={edge.pos}
        >
          <primitive object={edge.horiz ? _pbEdgeHGeo : _pbEdgeVGeo} attach="geometry" />
          <meshBasicMaterial
            color={origColor}
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            side={THREE.FrontSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Through-glow — original color bleeding through front during surges */}
      <mesh ref={throughGlowRef} position={[0, 0, 0.002]}>
        <primitive object={_pbThroughGlowGeo} attach="geometry" />
        <meshBasicMaterial
          color={origColor}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Surface cracks — light leaking through fractures */}
      {cracks.map((crack, i) => (
        <mesh
          key={i}
          ref={el => cracksRef.current[i] = el}
          position={crack.pos}
          rotation={[0, 0, crack.rot]}
        >
          <primitive object={_pbCrackGeos[crack.geoIdx]} attach="geometry" />
          <meshBasicMaterial
            color={origColor}
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// Worm component for disparity visualization.
// Lies flat on the tile surface and undulates with a travelling sine wave.
const Worm = ({ position, rotation, scale = 1 }) => {
  const headRef = useRef();
  const seg1Ref = useRef();
  const seg2Ref = useRef();
  const seg3Ref = useRef();
  const tailRef = useRef();

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    // Travelling sine wave — each segment is phase-shifted along the body
    const freq = 3.5;
    const amp  = 0.020 * scale;
    const refs = [headRef, seg1Ref, seg2Ref, seg3Ref, tailRef];
    refs.forEach((ref, i) => {
      if (!ref.current) return;
      ref.current.position.y = Math.sin(time * freq - i * 0.70 + rotation) * amp;
    });
  });

  const sp = 0.025 * scale; // spacing between segments along body axis

  return (
    // Rotate the group so the worm faces tangentially around the tile circle.
    // rotation = angle of this worm's orbit position; +PI/2 = 90° = tangent direction.
    <group position={position} rotation={[0, 0, rotation + Math.PI / 2]}>
      {/* Head — round, slightly larger and lighter */}
      <mesh ref={headRef} position={[sp * 2, 0, 0.016]}>
        <primitive object={_wormGeoHead} attach="geometry" />
        <meshBasicMaterial color="#dda15e" />
      </mesh>
      {/* Body segment 1 */}
      <mesh ref={seg1Ref} position={[sp, 0, 0.015]}>
        <primitive object={_wormGeoSeg1} attach="geometry" />
        <meshBasicMaterial color="#bc6c25" />
      </mesh>
      {/* Body segment 2 */}
      <mesh ref={seg2Ref} position={[0, 0, 0.015]}>
        <primitive object={_wormGeoSeg2} attach="geometry" />
        <meshBasicMaterial color="#a05c20" />
      </mesh>
      {/* Body segment 3 */}
      <mesh ref={seg3Ref} position={[-sp, 0, 0.015]}>
        <primitive object={_wormGeoSeg3} attach="geometry" />
        <meshBasicMaterial color="#bc6c25" />
      </mesh>
      {/* Tail — smallest segment */}
      <mesh ref={tailRef} position={[-sp * 2, 0, 0.015]}>
        <primitive object={_wormGeoTail} attach="geometry" />
        <meshBasicMaterial color="#a05c20" />
      </mesh>
    </group>
  );
};

// Thin flip-pressure bar at the bottom edge of a sticker face.
// Visible only during Disparity Mode on live tiles (not dead/headstoned).
const DisparityHealthBar = React.memo(function DisparityHealthBar({ flips, flipCap }) {
  const pct = Math.min(flips / flipCap, 1);
  if (pct <= 0) return null; // un-flipped tiles show nothing

  const barColor = pct < 0.33 ? '#22c55e' : pct < 0.66 ? '#f97316' : '#ef4444';
  const isFlashing = pct >= 0.9;
  const barWidth = pct * 0.82; // max 0.82 units = sticker width minus margin

  return (
    <group position={[0, -0.41, 0.002]}>
      {/* Background track */}
      <mesh>
        <planeGeometry args={[0.82, 0.05]} />
        <meshBasicMaterial color="#111111" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* Fill bar — left-aligned so it shrinks from right */}
      <mesh position={[-(0.82 - barWidth) / 2, 0, 0.001]}>
        <planeGeometry args={[barWidth, 0.05]} />
        <meshBasicMaterial
          color={barColor}
          transparent
          opacity={isFlashing ? 1.0 : 0.85}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
});

const StickerPlane = function StickerPlane({ meta, pos, rot = [0, 0, 0], overlay, mode, faceRow, faceCol, faceSize, hollow, currentDir: _currentDir }) {
  // Batch all store reads into a single subscription to minimize Zustand overhead.
  // With 54 stickers on a 3×3 cube, separate selectors = many subscriptions;
  // one combined selector with shallow equality keeps it to 54 subscriptions.
  const { biomeEnabled, chaosLevel, disparityFlipCap, disparityWinner, settings, faceTextures, disparityDeaths } = useGameStore(
    useShallow((s) => ({
      biomeEnabled: s.settings?.biomeMode?.enabled ?? false,
      chaosLevel: s.chaosLevel,
      disparityFlipCap: s.disparityFlipCap,
      disparityWinner: s.disparityWinner,
      settings: s.settings,
      faceTextures: s.faceTextures,
      disparityDeaths: s.disparityDeaths,
    }))
  );
  const fc = resolveColors(settings, settings?.biomeMode?.faceAssignment) || FACE_COLORS;
  const manifoldStyles = settings?.manifoldStyles;
  // In Disparity Mode (chaosLevel > 0), use the configurable flip cap; otherwise the global constant
  const effectiveFlipCap = chaosLevel > 0 ? disparityFlipCap : FLIP_CAP;
  // Dead tiles (at flip cap) are inert gray — used in useFrame and rendering
  const isDead = (meta?.flips ?? 0) >= effectiveFlipCap;
  const groupRef = useRef();
  const innerGroupRef = useRef(); // inner UV-rotation group — used for InstancedMesh world matrix
  const meshRef = useRef();
  const cityGroupRef = useRef();
  const geoRef = useRef();

  // ── InstancedMesh batch integration ─────────────────────────────────────────
  const instanceCtx = useStickerInstances();
  // THREE.Color kept in sync with the current material colour; manager reads it
  // each frame to upload per-instance colour without any allocation.
  const instanceColorRef = useRef(new THREE.Color());
  // true  → this sticker is handled by the InstancedMesh (no individual <mesh>)
  // false → individual <mesh> renders (complex / animating sticker, or no ctx)
  const isInstancedRef = useRef(false);
  const instanceIdRef = useRef(-1);
  const ringRef = useRef();
  const glowRef = useRef();
  const spinT = useRef(0);
  const shakeT = useRef(0);
  const pulseT = useRef(0);
  // Single boolean gate: skip the entire useFrame body on idle frames.
  // Cleared when all transient effects (flip, shake, tremor) finish, avoiding
  // the multi-condition bail-out that evaluated several ref lookups every frame.
  const isActiveRef = useRef(false);
  const flipFromColor = useRef(null);
  const flipToColor = useRef(null);
  const flipFromTexture = useRef(null);
  const flipToTexture = useRef(null);
  // Track if we're currently in a flip animation - prevents race condition
  // between React state updates and Three.js imperative rendering
  const isFlipping = useRef(false);
  // Previous rawP value — used to detect the exact frame the midpoint is crossed.
  const prevRawP = useRef(0);
  // Death animation: -1 = not started (idle), 0–1 = imploding, 1 = done (show headstone)
  // Start at 1 so tiles that load already-dead show headstone immediately without animation.
  const deathAnimT = useRef(isDead ? 1 : -1);
  const wasDeadRef = useRef(isDead);
  const [deathAnimDone, setDeathAnimDone] = useState(isDead);
  // Flash timer for ring opacity spike at midpoint crossing; decays to 0 in useFrame.
  const ringFlashRef = useRef(0);
  // Overlay ref for antipodal color bleed during flip transitions.
  const flipOverlayRef = useRef();
  // Stable gridId for this sticker — written to flipBurstMap during flips so
  // WormholeTunnel can read the burst progress without prop drilling.
  // origPos/origDir/orig never change so this is computed once.
  const stickerGridIdRef = useRef(meta ? getManifoldGridId(meta, faceSize) : null);
  // Live ref to current texture so useFrame closures can access it without stale captures.
  const currTextureRef = useRef(null);

  // Death rank from Disparity Mode — null if not in disparity game or tile not yet dead
  const deadRank = isDead ? (disparityDeaths?.find(d => d.gridId === stickerGridIdRef.current)?.rank ?? null) : null;
  // Winner tile — glows gold after the last pair is found
  const isWinnerTile = chaosLevel > 0 && !!(disparityWinner?.pair?.includes(stickerGridIdRef.current));

  // Imperative ref to FlipParticles — avoids re-rendering StickerPlane on every flip.
  const flipParticlesRef = useRef();

  // Register with the InstancedMesh batch manager.
  // useLayoutEffect so registration completes before the first WebGL frame —
  // the provider's useLayoutEffect (runs after children's) will have already
  // added the InstancedMesh to the scene.
  useLayoutEffect(() => {
    if (!instanceCtx) return;
    const id = instanceCtx.register(innerGroupRef, instanceColorRef, isInstancedRef);
    instanceIdRef.current = id;
    return () => {
      if (instanceIdRef.current >= 0) {
        instanceCtx.unregister(instanceIdRef.current);
        instanceIdRef.current = -1;
      }
    };
  }, [instanceCtx]);

  // Death detection: trigger implosion animation when tile first hits flip cap.
  // Also handles game reset: when isDead goes false (new game), clear all death state
  // so tombstones from a previous game don't carry over.
  useEffect(() => {
    if (isDead && !wasDeadRef.current) {
      wasDeadRef.current = true;
      deathAnimT.current = 0; // start implosion
    } else if (!isDead && wasDeadRef.current) {
      // Game was reset — wipe the death animation so no stale tombstone shows
      wasDeadRef.current = false;
      deathAnimT.current = -1;
      setDeathAnimDone(false);
    }
  }, [isDead]);

  const prevCurr = useRef(meta?.curr ?? 0);
  useEffect(() => {
    const curr = meta?.curr ?? 0;
    const prevVal = prevCurr.current;

    // Only trigger flip animation if the color actually changed to its antipodal
    if (curr !== prevVal && meta?.flips > 0 && ANTIPODAL_COLOR[prevVal] === curr) {
      // Mark as animating to prevent React state from interrupting
      isFlipping.current = true;
      // Store the colors for the flip animation
      // flipToColor is the ANTIPODAL color (what we're flipping TO)
      flipFromColor.current = fc[prevVal];
      flipToColor.current = fc[curr];
      // Texture follows city identity — use biome ground textures in biome mode
      if (biomeEnabled && meta?.orig) {
        const newFlips = meta?.flips ?? 0;
        // newFlips is already incremented. Odd = we just flipped TO antipodal; even = flipped back.
        const fromFace = newFlips % 2 === 1
          ? meta.orig
          : (ANTIPODAL_COLOR[meta.orig] ?? meta.orig);
        const toFace = newFlips % 2 === 1
          ? (ANTIPODAL_COLOR[meta.orig] ?? meta.orig)
          : meta.orig;
        flipFromTexture.current = BIOME_GROUND_TEXTURES[FACE_CITIES[fromFace]] ?? null;
        flipToTexture.current = BIOME_GROUND_TEXTURES[FACE_CITIES[toFace]] ?? null;
      } else {
        flipFromTexture.current = faceTextures?.[prevVal] || null;
        flipToTexture.current = faceTextures?.[curr] || null;
      }
      spinT.current = 1;
      prevRawP.current = 0;

      flipParticlesRef.current?.trigger(fc[curr]);

      play('/sounds/flip.mp3');
      vibrate(16);
    }
    prevCurr.current = curr;
  }, [meta?.curr, meta?.flips]);

  // Biome mode: restore anything left in transparent or hidden state from previous code —
  // runs once when biomeEnabled flips rather than every frame. FrontSide culling on the
  // sticker plane handles back-facing fragments; depth testing handles building occlusion.
  // The per-frame version caused the octagonal-flash artifact as tiles crossed rawDot=0.
  useLayoutEffect(() => {
    if (!biomeEnabled) return;
    if (meshRef.current && !meshRef.current.visible) meshRef.current.visible = true;
    if (cityGroupRef.current && !cityGroupRef.current.visible) cityGroupRef.current.visible = true;
    const mat = meshRef.current?.material;
    if (mat && mat.transparent) {
      mat.transparent = false;
      mat.depthWrite = true;
      mat.opacity = 1;
      mat.needsUpdate = true;
    }
  }, [biomeEnabled]);

  useFrame((state, delta) => {
    // Detect flipped tiles for persistent tremor
    const wormhole = (meta?.flips ?? 0) > 0 && meta?.curr !== meta?.orig;;

    // Death implosion animation — -1 = idle (not started), 0..1 = playing, ≥1 = done
    if (deathAnimT.current >= 0 && deathAnimT.current < 1 && groupRef.current) {
      const prev = deathAnimT.current;
      deathAnimT.current = Math.min(1, prev + delta / 0.5);
      const t = deathAnimT.current;
      // Phase 1 (0→0.25): overshoot to 1.15×
      // Phase 2 (0.25→1): collapse to 0
      const scl = t < 0.25
        ? 1 + (t / 0.25) * 0.15
        : 1.15 * Math.max(0, (1 - (t - 0.25) / 0.75));
      groupRef.current.scale.set(scl, scl, 1);
      if (t >= 1 && prev < 1) {
        // Animation done: restore scale to 1 so the headstone (child of group) renders normally
        groupRef.current.scale.set(1, 1, 1);
        setDeathAnimDone(true);
      }
      return; // skip other animations while dying
    }

    // Single-boolean gate: skip the entire body on idle frames.
    // ringRef / glowRef are only mounted when wormhole is true, so the
    // original multi-condition check collapsed to this equivalent.
    const anyActive = spinT.current > 0 || shakeT.current > 0 || wormhole;
    if (!anyActive) {
      isActiveRef.current = false;
      return;
    }
    isActiveRef.current = true;

    // Flip animation — X-axis scale squish (identity collapse, not card rotation)
    if (spinT.current > 0 && groupRef.current) {
      const dt = Math.min(delta * 2, spinT.current);
      spinT.current -= dt;
      const rawP = 1 - spinT.current;

      // Ease the time variable, not the geometry — expressive control lives here.
      const p = easeInOutCubic(rawP);

      // Nonlinear squish: 1→0→1 — tile starts full, collapses to zero at midpoint
      // where the color swaps, then expands back. Power curve (0.85) keeps the tile
      // at near-full width for longer then accelerates the collapse, so the snap feels
      // decisive rather than gradual.
      const t = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
      const xScale = Math.pow(t, 0.85);
      const yPunch = 1 + Math.sin(p * Math.PI) * 0.12;

      // Micro z-shear: directional crossing cue without Y-rotation.
      const shear = Math.sin(p * Math.PI) * 0.04;

      groupRef.current.scale.set(xScale, yPunch, 1);
      groupRef.current.rotation.y = rot[1]; // fixed — never animates
      groupRef.current.rotation.z = rot[2] + shear;

      // Broadcast flip progress so WormholeTunnel can arch-lift in sync.
      if (stickerGridIdRef.current) flipBurstMap.set(stickerGridIdRef.current, rawP);

      // Vibration: tile strains against the manifold crossing, peaks at midpoint.
      const vibEnv = Math.sin(rawP * Math.PI);
      const jX = Math.sin(rawP * Math.PI * 18) * 0.022 * vibEnv;
      const jY = Math.cos(rawP * Math.PI * 13) * 0.014 * vibEnv;
      groupRef.current.position.x = pos[0] + jX;
      groupRef.current.position.y = pos[1] + jY;

      // Antipodal color bleed overlay — counter-scale so it stays full-width while the
      // parent squishes. In world space: xScale * (1/xScale) = 1 throughout the flip.
      if (flipOverlayRef.current) {
        const mat = flipOverlayRef.current.material;
        // Prevent division by zero; at xScale < 0.001 the tile is effectively invisible
        // so the overlay is the only thing the player sees.
        const safeX = Math.max(xScale, 0.001);
        flipOverlayRef.current.scale.x = 1 / safeX;
        if (rawP < 0.5) {
          // Incoming color bleeds through as the tile collapses toward zero width.
          const bleed = Math.pow(rawP * 2, 2.0);
          if (flipToColor.current) mat.color.set(flipToColor.current);
          mat.opacity = bleed * 0.85;
        } else {
          // Original color echoes as the new identity expands out.
          const echo = 1 - Math.pow((rawP - 0.5) * 2, 0.5);
          if (flipFromColor.current) mat.color.set(flipFromColor.current);
          mat.opacity = echo * 0.4;
        }
      }

      // One-shot color swap at the sacred frame: fire exactly when xScale === 0.
      if (prevRawP.current < 0.5 && rawP >= 0.5) {
        // InstancedMesh path: update the instance colour so the manager uploads
        // it this frame (manager runs at priority 1, after this priority-0 useFrame).
        if (isInstancedRef.current && flipToColor.current) {
          instanceColorRef.current.setStyle(flipToColor.current);
        }
        const mat = meshRef.current?.material;
        if (mat?.color) {
          const tex = flipToTexture.current;
          mat.map = tex || null;
          mat.color.set(tex ? '#ffffff' : flipToColor.current);
          mat.needsUpdate = true; // single GPU upload, not per-frame
        } else if (mat?.uniforms?.baseColor) {
          const newMat = getTileStyleMaterial(tileStyle, flipToColor.current, false, null);
          meshRef.current.material = newMat;
        }
        // Ring opacity spike — event horizon signal. Clamp write, no stacking.
        if (ringRef.current) {
          ringRef.current.material.opacity = 0.9;
          ringFlashRef.current = 1;
        }
      }
      prevRawP.current = rawP;

      if (spinT.current <= 0) {
        isFlipping.current = false;
        groupRef.current.scale.set(1, 1, 1);
        groupRef.current.rotation.y = rot[1];
        groupRef.current.rotation.z = rot[2];
        groupRef.current.position.set(pos[0], pos[1], pos[2]);
        if (flipOverlayRef.current) {
          flipOverlayRef.current.material.opacity = 0;
          flipOverlayRef.current.scale.x = 1;
        }
        if (stickerGridIdRef.current) flipBurstMap.delete(stickerGridIdRef.current);
        shakeT.current = 0.4;
        flipFromColor.current = null;
        flipToColor.current = null;
        flipFromTexture.current = null;
        flipToTexture.current = null;
        prevRawP.current = 0;
        // Force set the final color/texture correctly.
        // Use currTextureRef (includes biome ground texture) instead of faceTextures.
        // InstancedMesh path: restore the final base colour.
        if (isInstancedRef.current && baseColorRef.current) {
          instanceColorRef.current.setStyle(baseColorRef.current);
        }
        const mat = meshRef.current?.material;
        if (mat?.color) {
          const finalTex = currTextureRef.current;
          mat.map = finalTex;
          mat.color.set(finalTex ? '#ffffff' : baseColorRef.current);
          mat.needsUpdate = true;
        } else if (mat?.uniforms?.baseColor) {
          const newMat = getTileStyleMaterial(tileStyle, baseColorRef.current, false, null);
          meshRef.current.material = newMat;
        }
      }
    }

    // Shake animation for parity indicator
    if (shakeT.current > 0 && groupRef.current) {
      const dt = Math.min(delta * 2, shakeT.current);
      shakeT.current -= dt;
      const intensity = shakeT.current * 2; // Decay from 1 to 0
      const shakeFreq = 25;
      const shakeX = Math.sin(shakeT.current * shakeFreq * Math.PI) * 0.03 * intensity;
      const shakeZ = Math.cos(shakeT.current * shakeFreq * Math.PI * 1.3) * 0.02 * intensity;
      groupRef.current.position.x = pos[0] + shakeX;
      groupRef.current.position.z = pos[2] + shakeZ;

      if (shakeT.current <= 0) {
        groupRef.current.position.set(pos[0], pos[1], pos[2]);
      }
    }

    pulseT.current += delta * 2.1;
    if (ringRef.current) {
      const s = 1 + (Math.sin(pulseT.current) * 0.08);
      ringRef.current.scale.setScalar(s);
      // Midpoint flash decay — frame-rate independent, clamps to base opacity.
      if (ringFlashRef.current > 0) {
        ringFlashRef.current = Math.max(0, ringFlashRef.current - delta * 3);
        ringRef.current.material.opacity = 0.85 + ringFlashRef.current * 0.05;
      }
    }

    if (glowRef.current) {
      const glowIntensity = 0.3 + Math.sin(pulseT.current * 1.5) * 0.2;
      glowRef.current.material.opacity = glowIntensity;
    }

    // Persistent tremor for flipped tiles — the parity violation makes the tile unstable
    // Dead tiles (flips >= FLIP_CAP) are inert — no tremor
    if (wormhole && !isDead && groupRef.current && spinT.current <= 0 && shakeT.current <= 0) {
      const t = state.clock.elapsedTime;
      const flips = Math.min(meta?.flips ?? 1, 5);
      const tremIntensity = 0.004 + flips * 0.003;

      // Multi-frequency vibration for organic feel
      const jX = Math.sin(t * 19 + pos[0] * 7) * tremIntensity
        + Math.sin(t * 33 + pos[1] * 11) * tremIntensity * 0.5;
      const jY = Math.cos(t * 17 + pos[2] * 8) * tremIntensity * 0.3;
      const jZ = Math.cos(t * 24 + pos[1] * 9) * tremIntensity * 0.8
        + Math.cos(t * 41 + pos[0] * 13) * tremIntensity * 0.4;

      // Surge multiplier is pre-computed once per frame by CubeAssembly.
      // Reading the shared value saves 3×sin + pow + max per wormhole sticker.
      const { mult } = sharedTremorState;

      groupRef.current.position.x = pos[0] + jX * mult;
      groupRef.current.position.y = pos[1] + jY * mult;
      groupRef.current.position.z = pos[2] + jZ * mult;
    }
  });

  const isSudokube = mode === 'sudokube';
  const isGlass = mode === 'glass';

  // Biome mode: city identity tracks flip parity.
  // Even flips (0, 2, 4…): sticker is on its home face → use meta.orig city.
  // Odd flips  (1, 3, 5…): sticker has crossed the manifold → use antipodal city.
  // Rotations never change meta.orig, so the city travels correctly through all moves.
  const cityFace = biomeEnabled && meta?.orig
    ? ((meta?.flips ?? 0) % 2 === 0
      ? meta.orig
      : (ANTIPODAL_COLOR[meta.orig] ?? meta.orig))
    : meta?.orig;
  const stableCity = biomeEnabled && cityFace
    ? (FACE_CITIES[cityFace] ?? null)
    : null;
  const biomeGroundTexture = biomeEnabled && !isDead && stableCity
    ? (BIOME_GROUND_TEXTURES[stableCity] ?? null)
    : null;

  // Texture and style follow the CURRENT displayed face (meta.curr).
  // Biome ground texture takes priority over face textures.
  const currTexture = isDead ? null
    : biomeGroundTexture
    ?? (biomeEnabled ? null : (faceTextures?.[meta?.curr] || null));
  // Keep ref in sync so useFrame closures always read the live value.
  currTextureRef.current = currTexture;
  const baseColor = isDead ? '#555555'
    : isSudokube ? COLORS.white
      : biomeEnabled
        ? (cityFace ? fc[cityFace] : COLORS.black)    // city identity follows flip parity
        : (meta?.curr ? fc[meta.curr] : COLORS.black); // normal mode: show current face color
  // Full-face GLBs (colosseum, volcano) cover the sticker completely.
  // Use city-specific bgColor so edge gaps match the model's ground material, falling back to near-black.
  const materialColor = currTexture ? '#ffffff'
    : (biomeEnabled && stableCity && isGLBFullFace(stableCity)) ? (CITY_CONFIG[stableCity]?.bgColor ?? '#0d0d0d')
    : baseColor;

  // Store baseColor in ref for access in useFrame animation callbacks
  const baseColorRef = useRef(materialColor);
  baseColorRef.current = materialColor;

  // In biome mode the ground texture IS the tile style — force solid so no
  // shader layer renders underneath the buildings.
  const _styleKey = biomeEnabled ? cityFace : meta?.curr;
  const tileStyle = biomeGroundTexture
    ? 'solid'
    : stableCity
      ? (CITY_CONFIG[stableCity]?.tileStyle ?? 'solid')
      : (manifoldStyles?.[meta?.curr] || 'solid');
  const tileStyleRef = useRef(tileStyle);

  // Glass mode overrides all tile styles with glass material
  const useGlassStyle = isGlass && !isSudokube;
  const glassMaterial = useMemo(() => {
    if (!useGlassStyle) return null;
    const colorHex = baseColor || '#888888';
    try {
      return getGlassMaterial(colorHex);
    } catch (e) {
      console.warn('Failed to create glass material:', e);
      return null;
    }
  }, [useGlassStyle, baseColor]);

  // Full-face GLBs (arch, volcano) cover the entire sticker — suppress shader + volumes beneath them.
  const glbFullFace = biomeEnabled && !!stableCity && isGLBFullFace(stableCity);

  // Use shader material for non-solid styles (when no texture is applied)
  const useShaderStyle = !isGlass && tileStyle !== 'solid' && !currTexture && !isSudokube && !glbFullFace;
  const styleMaterial = useMemo(() => {
    if (!useShaderStyle) return null;
    // Ensure we have a valid color string
    const colorHex = baseColor || '#888888';
    try {
      return getTileStyleMaterial(tileStyle, colorHex, false, null);
    } catch (e) {
      console.warn('Failed to create tile style material:', e);
      return null;
    }
  }, [useShaderStyle, tileStyle, baseColor]);

  // Set up UVs to show the correct portion of the face texture
  // Skip for hollow frame geometry (different UV layout, textures not applicable)
  useLayoutEffect(() => {
    if (hollow) return;
    if (biomeGroundTexture) return; // ground texture is full-tile, don't slice UVs
    if (!geoRef.current || faceRow == null || faceCol == null || !faceSize) return;
    const uvs = geoRef.current.attributes.uv;;
    if (!currTexture) {
      // Reset to default UVs
      uvs.setXY(0, 0, 1); uvs.setXY(1, 1, 1);
      uvs.setXY(2, 0, 0); uvs.setXY(3, 1, 0);
    } else {
      const s = faceSize;
      const u0 = faceCol / s, u1 = (faceCol + 1) / s;
      const v0 = (s - 1 - faceRow) / s, v1 = (s - faceRow) / s;
      uvs.setXY(0, u0, v1); uvs.setXY(1, u1, v1);
      uvs.setXY(2, u0, v0); uvs.setXY(3, u1, v0);
    }
    uvs.needsUpdate = true;
  }, [hollow, biomeGroundTexture, currTexture, faceRow, faceCol, faceSize]);

  // Sync material color/texture when meta.curr changes (e.g., during cube rotation).
  // Uses useLayoutEffect so the color updates BEFORE the browser paints,
  // preventing a 1-frame flash of the wrong color after rotation.
  useLayoutEffect(() => {
    tileStyleRef.current = tileStyle;
    if (meshRef.current && meshRef.current.material && !isFlipping.current && spinT.current <= 0) {
      const mat = meshRef.current.material;
      if (mat.color) {
        mat.color.set(materialColor);
        mat.map = currTexture;
        mat.needsUpdate = true;
      } else if (mat.uniforms?.baseColor && !glbFullFace) {
        // Only re-apply shader material on non-full-face tiles.
        // For full-face GLBs the shader is intentionally suppressed — don't revive it here.
        const newMat = getTileStyleMaterial(tileStyleRef.current, materialColor, false, null);
        meshRef.current.material = newMat;
      }
    }
  }, [materialColor, currTexture, tileStyle]);
  const isWormhole = meta?.flips > 0 && meta?.curr !== meta?.orig;
  const hasFlipHistory = meta?.flips > 0;

  const trackerRadius = Math.min(0.25, 0.06 + (meta?.flips ?? 0) * 0.012);
  const origColor = meta?.orig ? fc[meta.orig] : COLORS.black;
  const antipodalColor = meta?.orig ? fc[ANTIPODAL_COLOR[meta.orig]] : COLORS.black;

  // Check if colors are white - don't show white indicators on non-white tiles
  const currIsWhite = meta?.curr === 3;
  const origIsWhite = meta?.orig === 3;
  const antipodalIsWhite = ANTIPODAL_COLOR[meta?.orig] === 3;

  // UV rotation: accumulated in-plane rotations when sticker stays on same face
  const uvRotation = meta?.uvRotation ?? 0;
  const uvRotationAngle = -(uvRotation * Math.PI) / 2; // Negate for correct Three.js coordinate system

  // ── InstancedMesh eligibility ────────────────────────────────────────────────
  // A sticker is "instanceable" when it renders as a plain solid-colour quad with
  // no shader, no special geometry, and no biome overlay.  The manager handles the
  // draw call; StickerPlane skips its own <mesh> to avoid a redundant render.
  // All per-sticker animations (flip squish, tremor, shake) still run normally —
  // they modify groupRef / innerGroupRef, and the manager samples matrixWorld.
  const isInstanceable = (
    !!instanceCtx &&
    !hollow &&
    !isGlass &&
    !isSudokube &&
    !biomeEnabled &&
    !currTexture &&
    tileStyle === 'solid'
  );
  // Update refs every render so the manager's useFrame always reads fresh values.
  isInstancedRef.current = isInstanceable;
  instanceColorRef.current.setStyle(materialColor);

  return (
    <group position={pos} rotation={rot} ref={groupRef}>
      {/* Inner group for UV rotation - rotates the sticker mesh and 3D volume overlays together around face normal (Z axis) */}
      <group rotation={[0, 0, uvRotationAngle]} ref={innerGroupRef}>
        {/* Main sticker quad — omitted when the InstancedMesh handles rendering */}
        {!isInstanceable && <mesh ref={meshRef} key={hollow ? 'frame' : 'plane'}>
          {hollow ? (
            <shapeGeometry args={[_stickerFrameShape]} />
          ) : faceRow != null ? (
            // Face-texture mode (Sudokube): per-instance geometry so UVs can be patched.
            <planeGeometry ref={geoRef} args={[0.85, 0.85]} />
          ) : (
            // No texture atlas — share the module-level geometry to avoid per-sticker alloc.
            <primitive object={_sharedStickerGeo} attach="geometry" />
          )}
          {useGlassStyle && glassMaterial ? (
            <primitive object={glassMaterial} attach="material" />
          ) : useShaderStyle && styleMaterial ? (
            <primitive object={styleMaterial} attach="material" />
          ) : (
            <meshStandardMaterial
              color={materialColor}
              map={hollow ? null : currTexture}
              side={THREE.FrontSide}
              roughness={0.3}
              metalness={0.05}
              envMapIntensity={0.3}
            />
          )}
        </mesh>}

        {/* 3D style volumes — suppressed for full-face GLBs that cover the entire tile */}
        <group visible={!glbFullFace}>
          {/* 3D grass blades overlay */}
          {tileStyle === 'grass' && !isGlass && !isSudokube && !currTexture && (
            <GrassBlades faceColor={baseColor} />
          )}

          {/* 3D water volume — transparent box + animated rippling surface */}
          {tileStyle === 'water' && !isGlass && !isSudokube && !currTexture && (
            <WaterVolume faceColor={baseColor} />
          )}

          {/* 3D lava volume — bubbling molten surface + floating embers */}
          {tileStyle === 'lava' && !isGlass && !isSudokube && !currTexture && (
            <LavaVolume faceColor={baseColor} />
          )}

          {/* 3D ice volume — crystal depth + sparkle frost surface */}
          {tileStyle === 'ice' && !isGlass && !isSudokube && !currTexture && (
            <IceVolume faceColor={baseColor} />
          )}

          {/* 3D galaxy volume — parallax star-field depth layers */}
          {tileStyle === 'galaxy' && !isGlass && !isSudokube && !currTexture && (
            <GalaxyVolume faceColor={baseColor} />
          )}

          {/* 3D neural volume — floating soma nodes + traveling signal arcs */}
          {tileStyle === 'neural' && !isGlass && !isSudokube && !currTexture && (
            <NeuralVolume faceColor={baseColor} />
          )}

          {/* 3D circuit volume — raised PCB board + glowing trace pulses */}
          {tileStyle === 'circuit' && !isGlass && !isSudokube && !currTexture && (
            <CircuitVolume faceColor={baseColor} />
          )}

          {/* 3D wood volume — lacquered grain-ridge surface with deep specular sheen */}
          {tileStyle === 'wood' && !isGlass && !isSudokube && !currTexture && (
            <WoodVolume faceColor={baseColor} />
          )}
        </group>
      </group>

      {/* Color bleed overlay — both antipodal colors mix around the manifold crossing */}
      <mesh ref={flipOverlayRef} position={[0, 0, 0.003]}>
        <primitive object={_sharedStickerGeo} attach="geometry" />
        <meshBasicMaterial transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* City Biome buildings — kept mounted during rotation so they don't pop/glitch */}
      {biomeEnabled && !isDead && stableCity && (
        <group ref={cityGroupRef}>
          {(() => {
            // Stable seed: derived from the sticker's ORIGINAL face + original cubie position.
            // meta.orig and meta.origPos are written once at cube creation and never mutate,
            // so this index never changes regardless of rotations or manifold crossings.
            // This preserves non-orientability — the geometry carries its orientation through
            // all transformations rather than snapping back to a canonical direction.
            const origP = meta?.origPos;
            const stableIndex = origP
              ? origP.x * 25 + origP.y * 5 + origP.z
              : (faceRow ?? 0) * (faceSize ?? 3) + (faceCol ?? 0);
            const stableFaceId = meta?.orig ?? (cityFace ?? 1);
            return isGLBActive(stableCity) ? (
              <BiomeGLBCluster
                cityKey={stableCity}
                tileIndex={stableIndex}
                faceId={stableFaceId}
                scale={1}
              />
            ) : (
              <CityBuildings
                key={`city-${stableFaceId}`}
                cityKey={stableCity}
                tileIndex={stableIndex}
                faceId={stableFaceId}
                gridDim={faceSize ?? 3}
              />
            );
          })()}
        </group>
      )}

      {/* Seam pulse overlay — disabled pending revamp */}

      {/* Winner tile golden glow — last two alive tiles pulse gold when the pair is found */}
      {isWinnerTile && !isDead && (
        <mesh position={[0, 0, 0.003]} renderOrder={2}>
          <planeGeometry args={[1.02, 1.02]} />
          <meshBasicMaterial color="#ffd700" transparent opacity={0.45} depthTest={false} />
        </mesh>
      )}

      {/* Dead tile headstone — only in Disparity Mode, after tile actually dies and animation completes */}
      {chaosLevel > 0 && isDead && deathAnimDone && (
        <group position={[0, 0, 0.02]}>
          {/* Headstone body — rounded rectangle */}
          <mesh position={[0, 0.06, 0]}>
            <planeGeometry args={[0.28, 0.34]} />
            <meshStandardMaterial color="#777777" roughness={0.8} metalness={0.1} />
          </mesh>
          {/* Headstone arch top */}
          <mesh position={[0, 0.24, 0.001]}>
            <circleGeometry args={[0.14, 16, 0, Math.PI]} />
            <meshStandardMaterial color="#777777" roughness={0.8} metalness={0.1} />
          </mesh>
          {/* Cross etching */}
          <mesh position={[0, 0.1, 0.003]}>
            <planeGeometry args={[0.03, 0.16]} />
            <meshBasicMaterial color="#444444" />
          </mesh>
          <mesh position={[0, 0.14, 0.003]}>
            <planeGeometry args={[0.1, 0.03]} />
            <meshBasicMaterial color="#444444" />
          </mesh>
          {/* Ground base */}
          <mesh position={[0, -0.12, -0.001]}>
            <planeGeometry args={[0.36, 0.06]} />
            <meshStandardMaterial color="#555555" roughness={0.9} />
          </mesh>
          {/* Disparity Mode: tile identity and death rank in original color */}
          {deadRank != null && (
            <>
              {/* "RIP" in the arch area */}
              <Text position={[0, 0.22, 0.006]} fontSize={0.075} color={origColor} anchorX="center" anchorY="middle" fontWeight={700} renderOrder={1} depthTest={false}>
                RIP
              </Text>
              {/* Original grid ID below the cross */}
              <Text position={[0, 0.03, 0.006]} fontSize={0.038} color={origColor} anchorX="center" anchorY="middle" renderOrder={1} depthTest={false}>
                {stickerGridIdRef.current}
              </Text>
              {/* Death rank at the base */}
              <Text position={[0, -0.09, 0.006]} fontSize={0.062} color={origColor} anchorX="center" anchorY="middle" fontWeight={700} renderOrder={1} depthTest={false}>
                #{deadRank}
              </Text>
            </>
          )}
        </group>
      )}

      {/* Tally Marks - skip if origColor is white on non-white tile */}
      {!isDead && !isSudokube && hasFlipHistory && !(origIsWhite && !currIsWhite) && (
        <TallyMarks
          flips={meta?.flips ?? 0}
          radius={trackerRadius}
          origColor={origColor}
        />
      )}

      {/* Flipped tile border - skip white rings on non-white tiles */}
      {!isDead && !isSudokube && hasFlipHistory && (
        <>
          {!(origIsWhite && !currIsWhite) && (
            <mesh position={[0, 0, 0.006]}>
              <primitive object={sharedRing38_41} attach="geometry" />
              <meshBasicMaterial color={origColor} />
            </mesh>
          )}
          {!(antipodalIsWhite && !currIsWhite) && (
            <mesh position={[0, 0, 0.007]}>
              <primitive object={sharedRing35_38} attach="geometry" />
              <meshBasicMaterial color={antipodalColor} />
            </mesh>
          )}
        </>
      )}

      {!isDead && !isSudokube && isWormhole && (
        <>
          {/* Parity breakthrough — original color trying to push through.
              LOD: skip at flips === 1 (6–8 blended meshes saved for the very first wormhole frame). */}
          {(meta?.flips ?? 1) >= 2 && <ParityBreakthrough origColor={origColor} flipCount={meta?.flips ?? 1} />}

          <mesh ref={ringRef} position={[0, 0, 0.02]}>
            <primitive object={sharedRing36_40} attach="geometry" />
            <meshBasicMaterial color="#dda15e" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh ref={glowRef} position={[0, 0, 0.015]}>
            <primitive object={sharedCircle44} attach="geometry" />
            <meshBasicMaterial
              color="#bc6c25"
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* WORM creatures - number equals flip count (max 4) */}
          {Array.from({ length: Math.min(meta?.flips ?? 0, 4) }, (_, i) => {
            const count = Math.min(meta?.flips ?? 0, 4);
            const angle = (i / count) * Math.PI * 2;
            const radius = count <= 4 ? 0.25 : 0.28;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const scale = count <= 4 ? 0.7 + (i % 2) * 0.1 : 0.6;
            return (
              <Worm
                key={i}
                position={[x, y, 0]}
                rotation={angle}
                scale={scale}
              />
            );
          })}
        </>
      )}

      {/* Particle burst effect during flip — always mounted, triggered imperatively via ref
          to avoid re-rendering StickerPlane (and its entire subtree) on every flip. */}
      <FlipParticles ref={flipParticlesRef} />

      {overlay && (
        <Text position={[0, 0, 0.03]} fontSize={0.17} color="black" anchorX="center" anchorY="middle">
          {overlay}
        </Text>
      )}

      {/* Per-tile health bar — visible in Disparity Mode only, for live tiles */}
      {chaosLevel > 0 && !isDead && (
        <DisparityHealthBar flips={meta?.flips ?? 0} flipCap={effectiveFlipCap} />
      )}
    </group>
  );
};

export default React.memo(StickerPlane);
