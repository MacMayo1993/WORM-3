import React, { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
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
import { getTileStyleMaterial, getGlassMaterial, sharedTremorState, flipBurstMap, healBurstMap } from './styles/TileStyleMaterials.jsx';
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
import FlipParticles from './FlipParticles.jsx';
import HealParticles from './HealParticles.jsx';
import ParityBreakthrough from './ParityBreakthrough.jsx';
import StickerWorm from './StickerWorm.jsx';
import DisparityHealthBar from './DisparityHealthBar.jsx';
import { MergeTileOverlay } from '../modes/merge/index.js';

// Shared geometries used only by StickerPlane itself (not by extracted sub-components).
const _sharedStickerGeo = new THREE.PlaneGeometry(0.85, 0.85);
// Slightly larger plane for the worm-mode rim glow — extends the halo beyond the tile edge.
const _wormRimGlowGeo = new THREE.PlaneGeometry(1.05, 1.05);
// Circular alpha map — clips the base sticker mesh to a disc matching the overlay shader
// radius (smoothstep 0.44→0.50 in UV space).  Using alphaTest instead of transparent
// avoids depth-sorting issues and is unaffected by the biome-mode code that explicitly
// sets mat.transparent = false.  This eliminates white corners on textured tiles (which
// use materialColor='#ffffff' as the neutral tint required for correct texture display).
const _discAlphaMap = (() => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;
  // innerR = UV 0.44 from centre → fully opaque (matches shader inDisc = 1 zone)
  // outerR = UV 0.50 from centre → fully transparent (matches shader inDisc = 0 zone)
  // dist = length(vUv - 0.5), vUv ∈ [0,1]²  →  UV dist maps directly to canvas pixels as d*size.
  const innerR = 0.44 * size;   // UV 0.44 from centre → fully opaque  (56.32 px for size=128)
  const outerR = 0.50 * size;   // UV 0.50 from centre → fully transparent (64 px for size=128)
  // Fill whole canvas black (transparent outside disc)
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);
  // Solid white inner disc
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();
  // Soft antialiased edge matching smoothstep(0.44, 0.50, dist)
  const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  grad.addColorStop(0, 'white');
  grad.addColorStop(1, 'black');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
})();
// Scratch vectors for biome edge-on fade.
const _normal = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
// Frame-shaped sticker Shape for hollow cube mode.
const _stickerFrameShape = (() => {
  const outer = 0.425;
  const inner = 0.34;
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

const spiderVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const spiderFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uBurst;
  varying vec2 vUv;
  
  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;
    
    float angle = atan(uv.y, uv.x);
    
    float spiral = sin(angle * 6.0 + dist * 30.0 - uTime * 15.0);
    float lines = smoothstep(0.7, 1.0, spiral);
    
    float ripples = sin(dist * 40.0 + uTime * 10.0);
    float rippleLines = smoothstep(0.8, 1.0, ripples);
    
    float activity = max(lines, rippleLines * 0.6);
    float edgeFade = smoothstep(0.5, 0.2, dist);
    float intensity = uBurst * activity * edgeFade;
    
    gl_FragColor = vec4(uColor * 2.0, intensity * 0.9);
  }
`;


const hazardCrackVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const hazardCrackFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float radialMask = smoothstep(0.5, 0.18, dist);
    float angle = atan(uv.y, uv.x);
    float angleN = (angle + 3.14159265) / 6.2831853;

    float crackA = abs(fract(angleN * 7.0 + sin(dist * 20.0 + uTime * 2.1) * 0.06) - 0.5);
    float crackB = abs(fract(angleN * 11.0 + cos(dist * 26.0 - uTime * 2.7) * 0.08) - 0.5);
    float crackLines = (1.0 - smoothstep(0.0, 0.05, crackA)) + (1.0 - smoothstep(0.0, 0.04, crackB));

    float ringCrack = 1.0 - smoothstep(0.0, 0.035, abs(dist - (0.25 + sin(angle * 3.0 + uTime * 3.0) * 0.02)));
    float shards = smoothstep(0.78, 1.0, hash21(floor((uv + 0.5) * 18.0) + uTime * 0.02));

    float crackMask = clamp(crackLines * 0.45 + ringCrack * 0.6 + shards * 0.25, 0.0, 1.0);
    float pulse = 0.65 + sin(uTime * 8.0 + angle * 5.0) * 0.35;
    float alpha = crackMask * radialMask * pulse * uIntensity;

    gl_FragColor = vec4(uColor * 1.9, alpha);
  }
`;


const seamLeakFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float edge = max(abs(uv.x - 0.5), abs(uv.y - 0.5));

    // Brightness concentrated near the tile perimeter (where dark seams live).
    float edgeBand = smoothstep(0.38, 0.5, edge);
    // Suppress center so light does not appear to emit through the middle of the tile.
    float centerBlock = 1.0 - smoothstep(0.18, 0.28, length(uv - 0.5));
    float seamMask = edgeBand * (1.0 - centerBlock);

    float waveX = sin((uv.x * 18.0 + uTime * 4.0));
    float waveY = cos((uv.y * 22.0 - uTime * 3.2));
    float pulse = 0.55 + (waveX * waveY) * 0.25 + sin(uTime * 7.5) * 0.2;

    float alpha = clamp(seamMask * pulse * uIntensity, 0.0, 1.0);
    gl_FragColor = vec4(uColor * 1.7, alpha);
  }
`;

// ─── Worm-mode rim glow shader ────────────────────────────────────────────────
// Heartbeat ring on the outer rim of flipped tiles — only active in worm healer
// mode. Annular band from ~UV 0.30 to 0.50 on the 1.05×1.05 rim plane, so the
// glow overlaps the tile edge and extends ~0.1 world-units beyond it.
const wormRimGlowFragmentShader = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2  vUv;

  void main() {
    vec2  p    = vUv - 0.5;
    float dist = length(p);
    if (dist > 0.5) discard;

    // Annular band covering the outer rim of the tile and slightly beyond its edge.
    float rim = smoothstep(0.30, 0.39, dist) * (1.0 - smoothstep(0.44, 0.50, dist));

    // Heartbeat: sharp 12 % attack, slow exponential decay over the remaining 88 %.
    float t    = fract(uTime * 1.8);
    float beat = t < 0.12 ? t / 0.12 : pow(1.0 - (t - 0.12) / 0.88, 2.5);

    // Rotating shimmer so the ring sparkles from every camera angle.
    float angle   = atan(p.y, p.x);
    float shimmer = 0.60 + 0.40 * sin(angle * 6.0 + uTime * 5.0);

    float alpha = rim * (0.55 + beat * 0.75) * shimmer * uIntensity;
    gl_FragColor = vec4(uColor * (1.5 + beat * 2.0), alpha);
  }
`;

