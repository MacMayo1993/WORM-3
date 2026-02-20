import React, { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, FACE_COLORS, ANTIPODAL_COLOR, FLIP_CAP } from '../utils/constants.js';
import { play, vibrate } from '../utils/audio.js';
import TallyMarks from '../manifold/TallyMarks.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { FACE_CITIES, CITY_CONFIG } from '../modes/CityBiomeMode.js';
import CityBuildings from './CityBuildings.jsx';
import { SeamPulseOverlay, getAdjacentFaceId } from './SeamPulseOverlay.jsx';
import { getTileStyleMaterial, getGlassMaterial, sharedTremorState } from './styles/TileStyleMaterials.jsx';
import GrassBlades from './styles/GrassBlades.jsx';
import WaterVolume from './styles/WaterVolume.jsx';
import LavaVolume from './styles/LavaVolume.jsx';
import IceVolume from './styles/IceVolume.jsx';
import GalaxyVolume from './styles/GalaxyVolume.jsx';
import NeuralVolume from './styles/NeuralVolume.jsx';
import CircuitVolume from './styles/CircuitVolume.jsx';
import WoodVolume from './styles/WoodVolume.jsx';
import { BIOME_GROUND_TEXTURES } from './BiomeGroundTextures.js';

// Shared geometries for all particle/glow systems (created once, reused globally)
const sharedParticleGeometry = new THREE.PlaneGeometry(1, 1);
const sharedOuterRingGeometry = new THREE.RingGeometry(0.4, 0.5, 16);
const sharedMainRingGeometry = new THREE.RingGeometry(0.2, 0.45, 16);
const sharedInnerCircleGeometry = new THREE.CircleGeometry(0.48, 16);
// Shared sticker plane geometry for stickers that don't need per-instance UV customisation.
// (Stickers with face textures — Sudokube mode — still create their own geometry so UVs can
// be patched per-sticker via geoRef.  All others share this one buffer.)
const _sharedStickerGeo = new THREE.PlaneGeometry(0.85, 0.85);
// Scratch Object3D for FlipParticles matrix math — never added to a scene.
const _particleDummy = new THREE.Object3D();
// Scratch vectors for biome edge-on fade — allocated once, reused every frame.
const _normal = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();

// Frame-shaped sticker Shape for hollow cube mode (square with rectangular hole).
// Store the Shape, not the Geometry — each sticker creates its own ShapeGeometry
// instance via declarative <shapeGeometry>, so R3F can safely dispose per-instance.
// Stable city cache — keyed on origDir + origPos which are truly permanent.
// Populated on first render before any rotation can corrupt meta.orig.
const _stableCityCache = new Map();

