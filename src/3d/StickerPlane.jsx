import React, { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import FlipParticles from './FlipParticles.jsx';
import ParityBreakthrough from './ParityBreakthrough.jsx';
import StickerWorm from './StickerWorm.jsx';
import DisparityHealthBar from './DisparityHealthBar.jsx';
import { MergeTileOverlay } from '../modes/merge/index.js';

// Shared geometries used only by StickerPlane itself (not by extracted sub-components).
const _sharedStickerGeo = new THREE.PlaneGeometry(0.85, 0.85);
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

// Spin-reveal overlay: new tile face sweeps in from the outer rim toward the center
// with a spinning arc glow at the leading edge. Used to replace the midpoint white flash.
const spinRevealVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const spinRevealFragmentShader = `
  uniform vec3 uColor;
  uniform float uProgress; // 0 = reveal just started (outer ring only), 1 = full disc
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    // Outside-in: inner hole shrinks from 0.5 (empty) to 0 (full disc) as progress 0→1
    float innerEdge = 0.5 * (1.0 - uProgress);

    // Smooth disc boundary — only the circular area participates in the colour reveal.
    float inDisc = 1.0 - smoothstep(0.46, 0.52, dist);

    // Revealed band: new face colour sweeps from the outer rim inward (disc only).
    float show = smoothstep(innerEdge - 0.04, innerEdge + 0.02, dist) * inDisc;

    // Glass cube tile backing — fully opaque so the underlying face never bleeds through.
    // Mimics the glass visual mode: dark base with Fresnel-like rim brightening toward the disc edge.
    float rimGlow = smoothstep(0.2, 0.45, dist) * inDisc;
    vec3 glassColor = vec3(0.05, 0.08, 0.22) + rimGlow * 0.40;

    // Spinning arc glow at the reveal edge (inside disc only).
    float angle = atan(uv.y, uv.x);
    float spin = 0.5 + 0.5 * sin(angle * 8.0 - uTime * 14.0);
    float edgeDist = abs(dist - innerEdge);
    float edgeGlow = smoothstep(0.14, 0.0, edgeDist) * spin * inDisc;

    float brightness = 1.0 + edgeGlow * 0.7;

    // Always fully opaque — overlay completely covers the underlying tile during the flip,
    // replacing the raw face colour (which could be white) with a glass cube tile appearance.
    gl_FragColor = vec4(mix(glassColor, uColor * brightness, show), 1.0);
  }
`;


// Shared time uniform — all wispy ring materials reference this single object so only
// one value write per frame is needed regardless of how many tiles are on screen.
const _wispyT = { value: 0.0 };

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
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);

    // Clip to tile disc boundary
    float inDisc = 1.0 - smoothstep(0.46, 0.52, dist);

    // Ring annulus — occupies the outer band of the tile
    float innerEdge = 0.28;
    float inRing = smoothstep(innerEdge - 0.02, innerEdge + 0.02, dist) * inDisc;

    // Dark glass backing (same palette as spinReveal)
    float rimGlow = smoothstep(0.22, 0.44, dist) * inRing;
    vec3 glassColor = vec3(0.05, 0.08, 0.22) * inRing + rimGlow * vec3(0.12, 0.18, 0.38);

    // Spinning wispy arc at ring perimeter — same formula as spinReveal
    float angle = atan(uv.y, uv.x);
    float spin = 0.5 + 0.5 * sin(angle * 8.0 - uTime * 4.0);
    float edgeDist = abs(dist - 0.40);
    float edgeGlow = smoothstep(0.13, 0.0, edgeDist) * spin * inDisc;

    float brightness = 1.0 + edgeGlow * 0.7;
    vec3 col = mix(glassColor, uColor * brightness, edgeGlow);

    float alpha = inRing * 0.18 + edgeGlow * 0.88;
    gl_FragColor = vec4(col, alpha);
  }