// ─── Heal seal shader ─────────────────────────────────────────────────────────
// Plays when the worm heals a wormhole tile.
// Phase 1 (uHealProgress 0→0.5): golden ring converges rim→center (wound closing).
// Phase 2 (uHealProgress 0.5→1): healed color blooms outward from center (life restored).
const healSealVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const healSealFragmentShader = `
  uniform vec3  uColor;        // original (healed) face color
  uniform float uHealProgress; // 0→1
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    float inDisc = 1.0 - smoothstep(0.44, 0.50, dist);

    vec4 col = vec4(0.0);

    if (uHealProgress < 0.5) {
      // Phase 1: golden convergence ring rushes from rim to center
      float t = uHealProgress * 2.0;
      // Quadratic contraction — fast start, slows to a stop at the center
      float ringR = 0.44 * (1.0 - t * t);
      float ringWidth = 0.036 + 0.018 * (1.0 - t);
      float ring = 1.0 - smoothstep(0.0, ringWidth, abs(dist - ringR));
      // Color sweeps gold → pure white as the ring closes
      vec3 goldColor = vec3(1.0, 0.87, 0.20);
      vec3 ringCol = mix(goldColor, vec3(1.0, 1.0, 1.0), t * 0.70);
      float ringAlpha = ring * inDisc * (0.80 + 0.20 * t);
      // Soft trailing wake just behind the ring (slightly wider, dimmer)
      float wake = 1.0 - smoothstep(0.0, 0.04, abs(dist - (ringR + 0.07)));
      float wakeAlpha = wake * inDisc * 0.25 * (1.0 - t);
      col = vec4(ringCol * 1.8, max(ringAlpha, wakeAlpha));
    } else {
      // Phase 2: healed color blooms outward from center, fading as it expands
      float t = (uHealProgress - 0.5) * 2.0;
      float bloomR = t * 0.50;
      float bloom = 1.0 - smoothstep(bloomR - 0.05, bloomR + 0.01, dist);
      // White-hot center glow that fades with t
      float centerGlow = (1.0 - smoothstep(0.0, 0.15 + t * 0.08, dist)) * (1.0 - t);
      float whiteFade = (1.0 - t) * (1.0 - t);
      vec3 bloomCol = mix(uColor, vec3(1.0, 1.0, 1.0), whiteFade * 0.70 + centerGlow * 0.45);
      float bloomAlpha = (bloom + centerGlow * 0.80) * inDisc * (0.60 + 0.40 * (1.0 - t));
      col = vec4(bloomCol * (1.0 + whiteFade * 0.80), bloomAlpha);
    }

    if (col.a < 0.001) discard;
    gl_FragColor = col;
  }
`;

// Spin-reveal overlay: new tile face sweeps in from the outer rim toward the center
// with a spinning arc glow at the leading edge. Used to replace the midpoint white flash.
const spinRevealVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Flip overlay shader: keeps the tile fully visible during the whole flip while
// adding a restrained chromatic edge swirl. Intentionally avoids any white-phase
// bridge so heavy disparity bursts cannot accumulate into a white wash.
const spinRevealFragmentShader = `
  uniform vec3 uColor;
  uniform float uProgress; // 1 = calm, 0 = peak transition energy
  uniform float uTime;
  uniform float uDissolve;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);

    // Circular mask: 1 inside the sticker disc, fades to 0 at the corners.
    // Used as alpha so the overlay is transparent outside the tile radius.
    float inDisc = 1.0 - smoothstep(0.44, 0.50, dist);

    // Transition energy envelope: strongest near midpoint of each half.
    float energy = 1.0 - uProgress;

    // Rotating edge wisps (chromatic-only; no neutral/white bridge).
    float edgeBand = smoothstep(0.20, 0.40, dist) * (1.0 - smoothstep(0.40, 0.50, dist));
    float swirl = 0.5 + 0.5 * sin(angle * 10.0 - uTime * 7.0 + dist * 20.0);
    float wisp = edgeBand * swirl * energy * inDisc;

    // White-free transition: stay on-face-color through the entire handoff.
    // Slight brighten/darken modulation preserves motion readability without
    // introducing additive white accumulation under load.
    float shade = 1.0 + (wisp - 0.5 * energy) * 0.18;
    // uDissolve tracks scale.x squish (1=face-on, 0=edge-on): dim the tile as it rotates
    // away to simulate 3D edge lighting during the card-flip.
    float brightness = 0.35 + 0.65 * uDissolve;
    vec3 col = clamp(uColor * shade * brightness, 0.0, 1.0);

    // Fully opaque within the disc — the main mesh is hidden during the flip so the
    // spinReveal is the sole visible layer.  Any alpha < 1 lets background content show
    // through (worm portal, hollow tiles, glass backplate), which reads as white.
    float alpha = inDisc;
    gl_FragColor = vec4(col, alpha);
  }
`;


// Shared time uniform — all wispy ring materials reference this single object so only
// one value write per frame is needed regardless of how many tiles are on screen.
const _wispyT = { value: 0.0 };

// Module-level frame counter for tremor sub-sampling.
// Tremor is a slow organic vibration (~10–40 Hz signal content); computing it at
// 30 Hz instead of 60 Hz is imperceptible and halves the trig cost per wormhole tile.
let _tremorFrame = 0;

// Persistent spinning-wispy-ring shader — replaces static color rings on every tile.
// Reuses the same spinning-arc formula as spinRevealFragmentShader but at a fixed
// ring radius so it animates continuously rather than during a flip.
const wispyRingVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const wispyRingFragmentShader = `
  uniform vec3 uColor;      // face color (strand A)
  uniform vec3 uAntiColor;  // antipodal face color (strand B)
  uniform float uTime;
  uniform float uLens; // 0 = normal tile, 1 = wormhole — enables subtle gravitational barrel distortion
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;

    // Gravitational lens: very slight barrel distortion on wormhole tiles.
    if (uLens > 0.5) {
      float d2 = dot(uv, uv);
      uv = uv * (1.0 - 0.11 * d2);
    }

    float dist = length(uv);
    float angle = atan(uv.y, uv.x);

    // Clip to tile disc boundary
    float inDisc = 1.0 - smoothstep(0.44, 0.50, dist);

    // Double-helix: two thin strands braiding around r0.
    // Each strand weaves in/out of the base radius using a sinusoidal offset;
    // strand B is exactly half a period (PI) behind strand A so they always
    // sit on opposite sides of the ring — the classic double-helix relationship.
    float r0        = 0.36;   // base ring radius
    float weave     = 0.030;  // radial weave amplitude (thinner = smaller)
    float turns     = 4.0;    // helix turns around the ring (integer → seamless loop)
    float speed     = 1.6;    // rotation speed
    float phase     = angle * turns - uTime * speed;

    float rA = r0 + weave * sin(phase);
    float rB = r0 + weave * sin(phase + 3.14159265);

    // Gaussian radial falloff — controls strand thickness (smaller sigma = thinner)
    float sigma = 0.013;
    float gA = exp(-pow(dist - rA, 2.0) / (2.0 * sigma * sigma));
    float gB = exp(-pow(dist - rB, 2.0) / (2.0 * sigma * sigma));

    // Soft sparkle: brightness pulses at twice the helix frequency for a live feel
    gA *= 0.75 + 0.25 * sin(phase * 2.0);
    gB *= 0.75 + 0.25 * sin(phase * 2.0 + 3.14159265);

    gA *= inDisc;
    gB *= inDisc;

    // Blend the two strand colors; where they overlap use a weighted average
    float total = gA + gB;
    vec3 col = total > 0.001 ? (uColor * gA + uAntiColor * gB) / total : uColor;

    float alpha = clamp(total, 0.0, 1.0) * 0.92;
    gl_FragColor = vec4(col * 1.3, alpha);
  }
`;


