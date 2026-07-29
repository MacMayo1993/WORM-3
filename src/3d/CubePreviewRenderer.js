// CubePreviewRenderer.js
// Renders a live 3D cube — the real tile shaders, the real palette, the real
// piece count — for the setup wizards, through the shared R3F renderer so no
// second WebGL context is ever created (which would crash on mobile).
//
// The wizards used to describe the cube you were building rather than show it:
// a palette was six flat swatches, a tile style was one 56px quad, and cube size
// was a grid of CSS dots. Nothing ever put those three choices in the same
// picture, which is the one picture that matters. This draws that picture, and
// redraws it the moment any of the three changes.
//
// Usage mirrors WormPreviewRenderer:
//   • <TilePreviewHost /> inside the R3F <Canvas> calls setCubeSharedRenderer(gl)
//     and drives tickCubePreviews() each frame.
//   • UI components call registerCubePreview / updateCubePreview /
//     unregisterCubePreview (see CubePreviewCanvas.jsx).

import * as THREE from 'three';
import { getTileStyleMaterial, sharedUniforms } from './styles/TileStyleMaterials.jsx';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';
import { ALL_TILE_STYLE_KEYS } from '../utils/tileStyleCatalog.js';

// ─── Cube geometry constants ─────────────────────────────────────────────────
// The preview cube is normalised to one unit across whatever its piece count, so
// growing a 3×3 into a 7×7 reads as "more pieces" rather than "bigger cube" —
// which is what the size slider is actually choosing.
const CUBE_SPAN = 1;
const BODY_SPAN = 0.985;      // just inside the sticker shell, so no z-fighting
const STICKER_FILL = 0.85;    // fraction of a cell a sticker covers, as in Cubie
const STICKER_LIFT = 0.5005;  // distance from centre to the sticker plane

// Face id → outward direction, matching the project's face numbering
// (1=PZ, 2=NX, 3=PY, 4=NZ, 5=PX, 6=NY) and Cubie's sticker rotations.
const FACES = [
  { id: 1, axis: [0, 0, 1], rot: [0, 0, 0] },
  { id: 2, axis: [-1, 0, 0], rot: [0, -Math.PI / 2, 0] },
  { id: 3, axis: [0, 1, 0], rot: [-Math.PI / 2, 0, 0] },
  { id: 4, axis: [0, 0, -1], rot: [0, Math.PI, 0] },
  { id: 5, axis: [1, 0, 0], rot: [0, Math.PI / 2, 0] },
  { id: 6, axis: [0, -1, 0], rot: [Math.PI / 2, 0, 0] }
];

// Antipodal partners on RP2: red↔orange, green↔blue, white↔yellow. Antipodal
// tile styles bake the partner colour into their material, so the preview has to
// pass the same pairing the played cube uses or the op-art reads wrong.
const ANTIPODE = { 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3 };

// ─── Renderer state ───────────────────────────────────────────────────────────

let renderer = null;
let _usingShared = false;
const _targets = new Map();   // size → WebGLRenderTarget
const _buffers = new Map();   // size → { pixels, image }

let scene = null;
let camera = null;
let rig = null;               // built lazily, rebuilt when the piece count changes

// ─── Scene ────────────────────────────────────────────────────────────────────

// One plane per sticker. `eyeball` displaces its surface in the vertex shader, so
// it needs interior vertices to bend — the same split StickerPlane makes.
const _flatGeo = new THREE.PlaneGeometry(1, 1);
const _bulgeGeo = new THREE.PlaneGeometry(1, 1, 12, 12);

function _buildRig(n) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(BODY_SPAN, BODY_SPAN, BODY_SPAN),
    new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.25, metalness: 0.15 })
  );
  group.add(body);

  // Sticker planes, grouped by face. Each face group is turned so its local +Z
  // is the outward normal, which lets the tiles lay out in a plain local XY grid.
  const cell = CUBE_SPAN / n;
  const faces = FACES.map(face => {
    const faceGroup = new THREE.Group();
    faceGroup.position.set(face.axis[0] * STICKER_LIFT, face.axis[1] * STICKER_LIFT, face.axis[2] * STICKER_LIFT);
    faceGroup.rotation.set(face.rot[0], face.rot[1], face.rot[2]);

    const tiles = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const tile = new THREE.Mesh(_flatGeo, null);
        tile.position.set((col + 0.5) * cell - CUBE_SPAN / 2, (row + 0.5) * cell - CUBE_SPAN / 2, 0);
        tile.scale.setScalar(cell * STICKER_FILL);
        faceGroup.add(tile);
        tiles.push(tile);
      }
    }
    group.add(faceGroup);
    return { id: face.id, tiles };
  });

  return { group, body, faces, n };
}

