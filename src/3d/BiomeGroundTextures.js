// src/3d/BiomeGroundTextures.js
//
// Bakes one 128×128 CanvasTexture per city at module load.
// Zero per-tile cost — imported as a singleton map.
// All randomness uses mulberry32 for determinism (same seed = same texture every time).
//
// Usage:
//   import { BIOME_GROUND_TEXTURES } from './BiomeGroundTextures.js';
//   const texture = BIOME_GROUND_TEXTURES['frozenCitadel'];

import * as THREE from 'three';
import { mulberry32 } from '../modes/CityBiomeMode.js';

const SIZE = 128;

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  return canvas;
}

// Remap a value from [0,1] rng to [min,max]
function rr(rng, min, max) {
  return min + rng() * (max - min);
}

// Draw a soft radial gradient blob
function blob(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Simple 2D value noise via canvas pixel sampling
// Returns a function noiseAt(x, y) → [0,1]
function buildValueNoise(rng, gridSize = 8) {
  const cells = gridSize + 1;
  const grid = Array.from({ length: cells }, () =>
    Array.from({ length: cells }, () => rng())
  );
  return function noiseAt(u, v) {
    const gx = u * gridSize, gy = v * gridSize;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, gridSize), y1 = Math.min(y0 + 1, gridSize);
    const fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (
      grid[y0][x0] * (1 - sx) * (1 - sy) +
      grid[y0][x1] * sx * (1 - sy) +
      grid[y1][x0] * (1 - sx) * sy +
      grid[y1][x1] * sx * sy
    );
  };
}

// Voronoi: returns closest-cell distance [0,1] at (u,v)
function buildVoronoi(rng, numPoints = 24) {
  const pts = Array.from({ length: numPoints }, () => ({ x: rng(), y: rng() }));
  return function voronoiAt(u, v) {
    let best = Infinity;
    for (const p of pts) {
      const dx = p.x - u, dy = p.y - v;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < best) best = d;
    }
    return Math.min(best * Math.sqrt(numPoints), 1);
  };
}


// ── 1. Frozen Citadel ─────────────────────────────────────────────────────────
// Snow-pack ground with frost-crack Voronoi and embedded ice crystal glints.
function generateFrozenGround() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(0x1CE0F1CE);

  const noise = buildValueNoise(rng, 12);
  const voronoi = buildVoronoi(rng, 30);

  const imgData = ctx.createImageData(SIZE, SIZE);
  const d = imgData.data;

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const u = px / SIZE, v = py / SIZE;
      const n = noise(u, v);
      const vor = voronoi(u, v);

      // Base: pale ice blue-white
      let r = 200 + n * 50;
      let g = 220 + n * 30;
      let b = 240 + n * 15;

      // Voronoi crack lines — dark blue crevices at cell edges
      const crackEdge = Math.max(0, 1 - vor * 12); // sharp at low vor
      r -= crackEdge * 80;
      g -= crackEdge * 60;
      b -= crackEdge * 20;

      // Frost glints — bright white specular dots
      const glint = rng() > 0.994 ? 1 : 0;
      r += glint * 40;
      g += glint * 40;
      b += glint * 40;

      const i = (py * SIZE + px) * 4;
      d[i] = Math.min(255, Math.max(0, r));
      d[i + 1] = Math.min(255, Math.max(0, g));
      d[i + 2] = Math.min(255, Math.max(0, b));
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Overlay: scattered surface frost patches
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 14; i++) {
    blob(ctx, rr(rng, 0, SIZE), rr(rng, 0, SIZE), rr(rng, 4, 18), '#E8F4FF');
  }
  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(canvas);
}

// ── 2. Deep Station ───────────────────────────────────────────────────────────
// Abyssal ocean floor — dark silt, soft sediment dunes, bioluminescent plankton.
function generateDeepGround() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(0xDEEA5EE4);

  const noise = buildValueNoise(rng, 10);
  const noise2 = buildValueNoise(rng, 6);

  const imgData = ctx.createImageData(SIZE, SIZE);
  const d = imgData.data;

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const u = px / SIZE, v = py / SIZE;
      const n = noise(u, v);
      const n2 = noise2(u, v);

      // Base: deep navy silt
      let r = Math.round(0 + n * 12);
      let g = Math.round(18 + n * 22 + n2 * 10);
      let b = Math.round(48 + n * 40 + n2 * 20);

      // Sediment ridge lines — slightly lighter bands
      const ridge = Math.abs(Math.sin((u * 7 + n * 2) * Math.PI));
      g += Math.round(ridge * ridge * 10);
      b += Math.round(ridge * ridge * 18);

      // Bioluminescent plankton dots — teal sparks
      const plankton = rng() > 0.992 ? rng() : 0;
      r += Math.round(plankton * 0);
      g += Math.round(plankton * 180);
      b += Math.round(plankton * 160);

      const i = (py * SIZE + px) * 4;
      d[i] = Math.min(255, Math.max(0, r));
      d[i + 1] = Math.min(255, Math.max(0, g));
      d[i + 2] = Math.min(255, Math.max(0, b));
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Soft glow pools — areas of concentrated bioluminescence
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 6; i++) {
    blob(ctx, rr(rng, 0, SIZE), rr(rng, 0, SIZE), rr(rng, 8, 28), '#00CED1');
  }
  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(canvas);
}

