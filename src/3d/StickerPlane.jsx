import React, { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, FACE_COLORS, ANTIPODAL_COLOR, FLIP_CAP } from '../utils/constants.js';
import { play, vibrateFlip } from '../utils/audio.js';
import TallyMarks from '../manifold/TallyMarks.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import { FACE_CITIES, CITY_CONFIG } from '../modes/CityBiomeMode.js';
import CityBuildings from './CityBuildings.jsx';
import { BiomeGLBCluster, isGLBActive, isGLBFullFace } from './BiomeGLBCluster.jsx';
import { SeamPulseOverlay } from './SeamPulseOverlay.jsx';
import { getTileStyleMaterial, getGlassMaterial, sharedTremorState, flipBurstMap, stickerFlipMotion, healBurstMap, healParticleMap } from './styles/TileStyleMaterials.jsx';
import { useStickerInstances } from './StickerInstances.jsx';
import { registerSticker, unregisterSticker, activateSticker, deactivateSticker, wispyTime } from './StickerAnimationManager.js';
import { getWormPress, wormPress } from '../worm/tilePressBridge.js';
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
import FlipShockwave from './FlipShockwave.jsx';
import FlipFlash from './FlipFlash.jsx';
import AntipodalGlowFill from './AntipodalGlowFill.jsx';
import { fireFlipImpulse } from './flipImpulse.js';
import { blinkCountForFlips, blinkFlipRate, blinkPhase, blinkBounce, BLINK_BASE_DUR } from './parityBlink.js';
import HealParticles from './HealParticles.jsx';
import ParityBreakthrough from './ParityBreakthrough.jsx';
import StickerWorm from './StickerWorm.jsx';
import DisparityHealthBar from './DisparityHealthBar.jsx';
import { MergeTileOverlay } from '../modes/merge/index.js';

// Shared geometries used only by StickerPlane itself (not by extracted sub-components).
const _sharedStickerGeo = new THREE.PlaneGeometry(0.85, 0.85);
// Tessellated plane for styles whose vertex shader displaces the surface — the
// eyeball bulge needs interior vertices to bend (a 1×1-segment plane stays flat).
const _bulgeStickerGeo = new THREE.PlaneGeometry(0.85, 0.85, 24, 24);
// Slightly larger plane for the worm-mode rim glow — extends the halo beyond the tile edge.
const _wormRimGlowGeo = new THREE.PlaneGeometry(1.05, 1.05);
// Neon worm-border plane — sits in the grid-line channel just outside the sticker so the
// glowing square outline traces the tile's own perimeter (like the neon view mode).
const _neonBorderGeo = new THREE.PlaneGeometry(0.94, 0.94);
// How far into the cube a tile sinks under the worm, in world units.
//
// The ceiling here is not taste, it is clearance: a sticker sits at 0.51 on a
// cubie body that is 0.98 across (face at 0.49), so it floats 0.02 proud of the
// piece it is stuck to. Sink it past that and the body's own face — which writes
// depth even in worm mode, where it is only partly transparent — swallows it, and
// the tile does not read as pressed, it reads as gone.
const PRESS_DEPTH = 0.019;
// …and how much it narrows at full press, opening the grid channel around it.
// This is the cue that survives being looked at head-on, where two hundredths of
// depth is a couple of pixels; it reads as the tile dropping into its socket.
// 14% is intentional: depth alone is almost invisible from the chase camera, while
// this exposes a broad socket around the pressed face without making it look detached.
const PRESS_SHRINK = 0.14;
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
// Scratch for the flip camera-impulse: the tile's outward normal in world space.
const _flipWorldQuat = new THREE.Quaternion();
const _flipWorldN = new THREE.Vector3();
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
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uBurst;
  varying vec2  vUv;

  void main() {
    // Square portal frame — glowing border, transparent center shows the tunnel within
    float bw        = 0.09;
    float leftEdge  = 1.0 - smoothstep(0.0, bw, vUv.x);
    float rightEdge = smoothstep(1.0 - bw, 1.0, vUv.x);
    float botEdge   = 1.0 - smoothstep(0.0, bw, vUv.y);
    float topEdge   = smoothstep(1.0 - bw, 1.0, vUv.y);
    float border    = clamp(leftEdge + rightEdge + botEdge + topEdge, 0.0, 1.0);
    if (border < 0.01) discard;

    // Gentle energy pulse rippling around the portal edge
    float wave  = sin(uTime * 2.5 + (vUv.x + vUv.y) * 12.57) * 0.5 + 0.5;
    float pulse = 0.65 + wave * 0.35;
    gl_FragColor = vec4(uColor * 1.8 * pulse, border * uBurst);
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

// ─── Eyelid blink overlay ─────────────────────────────────────────────────────
// Fires on disparity (odd-flip) transitions.
// The FROM-color mesh stays fully visible underneath; this overlay covers the full
// tile disc with the TO color at ~0.5 alpha (NormalBlending), so both colors are
// simultaneously visible — the quantum superposition / 50-50 blend moment.
// The scale.y eyelid squish and the lid-edge gleam ride on top of that blend.
const eyelidVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const eyelidFragmentShader = `
  uniform vec3  uColorTo;  // the antipodal (destination) color
  uniform float uProgress; // 1 = fully open, 0 = fully closed (= flipSquish)
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    float inDisc = 1.0 - smoothstep(0.43, 0.50, dist);
    float closed  = 1.0 - uProgress;  // 1 when squished shut, 0 when open

    // Full-disc base at 0.5 alpha: overlaid on the FROM-color mesh via NormalBlending
    // this gives exactly a 50/50 mix — both states visible simultaneously.
    float baseAlpha = 0.50 * inDisc;

    // Eyelid edge gleam — bright band at top and bottom rim, intensifies as lids close.
    float topBot  = abs(abs(uv.y) - 0.41);
    float lidEdge = (1.0 - smoothstep(0.0, 0.055, topBot)) * inDisc;
    float lidBright = 0.15 + closed * 0.85;
    float shimmer = (0.5 + 0.5 * sin(atan(uv.x, uv.y) * 8.0 - uTime * 6.0))
                    * lidEdge * 0.30;

    // Center pinpoint: flares at the superposition peak (scale.y ≈ 0).
    float core = (1.0 - smoothstep(0.0, 0.09, dist)) * closed * closed;

    // Iris ring sweeps outward from center as the eye opens (phase 2).
    float irisR = uProgress * 0.44;
    float iris  = (1.0 - smoothstep(0.0, 0.045, abs(dist - irisR))) * uProgress * inDisc;

    float alpha = clamp(baseAlpha + lidEdge * lidBright + core * 1.1 + iris * 0.55 + shimmer,
                        0.0, 0.95);

    if (alpha < 0.001) discard;
    gl_FragColor = vec4(uColorTo, alpha);
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

// Flip overlay shader: additive rim glow at the tile edge during the flip. Transparent in
// the center so living/patterned tile styles show through — only the outer ring carries the
// flip energy color. Uses AdditiveBlending so it brightens whatever is underneath rather
// than covering it, which prevents a flat-color "flash" on textured or 3D-styled tiles.
const spinRevealFragmentShader = `
  uniform vec3 uColor;
  uniform float uProgress; // 1 = calm, 0 = peak transition energy
  uniform float uTime;
  uniform float uDissolve; // flipSquish: 1=face-on (bright), 0=edge-on (dim)
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);

    float inDisc = 1.0 - smoothstep(0.44, 0.50, dist);
    float energy = 1.0 - uProgress;

    // Rim band — only covers the outer ring of the tile so the center is transparent.
    float rim = smoothstep(0.30, 0.43, dist) * (1.0 - smoothstep(0.44, 0.50, dist));

    // Rotating wisps confined to the rim band.
    float swirl = 0.5 + 0.5 * sin(angle * 10.0 - uTime * 7.0 + dist * 20.0);
    float wisp = rim * swirl * energy;

    // Edge-lighting: tile dims as it rotates edge-on (uDissolve tracks squish).
    float brightness = 0.5 + 0.65 * uDissolve;
    vec3 col = uColor * brightness * (1.0 + wisp * 0.5);

    // Alpha: rim only — center stays at 0 so living/patterned content shows through.
    float alpha = inDisc * clamp(rim * (0.7 + energy * 0.5) + wisp * 0.4, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;


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
  uniform float uFlipRatio; // 0..1 = flips / flipCap — the closer to death, the hotter + faster the ring
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

    // Heartbeat pulse — speeds up as the tile accumulates flips so a near-dead
    // tile visibly throbs with urgency. uFlipRatio 0 → calm, 1 → frantic.
    float pulseHz = 1.4 + uFlipRatio * 6.0;
    float pulse   = 0.5 + 0.5 * sin(uTime * pulseHz); // 0..1

    // Double-helix: two thin strands braiding around r0.
    // Each strand weaves in/out of the base radius using a sinusoidal offset;
    // strand B is exactly half a period (PI) behind strand A so they always
    // sit on opposite sides of the ring — the classic double-helix relationship.
    float r0        = 0.36;   // base ring radius
    float weave     = 0.030;  // radial weave amplitude (thinner = smaller)
    float turns     = 4.0;    // helix turns around the ring (integer → seamless loop)
    float speed     = 1.6 + uFlipRatio * 2.6; // spins faster as it nears the cap
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
    vec3 strandCol = total > 0.001 ? (uColor * gA + uAntiColor * gB) / total : uColor;

    // Antipodal glow halo — a broad, soft band in the antipodal color sitting
    // under the crisp strands. Makes the ring read as a distinct colored glow at
    // a glance; it brightens with flip count and breathes with the heartbeat.
    float glowSigma = 0.058;
    float glow      = exp(-pow(dist - r0, 2.0) / (2.0 * glowSigma * glowSigma)) * inDisc;
    float glowAmp   = (0.18 + 0.62 * uFlipRatio) * (0.55 + 0.45 * pulse);
    float glowI     = glow * glowAmp;

    // Compose strands + antipodal glow, weighting color by each contribution.
    float sumI = total + glowI;
    vec3 col = sumI > 0.001 ? (strandCol * total + uAntiColor * glowI) / sumI : uColor;

    float alpha = clamp(sumI, 0.0, 1.0) * 0.92;
    // Whole ring breathes brighter on each beat (stronger pulse near death).
    float breathe = 1.0 + (0.12 + 0.28 * uFlipRatio) * (pulse - 0.5) * 2.0;
    gl_FragColor = vec4(col * 1.3 * breathe, alpha);
  }