function getStableCity(meta) {
  if (!meta?.origDir || !meta?.origPos) return null;
  const key = `${meta.origDir}-${meta.origPos.x}-${meta.origPos.y}-${meta.origPos.z}`;
  if (!_stableCityCache.has(key) && meta.orig) {
    _stableCityCache.set(key, FACE_CITIES[meta.orig] ?? null);
  }
  return _stableCityCache.get(key) ?? FACE_CITIES[meta.orig] ?? null;
}
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
const FlipParticles = ({ active, color, onComplete }) => {
  const meshRef = useRef();
  const progressRef = useRef(0);
  const velocitiesRef = useRef([]);
  const isActiveRef = useRef(false);
  const PARTICLE_COUNT = 12;

  // Zero-scale all instances on mount so they're invisible before first activation.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    _particleDummy.scale.set(0, 0, 0);
    _particleDummy.updateMatrix();
    for (let i = 0; i < PARTICLE_COUNT; i++) mesh.setMatrixAt(i, _particleDummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  // Handle activation — reset progress and generate per-particle velocities/sizes.
  useEffect(() => {
    if (active && !isActiveRef.current) {
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
      // All particles share one material — update color + opacity together.
      if (meshRef.current?.material) {
        meshRef.current.material.color.set(color);
        meshRef.current.material.opacity = 1;
      }
    } else if (!active) {
      isActiveRef.current = false;
    }
  }, [active, color]);

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
      onComplete?.();
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
};

// Antipodal glow fill effect - glows from outside and fills inward
// Uses persistent meshes with shared geometries
const AntipodalGlowFill = ({ active, color }) => {
  const ringRef = useRef();
  const innerGlowRef = useRef();
  const outerRingRef = useRef();
  const progressRef = useRef(0);
  const isActiveRef = useRef(false);

  // Create materials once and cache them
  const outerMatRef = useRef(null);
  const ringMatRef = useRef(null);
  const innerMatRef = useRef(null);

  useEffect(() => {
    if (!outerMatRef.current) {
      outerMatRef.current = new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
    }
    if (!ringMatRef.current) {
      ringMatRef.current = new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
    }
    if (!innerMatRef.current) {
      innerMatRef.current = new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
      });
    }
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

  // Cracks scale with flips — more damage = more fractures
  const cracks = useMemo(() => {
    const base = [
      { pos: [0.12, 0.40, 0.004], rot: 0.08, size: [0.38, 0.018] },
      { pos: [-0.08, -0.39, 0.004], rot: -0.12, size: [0.42, 0.016] },
      { pos: [0.39, 0.06, 0.004], rot: 1.52, size: [0.34, 0.017] },
      { pos: [-0.38, -0.05, 0.004], rot: 1.62, size: [0.36, 0.015] },
    ];
    if (flipCount >= 2) base.push(
      { pos: [0.22, -0.18, 0.004], rot: 0.75, size: [0.24, 0.014] },
      { pos: [-0.18, 0.24, 0.004], rot: -0.6, size: [0.28, 0.013] },
    );
    if (flipCount >= 3) base.push(
      { pos: [0.05, 0.12, 0.004], rot: 1.1, size: [0.20, 0.012] },
      { pos: [-0.1, -0.15, 0.004], rot: -0.9, size: [0.22, 0.012] },
    );
    return base;
  }, [flipCount]);

  // Grid-edge glow bars at the sticker border — visible where stickers meet
  const gridEdges = useMemo(() => [
    { pos: [0, 0.44, -0.005], size: [0.98, 0.08] },   // top edge
    { pos: [0, -0.44, -0.005], size: [0.98, 0.08] },  // bottom edge
    { pos: [0.44, 0, -0.005], size: [0.08, 0.98] },   // right edge
    { pos: [-0.44, 0, -0.005], size: [0.08, 0.98] },  // left edge
  ], []);

  return (
    <group>
      {/* Back glow — square fills the full cubie face so light bleeds through grid gaps */}
      <mesh ref={backGlowRef} position={[0, 0, -0.018]}>
        <planeGeometry args={[0.98, 0.98]} />
        <meshBasicMaterial
          color={origColor}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Grid-edge glow bars — light pouring through the black grid lines */}
      {gridEdges.map((edge, i) => (
        <mesh
          key={`edge-${i}`}
          ref={el => edgesRef.current[i] = el}
          position={edge.pos}
        >
          <planeGeometry args={edge.size} />
          <meshBasicMaterial
            color={origColor}
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Through-glow — original color bleeding through front during surges */}
      <mesh ref={throughGlowRef} position={[0, 0, 0.002]}>
        <planeGeometry args={[0.82, 0.82]} />
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
          <planeGeometry args={crack.size} />
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

// Worm component for disparity visualization
const Worm = ({ position, rotation, scale = 1 }) => {
  const wormRef = useRef();

  useFrame((state) => {
    if (wormRef.current) {
      // Wiggle animation
      const time = state.clock.elapsedTime;
      wormRef.current.rotation.z = Math.sin(time * 3 + rotation) * 0.2;
    }
  });

  return (
    <group position={position} ref={wormRef}>
      {/* Worm body - curved shape */}
      <mesh position={[0, 0, 0.015]}>
        <capsuleGeometry args={[0.02 * scale, 0.08 * scale, 4, 8]} />
        <meshBasicMaterial color="#bc6c25" />
      </mesh>
      {/* Worm head highlight */}
      <mesh position={[0, 0.05 * scale, 0.015]}>
        <sphereGeometry args={[0.025 * scale, 8, 8]} />
        <meshBasicMaterial color="#dda15e" />
      </mesh>
    </group>
  );
};

const StickerPlane = function StickerPlane({ meta, pos, rot = [0, 0, 0], overlay, mode, faceColors, faceTextures, faceRow, faceCol, faceSize, manifoldStyles, hollow, currentDir }) {
  const fc = faceColors || FACE_COLORS;
  const biomeEnabled = useGameStore((s) => s.settings?.biomeMode?.enabled ?? false);
  const groupRef = useRef();
  const meshRef = useRef();
  const geoRef = useRef();
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
  const flipProgress = useRef(0);

  // Track if we're currently in a flip animation - prevents race condition
  // between React state updates and Three.js imperative rendering
  const isFlipping = useRef(false);

  // Dead tiles (at flip cap) are inert gray — used in useFrame and rendering
  const isDead = (meta?.flips ?? 0) >= FLIP_CAP;

  // State for triggering particle and glow effects (needs re-render)
  const [particlesActive, setParticlesActive] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
  const [currentGlowColor, setCurrentGlowColor] = useState(null);
  const [currentParticleColor, setCurrentParticleColor] = useState(null);

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
      // Texture follows the displayed face - changes during flip
      flipFromTexture.current = faceTextures?.[prevVal] || null;
      flipToTexture.current = faceTextures?.[curr] || null;
      spinT.current = 1;
      flipProgress.current = 0;

      // Set the glow color to the ANTIPODAL color (what we're becoming)
      // So if flipping FROM blue, we glow GREEN (the antipodal)
      setCurrentGlowColor(fc[curr]);
      setCurrentParticleColor(fc[curr]);
      setParticlesActive(true);
      setGlowActive(true);

      play('/sounds/flip.mp3');
      vibrate(16);
    }
    prevCurr.current = curr;
  }, [meta?.curr, meta?.flips]);

  useFrame((state, delta) => {
    // Biome mode: hide sticker ground plane when edge-on to camera during rotation.
    // Prevents the bold canvas ground texture from blooming outward mid-slice-rotation.
    if (biomeEnabled && meshRef.current?.material && groupRef.current) {
      groupRef.current.getWorldQuaternion(_worldQuat);
      _normal.set(0, 0, 1).applyQuaternion(_worldQuat);
      const dot = Math.abs(_normal.dot(state.camera.position) / state.camera.position.length());
      const mat = meshRef.current.material;
      mat.transparent = true;
      mat.opacity = dot < 0.20 ? 0 : 1;
    }

    // Detect flipped tiles for persistent tremor
    const wormhole = (meta?.flips ?? 0) > 0 && meta?.curr !== meta?.orig;;

    // Single-boolean gate: skip the entire body on idle frames.
    // ringRef / glowRef are only mounted when wormhole is true, so the
    // original multi-condition check collapsed to this equivalent.
    const anyActive = spinT.current > 0 || shakeT.current > 0 || wormhole;
    if (!anyActive) {
      isActiveRef.current = false;
      return;
    }
    isActiveRef.current = true;

    // Flip animation with SNAPPY acceleration
    if (spinT.current > 0 && groupRef.current) {
      // Faster animation speed (5x instead of 4x) for snappier feel
      const dt = Math.min(delta * 5, spinT.current);
      spinT.current -= dt;
      const rawP = 1 - spinT.current;

      // Snappy ease-out-back easing for acceleration
      // Fast start, slight overshoot, smooth settle
      const easeOutBack = (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      };

      // Use different easing for different phases
      let p;
      if (rawP < 0.5) {
        // First half: accelerate quickly (ease-out quad)
        p = rawP * 2;
        p = 1 - (1 - p) * (1 - p);
        p = p * 0.5;
      } else {
        // Second half: snappy with slight overshoot
        p = (rawP - 0.5) * 2;
        p = easeOutBack(p);
        p = 0.5 + p * 0.5;
      }

      flipProgress.current = rawP;

      let angle;
      if (rawP < 0.5) {
        // First half: quick snap towards the flip
        angle = p * Math.PI;
      } else {
        // Second half: complete with snappy overshoot
        const overshoot = Math.sin((rawP - 0.5) * Math.PI * 2) * 0.2;
        angle = Math.PI + overshoot;
      }

      groupRef.current.rotation.y = rot[1] + angle;

      // Punchier scale animation - bigger at midpoint
      const scalePunch = Math.sin(rawP * Math.PI);
      const scale = 1 + scalePunch * 0.2;
      groupRef.current.scale.set(scale, scale, 1);

      // Animate color/texture through the flip - switch at midpoint
      // Only for standard materials (shader materials handle color via uniforms)
      if (flipFromColor.current && flipToColor.current) {
  const mat = meshRef.current?.material;
  if (!mat) {
    // no-op
  } else if (mat.color) {
    if (rawP < 0.5) {
      const tex = flipFromTexture.current;
      mat.map = tex || null;
      mat.color.set(tex ? '#ffffff' : flipFromColor.current);
      mat.needsUpdate = true;
    } else {
      const tex = flipToTexture.current;
      mat.map = tex || null;
      mat.color.set(tex ? '#ffffff' : flipToColor.current);
      mat.needsUpdate = true;
    }
  } else if (mat.uniforms?.baseColor) {
    const targetColor = rawP < 0.5 ? flipFromColor.current : flipToColor.current;
    const newMat = getTileStyleMaterial(tileStyle, targetColor, false, null);
    meshRef.current.material = newMat;
  }
}

      if (spinT.current <= 0) {
        // Release animation lock - allow React state to control color again
        isFlipping.current = false;
        groupRef.current.rotation.y = rot[1];
        groupRef.current.scale.set(1, 1, 1);
        // Start shake animation after flip completes
        shakeT.current = 0.4;
        setGlowActive(false);
        flipFromColor.current = null;
        flipToColor.current = null;
        flipFromTexture.current = null;
        flipToTexture.current = null;
        flipProgress.current = 0;
        // Force set the final color/texture correctly
        // Only for standard materials (shader materials handle color via uniforms)
        // Texture follows the displayed face (meta.curr)
        const mat = meshRef.current?.material;
if (mat?.color) {
  const currTex = faceTextures?.[meta?.curr] || null;
  mat.map = currTex;
  mat.color.set(currTex ? '#ffffff' : baseColorRef.current);
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

  // Biome mode: use city ground texture on the base sticker mesh.
  // CRITICAL: keyed on meta?.orig (not curr) so city identity travels with the
  // sticker's home face through rotations, not the face it currently sits on.
  const stableCity = biomeEnabled ? getStableCity(meta) : null;
  const biomeGroundTexture = biomeEnabled && !isDead && stableCity
  ? (BIOME_GROUND_TEXTURES[stableCity] ?? null)
  : null;

  // Texture and style follow the CURRENT displayed face (meta.curr).
  // Biome ground texture takes priority over face textures.
  const currTexture = isDead ? null
  : biomeGroundTexture
  ?? (biomeEnabled ? null : (faceTextures?.[meta?.curr] || null));
  const baseColor = isDead ? '#555555'
  : isSudokube ? COLORS.white
  : biomeEnabled
    ? (meta?.orig ? fc[meta.orig] : COLORS.black)   // city identity travels with sticker
    : (meta?.curr ? fc[meta.curr] : COLORS.black);  // normal mode: show current face color
  const materialColor = currTexture ? '#ffffff' : baseColor;

  // Store baseColor in ref for access in useFrame animation callbacks
  const baseColorRef = useRef(materialColor);
  baseColorRef.current = materialColor;

  // In biome mode the ground texture IS the tile style — force solid so no
  // shader layer renders underneath the buildings.
  const _styleKey = biomeEnabled ? meta?.orig : meta?.curr;
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

  // Use shader material for non-solid styles (when no texture is applied)
  const useShaderStyle = !isGlass && tileStyle !== 'solid' && !currTexture && !isSudokube;
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
    } else if (mat.uniforms?.baseColor) {
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

  return (
    <group position={pos} rotation={rot} ref={groupRef}>
      {/* Inner group for UV rotation - rotates the sticker mesh and 3D volume overlays together around face normal (Z axis) */}
      <group rotation={[0, 0, uvRotationAngle]}>
        <mesh ref={meshRef} key={hollow ? 'frame' : 'plane'}>
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
        </mesh>

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

      {/* City Biome buildings — mounted per tile when biome mode is active */}
      {biomeEnabled && !isDead && stableCity && (
        <CityBuildings
        cityKey={stableCity}
        tileIndex={(faceRow ?? 0) * (faceSize ?? 3) + (faceCol ?? 0)}
        faceId={meta?.orig ?? 1}
        gridDim={faceSize ?? 3}
  />
)}

      {/* Seam pulse overlay — border tiles only, biome mode only */}
      {(() => {
        if (!biomeEnabled || !currentDir || faceRow == null || faceCol == null || isDead) return null;
        const adjFaceId = getAdjacentFaceId(currentDir, faceRow, faceCol, faceSize ?? 3);
        if (adjFaceId == null || meta?.orig == null) return null;
        return <SeamPulseOverlay origFaceId={meta.orig} adjFaceId={adjFaceId} />;
      })()}

      {/* Dead tile headstone — replaces all live overlays */}
      {isDead && (
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
              <ringGeometry args={[0.38, 0.41, 16]} />
              <meshBasicMaterial color={origColor} />
            </mesh>
          )}
          {!(antipodalIsWhite && !currIsWhite) && (
            <mesh position={[0, 0, 0.007]}>
              <ringGeometry args={[0.35, 0.38, 16]} />
              <meshBasicMaterial color={antipodalColor} />
            </mesh>
          )}
        </>
      )}

      {!isDead && !isSudokube && isWormhole && (
        <>
          {/* Parity breakthrough — original color trying to push through */}
          <ParityBreakthrough origColor={origColor} flipCount={meta?.flips ?? 1} />

          <mesh ref={ringRef} position={[0, 0, 0.02]}>
            <ringGeometry args={[0.36, 0.40, 16]} />
            <meshBasicMaterial color="#dda15e" transparent opacity={0.85} />
          </mesh>
          <mesh ref={glowRef} position={[0, 0, 0.015]}>
            <circleGeometry args={[0.44, 16]} />
            <meshBasicMaterial
              color="#bc6c25"
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
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

      {/* Antipodal glow fill effect during flip - only mounted when active */}
      {glowActive && (
        <AntipodalGlowFill
          active={glowActive}
          color={currentGlowColor}
        />
      )}

      {/* Particle burst effect during flip - only mounted when active */}
      {particlesActive && (
        <FlipParticles
          active={particlesActive}
          color={currentParticleColor}
          onComplete={() => setParticlesActive(false)}
        />
      )}

      {overlay && (
        <Text position={[0, 0, 0.03]} fontSize={0.17} color="black" anchorX="center" anchorY="middle">
          {overlay}
        </Text>
      )}
    </group>
  );
};

export default React.memo(StickerPlane);