// Ghost worms that lazily orbit a dead tile's tombstone.
// The orbit group sits at mid-tombstone height so the worms circle the stone body.
function TombstoneGhost() {
  const orbitRef = useRef();
  useFrame(({ clock }) => {
    if (orbitRef.current) orbitRef.current.rotation.z = clock.elapsedTime * 0.45;
  });
  const r = 0.30;
  return (
    <group ref={orbitRef} position={[0, 0, 0.22]}>
      <StickerWorm position={[r, 0, 0]} rotation={0} scale={1.3} />
      <StickerWorm position={[-r, 0, 0]} rotation={Math.PI} scale={1.3} />
    </group>
  );
}

const StickerPlane = function StickerPlane({ meta, pos, rot = [0, 0, 0], overlay, mode, faceRow, faceCol, faceSize, hollow, currentDir: _currentDir }) {
  // Static game config — set once at game start, rarely changes during active play.
  // Kept in one shallow selector so tile-style/palette changes still reach all stickers.
  const { biomeEnabled, chaosLevel, disparityFlipCap, settings, faceTextures, mergeMode, mergeTheme, wormHealerMode } = useGameStore(
    useShallow((s) => ({
      biomeEnabled: s.settings?.biomeMode?.enabled ?? false,
      chaosLevel: s.chaosLevel,
      disparityFlipCap: s.disparityFlipCap,
      settings: s.settings,
      faceTextures: s.faceTextures,
      mergeMode: s.mergeMode,
      mergeTheme: s.mergeTheme,
      wormHealerMode: s.wormHealerMode ?? false,
    }))
  );
  const fc = useMemo(
    () => resolveColors(settings, settings?.biomeMode?.faceAssignment) || FACE_COLORS,
    [settings]
  );
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

  const spiderPlaneRef = useRef();
  const spiderMatRef = useRef();
  const crackMatRef = useRef();
  const seamLeakMatRef = useRef();
  const [spiderUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color() },
    uTime: { value: 0 },
    uBurst: { value: 1.0 }, // Always fully active for ghost tiles
  }));
  const [crackUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color('#ffffff') },
    uTime: { value: 0 },
    uIntensity: { value: 0 },
  }));
  const [seamLeakUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color('#ffffff') },
    uTime: { value: 0 },
    uIntensity: { value: 0 },
  }));
  // Spin reveal overlay — animates the new tile face in from the outer rim inward
  const spinRevealRef = useRef();
  const spinRevealMatRef = useRef();
  const [spinRevealUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color() },
    uProgress: { value: 0.0 },
    uTime: { value: 0.0 },
    uDissolve: { value: 0.0 },
  }));
  // Persistent wispy ring — replaces static color rings on all tiles
  const wispyRingMatRef = useRef();
  const [wispyRingUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color() },
    uAntiColor: { value: new THREE.Color() },
    uTime: _wispyT, // shared reference — updated once per frame externally
    uLens: { value: 0.0 },
  }));
  // Worm-mode rim glow — heartbeat ring on flipped tiles in worm healer mode
  const wormRimGroupRef = useRef();
  const wormRimMatRef = useRef();
  const [wormRimUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color() },
    uTime: { value: 0 },
    uIntensity: { value: 0 },
  }));

  // Dispose shader materials on unmount to prevent GPU program / texture leaks.
  // These are imperative Three.js material refs (not React DOM refs), assigned
  // lazily when conditional JSX renders them.  We intentionally read .current at
  // cleanup time to catch whatever was last rendered before unmount.
  useEffect(() => {
    return () => {
      spiderMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      crackMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      seamLeakMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      spinRevealMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      wispyRingMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      wormRimMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
    };
  }, []);

  // ── InstancedMesh batch integration ─────────────────────────────────────────
  const instanceCtx = useStickerInstances();
  // THREE.Color kept in sync with the current material colour; manager reads it
  // each frame to upload per-instance colour without any allocation.
  const instanceColorRef = useRef(new THREE.Color());
  // true  → this sticker is handled by the InstancedMesh (no individual <mesh>)
  // false → individual <mesh> renders (complex / animating sticker, or no ctx)
  const isInstancedRef = useRef(false);
  const instanceIdRef = useRef(-1);
  // Becomes true only after register() succeeds (returns a non-negative slot id).
  // Prevents suppressing the per-sticker <mesh> when the pool is exhausted and
  // no slot was allocated — those stickers must fall back to individual draw calls.
  const [instancedSlotValid, setInstancedSlotValid] = useState(false);
  const ringRef = useRef();
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
  // Post-flip worm intro timer: counts down from 6 after each flip animation ends.
  // Keeps worm(s) visible for 6 seconds even if isWormhole becomes false quickly.
  const wormIntroT = useRef(0);
  const [showWormIntro, setShowWormIntro] = useState(false);
  // Flash timer for ring opacity spike at midpoint crossing; decays to 0 in useFrame.
  const ringFlashRef = useRef(0);
  // Heal seal animation: -1 = idle, 0→1 = playing
  const healTRef = useRef(-1);
  const healParticlesRef = useRef();
  const healSealRef = useRef();
  const [healSealUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color() },
    uHealProgress: { value: 0.0 },
    uTime: { value: 0.0 },
  }));
  // Overlay ref for antipodal color bleed during flip transitions.
  const flipOverlayRef = useRef();
  // Stable gridId for this sticker — written to flipBurstMap during flips so
  // WormholeTunnel can read the burst progress without prop drilling.
  // origPos/origDir/orig never change so this is computed once.
  const stickerGridIdRef = useRef(meta ? getManifoldGridId(meta, faceSize) : null);
  // Per-sticker dynamic selectors — subscribe only to this sticker's own derived values.
  // When disparityDeathByGridId grows (a tile dies) Zustand re-runs all selectors, but
  // only the sticker whose primitive return value actually changed triggers a re-render.
  // 54 stickers dying → 54×54 re-renders becomes 1 re-render per death event.
  const deadRankRaw = useGameStore((s) => s.disparityDeathByGridId?.[stickerGridIdRef.current]?.rank ?? null);
  const isWinnerTile = useGameStore((s) => s.chaosLevel > 0 && !!(s.disparityWinner?.pair?.includes(stickerGridIdRef.current)));
  // Stable home key for Merge Mode tier lookup — same format as computeMergeRegions output.
  const mergeHomeKey = meta?.origPos
    ? `${meta.origPos.x}-${meta.origPos.y}-${meta.origPos.z}-${meta.origDir}`
    : null;
  // Live ref to current texture so useFrame closures can access it without stale captures.
  const currTextureRef = useRef(null);

  // Ensure transient flip-burst artifacts never leak across mode/home transitions.
  useEffect(() => {
    return () => {
      if (stickerGridIdRef.current) flipBurstMap.delete(stickerGridIdRef.current);
    };
  }, []);

  // Death rank from Disparity Mode — null if not in disparity game or tile not yet dead
  const deadRank = isDead ? deadRankRaw : null;

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
    // Only suppress the per-sticker mesh when a slot was actually allocated.
    // If the pool is exhausted (id === -1) we must fall back to individual rendering.
    setInstancedSlotValid(id >= 0);
    return () => {
      if (instanceIdRef.current >= 0) {
        instanceCtx.unregister(instanceIdRef.current);
        instanceIdRef.current = -1;
      }
      setInstancedSlotValid(false);
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
  const prevFlips = useRef(meta?.flips ?? 0);
  useEffect(() => {
    const curr = meta?.curr ?? 0;
    const flips = meta?.flips ?? 0;
    const prevVal = prevCurr.current;
    const prevFlipCount = prevFlips.current;
    const didFlip = flips > prevFlipCount;

    // Standardize all flip sources (manual + chaos/disparity) to use the same visual pipeline.
    // In disparity bursts a tile can be flipped multiple times between React commits, so curr can
    // end up unchanged while flips still increased; we still run the manual-style squish/reveal.
    const didAntipodalColorSwap = curr !== prevVal && ANTIPODAL_COLOR[prevVal] === curr;
    if (didFlip && (didAntipodalColorSwap || curr === prevVal)) {
      // Mark as animating to prevent React state from interrupting
      isFlipping.current = true;
      // Store the colors for the flip animation
      // flipToColor is the ANTIPODAL color (what we're flipping TO)
      flipFromColor.current = fc[prevVal];
      flipToColor.current = fc[curr];
      // Texture follows city identity — use biome ground textures in biome mode
      if (biomeEnabled && meta?.orig) {
        const newFlips = flips;
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
      wormIntroT.current = 6.0;
      setShowWormIntro(true);
      // Activate spin-reveal immediately with FROM color at full disc coverage.
      if (spinRevealRef.current && spinRevealMatRef.current && flipFromColor.current) {
        spinRevealMatRef.current.uniforms.uColor.value.set(flipFromColor.current);
        spinRevealMatRef.current.uniforms.uProgress.value = 1.0;
        spinRevealRef.current.visible = true;
      }
      // Hide the main disc entirely — spinReveal owns all visuals during the flip.
      // Keeping the disc visible (even with mat.map=null) produced a white square behind the
      // spinReveal circle because dropping the map also loses the disc alphaMap clip.
      if (meshRef.current) meshRef.current.visible = false;
      // Keep instanceColorRef updated so the manager doesn't show stale color if the tile
      // transitions back to instanced rendering after the animation ends.
      if (isInstancedRef.current && flipFromColor.current) {
        instanceColorRef.current.setStyle(flipFromColor.current);
      }
      flipParticlesRef.current?.trigger(fc[curr]);
      play('/sounds/flip.mp3');
      vibrate(16);
    }
    prevCurr.current = curr;
    prevFlips.current = flips;
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
    // Death implosion animation — -1 = idle (not started), 0..1 = playing, ≥1 = done
    // Check this FIRST: pure ref reads, no meta prop access, has its own early return.
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

    // Keep the shared wispy ring time current — single cheap write before any early return
    // so spinning rings stay animated even on otherwise-idle tiles.
    _wispyT.value = state.clock.elapsedTime;

    // Compute flip state once — hasFlips guards wormhole so meta?.flips is only
    // read once per frame instead of twice (was separate wormhole + hasFlips lines).
    const hasFlips = (meta?.flips ?? 0) > 0;
    const wormhole = hasFlips && meta?.curr !== meta?.orig;
    const showGhostTile = !isDead && hasFlips;
    const showWormholeHazardFx = !isDead && wormhole;

    const needsGhostUpdate = showGhostTile && spiderMatRef.current && (
      (wormhole && spiderMatRef.current.uniforms.uBurst.value !== 1.0) ||
      (!wormhole && spiderMatRef.current.uniforms.uBurst.value !== 0.4) ||
      (!spiderPlaneRef.current.visible)
    );

    // Heal seal trigger — MUST be before the anyActive gate.
    // After a tile heals, flips=0 so anyActive would be false and the gate would
    // return early before we could pick up the one-shot healBurstMap entry.
    if (healTRef.current < 0 && stickerGridIdRef.current && healBurstMap.get(stickerGridIdRef.current)) {
      healBurstMap.delete(stickerGridIdRef.current);
      healTRef.current = 0;
      const origHealColor = meta?.orig ? fc[meta.orig] : '#ffffff';
      healSealUniforms.uColor.value.set(origHealColor);
      healSealUniforms.uHealProgress.value = 0;
      if (healSealRef.current) healSealRef.current.visible = true;
      healParticlesRef.current?.trigger(origHealColor);
    }

    // Single-boolean gate: skip the entire body on idle frames.
    // Ensure we trigger animation if the tile is flipped (since ghost tile needs uTime updates).
    // If we need to transition the ghost tile (e.g. going from active to dormant), run at least one more frame.
    const anyActive = spinT.current > 0 || shakeT.current > 0 || showWormholeHazardFx || needsGhostUpdate || (spiderPlaneRef.current?.visible && !showGhostTile) || wormIntroT.current > 0 || healTRef.current >= 0;
    if (!anyActive) {
      isActiveRef.current = false;
      return;
    }
    isActiveRef.current = true;

    // Update Ghost Tile spiral animation if flipped
    if (showGhostTile && spiderPlaneRef.current && spiderMatRef.current) {
      spiderPlaneRef.current.visible = true;
      spiderMatRef.current.uniforms.uColor.value.set(baseColorRef.current);
      if (wormhole) {
        // Actively spinning disparate tile
        spiderMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        spiderMatRef.current.uniforms.uBurst.value = 1.0;
      } else {
        // Dormant stamp -- stop time, dim it out slightly
        spiderMatRef.current.uniforms.uBurst.value = 0.4;
      }
    } else if (spiderPlaneRef.current) {
      spiderPlaneRef.current.visible = false;
    }

    // Flip animation — X-axis scale squish (identity collapse, not card rotation)
    if (spinT.current > 0 && groupRef.current) {
      const dt = Math.min(delta * 2, spinT.current);
      spinT.current -= dt;
      const rawP = 1 - spinT.current;

      // Card-flip squish: compress scale.x to 0 (tile rotates edge-on), swap color at the
      // zero-width moment, then expand back. Ease-in-out makes the deceleration at the edge
      // feel physical rather than mechanical.
      const halfT = rawP < 0.5 ? rawP * 2.0 : (rawP - 0.5) * 2.0;
      const easedHalf = halfT * halfT * (3.0 - 2.0 * halfT);
      const flipSquish = Math.max(0.001, rawP < 0.5 ? 1.0 - easedHalf : easedHalf);
      groupRef.current.scale.set(flipSquish, 1, 1);
      groupRef.current.rotation.y = rot[1];
      groupRef.current.rotation.z = rot[2];

      // Broadcast flip progress so WormholeTunnel can arch-lift in sync.
      if (stickerGridIdRef.current) flipBurstMap.set(stickerGridIdRef.current, rawP);

      // Vibration: tile strains against the manifold crossing, peaks at midpoint.
      const vibEnv = Math.sin(rawP * Math.PI);
      const jX = Math.sin(rawP * Math.PI * 18) * 0.022 * vibEnv;
      const jY = Math.cos(rawP * Math.PI * 13) * 0.014 * vibEnv;
      groupRef.current.position.x = pos[0] + jX;
      groupRef.current.position.y = pos[1] + jY;

      // First half: contract FROM colour disc into glass (progress 1.0 → 0.0 as tile squishes).
      // The spin-reveal was activated at full disc coverage when the flip started; here we
      // shrink it so the glass centre grows while the FROM colour ring collapses inward.
      if (rawP < 0.5 && spinRevealRef.current && spinRevealMatRef.current) {
        const contractProgress = Math.max(0.0, 1.0 - rawP / 0.5);
        spinRevealMatRef.current.uniforms.uProgress.value = contractProgress;
        spinRevealMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        spinRevealMatRef.current.uniforms.uDissolve.value = flipSquish;
      }

      // Midpoint: switch the spin-reveal colour from FROM to TO and begin the outside-in reveal.
      if (prevRawP.current < 0.5 && rawP >= 0.5) {
        if (spinRevealRef.current && spinRevealMatRef.current && flipToColor.current) {
          spinRevealMatRef.current.uniforms.uColor.value.set(flipToColor.current);
          spinRevealMatRef.current.uniforms.uProgress.value = 0.0;
          spinRevealMatRef.current.uniforms.uDissolve.value = flipSquish;
          spinRevealRef.current.visible = true;
        }
        // Ring opacity spike — event horizon signal.
        if (ringRef.current) {
          ringRef.current.material.opacity = 0.9;
          ringFlashRef.current = 1;
        }
      }

      // Second half: drive the spin-reveal inward as the tile expands back.
      if (rawP >= 0.5 && spinRevealRef.current && spinRevealMatRef.current) {
        const revealProgress = Math.min(1.0, (rawP - 0.5) * 2.0);
        spinRevealMatRef.current.uniforms.uProgress.value = revealProgress;
        spinRevealMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        spinRevealMatRef.current.uniforms.uDissolve.value = flipSquish;
      }

      prevRawP.current = rawP;

      if (spinT.current <= 0) {
        isFlipping.current = false;
        // Hide spin-reveal and commit the final face color/texture to the mesh.
        if (spinRevealRef.current) spinRevealRef.current.visible = false;
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
        // Restore the main disc with the final TO color/texture, then make it visible.
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
          const newMat = getTileStyleMaterial(tileStyle, baseColorRef.current, false, null, antipodalHexRef.current);
          meshRef.current.material = newMat;
        }
        // Reveal the mesh now that it has the correct final color — was hidden during flip.
        if (meshRef.current) meshRef.current.visible = true;
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

    // Heal seal progress — drive the animation each frame while active.
    if (healTRef.current >= 0) {
      healTRef.current = Math.min(1, healTRef.current + delta / 0.65);
      healSealUniforms.uHealProgress.value = healTRef.current;
      healSealUniforms.uTime.value = state.clock.elapsedTime;
      if (healTRef.current >= 1) {
        if (healSealRef.current) healSealRef.current.visible = false;
        healTRef.current = -1;
      }
    }

    // Post-flip worm intro countdown — keeps worm(s) visible for 6 s after each flip.
    if (wormIntroT.current > 0) {
      wormIntroT.current = Math.max(0, wormIntroT.current - delta);
      if (wormIntroT.current <= 0) setShowWormIntro(false);
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

    if (crackMatRef.current) {
      crackMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      crackMatRef.current.uniforms.uIntensity.value = showWormholeHazardFx && !isDead ? 0.85 : 0;
      crackMatRef.current.uniforms.uColor.value.set(antipodalColor);
    }

    if (seamLeakMatRef.current) {
      seamLeakMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      seamLeakMatRef.current.uniforms.uIntensity.value = showWormholeHazardFx && !isDead ? 0.9 : 0;
      seamLeakMatRef.current.uniforms.uColor.value.set(antipodalColor);
    }

    // Worm-mode rim glow: heartbeat pulse + Z-bounce ("other side pressing through").
    if (wormRimMatRef.current) {
      const wormRimActive = wormHealerMode && showWormholeHazardFx;
      wormRimMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      wormRimMatRef.current.uniforms.uIntensity.value = wormRimActive
        ? 0.6 + Math.min(meta?.flips ?? 1, 5) * 0.08
        : 0;
      wormRimMatRef.current.uniforms.uColor.value.set(antipodalColor);
    }
    if (wormRimGroupRef.current) {
      if (wormHealerMode && showWormholeHazardFx) {
        const bt = (state.clock.elapsedTime * 1.8) % 1.0;
        const bounce = bt < 0.12 ? (bt / 0.12) * 0.055 : Math.pow(1.0 - (bt - 0.12) / 0.88, 2.5) * 0.055;
        wormRimGroupRef.current.position.z = bounce;
      } else {
        wormRimGroupRef.current.position.z = 0;
      }
    }

    // Persistent tremor for flipped tiles — the parity violation makes the tile unstable.
    // Sub-sampled to every other frame (30 Hz effective) — the vibration frequencies are
    // 6–41 Hz which are indistinguishable at 30 Hz vs 60 Hz updates.
    _tremorFrame++;
    if (showWormholeHazardFx && !isDead && groupRef.current && spinT.current <= 0 && shakeT.current <= 0 && (_tremorFrame & 1) === 0) {
      const t = state.clock.elapsedTime;
      const flips = Math.min(meta?.flips ?? 1, 5);
      const tremIntensity = 0.004 + flips * 0.003;

      // Multi-frequency vibration for organic feel
      const jX = Math.sin(t * 19 + pos[0] * 7) * tremIntensity
        + Math.sin(t * 33 + pos[1] * 11) * tremIntensity * 0.5;
      const hop = Math.max(0, Math.sin(t * (6 + flips * 0.8) + pos[0] * 2.3 + pos[2] * 1.8)) * (0.008 + flips * 0.002);
      const jY = Math.cos(t * 17 + pos[2] * 8) * tremIntensity * 0.3 + hop;
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

  const isTextureReady = (texture) => {
    if (!texture) return false;
    const img = texture.image ?? texture.source?.data ?? null;
    if (!img) return false;
    if (img.complete === false) return false;
    const width = img.videoWidth ?? img.naturalWidth ?? img.width ?? 0;
    const height = img.videoHeight ?? img.naturalHeight ?? img.height ?? 0;
    return width > 0 && height > 0;
  };

  // Texture and style follow the CURRENT displayed face (meta.curr).
  // Biome ground texture takes priority over face textures.
  const currTexture = isDead ? null
    : biomeGroundTexture
    ?? (biomeEnabled ? null : (faceTextures?.[meta?.curr] || null));
  const currTextureReady = isTextureReady(currTexture);
  const renderTexture = currTextureReady ? currTexture : null;
  // Keep ref in sync so useFrame closures always read the live value.
  currTextureRef.current = renderTexture;
  const baseColor = isDead ? '#555555'
    : isSudokube ? COLORS.white
      : biomeEnabled
        ? (cityFace ? fc[cityFace] : COLORS.black)    // city identity follows flip parity
        : (meta?.curr ? fc[meta.curr] : COLORS.black); // normal mode: show current face color
  // Full-face GLBs (colosseum, volcano) cover the sticker completely.
  // Use city-specific bgColor so edge gaps match the model's ground material, falling back to near-black.
  const materialColor = currTextureReady ? '#ffffff'
    : (biomeEnabled && stableCity && isGLBFullFace(stableCity)) ? (CITY_CONFIG[stableCity]?.bgColor ?? '#0d0d0d')
      : baseColor;

  // Store baseColor in ref for access in useFrame animation callbacks
  const baseColorRef = useRef(materialColor);
  baseColorRef.current = materialColor;

  // Hex color of the antipodal face — used by antipodal-pattern tile styles.
  // Kept in a ref so imperative flip/layout-effect callbacks can read the live value.
  const antipodalHex = meta?.curr ? (fc[ANTIPODAL_COLOR[meta.curr]] ?? null) : null;
  const antipodalHexRef = useRef(antipodalHex);
  antipodalHexRef.current = antipodalHex;

  // In biome mode the ground texture IS the tile style — force solid so no
  // shader layer renders underneath the buildings.
  const _styleKey = biomeEnabled ? cityFace : meta?.orig;
  const tileStyle = biomeGroundTexture
    ? 'solid'
    : stableCity
      ? (CITY_CONFIG[stableCity]?.tileStyle ?? 'solid')
      : (manifoldStyles?.[meta?.curr] || 'solid');
  const tileStyleRef = useRef(tileStyle);

  // Glass mode overrides all tile styles with glass material.
  // Each StickerPlane owns its own material instance — sharing via the LRU cache
  // caused disposed materials to linger on corner-sticker meshes when the cache
  // evicted entries, producing wrong colors after rotations.
  const useGlassStyle = isGlass && !isSudokube;
  const glassMaterialRef = useRef(null);
  // Create the material once on mount (or when glass mode turns on).
  // Subsequent color changes update the uniform in-place — no object reallocation.
  useEffect(() => {
    if (!useGlassStyle) {
      if (glassMaterialRef.current) {
        glassMaterialRef.current.dispose();
        glassMaterialRef.current = null;
      }
      return;
    }
    const colorHex = baseColor || '#888888';
    if (!glassMaterialRef.current) {
      try {
        // Clone from the shared cache so we get a fresh instance instead of the
        // shared one that might be evicted / mutated by other stickers.
        const shared = getGlassMaterial(colorHex);
        glassMaterialRef.current = shared.clone();
      } catch (e) {
        console.warn('Failed to create glass material:', e);
      }
    } else {
      // Update the existing material's color uniform in-place.
      try {
        glassMaterialRef.current.uniforms.baseColor.value.set(baseColor || '#888888');
      } catch (_e) { /* ignore */ }
    }
    return () => {
      glassMaterialRef.current?.dispose();
      glassMaterialRef.current = null;
    };
  }, [useGlassStyle]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: create once

  // Sync glass material color when baseColor changes (separate from creation)
  useEffect(() => {
    if (!glassMaterialRef.current) return;
    try {
      glassMaterialRef.current.uniforms.baseColor.value.set(baseColor || '#888888');
    } catch (_e) { /* ignore */ }
  }, [baseColor]);

  const glassMaterial = useGlassStyle ? glassMaterialRef.current : null;

  // Full-face GLBs (arch, volcano) cover the entire sticker — suppress shader + volumes beneath them.
  const glbFullFace = biomeEnabled && !!stableCity && isGLBFullFace(stableCity);

  // Use shader material for non-solid styles (when no texture is applied)
  const useShaderStyle = !isGlass && tileStyle !== 'solid' && !currTexture && !isSudokube && !glbFullFace;
  const styleMaterial = useMemo(() => {
    if (!useShaderStyle) return null;
    // Ensure we have a valid color string
    const colorHex = baseColor || '#888888';
    try {
      return getTileStyleMaterial(tileStyle, colorHex, false, null, antipodalHex);
    } catch (e) {
      console.warn('Failed to create tile style material:', e);
      return null;
    }
  }, [useShaderStyle, tileStyle, baseColor, antipodalHex]);

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

  // ── InstancedMesh eligibility ────────────────────────────────────────────────
  // A sticker is "instanceable" when it renders as a plain solid-colour quad with
  // no shader, no special geometry, and no biome overlay.  The manager handles the
  // draw call; StickerPlane skips its own <mesh> to avoid a redundant render.
  // All per-sticker animations (flip squish, tremor, shake) still run normally —
  // they modify groupRef / innerGroupRef, and the manager samples matrixWorld.
  // Declared here (before the useLayoutEffect) so it is available in both the
  // effect body and its deps array — the ref write still lands in the commit phase.
  const isInstanceable = (
    !!instanceCtx &&
    instancedSlotValid &&
    !hollow &&
    !isGlass &&
    !isSudokube &&
    !biomeEnabled &&
    !currTexture &&
    tileStyle === 'solid' &&
    !(meta?.flips > 0) // Cannot instance if it has a ghost tile spider web (active or dormant)
  );

  // Sync material color/texture when meta.curr changes (e.g., during cube rotation).
  // Uses useLayoutEffect so the color updates BEFORE the browser paints,
  // preventing a 1-frame flash of the wrong color after rotation.
  //
  // instanceColorRef is also written here (not in the render body) so that it lands
  // in the commit phase — the same phase where CubeAssembly's useLayoutEffect resets
  // cubie positions to the grid.  Writing it in the render body caused a race in
  // React 18 concurrent mode: the render phase could complete (mutating the ref) and
  // yield before the commit, letting R3F's frame loop read new colors at still-rotated
  // positions for one frame (the "sticker color flash" on single-turn drag releases).
  useLayoutEffect(() => {
    // Keep isInstancedRef current in the commit phase so StickerInstances' useFrame never
    // reads a value written by a speculative render that React 18 later discarded.
    isInstancedRef.current = isInstanceable;
    tileStyleRef.current = tileStyle;
    // Detect a pending flip transition: prevCurr.current still holds the OLD face id here
    // because useEffect (which updates prevCurr) hasn't run yet. When a flip is pending we
    // must NOT overwrite the mesh with the new post-flip color — the squish animation needs
    // the mesh to start showing the OLD color so the "collapse → color-swap → expand" plays
    // correctly. Without this guard useLayoutEffect would set new color before useEffect
    // even gets a chance to set isFlipping=true, causing a one-frame new-color flash.
    const isFlipPending = (meta?.curr ?? 0) !== prevCurr.current
      && (meta?.flips ?? 0) > 0
      && ANTIPODAL_COLOR[prevCurr.current] === (meta?.curr ?? 0);
    // Always keep the instanced-mesh color ref current, even when this sticker is
    // temporarily non-instanceable (the manager will zero its slot; the ref stays
    // ready for when it becomes instanceable again without a re-register).
    if (!isFlipping.current && spinT.current <= 0 && !isFlipPending) {
      instanceColorRef.current.setStyle(materialColor);
    }
    if (meshRef.current && meshRef.current.material && !isFlipping.current && spinT.current <= 0) {
      const mat = meshRef.current.material;
      if (isFlipPending) {
        // Hide the main disc immediately — spinReveal will cover the tile.
        // This closes the commit→paint gap before useEffect can fire, preventing any
        // white flash from the mesh (textured tiles use '#ffffff' as materialColor).
        meshRef.current.visible = false;
        // Pre-activate spinReveal with the FROM color so there is no transparent frame
        // between commit (where we hide the mesh) and the first paint.
        if (spinRevealRef.current && spinRevealMatRef.current) {
          const fromColor = fc[prevCurr.current];
          if (fromColor) {
            spinRevealMatRef.current.uniforms.uColor.value.set(fromColor);
            spinRevealMatRef.current.uniforms.uProgress.value = 1.0;
            spinRevealRef.current.visible = true;
          }
        }
      } else if (mat.color) {
        mat.color.set(materialColor);
        mat.map = renderTexture;
        mat.needsUpdate = true;
      } else if (mat.uniforms?.baseColor && !glbFullFace) {
        // Only re-apply shader material on non-full-face tiles.
        // For full-face GLBs the shader is intentionally suppressed — don't revive it here.
        const newMat = getTileStyleMaterial(tileStyleRef.current, materialColor, false, null, antipodalHexRef.current);
        meshRef.current.material = newMat;
      }
    }
    // Keep wispy ring colors and lens flag in sync with tile state
    if (wispyRingMatRef.current) {
      wispyRingMatRef.current.uniforms.uColor.value.set(materialColor);
      wispyRingMatRef.current.uniforms.uAntiColor.value.set(antipodalHexRef.current ?? materialColor);
      wispyRingMatRef.current.uniforms.uLens.value = (meta?.flips > 0 && meta?.curr !== meta?.orig) ? 1.0 : 0.0;
    }
  }, [isInstanceable, materialColor, renderTexture, tileStyle, meta?.curr, meta?.flips]);
  const isWormhole = meta?.flips > 0 && meta?.curr !== meta?.orig;
  const hasFlipHistory = meta?.flips > 0;

  const trackerRadius = Math.min(0.25, 0.06 + (meta?.flips ?? 0) * 0.012);
  const origColor = meta?.orig ? fc[meta.orig] : COLORS.black;
  const antipodalColor = meta?.orig ? fc[ANTIPODAL_COLOR[meta.orig]] : COLORS.black;

  // Check if colors are white - don't show white indicators on non-white tiles
  const currIsWhite = meta?.curr === 3;
  const origIsWhite = meta?.orig === 3;
  const _antipodalIsWhite = ANTIPODAL_COLOR[meta?.orig] === 3;

  return (
    <group position={pos} rotation={rot} ref={groupRef}>
      {/* Ghost spider web on the back of flipped tiles */}
      <mesh ref={spiderPlaneRef} position={[0, 0, -1.01]} rotation={[0, Math.PI, 0]} visible={false}>
        <planeGeometry args={[0.92, 0.92]} />
        <shaderMaterial
          ref={spiderMatRef}
          vertexShader={spiderVertexShader}
          fragmentShader={spiderFragmentShader}
          uniforms={spiderUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <group ref={innerGroupRef}>
        {/* Background quad — full-square mesh 1 mm behind the disc-clipped main sticker
            so the white '#ffffff' texture-tint does not bleed through the transparent disc
            corners on textured tiles.  Only rendered when a texture is active; plain
            solid-colour tiles skip it since the main sticker is now a full square.
            Skipped for hollow-frame and glass/shader-style tiles (own visuals). */}
        {!isInstanceable && !hollow && !useGlassStyle && !useShaderStyle && !!renderTexture && (
          <mesh position={[0, 0, -0.001]}>
            <primitive object={_sharedStickerGeo} attach="geometry" />
            <meshStandardMaterial
              color={isDead ? '#333333' : baseColor}
              side={THREE.FrontSide}
              roughness={0.3}
              metalness={0.05}
            />
          </mesh>
        )}

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
              map={hollow ? null : renderTexture}
              alphaMap={hollow || !renderTexture ? null : _discAlphaMap}
              alphaTest={hollow || !renderTexture ? 0 : 0.45}
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

      {/* Wormhole portal overlay — covers the tile during the flip animation.
          Positioned slightly in front of the main mesh so depth-testing works correctly
          without z-fighting.  depthTest must stay ON so that back-face flips don't bleed
          over front-face tiles (the main cause of white-tile / outline artifacts).
          renderOrder must be HIGH (above wispy ring=1, wormhole crack/winner=2) so the
          flip animation paints cleanly over those per-tile additive overlays — otherwise
          in disparity mode where every flipped tile carries a wispy ring, the additive ring
          bleeds on top of the spin-reveal and the flip looks washed out / glitchy. */}
      <mesh ref={spinRevealRef} position={[0, 0, 0.002]} visible={false} renderOrder={10}>
        <primitive object={_sharedStickerGeo} attach="geometry" />
        <shaderMaterial
          ref={spinRevealMatRef}
          vertexShader={spinRevealVertexShader}
          fragmentShader={spinRevealFragmentShader}
          uniforms={spinRevealUniforms}
          transparent
          blending={THREE.NormalBlending}
          depthTest={true}
          depthWrite={false}
        />
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

      {/* Dead tile tombstone — stands perpendicular to the tile face (tall dimension = local Z = outward) */}
      {chaosLevel > 0 && isDead && deathAnimDone && (
        <group position={[0, 0, 0.01]}>
          {/* Base slab — sits on the tile surface, wide in X, thick in Y, thin in Z */}
          <mesh position={[0, 0, 0.025]}>
            <boxGeometry args={[0.38, 0.14, 0.05]} />
            <meshStandardMaterial color={origColor} roughness={0.9} metalness={0.05} />
          </mesh>
          {/* Stone body — wide in X (0.28), thick in Y (0.12), tall in Z (0.34) */}
          {/* Z range: 0.05 → 0.39  (rises outward from tile face) */}
          <mesh position={[0, 0, 0.22]}>
            <boxGeometry args={[0.28, 0.12, 0.34]} />
            <meshStandardMaterial color={origColor} roughness={0.75} metalness={0.1} />
          </mesh>
          {/* Arch cap — half-cylinder, default axis=Y (the thin dim), semicircle in XZ plane.
              thetaStart=-PI/2, thetaLength=PI  →  arc goes from -X through +Z to +X
              (the +Z peak is the top of the arch, outward from tile)  */}
          <mesh position={[0, 0, 0.39]}>
            <cylinderGeometry args={[0.14, 0.14, 0.12, 20, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color={origColor} roughness={0.75} metalness={0.1} />
          </mesh>
          {/* Cross engraving — on the +Y face of the body (XZ plane, just outside Y=0.06) */}
          <mesh position={[0, 0.063, 0.18]}>
            <boxGeometry args={[0.028, 0.003, 0.13]} />
            <meshStandardMaterial color="#111111" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.063, 0.26]}>
            <boxGeometry args={[0.09, 0.003, 0.028]} />
            <meshStandardMaterial color="#111111" roughness={0.9} />
          </mesh>
          {/* Text — Billboard keeps labels facing the camera as the cube is orbited */}
          {deadRank != null && (
            <Billboard position={[0, 0, 0.27]}>
              <Text position={[0, 0.12, 0]} fontSize={0.075} color={antipodalColor} anchorX="center" anchorY="middle" fontWeight={700} renderOrder={2} depthTest={false}>
                RIP
              </Text>
              <Text position={[0, 0, 0]} fontSize={0.038} color={antipodalColor} anchorX="center" anchorY="middle" renderOrder={2} depthTest={false}>
                {stickerGridIdRef.current}
              </Text>
              <Text position={[0, -0.13, 0]} fontSize={0.062} color={antipodalColor} anchorX="center" anchorY="middle" fontWeight={700} renderOrder={2} depthTest={false}>
                #{deadRank}
              </Text>
            </Billboard>
          )}
          {/* Ghost worms orbit mid-tombstone height */}
          <TombstoneGhost />
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

      {/* Wispy spinning ring — only shown after the tile has been flipped at least once */}
      {!isDead && !isSudokube && hasFlipHistory && (
        <mesh position={[0, 0, 0.007]} renderOrder={1}>
          <primitive object={_sharedStickerGeo} attach="geometry" />
          <shaderMaterial
            ref={wispyRingMatRef}
            vertexShader={wispyRingVertexShader}
            fragmentShader={wispyRingFragmentShader}
            uniforms={wispyRingUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {!isDead && !isSudokube && (isWormhole || showWormIntro) && (
        <>
          {/* Parity breakthrough — original color trying to push through.
              LOD: skip at flips === 1 (6–8 blended meshes saved for the very first wormhole frame). */}
          {isWormhole && (meta?.flips ?? 1) >= 2 && <ParityBreakthrough origColor={origColor} flipCount={meta?.flips ?? 1} />}

          {isWormhole && <mesh position={[0, 0, 0.018]} renderOrder={2}>
            <primitive object={_sharedStickerGeo} attach="geometry" />
            <shaderMaterial
              ref={crackMatRef}
              vertexShader={hazardCrackVertexShader}
              fragmentShader={hazardCrackFragmentShader}
              uniforms={crackUniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>}

          {isWormhole && <mesh position={[0, 0, -0.009]} scale={[1.08, 1.08, 1]} renderOrder={1}>
            <primitive object={_sharedStickerGeo} attach="geometry" />
            <shaderMaterial
              ref={seamLeakMatRef}
              vertexShader={hazardCrackVertexShader}
              fragmentShader={seamLeakFragmentShader}
              uniforms={seamLeakUniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>}

          {/* Worm-mode rim glow — heartbeat ring that makes healing targets easy to spot.
              The group's Z position is animated in useFrame (heartbeat bounce) so the whole
              effect "pops" forward rhythmically, as if the antipodal face is pressing through. */}
          {isWormhole && wormHealerMode && (
            <group ref={wormRimGroupRef}>
              <mesh position={[0, 0, 0.022]} renderOrder={3}>
                <primitive object={_wormRimGlowGeo} attach="geometry" />
                <shaderMaterial
                  ref={wormRimMatRef}
                  vertexShader={hazardCrackVertexShader}
                  fragmentShader={wormRimGlowFragmentShader}
                  uniforms={wormRimUniforms}
                  transparent
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            </group>
          )}

          {/* WORM creatures around active vortex — also shown for 6 s after any flip. */}
          {/* During the non-wormhole intro a single worm emerges from the tile centre. */}
          {Array.from({ length: (showWormIntro && !isWormhole) ? 1 : Math.max(1, Math.min(meta?.flips ?? 0, 4)) }, (_, i) => {
            const count = (showWormIntro && !isWormhole) ? 1 : Math.max(1, Math.min(meta?.flips ?? 0, 4));
            const angle = (i / count) * Math.PI * 2;
            const radius = showWormIntro && !isWormhole ? 0 : (count <= 4 ? 0.25 : 0.28);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const scale = (showWormIntro && !isWormhole)
              ? 1.0
              : (count <= 4 ? 0.7 + (i % 2) * 0.1 : 0.6);
            return (
              <StickerWorm
                key={i}
                position={[x, y, 0]}
                rotation={angle}
                scale={scale}
              />
            );
          })}
        </>
      )}

      {/* Particle burst effect during flip (manual + chaos/disparity). */}
      <FlipParticles ref={flipParticlesRef} />

      {/* Heal seal overlay — golden convergence ring + color bloom on wormhole heal. */}
      <mesh ref={healSealRef} position={[0, 0, 0.004]} visible={false} renderOrder={11}>
        <primitive object={_sharedStickerGeo} attach="geometry" />
        <shaderMaterial
          vertexShader={healSealVertexShader}
          fragmentShader={healSealFragmentShader}
          uniforms={healSealUniforms}
          transparent
          depthTest={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Double-density golden particle burst on heal. */}
      <HealParticles ref={healParticlesRef} />

      {overlay && (
        <Text position={[0, 0, 0.03]} fontSize={0.17} color="black" anchorX="center" anchorY="middle">
          {overlay}
        </Text>
      )}

      {/* Per-tile health bar — Disparity Mode always; standard mode once a tile has flips (approaching FLIP_CAP death) */}
      {!isDead && (meta?.flips ?? 0) > 0 && (
        <DisparityHealthBar flips={meta?.flips ?? 0} flipCap={effectiveFlipCap} />
      )}

      {mergeMode && mergeHomeKey && (
        <MergeTileOverlay homeKey={mergeHomeKey} themeId={mergeTheme} colorIndex={meta.curr} />
      )}
    </group>
  );
};

// Custom memo comparator — prevents un-flipped stickers on the same cubie from
// re-rendering when a sibling sticker gets a chaos flip. Default memo uses reference
// equality on `meta`, which always fails (new cubies state = new sticker objects).
// We only care about the two volatile fields: curr (color) and flips (count).
// All other meta fields (orig, origPos, origDir) are frozen after cube creation.
// pos/rot are stable module-level constants so reference equality is sufficient.
function stickerPropsAreEqual(prev, next) {
  if (prev.pos !== next.pos || prev.rot !== next.rot) return false;
  if (prev.mode !== next.mode || prev.hollow !== next.hollow) return false;
  if (prev.faceSize !== next.faceSize) return false;
  if (prev.faceRow !== next.faceRow || prev.faceCol !== next.faceCol) return false;
  if (prev.overlay !== next.overlay) return false;
  const pm = prev.meta, nm = next.meta;
  if (pm === nm) return true;
  if (!pm || !nm) return pm === nm;
  return pm.curr === nm.curr && pm.flips === nm.flips;
}

export default React.memo(StickerPlane, stickerPropsAreEqual);