function _disposeRig() {
  if (!rig) return;
  scene.remove(rig.group);
  rig.body.geometry.dispose();
  rig.body.material.dispose();
  // Tile geometries and materials are shared/cached elsewhere — only the meshes
  // themselves are ours to drop.
  rig = null;
}

function _initScene() {
  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  // Far enough back that the body diagonal (√3 × the span) still clears the
  // frame at every point in the tumble.
  camera.position.set(0, 0, 3.5);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const key = new THREE.DirectionalLight(0xfff6e2, 2.2);
  key.position.set(0.8, 1.2, 1.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd8ff, 0.9);
  fill.position.set(-1, -0.4, 0.6);
  scene.add(fill);
}

/** Called by TilePreviewHost (inside the R3F Canvas) to inject the main renderer. */
export function setCubeSharedRenderer(gl) {
  if (renderer) return;
  if (fallbackTimer !== null) { clearTimeout(fallbackTimer); fallbackTimer = null; }
  renderer = gl;
  _usingShared = true;
  _initScene();
  for (const info of registry.values()) info.dirty = true;
}

function ensureOwnRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  _initScene();
}

function _targetFor(size) {
  let target = _targets.get(size);
  if (!target) {
    target = new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      samples: 4          // MSAA — a cube is all straight edges, and jaggies show
    });
    _targets.set(size, target);
  }
  return target;
}

function _bufferFor(size, ctx) {
  let buf = _buffers.get(size);
  if (!buf) {
    buf = { pixels: new Uint8Array(size * size * 4), image: ctx.createImageData(size, size) };
    _buffers.set(size, buf);
  }
  return buf;
}

// ─── Cube dressing ────────────────────────────────────────────────────────────

/** Deterministic style for a face under "Random Mix" — stable across renders. */
function _randomStyleFor(faceId) {
  return ALL_TILE_STYLE_KEYS[(faceId * 7 + 3) % ALL_TILE_STYLE_KEYS.length];
}

/** The style a given face should wear, honouring per-face overrides and Random Mix. */
export function resolveFaceStyle(faceId, tileStyle, perFaceStyles) {
  const perFace = perFaceStyles?.[faceId];
  if (perFace && perFace !== 'random') return perFace;
  if (tileStyle === 'random' || perFace === 'random') return _randomStyleFor(faceId);
  return tileStyle || 'solid';
}

function _dressCube(opts) {
  const colors = opts.colors || COLOR_SCHEMES.standard;
  for (const face of rig.faces) {
    const style = resolveFaceStyle(face.id, opts.tileStyle, opts.perFaceStyles);
    const colorHex = colors[face.id] || COLOR_SCHEMES.standard[face.id];
    const antiHex = colors[ANTIPODE[face.id]] || COLOR_SCHEMES.standard[ANTIPODE[face.id]];
    const material = getTileStyleMaterial(style, colorHex, false, null, antiHex);
    const geo = style === 'eyeball' ? _bulgeGeo : _flatGeo;
    for (const tile of face.tiles) {
      tile.material = material;
      if (tile.geometry !== geo) tile.geometry = geo;
    }
  }
}

// The idle tumble. Yaw carries the four side faces past the camera; a slower
// pitch swing rolls the top and bottom into view, so every colour in the palette
// comes around without the player touching anything. Their periods are
// deliberately coprime-ish, so the cube never settles into a repeating pose.
function _poseCube(opts, time) {
  const yawSpeed = opts.animated === false ? 0 : 0.55;
  const t = opts.animated === false ? 0 : time;
  rig.group.rotation.y = t * yawSpeed + (opts.yaw || 0);
  rig.group.rotation.x = -0.42 + Math.sin(t * 0.62) * 0.34 + (opts.pitch || 0);
  rig.group.rotation.z = Math.sin(t * 0.31) * 0.05;
}

// ─── Core render ──────────────────────────────────────────────────────────────