`;


const StickerPlane = function StickerPlane({ meta, pos, rot = [0, 0, 0], overlay, mode, faceRow, faceCol, faceSize, hollow, currentDir: _currentDir }) {
  // Batch all store reads into a single subscription to minimize Zustand overhead.
  // With 54 stickers on a 3×3 cube, separate selectors = many subscriptions;
  // one combined selector with shallow equality keeps it to 54 subscriptions.
  const { biomeEnabled, chaosLevel, disparityFlipCap, disparityWinner, settings, faceTextures, disparityDeathByGridId, mergeMode, mergeTheme } = useGameStore(
    useShallow((s) => ({
      biomeEnabled: s.settings?.biomeMode?.enabled ?? false,
      chaosLevel: s.chaosLevel,
      disparityFlipCap: s.disparityFlipCap,
      disparityWinner: s.disparityWinner,
      settings: s.settings,
      faceTextures: s.faceTextures,
      disparityDeathByGridId: s.disparityDeathByGridId,
      mergeMode: s.mergeMode,
      mergeTheme: s.mergeTheme,
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
  }));
  // Persistent wispy ring — replaces static color rings on all tiles
  const wispyRingMatRef = useRef();
  const [wispyRingUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color(materialColor) },
    uTime: _wispyT, // shared reference — updated once per frame externally
  }));

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
  // Post-flip worm intro timer: counts down from 2 after each flip animation ends.
  // Keeps worm(s) visible for 2 seconds even if isWormhole becomes false quickly.
  const wormIntroT = useRef(0);
  const [showWormIntro, setShowWormIntro] = useState(false);
  // Flash timer for ring opacity spike at midpoint crossing; decays to 0 in useFrame.
  const ringFlashRef = useRef(0);
  // Overlay ref for antipodal color bleed during flip transitions.
  const flipOverlayRef = useRef();
  // Stable gridId for this sticker — written to flipBurstMap during flips so
  // WormholeTunnel can read the burst progress without prop drilling.
  // origPos/origDir/orig never change so this is computed once.
  const stickerGridIdRef = useRef(meta ? getManifoldGridId(meta, faceSize) : null);
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
  const deadRank = isDead ? (disparityDeathByGridId?.[stickerGridIdRef.current]?.rank ?? null) : null;
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
  useEffect(() => {
    const curr = meta?.curr ?? 0;
    const prevVal = prevCurr.current;

    // Only trigger flip animation if the color actually changed to its antipodal.
    // Keep manual-style vortex/squish visuals active in chaos/disparity too.
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
      wormIntroT.current = 3.0;
      setShowWormIntro(true);
      // Activate spin-reveal immediately with FROM color at full disc coverage so the
      // squish phase shows the FROM colour contracting into glass — not raw face colour.
      // This eliminates the white tile flash on both halves of the flip.
      if (spinRevealRef.current && spinRevealMatRef.current && flipFromColor.current) {
        spinRevealMatRef.current.uniforms.uColor.value.set(flipFromColor.current);
        spinRevealMatRef.current.uniforms.uProgress.value = 1.0;
        spinRevealRef.current.visible = true;
      }
      // Imperatively reset the mesh to the FROM color here. This covers the case where
      // the mesh was just mounted for the first time (tile going instanceable→non-instanceable)
      // and the JSX-created material already has materialColor (the new post-flip color).
      // useLayoutEffect skips the update when isFlipPending, but a brand-new mesh starts
      // with the JSX color, so we must explicitly restore the old color before the first frame.
      if (isInstancedRef.current && flipFromColor.current) {
        instanceColorRef.current.setStyle(flipFromColor.current);
      }
      const mat = meshRef.current?.material;
      if (mat?.color && flipFromColor.current) {
        // Drop the texture during the flip so the mesh shows a clean face color rather than
        // white (the neutral tint required for texture display). The texture is restored at
        // animation end. This gives a glass-tile look: solid colour squishes in, solid
        // antipodal colour reveals out, texture snaps back when the animation settles.
        mat.color.set(flipFromColor.current);
        mat.map = null;
        mat.needsUpdate = true;
      } else if (mat?.uniforms?.baseColor && flipFromColor.current) {
        // Shader-style tile (circuit, grid, etc.): switch to the from-color material so the
        // squish animation starts on the OLD color, not the post-flip color that React already
        // attached via the styleMaterial useMemo. flipToColor is the antipodal hex of the from face.
        const fromMat = getTileStyleMaterial(tileStyleRef.current, flipFromColor.current, false, null, flipToColor.current);
        meshRef.current.material = fromMat;
      }
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

    // Single-boolean gate: skip the entire body on idle frames.
    // Ensure we trigger animation if the tile is flipped (since ghost tile needs uTime updates).
    // If we need to transition the ghost tile (e.g. going from active to dormant), run at least one more frame.
    const anyActive = spinT.current > 0 || shakeT.current > 0 || showWormholeHazardFx || needsGhostUpdate || (spiderPlaneRef.current?.visible && !showGhostTile) || wormIntroT.current > 0;
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

      // First half: contract FROM colour disc into glass (progress 1.0 → 0.0 as tile squishes).
      // The spin-reveal was activated at full disc coverage when the flip started; here we
      // shrink it so the glass centre grows while the FROM colour ring collapses inward.
      if (rawP < 0.5 && spinRevealRef.current && spinRevealMatRef.current) {
        const contractProgress = Math.max(0.0, 1.0 - rawP / 0.5);
        spinRevealMatRef.current.uniforms.uProgress.value = contractProgress;
        spinRevealMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      }

      // Midpoint: switch the spin-reveal colour from FROM to TO and begin the outside-in reveal.
      if (prevRawP.current < 0.5 && rawP >= 0.5) {
        if (spinRevealRef.current && spinRevealMatRef.current && flipToColor.current) {
          spinRevealMatRef.current.uniforms.uColor.value.set(flipToColor.current);
          spinRevealMatRef.current.uniforms.uProgress.value = 0.0;
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
          const newMat = getTileStyleMaterial(tileStyle, baseColorRef.current, false, null, antipodalHexRef.current);
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

    // Post-flip worm intro countdown — keeps worm(s) visible for 2 s after each flip.
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

    // Persistent tremor for flipped tiles — the parity violation makes the tile unstable
    // Dead tiles (flips >= FLIP_CAP) are inert — no tremor
    if (showWormholeHazardFx && !isDead && groupRef.current && spinT.current <= 0 && shakeT.current <= 0) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // A flip is about to start — immediately paint the mesh with the FROM face color so no
        // frame of the post-flip materialColor (e.g. '#ffffff' for textured tiles, COLORS.white
        // for Sudokube) is ever visible before the squish animation kicks in.  This closes two
        // distinct gaps:
        //   1. First-flip white flash: the tile just went instanceable → non-instanceable so a
        //      brand-new <mesh> mounted with color={materialColor}='#ffffff' from JSX.  The old
        //      guard would skip the update, leaving it white until useEffect corrects it after paint.
        //   2. Constant-materialColor modes (Sudokube, glass): materialColor never changes on a
        //      flip so useLayoutEffect wouldn't fire at all without meta?.curr in the deps array.
        //      Applying FROM color here ensures the squish starts on the right color, not white.
        if (mat.color) {
          const fromVal = prevCurr.current;
          const fromColor = fc[fromVal];
          if (fromColor) {
            // Drop the texture so the mesh shows the raw face colour (not white).
          // The texture is restored at the end of the animation (see flip-end block in useFrame).
          mat.color.set(fromColor);
          mat.map = null;
          mat.needsUpdate = true;
          }
        }
        // Shader-style tiles (uniforms.baseColor) are handled by the flip useEffect which builds
        // a fromMat with getTileStyleMaterial — no action needed here for those.
      } else if (mat.color) {
        mat.color.set(materialColor);
        mat.map = currTexture;
        mat.needsUpdate = true;
      } else if (mat.uniforms?.baseColor && !glbFullFace) {
        // Only re-apply shader material on non-full-face tiles.
        // For full-face GLBs the shader is intentionally suppressed — don't revive it here.
        const newMat = getTileStyleMaterial(tileStyleRef.current, materialColor, false, null, antipodalHexRef.current);
        meshRef.current.material = newMat;
      }
    }
    // Keep wispy ring color in sync with the tile's current color
    if (wispyRingMatRef.current) wispyRingMatRef.current.uniforms.uColor.value.set(materialColor);
  }, [materialColor, currTexture, tileStyle, meta?.curr, meta?.flips]);
  const isWormhole = meta?.flips > 0 && meta?.curr !== meta?.orig;
  const hasFlipHistory = meta?.flips > 0;

  const trackerRadius = Math.min(0.25, 0.06 + (meta?.flips ?? 0) * 0.012);
  const origColor = meta?.orig ? fc[meta.orig] : COLORS.black;
  const antipodalColor = meta?.orig ? fc[ANTIPODAL_COLOR[meta.orig]] : COLORS.black;

  // Check if colors are white - don't show white indicators on non-white tiles
  const currIsWhite = meta?.curr === 3;
  const origIsWhite = meta?.orig === 3;
  const antipodalIsWhite = ANTIPODAL_COLOR[meta?.orig] === 3;

  // ── InstancedMesh eligibility ────────────────────────────────────────────────
  // A sticker is "instanceable" when it renders as a plain solid-colour quad with
  // no shader, no special geometry, and no biome overlay.  The manager handles the
  // draw call; StickerPlane skips its own <mesh> to avoid a redundant render.
  // All per-sticker animations (flip squish, tremor, shake) still run normally —
  // they modify groupRef / innerGroupRef, and the manager samples matrixWorld.
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
  // Update isInstancedRef every render so the manager's useFrame always reads a fresh value.
  // instanceColorRef is updated in useLayoutEffect([materialColor]) below, not here, so that
  // the color write is atomic with CubeAssembly's position-reset useLayoutEffect and cannot
  // race with R3F's frame loop in React 18 concurrent mode.
  isInstancedRef.current = isInstanceable;

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

      {/* Spin-reveal overlay — new face appears as a spinning circle from the outer rim inward */}
      <mesh ref={spinRevealRef} position={[0, 0, 0.005]} visible={false} renderOrder={1}>
        <primitive object={_sharedStickerGeo} attach="geometry" />
        <shaderMaterial
          ref={spinRevealMatRef}
          vertexShader={spinRevealVertexShader}
          fragmentShader={spinRevealFragmentShader}
          uniforms={spinRevealUniforms}
          transparent
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

      {/* Wispy spinning ring — replaces static color rings on every non-dead tile */}
      {!isDead && !isSudokube && (
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
          {/* WORM creatures around active vortex — also shown for 2 s after any flip */}
          {Array.from({ length: Math.max(1, Math.min(meta?.flips ?? 0, 4)) }, (_, i) => {
            const count = Math.max(1, Math.min(meta?.flips ?? 0, 4));
            const angle = (i / count) * Math.PI * 2;
            const radius = count <= 4 ? 0.25 : 0.28;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const scale = count <= 4 ? 0.7 + (i % 2) * 0.1 : 0.6;
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

      {overlay && (
        <Text position={[0, 0, 0.03]} fontSize={0.17} color="black" anchorX="center" anchorY="middle">
          {overlay}
        </Text>
      )}

      {/* Per-tile health bar — visible in Disparity Mode only, for live tiles */}
      {chaosLevel > 0 && !isDead && (
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
