// TilePreviewRenderer.js
// Shared off-screen WebGL renderer for tile style preview thumbnails.
// Uses a single Three.js renderer to avoid hitting browser WebGL context limits.

import * as THREE from 'three';
import { getTileStyleMaterial } from './styles/TileStyleMaterials.jsx';

const PREVIEW_SIZE = 64;

// Styles that need per-frame animation
const ANIMATED_STYLE_SET = new Set([
  'holographic', 'pulse', 'lava', 'galaxy', 'circuit',
  'grass', 'ice', 'sand', 'water', 'neural',
]);

export function isAnimatedPreviewStyle(styleKey) {
  return ANIMATED_STYLE_SET.has(styleKey);
}

// ── Shared renderer state ────────────────────────────────────────────────────

let renderer = null;
let scene = null;
let camera = null;
let mesh = null;

function ensureRenderer() {
  if (renderer) return;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE);
  renderer.setPixelRatio(1);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);

  // Orthographic camera looking straight at a unit plane
  camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
  camera.position.z = 1;

  const geo = new THREE.PlaneGeometry(1, 1);
  mesh = new THREE.Mesh(geo, null);
  scene.add(mesh);
}

/** Render a style+color combo to the shared renderer then blit to targetCanvas. */
function renderToCanvas(styleKey, colorHex, simTime, targetCanvas) {
  ensureRenderer();

  const mat = getTileStyleMaterial(styleKey, colorHex);
  // Temporarily override the time uniform so previews animate on our local clock,
  // then restore it so the main scene's material is not affected.
  let savedTime = null;
  if (mat.uniforms && mat.uniforms.time) {
    savedTime = mat.uniforms.time.value;
    mat.uniforms.time.value = simTime;
  }
  mesh.material = mat;

  renderer.render(scene, camera);

  const ctx = targetCanvas.getContext('2d');
  ctx.drawImage(renderer.domElement, 0, 0, targetCanvas.width, targetCanvas.height);

  if (savedTime !== null) {
    mat.uniforms.time.value = savedTime;
  }
  // Do NOT dispose — the LRU cache owns this material instance.
}

// ── Subscription registry ────────────────────────────────────────────────────

let idCounter = 0;
let animFrameId = null;
let simTime = 0;
let lastTimestamp = null;

// Map<id, { canvas, styleKey, colorHex, animated, dirty }>
const registry = new Map();

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
  if (!animFrameId) {
    lastTimestamp = null;
    animFrameId = requestAnimationFrame(loop);
  }
}

function maybeStopLoop() {
  if (animFrameId && registry.size === 0) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
    lastTimestamp = null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a canvas element to receive tile preview renders.
 * Returns a numeric ID that can be used to update or unregister.
 */
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

/**
 * Update the style or color for a registered preview.
 * Triggers an immediate re-render on the next frame.
 */
export function updateTilePreview(id, styleKey, colorHex) {
  const info = registry.get(id);
  if (!info) return;
  info.styleKey = styleKey;
  info.colorHex = colorHex;
  info.animated = isAnimatedPreviewStyle(styleKey);
  info.dirty = true;
}

/**
 * Unregister a canvas when its component unmounts.
 */
export function unregisterTilePreview(id) {
  registry.delete(id);
  maybeStopLoop();
}