// ── 3. Volcanic Foundry ───────────────────────────────────────────────────────
// Cooled lava crust — dark basalt with glowing magma fissures along Voronoi edges.
function generateVolcanicGround() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(0xC0C14C40);

  const voronoi = buildVoronoi(rng, 20);
  const noise = buildValueNoise(rng, 8);

  const imgData = ctx.createImageData(SIZE, SIZE);
  const d = imgData.data;

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const u = px / SIZE, v = py / SIZE;
      const n = noise(u, v);
      const vor = voronoi(u, v);

      // Base: dark basalt — near black with slight warm tint
      let r = Math.round(20 + n * 18);
      let g = Math.round(8 + n * 8);
      let b = Math.round(4 + n * 4);

      // Lava fissures at Voronoi cell boundaries — hot orange-red glow
      const fissure = Math.max(0, 1 - vor * 9);
      const glow = fissure * fissure; // sharpen
      r += Math.round(glow * 220);
      g += Math.round(glow * 80);
      b += Math.round(glow * 0);

      // Sub-surface ember patches — faint orange bleed through crust
      const ember = Math.max(0, n - 0.72) * 5;
      r += Math.round(ember * 60);
      g += Math.round(ember * 20);

      const i = (py * SIZE + px) * 4;
      d[i] = Math.min(255, Math.max(0, r));
      d[i + 1] = Math.min(255, Math.max(0, g));
      d[i + 2] = Math.min(255, Math.max(0, b));
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

// ── 4. Solar Arcology ─────────────────────────────────────────────────────────
// Desert hardpan — warm sand with directional dune ripples and scattered pebbles.
function generateSolarGround() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(0x501A4C01);

  const noise = buildValueNoise(rng, 10);
  const noise2 = buildValueNoise(rng, 20);

  const imgData = ctx.createImageData(SIZE, SIZE);
  const d = imgData.data;

  // Dune ripple angle — consistent per tile
  const angle = Math.PI * 0.18;
  const cosA = Math.cos(angle), sinA = Math.sin(angle);

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const u = px / SIZE, v = py / SIZE;
      const n = noise(u, v);
      const n2 = noise2(u, v);

      // Ripple coordinate — project onto dune direction
      const rippleCoord = u * cosA + v * sinA;
      const ripple = 0.5 + 0.5 * Math.sin(rippleCoord * 28 + n * 3);

      // Base: warm ochre-gold sand
      let r = Math.round(190 + ripple * 30 + n * 20);
      let g = Math.round(150 + ripple * 20 + n * 15);
      let b = Math.round(70 + ripple * 8 + n * 10);

      // Fine grain variation
      r += Math.round((n2 - 0.5) * 20);
      g += Math.round((n2 - 0.5) * 15);
      b += Math.round((n2 - 0.5) * 8);

      // Dark pebbles
      const pebble = rng() > 0.988 ? rng() : 0;
      r -= Math.round(pebble * 60);
      g -= Math.round(pebble * 50);
      b -= Math.round(pebble * 30);

      const i = (py * SIZE + px) * 4;
      d[i] = Math.min(255, Math.max(0, r));
      d[i + 1] = Math.min(255, Math.max(0, g));
      d[i + 2] = Math.min(255, Math.max(0, b));
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Heat shimmer haze — faint gold bloom near center
  ctx.globalAlpha = 0.10;
  blob(ctx, SIZE * 0.5, SIZE * 0.5, SIZE * 0.4, '#FFD700');
  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(canvas);
}

