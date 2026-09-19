import { prefersReducedMotion, isMobile } from '../utils/device.js';
import { LIVING_SURFACE_KEYS } from '../utils/livingSurfaceCatalog.js';
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

// Styles that animate while selected, hovered or focused
const ANIMATED_STYLE_SET = new Set([
  ...LIVING_SURFACE_KEYS,
  'liquidCheckers', 'velvetFolds', 'dreamMarble', 'paradoxWeave',
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
  return _usingShared ? _imgDataCache.get(targetCanvas) : null;
}

// ── Registry ──────────────────────────────────────────────────────────────────

let idCounter = 0;
let simTime = 0;

// rAF loop — only used when NOT sharing the main renderer (own-renderer fallback)
let animFrameId = null;
let lastTimestamp = null;

// Map<id, { canvas, styleKey, colorHex, animated, dirty, visible, nextFrame }>
const registry = new Map();
let previewEntries = [];
// CPU snapshots survive grid unmounts. Bounded by both count and bytes, so
// unusual canvas sizes cannot turn the cache into an unbounded image store.
const snapshots = new Map();
let snapshotBytes = 0;
const SNAPSHOT_BYTES = 4 * 1024 * 1024;
function snapshotKey(info) {
  return `${info.styleKey}|${info.colorHex}|${info.canvas.width}|${info.canvas.height}`;
}
function rememberSnapshot(key, frame) {
  if (!frame || frame.data.byteLength > SNAPSHOT_BYTES) return;
  const copy = { width: frame.width, height: frame.height, data: frame.data.slice() };
  snapshots.set(key, copy);
  snapshotBytes += copy.data.byteLength;
  while (snapshots.size > 128 || snapshotBytes > SNAPSHOT_BYTES) {
    const oldest = snapshots.keys().next().value;
    snapshotBytes -= snapshots.get(oldest).data.byteLength;
    snapshots.delete(oldest);
  }
}

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
  const animate = info.animated && (info.active || info.hovered || info.focused) && !prefersReducedMotion();
  const key = snapshotKey(info);
  const cached = !animate && snapshots.get(key);
  if (cached) {
    const ctx = info.canvas.getContext('2d');
    const frame = imageDataFor(ctx, info.canvas, cached.width, cached.height);
    frame.data.set(cached.data);
    ctx.putImageData(frame, 0, 0);
    snapshots.delete(key); snapshots.set(key, cached);
  } else {
    const frame = renderToCanvas(info.styleKey, info.colorHex, animate ? simTime : 0, info.canvas);
    if (!animate) rememberSnapshot(key, frame);
  }
  info.dirty = false;
  // A grid mounts every one of its tiles on the same frame, so the first redraw
  // is where they get pulled apart; after that the interval keeps them apart.
  info.nextFrame = simTime + ANIMATED_STEP + (info.phased ? 0 : info.phase);
  info.phased = true;
}

let previewCursor = 0;
function tick(delta) {
  if (registry.size === 0) return;
  const reduced = prefersReducedMotion();
  if (!reduced) simTime += Math.min(delta, 0.1);
  const entries = previewEntries;
  const start = previewCursor % entries.length;
  let budget = isMobile ? 2 : 4;
  for (let offset = 0; offset < entries.length; offset++) {
    const index = (start + offset) % entries.length;
    const info = entries[index];
    if (!info.visible) continue;
    if (!info.dirty && (reduced || !info.animated || !(info.active || info.hovered || info.focused) || simTime < info.nextFrame)) continue;
    drawPreview(info);
    previewCursor = (index + 1) % entries.length;
    if (--budget === 0) break;
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

export function registerTilePreview(canvas, styleKey, colorHex, active = false) {
  const id = ++idCounter;
  registry.set(id, {
    canvas,
    styleKey,
    colorHex,
    active, hovered: false, focused: false,
    animated: isAnimatedPreviewStyle(styleKey),
    dirty: true,
    // Without IntersectionObserver, still images render once and active
    // previews use the normal animation budget.
    visible: true,
    nextFrame: 0,
    phase: (id % PHASE_SLOTS) * (ANIMATED_STEP / PHASE_SLOTS),
    phased: false,
  });
  previewEntries = [...registry.values()];
  const info = registry.get(id);
  // Listen on the owning card, including its label, and support keyboard focus.
  const target = canvas.closest?.('button') || canvas;
  const listeners = [
    ['pointerenter', () => { info.hovered = true; info.nextFrame = simTime; }],
    ['pointerleave', () => { info.hovered = false; info.dirty = true; }],
    ['focusin', () => { info.focused = true; info.nextFrame = simTime; }],
    ['focusout', () => { info.focused = false; info.dirty = true; }],
  ];
  for (const [event, handler] of listeners) target.addEventListener?.(event, handler);
  let observer;
  if (typeof IntersectionObserver === 'function') {
    info.visible = false;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) setTilePreviewVisible(id, entry.isIntersecting);
    }, { rootMargin: '120px' });
    observer.observe(canvas);
  }
  info.cleanup = () => {
    observer?.disconnect();
    for (const [event, handler] of listeners) target.removeEventListener?.(event, handler);
  };
  maybeStartLoop();
  return id;
}

export function updateTilePreview(id, styleKey, colorHex) {
  const info = registry.get(id);
  if (!info) return;
  if (info.styleKey === styleKey && info.colorHex === colorHex) return;
  info.styleKey = styleKey;
  info.colorHex = colorHex;
  info.animated = isAnimatedPreviewStyle(styleKey);
  info.dirty = true;
}

/**
 * Report whether a preview is on screen. Off-screen previews stop animating —
 * the style grid is a scrolling list of ~46 tiles in the Living family alone and
 * only a handful are ever in view. Changed previews redraw on their next visible,
 * budgeted frame.
 */
export function setTilePreviewVisible(id, visible) {
  const info = registry.get(id);
  if (!info || info.visible === visible) return;
  info.visible = visible;
  if (visible) info.nextFrame = simTime;
}

export function setTilePreviewActive(id, active) {
  const info = registry.get(id);
  if (!info || info.active === active) return;
  info.active = active;
  info.dirty = true;
  info.nextFrame = simTime;
}

export function unregisterTilePreview(id) {
  registry.get(id)?.cleanup();
  registry.delete(id);
  previewEntries = [...registry.values()];
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
