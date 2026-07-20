// TilePreviewRenderer.js
// Renders tile-style preview thumbnails using the shared R3F renderer so no
// second WebGL context is ever created (which would crash on mobile).
//
// Usage:
//   • Place <TilePreviewHost /> inside the R3F <Canvas> in App.jsx. It calls
//     setSharedRenderer(gl) and drives tickPreviews() each frame via useFrame.
//   • Call registerTilePreview / updateTilePreview / unregisterTilePreview from
//     TilePreviewCanvas UI components as before.

import * as THREE from 'three';
import { getTileStyleMaterial } from './styles/TileStyleMaterials.jsx';

const PREVIEW_SIZE = 64;

// Styles that need continuous per-frame animation
const ANIMATED_STYLE_SET = new Set([
  'holographic', 'pulse', 'lava', 'galaxy', 'circuit',
  'grass', 'ice', 'sand', 'water', 'neural',
  'moireRings', 'moireLines', 'infinityTunnel', 'vortex', 'shockwave',
  'oilSlick', 'constellation', 'waveform', 'dnaHelix', 'neonSign',
  'prismBloom', 'magnetFlux', 'liquidChrome', 'auroraWeave', 'plasmaCells',
  'quantumScanlines', 'emberstorm', 'fractalPulse', 'bioLattice', 'stellarLensing',
  'orbChamber', 'liquidTank', 'dice', 'sandChamber', 'lavaLamp', 'eyeball',
]);

export function isAnimatedPreviewStyle(styleKey) {
  return ANIMATED_STYLE_SET.has(styleKey);
}

// ── Renderer state ────────────────────────────────────────────────────────────

let renderer = null;      // set either by setSharedRenderer or ensureOwnRenderer
let _usingShared = false; // true when we borrowed the main R3F renderer
let _renderTarget = null; // WebGLRenderTarget used when sharing the main renderer
let _pixelBuf = null;     // Uint8Array for readRenderTargetPixels

let scene = null;
let camera = null;
let mesh = null;

function _initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
  camera.position.z = 1;
  const geo = new THREE.PlaneGeometry(1, 1);
  mesh = new THREE.Mesh(geo, null);
  scene.add(mesh);
}

/**
 * Called by TilePreviewHost (inside the R3F Canvas) to inject the main renderer.
 * This avoids creating a second WebGL context, which causes context loss on mobile.
 */
export function setSharedRenderer(gl) {
  if (renderer) return; // already initialised
  renderer = gl;
  _usingShared = true;
  _renderTarget = new THREE.WebGLRenderTarget(PREVIEW_SIZE, PREVIEW_SIZE, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });
  _pixelBuf = new Uint8Array(PREVIEW_SIZE * PREVIEW_SIZE * 4);
  _initScene();
}

// Fallback: create our own renderer if setSharedRenderer was never called
// (only expected in test environments or non-mobile desktop with plenty of contexts).
function ensureOwnRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE);
  renderer.setPixelRatio(1);
  _initScene();
}

// ── Core render ───────────────────────────────────────────────────────────────