// ── 5. Bio-Dome ────────────────────────────────────────────────────────────────
// Jungle floor — deep humus, root network veins, moss patches, bioluminescent spores.
function generateBioGround() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(0xB10D011E);

  const noise = buildValueNoise(rng, 8);
  const noise2 = buildValueNoise(rng, 16);

  const imgData = ctx.createImageData(SIZE, SIZE);
  const d = imgData.data;

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const u = px / SIZE, v = py / SIZE;
      const n = noise(u, v);
      const n2 = noise2(u, v);

      // Base: rich dark humus
      let r = Math.round(18 + n * 20);
      let g = Math.round(30 + n * 28 + n2 * 10);
      let b = Math.round(10 + n * 12);

      // Moss patches — brighter green blotches
      const moss = Math.max(0, n - 0.55) * 3.5;
      r += Math.round(moss * 15);
      g += Math.round(moss * 60);
      b += Math.round(moss * 10);

      // Root veins — using directional streaks from noise gradients
      const veinH = Math.abs(n - 0.5) < 0.04 ? 1 : 0;
      const veinV = Math.abs(n2 - 0.5) < 0.035 ? 1 : 0;
      const vein = Math.max(veinH, veinV);
      r += Math.round(vein * 30);
      g += Math.round(vein * 20);
      b += Math.round(vein * 8);

      // Bioluminescent spores — neon green sparks
      const spore = rng() > 0.994 ? rng() : 0;
      r -= Math.round(spore * 5);
      g += Math.round(spore * 200);
      b -= Math.round(spore * 5);

      const i = (py * SIZE + px) * 4;
      d[i] = Math.min(255, Math.max(0, r));
      d[i + 1] = Math.min(255, Math.max(0, g));
      d[i + 2] = Math.min(255, Math.max(0, b));
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Ambient glow of photosynthesis — soft green light from below
  ctx.globalAlpha = 0.08;
  blob(ctx, SIZE * 0.4, SIZE * 0.6, SIZE * 0.45, '#39FF14');
  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(canvas);
}

// ── 6. Neural Hub ─────────────────────────────────────────────────────────────
// Dark circuit-board floor — near-black with orthogonal trace lines, node pads, violet pulses.
function generateNeuralGround() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(0xEA174177);

  const imgData = ctx.createImageData(SIZE, SIZE);
  const d = imgData.data;

  // Base fill: near-black indigo
  for (let i = 0; i < SIZE * SIZE * 4; i += 4) {
    d[i] = 6; d[i + 1] = 6; d[i + 2] = 18; d[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // PCB trace grid — thin orthogonal lines
  const traceSpacing = 12;
  const traceAlpha = 0.22;
  ctx.strokeStyle = '#8B00FF';
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = traceAlpha;
  for (let x = traceSpacing / 2; x < SIZE; x += traceSpacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SIZE); ctx.stroke();
  }
  for (let y = traceSpacing / 2; y < SIZE; y += traceSpacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
  }

  // Node pads at grid intersections (not all — skip some for variety)
  ctx.fillStyle = '#8B00FF';
  ctx.globalAlpha = 0.55;
  for (let x = traceSpacing / 2; x < SIZE; x += traceSpacing) {
    for (let y = traceSpacing / 2; y < SIZE; y += traceSpacing) {
      if (rng() > 0.45) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Horizontal traces — some thicker "bus" lines
  ctx.globalAlpha = 0.30;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#6600CC';
  const busRows = [22, 55, 90, 110];
  busRows.forEach(y => {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
  });

  // Glowing node hotspots — orange signal pulses
  ctx.globalAlpha = 0.60;
  for (let i = 0; i < 7; i++) {
    const x = Math.round(rr(rng, 1, SIZE / traceSpacing - 1)) * traceSpacing + traceSpacing / 2;
    const y = Math.round(rr(rng, 1, SIZE / traceSpacing - 1)) * traceSpacing + traceSpacing / 2;
    blob(ctx, x, y, rr(rng, 3, 7), '#FF6B00');
  }

  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(canvas);
}

// ── Bake all 6 at module load ─────────────────────────────────────────────────
// Wrapped in a try/catch so a canvas API failure in non-browser environments
// (e.g., test runners) doesn't explode the import.

let BIOME_GROUND_TEXTURES = {};

try {
  BIOME_GROUND_TEXTURES = {
    frozenCitadel:   generateFrozenGround(),
    deepStation:     generateDeepGround(),
    volcanicFoundry: generateVolcanicGround(),
    solarArcology:   generateSolarGround(),
    bioDome:         generateBioGround(),
    neuralHub:       null, // base.sand.glb provides the ground — no procedural texture
  };

  // Flip Y so canvas pixel (0,0) maps to UV bottom-left, matching Three.js convention
  Object.values(BIOME_GROUND_TEXTURES).filter(Boolean).forEach(tex => {
    tex.flipY = true;
    tex.needsUpdate = true;
  });
} catch (e) {
  console.warn('[BiomeGroundTextures] Canvas generation failed:', e);
}

export { BIOME_GROUND_TEXTURES };