`;


// ─── Worm footprint shader ────────────────────────────────────────────────────
// The tile's own grid square, lit up under the worm's weight.
//
// Same square-outline vocabulary the neon view mode uses for cubie edges (a bright
// rail traced right on the perimeter), but driven by contact rather than by view
// style, and in the worm's own skin colour so the glow reads as coming from the
// creature rather than from the cube.
//
// Two things this deliberately does NOT do, both learned the hard way:
//
// The rail's colour and brightness do not vary with how hard the tile is pressed.
// They did, and the result was that a tile under the head and a tile under the
// body lit in visibly different colours — one washing toward white, the other
// staying saturated — so a line of touched tiles read as a mess of mismatched
// squares rather than as one lit path. Depth is still allowed to vary; light is
// not. `lit` crosses to full as soon as there is any real contact.
//
// And the inner shadow is slight. A recess wants some shading against the rim
// that is now above it, but at any strength the eye notices it stops being shade
// and becomes the tile's colour — a dark square where a coloured one used to be,
// which is exactly what a dead tile looks like in this game. It stays a thin
// gradient hugging the rim and never reaches the middle of the tile.
const wormFootprintFragmentShader = `
  uniform vec3  uColor;   // worm's skin colour
  uniform float uPress;   // 0 = flat, 1 = fully under the worm
  uniform float uTime;
  varying vec2  vUv;

  void main() {
    vec2  p = vUv - 0.5;
    vec2  a = abs(p);
    float edge = 0.5 - max(a.x, a.y);   // 0 at the tile's rim, grows inward
    float press = clamp(uPress, 0.0, 1.0);

    // The lit rail, hugging the perimeter. It fattens as the tile sinks.
    float bw   = 0.038 + press * 0.034;
    float rail = 1.0 - smoothstep(bw * 0.55, bw, edge);

    // Light spilling inward from the rail, over the tile's shoulder.
    float spill = (1.0 - smoothstep(bw, 0.22 + press * 0.12, edge)) * 0.42;

    // Inner shadow: the recess the worm is standing in. Strongest right against
    // the rim (where the wall is highest) and gone by the middle of the tile.
    float wall = 1.0 - smoothstep(0.015, 0.19, edge);
    float shade = wall * press * 0.88;

    // A slow breath so a tile held under a resting worm is not perfectly static.
    float breath = 0.94 + 0.06 * sin(uTime * 2.6);

    float glow  = (rail * (1.05 + press * 0.95) + spill * press) * breath;
    float alpha = clamp(max(glow, shade), 0.0, 1.0) * smoothstep(0.0, 0.09, press);

    // Rail runs hot toward white at the centre of the stroke; the shadow band is
    // the same hue taken almost to black, so the whole square stays one colour.
    vec3 socket = uColor * 0.025;
    vec3 hotRail = mix(uColor, vec3(1.0), rail * 0.62 * press);
    vec3 col = mix(socket, hotRail, clamp(glow, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

// ─── Neon worm-border shader ──────────────────────────────────────────────────
// Replaces the old solid parity ring. Lights up the SQUARE outer edge of the tile
// like the neon view mode, then sends a handful of bright "light-worms" chasing one
// another around the perimeter. Each worm is a white-hot head with a trailing comet
// tail; they wiggle as they slither and speed up as the tile's flip count climbs
// toward its cap (uFlipRatio), so a strained tile's border races frantically.
const neonBorderVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const neonBorderFragmentShader = `
  uniform vec3  uColor;      // antipodal ("other side") color of the displaced tile
  uniform float uTime;       // shared wispyTime — advances every frame
  uniform float uFlipRatio;  // flips / cap → worms race faster & burn hotter near death
  varying vec2  vUv;

  #define TAU 6.28318530718

  void main() {
    vec2 p = vUv - 0.5;              // -0.5 .. 0.5
    vec2 a = abs(p);
    float m = max(a.x, a.y);
    float edgeDist = 0.5 - m;        // 0 at the square edge, grows inward
    if (edgeDist > 0.16) discard;    // only the border band is ever lit

    // Perimeter coordinate s ∈ [0,1) running clockwise around the square.
    float s;
    if (p.y >= a.x)       s = (p.x + 0.5) * 0.25;          // top    L→R  0.00–0.25
    else if (p.x >= a.y)  s = 0.25 + (0.5 - p.y) * 0.25;   // right  T→B  0.25–0.50
    else if (-p.y >= a.x) s = 0.50 + (0.5 - p.x) * 0.25;   // bottom R→L  0.50–0.75
    else                  s = 0.75 + (p.y + 0.5) * 0.25;   // left   B→T  0.75–1.00

    // Band hugging the edge; its thickness wiggles along its length + over time so
    // the tube looks alive rather than a static rectangle.
    float wig = 1.0 + 0.35 * sin(s * TAU * 6.0 - uTime * 5.0);
    float bw  = 0.052 * wig;
    float band = 1.0 - smoothstep(0.0, bw, edgeDist);

    // Dim continuous neon tube around the whole square.
    float baseGlow = band * 0.28;

    // Chasing light-worms: bright heads + comet tails racing around the loop. Each
    // worm runs a touch faster than the one ahead so they visibly chase and bunch;
    // the whole pack accelerates with flip count.
    const int N = 3;
    float speed   = 0.09 + uFlipRatio * 0.60;  // laps / sec: calm → frantic
    float headLen = 0.045;
    float tailLen = 0.10;
    float worms = 0.0;
    for (int i = 0; i < N; i++) {
      float fi = float(i);
      float sp = speed * (1.0 + fi * 0.10);                 // faster ⇒ catches the next
      float head = fract(fi / float(N) + uTime * sp);
      head = fract(head + 0.006 * sin(uTime * 9.0 + fi * 2.0)); // slither wiggle
      float sd = fract(s - head + 0.5) - 0.5;               // signed wrap distance
      float h = exp(-(sd * sd) / (headLen * headLen));      // glowing head
      float tail = sd < 0.0 ? exp(sd / tailLen) * 0.55 : 0.0; // comet tail behind it
      worms += max(h, tail);
    }
    worms = clamp(worms, 0.0, 1.4) * band;

    float glow = baseGlow + worms;
    // Colored tube, white-hot at the worm heads. Hotter overall as the tile nears death.
    vec3 col = uColor * (0.9 + 0.7 * uFlipRatio);
    col = mix(col, vec3(1.0), clamp(worms - 0.45, 0.0, 1.0) * 0.7);

    float alpha = clamp(glow, 0.0, 1.0);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col * 1.6, alpha);
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

const StickerPlane = function StickerPlane({ meta, pos, rot = [0, 0, 0], overlay, mode, faceRow, faceCol, faceSize, hollow, currentDir: _currentDir, surfaceTileKey }) {
  // Static game config — set once at game start, rarely changes during active play.
  // Kept in one shallow selector so tile-style/palette changes still reach all stickers.
  const { biomeEnabled, chaosLevel, disparityFlipCap, settings, faceTextures, mergeMode, mergeTheme, wormHealerMode, perfReducedFX } = useGameStore(
    useShallow((s) => ({
      biomeEnabled: s.settings?.biomeMode?.enabled ?? false,
      chaosLevel: s.chaosLevel,
      disparityFlipCap: s.disparityFlipCap,
      settings: s.settings,
      faceTextures: s.faceTextures,
      mergeMode: s.mergeMode,
      mergeTheme: s.mergeTheme,
      wormHealerMode: s.wormHealerMode ?? false,
      perfReducedFX: s.perfReducedFX ?? false,
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
  // The tile's outward normal expressed in the parent (cubie) frame. groupRef holds
  // the tile's own rotation, so "out of the cube" is local +Z rotated by `rot` — the
  // blink bounce offsets groupRef.position along this.
  const rotX = rot[0] ?? 0;
  const rotY = rot[1] ?? 0;
  const rotZ = rot[2] ?? 0;
  const outwardNormal = useMemo(
    () => new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(rotX, rotY, rotZ)),
    [rotX, rotY, rotZ]
  );
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
  // Whether the current in-progress flip is a disparity (eyelid) flip.
  const isDisparityFlipRef = useRef(false);
  // How many eyelid blinks this flip plays (1 for a normal flip), how fast the
  // flip timer runs (progress per second — slower when there are more blinks to
  // fit in), and how far each blink shoves the tile out of the cube.
  const blinkCountRef = useRef(1);
  const spinRateRef = useRef(1 / BLINK_BASE_DUR); // 2 = the original single-beat flip
  const blinkBounceRef = useRef(0);
  // Eyelid blink overlay — used instead of spinReveal for disparity flips.
  const eyelidOverlayRef = useRef();
  const eyelidMatRef = useRef();
  const [eyelidUniforms] = React.useState(() => ({
    uColorTo: { value: new THREE.Color() },
    uProgress: { value: 1.0 },
    uTime: { value: 0.0 },
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
    uTime: wispyTime, // shared reference — updated once per frame externally
    uLens: { value: 0.0 },
    uFlipRatio: { value: 0.0 }, // flips / flipCap — drives glow strength + pulse speed
  }));
  // Neon worm-border — glowing square outline with light-worms chasing around it.
  // Replaces the old solid parity ring. Shares wispyTime so it animates every frame.
  const neonBorderMatRef = useRef();
  const [neonBorderUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color() },
    uTime: wispyTime, // shared reference — updated once per frame externally
    uFlipRatio: { value: 0.0 },
  }));
  // Worm-mode rim glow — heartbeat ring on flipped tiles in worm healer mode
  const wormRimGroupRef = useRef();
  const wormRimMatRef = useRef();
  const [wormRimUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color() },
    uTime: { value: 0 },
    uIntensity: { value: 0 },
  }));
  // Worm footprint — the tile's grid square lit up while the worm's weight is on it.
  // The group carries the lit square down with the tile; the sticker itself sinks on
  // innerGroupRef (see the press block in tickImpl).
  const footprintGroupRef = useRef();
  const footprintMatRef = useRef();
  const [footprintUniforms] = React.useState(() => ({
    uColor: { value: new THREE.Color('#33ff66') },
    uPress: { value: 0 },
    uTime: wispyTime, // shared reference — advanced once per frame externally
  }));
  // Split so the press and the flip counter-kick can both drive innerGroupRef.position.z
  // without either clobbering the other; applyInnerZ() writes their sum.
  const innerShockZ = useRef(0);
  const innerPressZ = useRef(0);
  const applyInnerZ = () => {
    if (innerGroupRef.current) innerGroupRef.current.position.z = innerShockZ.current + innerPressZ.current;
  };

  // Dispose shader materials on unmount to prevent GPU program / texture leaks.
  // These are imperative Three.js material refs (not React DOM refs), assigned
  // lazily when conditional JSX renders them.  We intentionally read .current at
  // cleanup time to catch whatever was last rendered before unmount.
  useEffect(() => {
    return () => {
      spiderMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      crackMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      seamLeakMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      eyelidMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      spinRevealMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      wispyRingMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      neonBorderMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      wormRimMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
      footprintMatRef.current?.dispose(); // eslint-disable-line react-hooks/exhaustive-deps
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
  const shakeDurationRef = useRef(0.4);
  const pulseT = useRef(0);
  // Single boolean gate: skip the entire useFrame body on idle frames.
  // Cleared when all transient effects (flip, shake, tremor) finish, avoiding
  // the multi-condition bail-out that evaluated several ref lookups every frame.
  const isActiveRef = useRef(false);
  // Holds the real tick body, reassigned every render so it always closes over this
  // render's refs/props — exactly like useFrame's own internal callback ref. The
  // StickerAnimationManager registers a stable wrapper around this once on mount and
  // only invokes it while this sticker's key is in the active set.
  const tickImplRef = useRef(null);
  const flipFromColor = useRef(null);
  const flipToColor = useRef(null);
  const flipFromTexture = useRef(null);
  const flipToTexture = useRef(null);
  // Healing resets meta.flips before its flip animation starts. Keep the dedicated
  // mesh and reveal FX mounted across that state change; refs alone cannot influence
  // the render-time instancing decision.
  const [keepFlipMeshMounted, setKeepFlipMeshMounted] = useState(false);
  // Track if we're currently in a flip animation - prevents race condition
  // between React state updates and Three.js imperative rendering
  const isFlipping = useRef(false);
  // Previous blink-phase value — used to detect the exact frame the midpoint is
  // crossed. On a multi-blink parity flip it wraps once per blink, so each blink
  // gets its own crossing.
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
  // Physical-piece manifold id — written to flipBurstMap during flips, and the key
  // the shared animation manager ticks/activates this sticker under (the worm
  // wakes tiles by gridId). In every mode except Worm, StickerPlane is keyed by
  // this identity so it remounts when a turn moves a different piece into its slot,
  // and the id is effectively constant for the component's life. Worm mode instead
  // keys by grid slot (StickerPlane persists across turns to avoid the rotation-end
  // remount storm), so the id can change under a live component — recompute it every
  // render and keep the ref (read by the tick + FX-map cleanup) in sync.
  const stickerGridId = meta ? getManifoldGridId(meta, faceSize) : null;
  const stickerGridIdRef = useRef(stickerGridId);
  stickerGridIdRef.current = stickerGridId;
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
      if (stickerGridIdRef.current) {
        flipBurstMap.delete(stickerGridIdRef.current);
        stickerFlipMotion.delete(stickerGridIdRef.current);
      }
    };
  }, []);

  // Register this sticker's tick with the shared animation manager once on mount.
  // The wrapper forwards to tickImplRef so it stays valid even though tickImplRef.current
  // is reassigned every render. Tiles that already sit in a persistent wormhole state at
  // mount (loaded mid-game, or surviving a re-mount) activate immediately so their ring/
  // hazard fx start running without waiting for a flip event.
  // Re-runs when the physical identity changes. In non-Worm modes stickerGridId is
  // constant for the component's life (remount-on-turn), so this fires exactly once
  // like the old []-deps version. In Worm mode the component persists across turns,
  // so a turn that swaps a new piece into this slot re-keys the tick to the incoming
  // piece's gridId — the manager's stale-tick guard makes the unregister/register
  // pair safe regardless of the order sibling stickers run their effects in.
  useEffect(() => {
    const key = stickerGridId;
    if (!key) return undefined;
    const tickSticker = (state, delta) => tickImplRef.current?.(state, delta);
    registerSticker(key, tickSticker);
    if ((meta?.flips ?? 0) > 0 && meta?.curr !== meta?.orig) activateSticker(key);
    return () => unregisterSticker(key, tickSticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- meta read only at (re)register time
  }, [stickerGridId]);

  // Death rank from Disparity Mode — null if not in disparity game or tile not yet dead
  const deadRank = isDead ? deadRankRaw : null;

  // Imperative ref to FlipParticles — avoids re-rendering StickerPlane on every flip.
  const flipParticlesRef = useRef();
  // Imperative ref to FlipShockwave — the neon burst ring fired on each flip.
  const flipShockwaveRef = useRef();
  // Shockwave progress (1 = idle/spent). Advanced in tickImpl so it rides the
  // active-sticker registry instead of a per-sticker useFrame.
  const shockT = useRef(1);
  // Antipodal glow fill — the inward crossing collapse. Runs slower than the
  // shockwave so the "pulled through" read lands after the "punched out" one.
  const glowFillRef = useRef();
  const glowT = useRef(1);
  // Crossing bloom/chromatic flash (1 = idle) + hitstop freeze timer (seconds).
  const flipFlashRef = useRef();
  const flashT = useRef(1);
  const hitstopT = useRef(0);

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
      activateSticker(stickerGridIdRef.current);
    } else if (!isDead && wasDeadRef.current) {
      // Game was reset — wipe the death animation so no stale tombstone shows
      wasDeadRef.current = false;
      deathAnimT.current = -1;
      setDeathAnimDone(false);
      activateSticker(stickerGridIdRef.current);
    }
  }, [isDead]);

  const prevCurr = useRef(meta?.curr ?? 0);
  const prevFlips = useRef(meta?.flips ?? 0);

  // Identity-swap reset (Worm mode only in practice). Worm mode keys StickerPlane by
  // grid slot so it persists across turns — see Cubie's stickerKey — which means a
  // turn can move a DIFFERENT physical piece into this live component rather than
  // remounting it. That is the whole point (remounting ~150 stickers per turn is the
  // rotation-end lag on the 15x15 board), but it means the flip trackers and any
  // in-flight flip/heal visuals still belong to the OUTGOING piece. Re-sync them to
  // the incoming piece so the swap is not misread as a flip (which would fire a
  // spurious squish) and no overlay lingers from the piece that left. Runs as a
  // layout effect BEFORE the materialColor sync below, so that effect sees the reset
  // prevCurr and paints the incoming color rather than a stale flip-pending color.
  // In every other mode the physical-identity key forces a remount, so stickerGridId
  // never changes under a mounted component and this effect is inert after mount.
  const prevGridIdRef = useRef(stickerGridId);
  useLayoutEffect(() => {
    if (prevGridIdRef.current === stickerGridId) return; // mount, or no identity change
    prevGridIdRef.current = stickerGridId;
    prevCurr.current = meta?.curr ?? 0;
    prevFlips.current = meta?.flips ?? 0;
    isFlipping.current = false;
    setKeepFlipMeshMounted(false);
    spinT.current = 0;
    shakeT.current = 0;
    shockT.current = 1;
    glowT.current = 1;
    flashT.current = 1;
    hitstopT.current = 0;
    healTRef.current = -1;
    wormIntroT.current = 0;
    ringFlashRef.current = 0;
    prevRawP.current = 0;
    blinkBounceRef.current = 0;
    innerShockZ.current = 0;
    innerPressZ.current = 0;
    applyInnerZ();
    if (eyelidOverlayRef.current) eyelidOverlayRef.current.visible = false;
    if (spinRevealRef.current) spinRevealRef.current.visible = false;
    if (spiderPlaneRef.current) spiderPlaneRef.current.visible = false;
    if (healSealRef.current) healSealRef.current.visible = false;
    setShowWormIntro(false); // React bails out when already false — no extra render
    // eslint-disable-next-line react-hooks/exhaustive-deps -- meta read only on identity change
  }, [stickerGridId]);

  useEffect(() => {
    const curr = meta?.curr ?? 0;
    const flips = meta?.flips ?? 0;
    const prevVal = prevCurr.current;
    const prevFlipCount = prevFlips.current;
    const didNewFlip = flips > prevFlipCount;
    const didHeal = flips < prevFlipCount;

    // Standardize all flip sources (manual + chaos/disparity) to use the same visual pipeline.
    // In disparity bursts a tile can be flipped multiple times between React commits, so curr can
    // end up unchanged while flips still increased; we still run the manual-style squish/reveal.
    const didAntipodalColorSwap = curr !== prevVal && ANTIPODAL_COLOR[prevVal] === curr;
    // Healing restores odd flip parity to zero. Give that color restoration the
    // same squish/reveal motion as a manual flip instead of snapping immediately.
    if ((didNewFlip && (didAntipodalColorSwap || curr === prevVal))
        || (didHeal && didAntipodalColorSwap)) {
      // Mark as animating to prevent React state from interrupting
      isFlipping.current = true;
      if (didHeal) setKeepFlipMeshMounted(true);
      activateSticker(stickerGridIdRef.current);
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
      // Disparity flip (odd flip count → tile enters wormhole state) → eyelid blink.
      // Normal flip → spinning rim reveal.
      isDisparityFlipRef.current = flips % 2 === 1;
      // One blink per flip the tile is carrying (capped), and the flip timer is
      // stretched to fit them: the first blink keeps its normal length, the extra
      // ones are quicker. Normal flips stay a single 0.5 s beat exactly as before.
      blinkCountRef.current = blinkCountForFlips(flips, isDisparityFlipRef.current);
      spinRateRef.current = blinkFlipRate(blinkCountRef.current);
      blinkBounceRef.current = 0;
      if (isDisparityFlipRef.current) {
        // Overlay shows TO color at 0.5 alpha (NormalBlending) over the FROM mesh.
        // Both colors simultaneously visible = superposition blend.
        if (eyelidOverlayRef.current && eyelidMatRef.current && flipToColor.current) {
          eyelidMatRef.current.uniforms.uColorTo.value.set(flipToColor.current);
          eyelidMatRef.current.uniforms.uProgress.value = 1.0;
          eyelidMatRef.current.uniforms.uTime.value = 0.0;
          eyelidOverlayRef.current.visible = true;
        }
      } else {
        // Activate spin-reveal immediately with FROM color at full disc coverage.
        if (spinRevealRef.current && spinRevealMatRef.current && flipFromColor.current) {
          spinRevealMatRef.current.uniforms.uColor.value.set(flipFromColor.current);
          spinRevealMatRef.current.uniforms.uProgress.value = 1.0;
          spinRevealRef.current.visible = true;
        }
      }
      // Restore the correct FROM texture now that flipFromTexture is known, and ensure the
      // mesh is visible so living/patterned styles show through the additive rim glow.
      if (!isInstancedRef.current && meshRef.current) {
        const mat = meshRef.current?.material;
        if (mat?.color && flipFromColor.current) {
          mat.map = flipFromTexture.current || null;
          mat.color.set(flipFromTexture.current ? '#ffffff' : flipFromColor.current);
          mat.needsUpdate = true;
        } else if (mat?.uniforms?.baseColor && flipFromColor.current) {
          // Shader tile-style: React already swapped the mesh to the antipodal (TO)
          // style at frame 0, so the style "pops" while only color animates. Override
          // it back to the FROM style for the first half; the midpoint swaps it to TO,
          // so the antipodal style flips in with the animation. (Solid FROM has no
          // style to show — leave the TO style visible in that case.)
          const fromStyleName = manifoldStyles?.[prevVal] || 'solid';
          if (fromStyleName !== 'solid') {
            const fromAntiHex = fc[ANTIPODAL_COLOR[prevVal]] ?? null;
            meshRef.current.material = getTileStyleMaterial(fromStyleName, flipFromColor.current, false, null, fromAntiHex);
          }
        }
        meshRef.current.visible = true;
      }
      // Keep instanceColorRef updated so the manager doesn't show stale color if the tile
      // transitions back to instanced rendering after the animation ends.
      if (isInstancedRef.current && flipFromColor.current) {
        instanceColorRef.current.setStyle(flipFromColor.current);
      }
      flipParticlesRef.current?.trigger(fc[curr]);
      flipShockwaveRef.current?.trigger(fc[curr]);
      shockT.current = 0;
      glowFillRef.current?.trigger(fc[curr]);
      glowT.current = 0;
      // Camera micro-kick along the tile's outward normal (recoil out); the tile
      // itself punches the other way in tickImpl (innerGroupRef −Z, into the cube).
      if (groupRef.current) {
        groupRef.current.getWorldQuaternion(_flipWorldQuat);
        _flipWorldN.set(0, 0, 1).applyQuaternion(_flipWorldQuat);
        const dangerT = effectiveFlipCap > 0 ? Math.min(1, flips / effectiveFlipCap) : 0;
        fireFlipImpulse(_flipWorldN, 0.05 + dangerT * 0.035);
      }
      play('/sounds/flip.mp3');
      vibrateFlip(flips, effectiveFlipCap);
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

  tickImplRef.current = (state, delta) => {
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

    // Disparity tap-heal: particles only, no white seal overlay.
    if (stickerGridIdRef.current && healParticleMap.get(stickerGridIdRef.current)) {
      healParticleMap.delete(stickerGridIdRef.current);
      const origHealColor = meta?.orig ? fc[meta.orig] : '#ffffff';
      healParticlesRef.current?.trigger(origHealColor);
    }

    // ── Worm footprint: the tile carrying the worm's weight ────────────────────
    // press comes from the shared spring (worm/tilePressBridge) and can overshoot
    // slightly negative as the tile rebounds. Three cues, because a 0.03-unit
    // displacement on its own is nearly invisible head-on and only reads at a
    // glancing angle: the tile sinks, it narrows a little so the grid channel
    // around it opens up (which is what carries the effect when you are looking
    // straight down at the face), and its square lights up.
    //
    // Sits ahead of the idle gate, and feeds it: a tile whose only activity is
    // being stood on has to run, and — just as important — has to get one last
    // frame at press 0 to put itself back flat before it goes to sleep.
    let pressBusy = false;
    if (wormHealerMode) {
      const press = getWormPress(surfaceTileKey);
      pressBusy = press !== 0 || innerPressZ.current !== 0;
      if (pressBusy) {
        innerPressZ.current = -press * PRESS_DEPTH;
        applyInnerZ();
        if (innerGroupRef.current) {
          const shrink = 1 - Math.max(0, press) * PRESS_SHRINK;
          innerGroupRef.current.scale.set(shrink, shrink, 1);
        }
        const fpGroup = footprintGroupRef.current;
        if (fpGroup) {
          const lit = press > 0.01;
          fpGroup.visible = lit;
          if (lit) {
            // Half the tile's own sink: the lit square lives in the channel wall
            // between this tile and its neighbours, not on the tile's face.
            fpGroup.position.z = -press * PRESS_DEPTH * 0.5;
            footprintUniforms.uPress.value = press;
            footprintUniforms.uColor.value.set(wormPress.color);
          }
        }
      }
    }

    // Single-boolean gate: skip the entire body on idle frames.
    // Ensure we trigger animation if the tile is flipped (since ghost tile needs uTime updates).
    // If we need to transition the ghost tile (e.g. going from active to dormant), run at least one more frame.
    // wormhole keeps the loop alive so the indicator ring pulses while the tile is in disparity.
    const anyActive = pressBusy || spinT.current > 0 || shakeT.current > 0 || showWormholeHazardFx || needsGhostUpdate || (spiderPlaneRef.current?.visible && !showGhostTile) || wormIntroT.current > 0 || healTRef.current >= 0 || shockT.current < 1 || flashT.current < 1 || hitstopT.current > 0 || (wormhole && !isSudokube);
    if (!anyActive) {
      isActiveRef.current = false;
      deactivateSticker(stickerGridIdRef.current);
      return;
    }
    isActiveRef.current = true;

    // Update Ghost Tile spiral animation if flipped
    if (showGhostTile && spiderPlaneRef.current && spiderMatRef.current) {
      spiderPlaneRef.current.visible = true;
      spiderMatRef.current.uniforms.uColor.value.set(antipodalHexRef.current ?? baseColorRef.current);
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
    // Hitstop: at the manifold crossing the flip freezes for a few frames so the
    // punch "lands" — meanwhile the shockwave / bloom-flash / camera-kick keep
    // blasting. When the freeze bleeds out, the squish resumes from the crossing
    // pose. (The existing flip body below is unchanged, just moved to else-if.)
    if (spinT.current > 0 && groupRef.current && hitstopT.current > 0) {
      hitstopT.current = Math.max(0, hitstopT.current - delta);
    } else if (spinT.current > 0 && groupRef.current) {
      const dt = Math.min(delta * spinRateRef.current, spinT.current);
      spinT.current -= dt;
      const rawP = 1 - spinT.current;

      // Blink phase: rawP is the progress of the whole flip, `p` is the progress of
      // the blink currently playing. A single-blink flip has p === rawP, so nothing
      // downstream changes for normal flips; a multi-blink parity flip replays the
      // same 0→1 squish once per blink.
      const { blinkIdx, p } = blinkPhase(rawP, blinkCountRef.current);

      // Crossing beat — fires as the tile passes the seam (p crosses 0.5). The first
      // crossing is the real identification event (hitstop + style swap); the extra
      // blinks of a damaged tile re-fire the bloom flash only, so they read as
      // after-shocks rather than repeated crossings.
      const atCrossing = prevRawP.current < 0.5 && p >= 0.5;
      if (atCrossing) {
        flashT.current = 0;
        flipFlashRef.current?.trigger();
      }
      if (atCrossing && blinkIdx === 0) {
        hitstopT.current = 0.05; // ~3 frames
        // Swap the shader-style mesh to the antipodal (TO) style while it's squished
        // shut, so the style reveals with the expand rather than popping at frame 0.
        if (!isInstancedRef.current && meshRef.current?.material?.uniforms?.baseColor
            && tileStyleRef.current && tileStyleRef.current !== 'solid') {
          meshRef.current.material = getTileStyleMaterial(
            tileStyleRef.current, baseColorRef.current, false, null, antipodalHexRef.current);
        }
      }

      // Card-flip squish: compress to 0 at midpoint then expand back.
      // Eyelid (disparity) → squish scale.y (vertical, top+bottom converge to center).
      // Normal flip → squish scale.x (horizontal card rotation).
      const halfT = p < 0.5 ? p * 2.0 : (p - 0.5) * 2.0;
      const easedHalf = halfT * halfT * (3.0 - 2.0 * halfT);
      // Shader-facing squish stays a clean 0→1 (drives dissolve / eyelid uniforms below).
      const flipSquish = Math.max(0.001, p < 0.5 ? 1.0 - easedHalf : easedHalf);

      // ── The snap ────────────────────────────────────────────────────────────
      // First half collapses cleanly to the seam. Second half does NOT ease flat to
      // rest — it OVERSHOOTS past full size then settles (easeOutBack), the tactile
      // "click into place". The overshoot bites harder the closer the tile is to its
      // flip cap, so a strained tile snaps back with visible violence. The cross axis
      // conserves apparent volume (bulge while thin, pinch on the overshoot) so the
      // whole tile reads as a physical membrane snapping, not a flat scale tween.
      let mainScale;
      if (p < 0.5) {
        mainScale = flipSquish;
      } else {
        const dangerT = effectiveFlipCap > 0 ? Math.min(1, (meta?.flips ?? 0) / effectiveFlipCap) : 0;
        const c1 = 1.70158 * (1.0 + dangerT * 0.7);
        const c3 = c1 + 1.0;
        const tb = halfT - 1.0;
        mainScale = Math.max(0.001, 1.0 + c3 * tb * tb * tb + c1 * tb * tb);
      }
      const squash = Math.min(1.0, mainScale);
      const overshoot = Math.max(0.0, mainScale - 1.0);
      const crossScale = 1.0 + (1.0 - squash) * 0.16 - overshoot * 0.6;
      if (isDisparityFlipRef.current) {
        groupRef.current.scale.set(crossScale, mainScale, 1);
      } else {
        groupRef.current.scale.set(mainScale, crossScale, 1);
      }
      groupRef.current.rotation.y = rot[1];
      groupRef.current.rotation.z = rot[2];

      // Broadcast flip progress so WormholeTunnel can arch-lift in sync.
      if (stickerGridIdRef.current) flipBurstMap.set(stickerGridIdRef.current, rawP);

      // Vibration: tile strains against the manifold crossing, peaks at midpoint.
      const vibEnv = Math.sin(p * Math.PI);
      const jX = Math.sin(p * Math.PI * 18) * 0.022 * vibEnv;
      const jY = Math.cos(p * Math.PI * 13) * 0.014 * vibEnv;

      // Blink bounce: the tile physically shoves out of the cube along its own
      // outward normal as the eyelid shuts, peaking with the lids closed and
      // settling back as they open — the sine bell a manual flip pops the cubie
      // with. Reach grows with the flip count and eases off over a blink burst.
      if (isDisparityFlipRef.current) {
        blinkBounceRef.current = blinkBounce(p, meta?.flips ?? 1, blinkIdx);
      }
      const b = blinkBounceRef.current;
      groupRef.current.position.x = pos[0] + jX + outwardNormal.x * b;
      groupRef.current.position.y = pos[1] + jY + outwardNormal.y * b;
      groupRef.current.position.z = pos[2] + outwardNormal.z * b;

      // Publish the live motion so anything welded to this tile can ride it —
      // the wormhole ribbon and cords anchor here and would otherwise stay rigid
      // while the tile shakes and squashes underneath them.
      if (stickerGridIdRef.current) {
        stickerFlipMotion.set(stickerGridIdRef.current, { p: rawP, jx: jX, jy: jY, squash, bounce: b });
      }

      if (isDisparityFlipRef.current) {
        // Eyelid overlay: uProgress tracks flipSquish directly (1=open, 0=closed).
        if (eyelidOverlayRef.current && eyelidMatRef.current) {
          eyelidMatRef.current.uniforms.uProgress.value = flipSquish;
          eyelidMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
        // Midpoint: ring flash only. Mesh keeps FROM color — overlay is already showing
        // TO at 0.5 alpha, so both colors remain blended until the animation ends.
        // Every blink in the burst flashes the ring, not just the first.
        if (atCrossing) {
          if (ringRef.current) { ringRef.current.material.opacity = 0.9; ringFlashRef.current = 1; }
        }
      } else {
        // Normal flip — spinning rim reveal.
        // First half: contract FROM colour disc into glass (progress 1.0 → 0.0 as tile squishes).
        if (p < 0.5 && spinRevealRef.current && spinRevealMatRef.current) {
          const contractProgress = Math.max(0.0, 1.0 - p / 0.5);
          spinRevealMatRef.current.uniforms.uProgress.value = contractProgress;
          spinRevealMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
          spinRevealMatRef.current.uniforms.uDissolve.value = flipSquish;
        }
        // Midpoint: switch rim glow and mesh to TO color.
        if (atCrossing) {
          if (spinRevealRef.current && spinRevealMatRef.current && flipToColor.current) {
            spinRevealMatRef.current.uniforms.uColor.value.set(flipToColor.current);
            spinRevealMatRef.current.uniforms.uProgress.value = 0.0;
            spinRevealMatRef.current.uniforms.uDissolve.value = flipSquish;
            spinRevealRef.current.visible = true;
          }
          if (!isInstancedRef.current && meshRef.current) {
            const mat = meshRef.current?.material;
            if (mat?.color) {
              const finalTex = currTextureRef.current;
              mat.map = finalTex || null;
              mat.color.set(finalTex ? '#ffffff' : baseColorRef.current);
              mat.needsUpdate = true;
            }
          }
          if (ringRef.current) { ringRef.current.material.opacity = 0.9; ringFlashRef.current = 1; }
        }
        // Second half: drive the spin-reveal inward as the tile expands back.
        if (p >= 0.5 && spinRevealRef.current && spinRevealMatRef.current) {
          const revealProgress = Math.min(1.0, (p - 0.5) * 2.0);
          spinRevealMatRef.current.uniforms.uProgress.value = revealProgress;
          spinRevealMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
          spinRevealMatRef.current.uniforms.uDissolve.value = flipSquish;
        }
      }

      prevRawP.current = p;

      if (spinT.current <= 0) {
        isFlipping.current = false;
        setKeepFlipMeshMounted(false);
        // Hide overlays and commit the final face color/texture to the mesh.
        if (spinRevealRef.current) spinRevealRef.current.visible = false;
        if (eyelidOverlayRef.current) eyelidOverlayRef.current.visible = false;
        groupRef.current.scale.set(1, 1, 1);
        groupRef.current.rotation.y = rot[1];
        groupRef.current.rotation.z = rot[2];
        groupRef.current.position.set(pos[0], pos[1], pos[2]);
        if (stickerGridIdRef.current) {
          flipBurstMap.delete(stickerGridIdRef.current);
          stickerFlipMotion.delete(stickerGridIdRef.current);
        }
        // The more times this tile has already been flipped, the harder it shakes —
        // a visible sense of accumulating damage as it nears its flip cap.
        {
          const dangerT = effectiveFlipCap > 0 ? Math.min(1, (meta?.flips ?? 0) / effectiveFlipCap) : 0;
          shakeDurationRef.current = 0.4 + dangerT * 0.35;
          shakeT.current = shakeDurationRef.current;
        }
        flipFromColor.current = null;
        flipToColor.current = null;
        flipFromTexture.current = null;
        flipToTexture.current = null;
        prevRawP.current = 0;
        blinkBounceRef.current = 0;
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

    // Shake animation for parity indicator — amplitude and duration both grow
    // with flip count (set at trigger via shakeDurationRef), so damaged tiles
    // visibly rattle harder as they approach their flip cap.
    if (shakeT.current > 0 && groupRef.current) {
      const duration = shakeDurationRef.current || 0.4;
      const dangerT = Math.min(1, Math.max(0, (duration - 0.4) / 0.35));
      const dt = Math.min(delta * 2, shakeT.current);
      shakeT.current -= dt;
      const intensity = shakeT.current * 2; // Decay from 1 to 0
      const shakeFreq = 25;
      const shakeX = Math.sin(shakeT.current * shakeFreq * Math.PI) * 0.03 * intensity;
      const shakeZ = Math.cos(shakeT.current * shakeFreq * Math.PI * 1.3) * 0.02 * intensity;
      // Bounce pop: a quick vertical hop that only appears as the tile nears
      // death — undamaged tiles (dangerT 0) shake in place with no lift.
      const bounceProgress = Math.min(1, 1 - shakeT.current / duration);
      const bounce = Math.sin(bounceProgress * Math.PI) * 0.06 * dangerT;
      groupRef.current.position.x = pos[0] + shakeX;
      groupRef.current.position.y = pos[1] + bounce;
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

    // Flip shockwave — advance here (active-registry gated) rather than in a
    // per-sticker useFrame. ~0.45 s burst, then idles transparent at 1.
    if (shockT.current < 1) {
      shockT.current = Math.min(1, shockT.current + Math.min(delta, 0.05) * 2.2);
      flipShockwaveRef.current?.setProgress(shockT.current);
      // Tile counter-kick: as the camera recoils OUT along the tile normal, the
      // tile punches IN (local −Z, into the cube) with a quick damped shake. Driven
      // on innerGroupRef so it never collides with the squish/shake/tremor writers
      // on groupRef. Settles to exactly 0.
      const u = shockT.current;
      innerShockZ.current = u >= 1 ? 0 : -0.07 * Math.exp(-4.5 * u) * Math.sin(u * Math.PI * 3.0);
      applyInnerZ();
    }

    // Antipodal glow fill — ~0.55 s, the slowest of the three so the collapse
    // is still resolving as the shockwave ring leaves the tile.
    if (glowT.current < 1) {
      glowT.current = Math.min(1, glowT.current + Math.min(delta, 0.05) * 1.8);
      glowFillRef.current?.setProgress(glowT.current);
    }

    // Crossing bloom/chromatic flash — advances faster than the shockwave (~0.2 s).
    if (flashT.current < 1) {
      flashT.current = Math.min(1, flashT.current + Math.min(delta, 0.05) * 5.0);
      flipFlashRef.current?.setProgress(flashT.current);
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

  };

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
  // Dead (capped) tiles render flat gray with no decorative style, so a board of
  // spent tiles reads as spent and the surviving pair actually stands out.
  const tileStyle = isDead
    ? 'solid'
    : biomeGroundTexture
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

  // Performance fallback: at size >= 6 each sticker's 3D volume style (lava, ice, water,
  // neural, circuit, galaxy, wood, grass) adds 3-6 extra meshes/draw calls on top of the
  // already-large sticker count (294 at size 7). Hide the volume layer and fall back to
  // the flat shader-styled sticker quad beneath it, which is unaffected by this flag.
  // Also drops on perfReducedFX (set by App.jsx's PerformanceMonitor on a sustained frame-
  // rate decline) so smaller cube sizes get the same fallback on underpowered devices.
  const suppressVolumeFX = (faceSize ?? 3) >= 6 || perfReducedFX;

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
  const nextCurr = meta?.curr ?? 0;
  const nextFlips = meta?.flips ?? 0;
  const hasPendingFlipAnimation = nextFlips !== prevFlips.current
    && nextCurr !== prevCurr.current
    && ANTIPODAL_COLOR[prevCurr.current] === nextCurr;
  const isInstanceable = (
    !!instanceCtx &&
    instancedSlotValid &&
    !hollow &&
    !isGlass &&
    !isSudokube &&
    !biomeEnabled &&
    !currTexture &&
    tileStyle === 'solid' &&
    !(meta?.flips > 0) && // Cannot instance if it has a ghost tile spider web (active or dormant)
    !hasPendingFlipAnimation &&
    !keepFlipMeshMounted
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
    const isFlipPending = hasPendingFlipAnimation;
    // Always keep the instanced-mesh color ref current, even when this sticker is
    // temporarily non-instanceable (the manager will zero its slot; the ref stays
    // ready for when it becomes instanceable again without a re-register).
    if (!isFlipping.current && spinT.current <= 0 && !isFlipPending) {
      instanceColorRef.current.setStyle(materialColor);
    }
    if (meshRef.current && meshRef.current.material && !isFlipping.current && spinT.current <= 0) {
      const mat = meshRef.current.material;
      if (isFlipPending) {
        // Paint the FROM color onto the mesh before the browser paints — closes the
        // commit→paint gap that would otherwise show one frame of the already-updated
        // TO color. The spinReveal is now an additive rim glow (not a full cover), so
        // the mesh must hold the correct color itself.
        const fromColor = fc[prevCurr.current];
        if (mat.color && fromColor) {
          mat.map = null; // texture restored in useEffect once flipFromTexture is known
          mat.color.set(fromColor);
          mat.needsUpdate = true;
          meshRef.current.visible = true;
        }
        // Pre-activate spinReveal rim glow.
        if (spinRevealRef.current && spinRevealMatRef.current && fromColor) {
          spinRevealMatRef.current.uniforms.uColor.value.set(fromColor);
          spinRevealMatRef.current.uniforms.uProgress.value = 1.0;
          spinRevealRef.current.visible = true;
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
      wispyRingMatRef.current.uniforms.uFlipRatio.value = effectiveFlipCap > 0 ? Math.min(1, (meta?.flips ?? 0) / effectiveFlipCap) : 0;
    }
    // Keep neon worm-border color + speed/heat in sync with tile state.
    if (neonBorderMatRef.current) {
      neonBorderMatRef.current.uniforms.uColor.value.set(antipodalHexRef.current ?? materialColor);
      neonBorderMatRef.current.uniforms.uFlipRatio.value = effectiveFlipCap > 0 ? Math.min(1, (meta?.flips ?? 0) / effectiveFlipCap) : 0;
    }
  }, [isInstanceable, materialColor, renderTexture, tileStyle, meta?.curr, meta?.flips, hasPendingFlipAnimation]);
  const isWormhole = meta?.flips > 0 && meta?.curr !== meta?.orig;
  const hasFlipHistory = meta?.flips > 0 || hasPendingFlipAnimation || keepFlipMeshMounted;

  const trackerRadius = Math.min(0.25, 0.06 + (meta?.flips ?? 0) * 0.012);
  const origColor = meta?.orig ? fc[meta.orig] : COLORS.black;
  const antipodalColor = meta?.orig ? fc[ANTIPODAL_COLOR[meta.orig]] : COLORS.black;

  // Check if colors are white - don't show white indicators on non-white tiles
  const currIsWhite = meta?.curr === 3;
  const origIsWhite = meta?.orig === 3;
  const _antipodalIsWhite = ANTIPODAL_COLOR[meta?.orig] === 3;

  return (
    <group position={pos} rotation={rot} ref={groupRef}>
      {/* Ghost spider web on the back of flipped tiles. Mounted only once a tile has
          any flip history — a never-flipped tile can never show it, so on a 15×15
          Mega shell the ~1,300 untouched tiles skip this mesh (and every transient
          flip/heal mesh below) entirely, shrinking the per-frame scene-graph walk.
          These meshes are visible={false} until an effect fires, so their shaders
          already compiled lazily on first use — gating changes node count, not
          compile timing. hasFlipHistory latches true on the flip that mounts them,
          the same commit whose flip-start effect then wires their refs. */}
      {hasFlipHistory && (
        <mesh ref={spiderPlaneRef} position={[0, 0, -1.01]} rotation={[0, Math.PI, 0]} visible={false}>
          <planeGeometry args={[0.92, 0.92]} />
          <shaderMaterial
            ref={spiderMatRef}
            vertexShader={spiderVertexShader}
            fragmentShader={spiderFragmentShader}
            uniforms={spiderUniforms}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Antipodal back face — visible from inside the cube; shows the RP² partner tile
          at 80% scale so the interior reads as distinct from the front face. */}
      {antipodalHex && (
        <mesh position={[0, 0, -0.012]} rotation={[0, Math.PI, 0]} scale={[0.8, 0.8, 1]}>
          <primitive object={_sharedStickerGeo} attach="geometry" />
          <meshStandardMaterial
            color={antipodalHex}
            roughness={0.45}
            metalness={0.08}
            side={THREE.FrontSide}
          />
        </mesh>
      )}

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
        {!isInstanceable && <mesh ref={meshRef} key={hollow ? 'frame' : useShaderStyle && tileStyle === 'eyeball' ? 'bulge' : 'plane'}>
          {hollow ? (
            <shapeGeometry args={[_stickerFrameShape]} />
          ) : faceRow != null ? (
            // Face-texture mode (Sudokube): per-instance geometry so UVs can be patched.
            <planeGeometry ref={geoRef} args={[0.85, 0.85]} />
          ) : useShaderStyle && tileStyle === 'eyeball' ? (
            // Eyeball style: tessellated plane so the bulge vertex shader can dome it.
            <primitive object={_bulgeStickerGeo} attach="geometry" />
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

        {/* 3D style volumes — suppressed for full-face GLBs that cover the entire tile,
            and at size >= 6 as a performance fallback (see suppressVolumeFX above) */}
        <group visible={!glbFullFace && !suppressVolumeFX}>
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

      {/* Color-bleed overlay removed — it was mounted (and drawn) on every sticker but
          only ever held at opacity 0; nothing ever animated it visible, so it was one
          wasted transparent draw call per sticker (294 at 7×7). */}

      {/* Eyelid blink overlay — disparity flip: NormalBlending at 0.5 alpha over the
          FROM-color mesh gives a simultaneous 50/50 superposition of both colors.
          Scale.y eyelid squish + lid-edge gleam ride on top of the blend.
          Gated on flip history (see spider-web note) — only ever fires on a flip. */}
      {hasFlipHistory && (
        <mesh ref={eyelidOverlayRef} position={[0, 0, 0.002]} visible={false} renderOrder={10}>
          <primitive object={_sharedStickerGeo} attach="geometry" />
          <shaderMaterial
            ref={eyelidMatRef}
            vertexShader={eyelidVertexShader}
            fragmentShader={eyelidFragmentShader}
            uniforms={eyelidUniforms}
            transparent
            depthTest={true}
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
      )}

      {/* Flip rim glow — additive edge ring that fires during the card-flip squish.
          Transparent in the center so living/patterned tile styles show through.
          AdditiveBlending adds energy to the tile surface rather than covering it.
          Gated on flip history (see spider-web note). */}
      {hasFlipHistory && (
        <mesh ref={spinRevealRef} position={[0, 0, 0.002]} visible={false} renderOrder={10}>
          <primitive object={_sharedStickerGeo} attach="geometry" />
          <shaderMaterial
            ref={spinRevealMatRef}
            vertexShader={spinRevealVertexShader}
            fragmentShader={spinRevealFragmentShader}
            uniforms={spinRevealUniforms}
            transparent
            blending={THREE.AdditiveBlending}
            depthTest={true}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Neon worm-border — replaces the old solid parity ring. A glowing SQUARE outline
          traced on the tile's own perimeter (like the neon view mode), with bright
          light-worms chasing one another around it. They wiggle as they slither and race
          faster as the tile nears its flip cap. Shown only while the tile is displaced
          (odd parity). Additive so it reads as neon over the dark cube frame.
          NOTE: ringRef stays declared — the flip midpoint/pulse code still references
          ringRef.current under null guards, so those branches simply no-op. */}
      {!isDead && !isSudokube && isWormhole && (
        <mesh position={[0, 0, 0.006]} renderOrder={2}>
          <primitive object={_neonBorderGeo} attach="geometry" />
          <shaderMaterial
            ref={neonBorderMatRef}
            vertexShader={neonBorderVertexShader}
            fragmentShader={neonBorderFragmentShader}
            uniforms={neonBorderUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Worm footprint — the tile's grid square lit up under the worm's weight, in the
          worm's own skin colour. Mounted for every tile in worm mode and left invisible
          until something stands on it: the alternative is mounting a mesh mid-crawl on
          the exact frame it first needs to be seen, which is a shader compile in the
          middle of a step. Sits a hair below the parity border's z so a flipped tile the
          worm is standing on shows both without them fighting.
          Normal blending, not additive: the inner shadow is the half of this that makes a
          tile look pressed rather than merely lit, and additive cannot darken. */}
      {wormHealerMode && !isDead && (
        <group ref={footprintGroupRef} visible={false}>
          <mesh position={[0, 0, 0.005]} renderOrder={2}>
            <primitive object={_neonBorderGeo} attach="geometry" />
            <shaderMaterial
              ref={footprintMatRef}
              vertexShader={neonBorderVertexShader}
              fragmentShader={wormFootprintFragmentShader}
              uniforms={footprintUniforms}
              transparent
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

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
          {/* Epitaph — RIP + tile ID engraved on the headstone (replaces the old
              cross, which mis-rendered as a "T"). Death rank is added only when the
              tile is ranked (disparity mode). Billboard keeps the text facing the
              camera as the cube is orbited. */}
          <Billboard position={[0, 0, 0.27]}>
            <Text position={[0, deadRank != null ? 0.12 : 0.05, 0]} fontSize={0.075} color={antipodalColor} anchorX="center" anchorY="middle" fontWeight={700} renderOrder={2} depthTest={false}>
              RIP
            </Text>
            <Text position={[0, deadRank != null ? 0 : -0.05, 0]} fontSize={0.04} color={antipodalColor} anchorX="center" anchorY="middle" renderOrder={2} depthTest={false}>
              {stickerGridIdRef.current}
            </Text>
            {deadRank != null && (
              <Text position={[0, -0.13, 0]} fontSize={0.062} color={antipodalColor} anchorX="center" anchorY="middle" fontWeight={700} renderOrder={2} depthTest={false}>
                #{deadRank}
              </Text>
            )}
          </Billboard>
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

      {/* Flip burst effects. Each fires only on a flip or animated heal transition,
          so a never-flipped Mega tile carries none of them.
          They mount on the flip that latches hasFlipHistory — the same commit whose
          flip-start effect wires the refs below — and every ref read is optional-
          chained, so an unmounted effect is simply a no-op. NOTE: the two HEAL
          effects below are intentionally NOT in this gate because their independent
          one-shot triggers may arrive without a flip transition. */}
      {hasFlipHistory && (
        <>
          {/* Particle burst effect during flip (manual + chaos/disparity). */}
          <FlipParticles ref={flipParticlesRef} />

          {/* Neon shockwave ring — bursts across the tile face at the flip moment. */}
          <FlipShockwave ref={flipShockwaveRef} />

          {/* Crossing bloom + chromatic flash — fires at the midpoint hitstop. */}
          <FlipFlash ref={flipFlashRef} />

          {/* Antipodal glow fill — edge ring collapses in as the core fills out. */}
          <AntipodalGlowFill ref={glowFillRef} />
        </>
      )}

      {/* Heal seal overlay — golden convergence ring + color bloom on wormhole heal.
          Kept mounted regardless of flip history: the heal resets flips to 0 before
          this animation is picked up (see note above). */}
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

      {/* Double-density golden particle burst on heal. Kept mounted for the same
          reason as the heal seal above. */}
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
// We care about the volatile fields curr (color) and flips (count) AND — for Worm
// mode's grid-slot keying — the physical identity (orig/origDir/origPos): there the
// same keyed component is reused as pieces turn through its slot, so a turn can hand
// it a different physical piece that happens to share curr/flips (very common on a
// solid Mega face where 225 tiles are one color). Without the identity check that
// swap would bail here, leaving stickerGridId — and the worm's gridId activation —
// bound to the piece that left. In non-Worm modes identity is frozen per key, so
// these extra checks never fire (no added re-renders). pos/rot are stable module
// constants so reference equality is sufficient.
function stickerPropsAreEqual(prev, next) {
  if (prev.pos !== next.pos || prev.rot !== next.rot) return false;
  if (prev.mode !== next.mode || prev.hollow !== next.hollow) return false;
  if (prev.faceSize !== next.faceSize) return false;
  if (prev.surfaceTileKey !== next.surfaceTileKey) return false;
  if (prev.faceRow !== next.faceRow || prev.faceCol !== next.faceCol) return false;
  if (prev.overlay !== next.overlay) return false;
  const pm = prev.meta, nm = next.meta;
  if (pm === nm) return true;
  if (!pm || !nm) return pm === nm;
  if (pm.curr !== nm.curr || pm.flips !== nm.flips) return false;
  if (pm.orig !== nm.orig || pm.origDir !== nm.origDir) return false;
  return pm.origPos?.x === nm.origPos?.x
    && pm.origPos?.y === nm.origPos?.y
    && pm.origPos?.z === nm.origPos?.z;
}

export default React.memo(StickerPlane, stickerPropsAreEqual);