function renderToCanvas(styleKey, colorHex, simTime, targetCanvas) {
  if (_usingShared) {
    if (!renderer || !_renderTarget) return;
  } else {
    ensureOwnRenderer();
    if (!renderer) return;
  }

  const mat = getTileStyleMaterial(styleKey, colorHex);
  let savedTime = null;
  if (mat.uniforms?.time) {
    savedTime = mat.uniforms.time.value;
    mat.uniforms.time.value = simTime;
  }
  mesh.material = mat;

  if (_usingShared) {
    // Save the render target R3F had set (restore it after so we don't break the main pipeline)
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(_renderTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(prevTarget);

    // Read pixels back to CPU (WebGL origin is bottom-left; Canvas is top-left → Y-flip)
    renderer.readRenderTargetPixels(_renderTarget, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE, _pixelBuf);

    const w = targetCanvas.width;
    const h = targetCanvas.height;
    const ctx = targetCanvas.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const sx = Math.floor(dx * PREVIEW_SIZE / w);
        const sy = Math.floor((h - 1 - dy) * PREVIEW_SIZE / h); // flip Y
        const si = (sy * PREVIEW_SIZE + sx) * 4;
        const di = (dy * w + dx) * 4;
        imgData.data[di    ] = _pixelBuf[si    ];
        imgData.data[di + 1] = _pixelBuf[si + 1];
        imgData.data[di + 2] = _pixelBuf[si + 2];
        imgData.data[di + 3] = _pixelBuf[si + 3];
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } else {
    renderer.render(scene, camera);
    const ctx = targetCanvas.getContext('2d');
    ctx.drawImage(renderer.domElement, 0, 0, targetCanvas.width, targetCanvas.height);
  }

  if (savedTime !== null) {
    mat.uniforms.time.value = savedTime;
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

let idCounter = 0;
let simTime = 0;

// rAF loop — only used when NOT sharing the main renderer (own-renderer fallback)
let animFrameId = null;
let lastTimestamp = null;

// Map<id, { canvas, styleKey, colorHex, animated, dirty }>
const registry = new Map();

/** Returns true when there are previews that need rendering. */
export function hasActivePreviews() { return registry.size > 0; }

/** Driven by TilePreviewHost's useFrame when using the shared renderer. */
export function tickPreviews(delta) {
  if (registry.size === 0) return;
  simTime += delta;
  for (const [, info] of registry) {
    if (info.animated || info.dirty) {
      renderToCanvas(info.styleKey, info.colorHex, simTime, info.canvas);
      info.dirty = false;
    }
  }
}

// Own rAF loop used only in the own-renderer (non-shared) fallback path
function loop(timestamp) {
  animFrameId = requestAnimationFrame(loop);
  const dt = lastTimestamp == null ? 0 : (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  simTime += dt;
  for (const [, info] of registry) {
    if (info.animated || info.dirty) {
      renderToCanvas(info.styleKey, info.colorHex, simTime, info.canvas);
      info.dirty = false;
    }
  }
}

function maybeStartLoop() {
  if (_usingShared) return; // TilePreviewHost drives ticks instead
  if (!animFrameId) {
    lastTimestamp = null;
    animFrameId = requestAnimationFrame(loop);
  }
}

function maybeStopLoop() {
  if (_usingShared) return;
  if (animFrameId && registry.size === 0) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
    lastTimestamp = null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function registerTilePreview(canvas, styleKey, colorHex) {
  const id = ++idCounter;
  registry.set(id, {
    canvas,
    styleKey,
    colorHex,
    animated: isAnimatedPreviewStyle(styleKey),
    dirty: true,
  });
  maybeStartLoop();
  return id;
}

export function updateTilePreview(id, styleKey, colorHex) {
  const info = registry.get(id);
  if (!info) return;
  info.styleKey = styleKey;
  info.colorHex = colorHex;
  info.animated = isAnimatedPreviewStyle(styleKey);
  info.dirty = true;
}

export function unregisterTilePreview(id) {
  registry.delete(id);
  maybeStopLoop();
}

/** True once the main R3F renderer has been shared (i.e. the <Canvas> is up). */
export function hasSharedRenderer() {
  return _usingShared && !!renderer;
}

/**
 * One-shot: render a tile style to a PNG data URL using the shared main renderer.
 * Returns null when the shared renderer isn't available yet (e.g. before the main
 * <Canvas> mounts) so callers can fall back to a plain look. Never creates a
 * second WebGL context, so it stays safe on mobile — unlike a standalone canvas.
 */
export function renderTileImage(styleKey, colorHex, size = 96) {
  if (!hasSharedRenderer() || !_renderTarget) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  try {
    renderToCanvas(styleKey, colorHex, simTime, canvas);
    return canvas.toDataURL();
  } catch {
    return null;
  }
}
