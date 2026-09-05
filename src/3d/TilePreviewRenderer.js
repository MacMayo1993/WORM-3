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
  'compass', 'spiritLevel', 'snowGlobe', 'lichtenberg', 'rainGlass', 'pond',
  'sundial', 'crystalGrowth', 'cymatics', 'turing',
  'orbChamber', 'liquidTank', 'dice', 'sandChamber', 'lavaLamp', 'eyeball',
  // Non-Euclidean (poincareDisk and apollonian are static — they stay out)
  'hyperbolicWeave', 'circleInversion', 'rp2Geodesics', 'solFlow', 'nilTwist',
  'lightCone', 'metricBalls', 'gyroidSlice', 'hopfFibers', 'drosteSpiral',
  // Impossible (triangle, fork and interlockingWings are static — they stay out)
  'endlessStairs', 'neckerFlip', 'mobiusBand',
  // Surreal (all six carry their own weather)
  'bowlerRain', 'dayOverNight', 'skyCurtain', 'paintedWindow', 'falseReflection', 'skyBird',
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

// One ImageData per canvas, reused across frames. Allocating a fresh 64² buffer
// per preview per frame was pure churn: the pixels are overwritten in full every
// time, so the only thing the allocation bought was garbage.
const _imgDataCache = new WeakMap();

function imageDataFor(ctx, canvas, w, h) {
  const cached = _imgDataCache.get(canvas);
  if (cached && cached.width === w && cached.height === h) return cached;
  const fresh = ctx.createImageData(w, h);
  _imgDataCache.set(canvas, fresh);
  return fresh;
}

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
    const imgData = imageDataFor(ctx, targetCanvas, w, h);
    const dst = imgData.data;
    if (w === PREVIEW_SIZE && h === PREVIEW_SIZE) {
      // Same resolution as the render target: the only work left is the Y flip,
      // and a whole row copies at once.
      const rowBytes = PREVIEW_SIZE * 4;
      for (let dy = 0; dy < h; dy++) {
        const si = (h - 1 - dy) * rowBytes;
        dst.set(_pixelBuf.subarray(si, si + rowBytes), dy * rowBytes);
      }
    } else {
      for (let dy = 0; dy < h; dy++) {
        const sy = Math.floor((h - 1 - dy) * PREVIEW_SIZE / h); // flip Y
        const rowStart = sy * PREVIEW_SIZE;
        let di = dy * w * 4;
        for (let dx = 0; dx < w; dx++, di += 4) {
          const si = (rowStart + Math.floor(dx * PREVIEW_SIZE / w)) * 4;
          dst[di    ] = _pixelBuf[si    ];
          dst[di + 1] = _pixelBuf[si + 1];
          dst[di + 2] = _pixelBuf[si + 2];
          dst[di + 3] = _pixelBuf[si + 3];
        }
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

// Map<id, { canvas, styleKey, colorHex, animated, dirty, visible, nextFrame }>
const registry = new Map();

/** Returns true when there are previews that need rendering. */
export function hasActivePreviews() { return registry.size > 0; }

// Every drawn preview frame costs a render-target render plus a synchronous
// readRenderTargetPixels, which stalls the CPU on the GPU. The style grid mounts
// one canvas per style — dozens of them, most of them animated — so at the main
// loop's rate that is hundreds of GPU syncs a second for thumbnails a couple of
// centimetres across. 20fps looks the same on a 56px tile and costs a third as
// much; the cube and worm plates already run on their own budgets for the same
// reason.
const ANIMATED_FPS = 20;
const ANIMATED_STEP = 1 / ANIMATED_FPS;
// Spread the redraws across the interval instead of letting every visible tile
// land its readback on the same frame — the average cost is identical, the spike
// is not.
const PHASE_SLOTS = 5;

function drawPreview(info) {
  renderToCanvas(info.styleKey, info.colorHex, simTime, info.canvas);
  info.dirty = false;
  // A grid mounts every one of its tiles on the same frame, so the first redraw
  // is where they get pulled apart; after that the interval keeps them apart.
  info.nextFrame = simTime + ANIMATED_STEP + (info.phased ? 0 : info.phase);
  info.phased = true;
}

function tick(delta) {
  if (registry.size === 0) return;
  simTime += delta;
  for (const info of registry.values()) {
    if (info.dirty) {
      // A style/colour change has to show up whether or not the tile is on
      // screen: the canvas keeps its last frame until something redraws it.
      drawPreview(info);
      continue;
    }
    if (!info.animated || !info.visible) continue;
    if (simTime < info.nextFrame) continue;
    drawPreview(info);
  }
}

/** Driven by TilePreviewHost's useFrame when using the shared renderer. */
export function tickPreviews(delta) {
  tick(delta);
}

// Own rAF loop used only in the own-renderer (non-shared) fallback path
function loop(timestamp) {
  animFrameId = requestAnimationFrame(loop);
  const dt = lastTimestamp == null ? 0 : (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  tick(dt);
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
    // Previews start visible: a caller that never reports visibility (the
    // per-face plates, the store) keeps the old always-animating behaviour.
    visible: true,
    nextFrame: 0,
    phase: (id % PHASE_SLOTS) * (ANIMATED_STEP / PHASE_SLOTS),
    phased: false,
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

/**
 * Report whether a preview is on screen. Off-screen previews stop animating —
 * the style grid is a scrolling list of ~46 tiles in the Living family alone and
 * only a handful are ever in view. A style change still redraws immediately, so
 * a tile that scrolls back in is never stale.
 */
export function setTilePreviewVisible(id, visible) {
  const info = registry.get(id);
  if (!info || info.visible === visible) return;
  info.visible = visible;
  if (visible) info.nextFrame = simTime;
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
  // The shared renderer belongs to the main <Canvas>. On the co-op path that
  // Canvas has unmounted and its context is lost — rendering would spew WebGL
  // errors — so bail to the flat-cube fallback.
  const glCtx = renderer.getContext?.();
  if (!glCtx || glCtx.isContextLost?.()) return null;
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