function renderToCanvas(opts, time, targetCanvas) {
  if (_usingShared) {
    if (!renderer) return;
    // On the co-op path the main <Canvas> has unmounted and its context is lost —
    // rendering would spew WebGL errors, so bail and leave the last frame up.
    const glCtx = renderer.getContext?.();
    if (!glCtx || glCtx.isContextLost?.()) return;
  } else {
    ensureOwnRenderer();
    if (!renderer) return;
  }

  const size = targetCanvas.width;
  if (!size) return;

  // The setup preview is deliberately representative for Mega Mode. Building a
  // literal 15×15 rig here creates 1,350 independent sticker meshes and redraws
  // them at 24 FPS while the player is still in the wizard — often more expensive
  // than the optimized game scene itself. A 7×7 proxy preserves the selected
  // palette/style and large-cube read without that transition-screen GPU spike.
  const requestedN = Math.max(2, Math.round(opts.size || 3));
  const n = Math.min(7, requestedN);
  if (!rig || rig.n !== n) {
    _disposeRig();
    rig = _buildRig(n);
    scene.add(rig.group);
  }
  _dressCube(opts);
  _poseCube(opts, time);

  // Animated tile shaders read one shared clock, which the game scene drives. A
  // wizard can be open with no cube on screen to drive it, so the preview runs
  // that clock itself and puts back whatever the caller had.
  const savedTime = sharedUniforms.time.value;
  sharedUniforms.time.value = time;

  const ctx = targetCanvas.getContext('2d');

  if (_usingShared) {
    const target = _targetFor(size);
    const buf = _bufferFor(size, ctx);

    // The main pipeline's state is borrowed, not owned — put it all back.
    const prevTarget = renderer.getRenderTarget();
    const prevAlpha = renderer.getClearAlpha();
    const prevAutoClear = renderer.autoClear;
    renderer.setRenderTarget(target);
    renderer.setClearAlpha(0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, buf.pixels);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevAlpha);
    renderer.autoClear = prevAutoClear;

    // WebGL reads bottom-up, canvas draws top-down — flip by whole rows.
    const rowBytes = size * 4;
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * rowBytes;
      buf.image.data.set(buf.pixels.subarray(src, src + rowBytes), y * rowBytes);
    }
    ctx.putImageData(buf.image, 0, 0);
  } else {
    renderer.setSize(size, size, false);
    renderer.setClearAlpha(0);
    renderer.render(scene, camera);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(renderer.domElement, 0, 0, size, size);
  }

  sharedUniforms.time.value = savedTime;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

let idCounter = 0;
let simTime = 0;

let animFrameId = null;
let lastTimestamp = null;
let fallbackTimer = null;

// Map<id, { canvas, opts, animated, dirty, nextFrame }>
const registry = new Map();

export function hasActiveCubePreviews() { return registry.size > 0; }

// A 7×7 plate is 294 shader planes plus a full size² readback per drawn frame, so
// the tumble runs on its own budget rather than the main loop's rate. At this
// speed 24fps is indistinguishable from 60 and costs well under half as much.
const ANIMATED_FPS = 24;
const ANIMATED_STEP = 1 / ANIMATED_FPS;

/** Driven by TilePreviewHost's useFrame when using the shared renderer. */
export function tickCubePreviews(delta) {
  simTime += delta;
  for (const info of registry.values()) {
    if (info.dirty) {
      renderToCanvas(info.opts, simTime, info.canvas);
      info.dirty = false;
      info.nextFrame = simTime + ANIMATED_STEP;
      continue;
    }
    if (!info.animated || simTime < (info.nextFrame ?? 0)) continue;
    renderToCanvas(info.opts, simTime, info.canvas);
    info.nextFrame = simTime + ANIMATED_STEP;
  }
}

function loop(timestamp) {
  if (lastTimestamp === null) lastTimestamp = timestamp;
  const delta = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  tickCubePreviews(delta);
  animFrameId = registry.size > 0 ? requestAnimationFrame(loop) : null;
}

function maybeStartLoop() {
  if (_usingShared) return;      // TilePreviewHost drives ticks instead
  if (animFrameId !== null || registry.size === 0) return;
  // Give the main <Canvas> a moment to hand its renderer over before falling
  // back to a private WebGL context — a second context is a mobile crash risk,
  // and a preview registered during the Canvas's own mount would otherwise win
  // the race and pin us to the fallback for the rest of the session.
  if (!renderer) {
    if (fallbackTimer === null) {
      fallbackTimer = setTimeout(() => { fallbackTimer = null; maybeStartLoop(); }, 700);
    }
    return;
  }
  lastTimestamp = null;
  animFrameId = requestAnimationFrame(loop);
}

function maybeStopLoop() {
  if (registry.size === 0 && animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @param canvas  target 2D canvas (square; canvas.width sets the render size)
 * @param opts    { size, colors, tileStyle, perFaceStyles, animated, yaw, pitch }
 */
export function registerCubePreview(canvas, opts) {
  const id = ++idCounter;
  registry.set(id, { canvas, opts: { ...opts }, animated: opts.animated !== false, dirty: true });
  maybeStartLoop();
  return id;
}

export function updateCubePreview(id, opts) {
  const info = registry.get(id);
  if (!info) return;
  info.opts = { ...opts };
  info.animated = opts.animated !== false;
  info.dirty = true;
}

export function unregisterCubePreview(id) {
  registry.delete(id);
  maybeStopLoop();
}
