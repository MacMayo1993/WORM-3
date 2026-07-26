// WormPreviewRenderer.js
// Renders worm thumbnails — the character picker's plate, the store's skin and
// hat cards — using the *same* geometry and materials as the worm you steer in
// Healer mode, through the shared R3F renderer so no second WebGL context is
// ever created (which would crash on mobile).
//
// Every worm outside the game used to be a hand-drawn SVG lookalike: flat, and
// wrong about almost everything (no clearcoat body, no 3D hat, wrong segment
// spacing). This draws the real thing instead: instanced-equivalent sphere
// beads with the clearcoat physical material from WormBody, the sphere eyes and
// smile from WormFace, and the shared hat parts.
//
// Usage mirrors TilePreviewRenderer:
//   • <TilePreviewHost /> inside the R3F <Canvas> calls setWormSharedRenderer(gl)
//     and drives tickWormPreviews() each frame.
//   • UI components call registerWormPreview / updateWormPreview /
//     unregisterWormPreview (see WormPreviewCanvas.jsx).

import * as THREE from 'three';
import { getSkin } from '../worm/wormCosmeticsData.js';
import { getHatParts } from '../worm/wormHatParts.js';

// ─── Worm geometry constants ─────────────────────────────────────────────────
// Straight from healerWorm/WormBody.jsx and WormFace.jsx so the preview worm is
// built to the same measurements as the played one.
const HEAD_SCALE = 0.092;
const BODY_SCALE = 0.09;
const INCH_BODY_SCALE = 0.082;
const BOOK_BODY_SCALE = [0.088, 0.055, 0.1];
const SPACING = 0.09;
const INCH_SPACING = 0.095;
const SEGMENTS = 9;          // head + 8 beads — a readable stretch of worm
const FACE_LIFT = 0.09;      // face anchor above head centre
const EYE_SCALE = 0.022;
const EYE_SIDE = 0.028;
const EYE_FWD = 0.025;
const HAT_SCALE = 0.07;
// In game the hat rides the face anchor (head + normal*0.09) plus another 0.04,
// which at portrait range reads as a hat hovering over the worm. The preview
// drops that lift and then some — but only so far: the worm's eyes are on the
// crown of its head (it is drawn to be seen from above), so a hat seated flush
// would sit across the face. This clears the eyes by a hair and no more.
const HAT_LIFT = -0.03;
const GLASS_SCALE = 0.054;

// Forward is +X, the surface normal (worm's "up") is +Y, so right is +Z —
// the same basis WormFace derives on the cube surface.
const FWD = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(0, 0, 1);

// ─── Renderer state ───────────────────────────────────────────────────────────

let renderer = null;
let _usingShared = false;
const _targets = new Map();   // size → WebGLRenderTarget
const _buffers = new Map();   // size → { pixels: Uint8Array, image: ImageData }

let scene = null;
let camera = null;
let rig = null;             // built lazily, reconfigured per render

const _color = new THREE.Color();

// ─── Scene ────────────────────────────────────────────────────────────────────

function _buildRig() {
  const group = new THREE.Group();

  // Body beads. Material colour carries the segment colour directly (the game
  // uses white + per-instance colour because it draws one instanced mesh).
  const sphereGeo = new THREE.SphereGeometry(1, 16, 16);
  const boxGeo = new THREE.BoxGeometry(1, 0.68, 1.12);
  const glowGeo = new THREE.SphereGeometry(1, 10, 10);

  const beads = [];
  const boxes = [];
  const glows = [];
  for (let i = 0; i < SEGMENTS; i++) {
    // Wet-slime body: clearcoat + sheen, matching WormBody's meshPhysicalMaterial.
    const bead = new THREE.Mesh(sphereGeo, new THREE.MeshPhysicalMaterial({
      emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.35, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xffffff), toneMapped: false,
    }));
    const box = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
      emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.58, metalness: 0.2,
    }));
    const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    }));
    group.add(bead, box, glow);
    beads.push(bead); boxes.push(box); glows.push(glow);
  }

  // Face — white sphere eyes and a three-bead smile, as in WormFace.
  const eyeGeo = new THREE.SphereGeometry(1, 10, 10);
  const smileGeo = new THREE.SphereGeometry(1, 8, 8);
  const eyes = [0, 1].map(() => new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })));
  const smile = [0, 1, 2].map(() => new THREE.Mesh(smileGeo, new THREE.MeshBasicMaterial({ color: 0x111111 })));
  eyes.forEach(m => group.add(m));
  smile.forEach(m => group.add(m));

  // Book worm glasses.
  const glassGeo = new THREE.TorusGeometry(1, 0.13, 8, 18);
  const glasses = [0, 1].map(() => new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.9, roughness: 0.1,
  })));
  glasses.forEach(m => group.add(m));

  const hatGroup = new THREE.Group();
  group.add(hatGroup);

  const glowLight = new THREE.PointLight(0xffffff, 0, 1.2);
  group.add(glowLight);

  return { group, beads, boxes, glows, eyes, smile, glasses, hatGroup, hatKey: null, glowLight };
}

// Framing presets. In game the camera looks down at the cube face the worm is
// crawling on, so the face features — which sit along the surface normal — point
// back at you. Both presets keep the camera mostly above the worm's up axis for
// that reason: a side-on view puts the eyes on the skyline and reads as a bug,
// not a worm. 'head' is the same shot pulled in, used where the hat is the
// subject.
// Elevation is deliberately shallow (~27°): the eyes sit on the crown of the
// head, right under where a hat lands, so a steeper angle puts the brim across
// the face. Broadside-ish azimuth keeps the body stretched across the frame.
const FRAMING = {
  body: { pos: [0.34, 0.66, 0.97], look: [-0.30, 0.05, -0.12], yaw: -0.38 },
  head: { pos: [0.20, 0.30, 0.40], look: [0.0, 0.05, -0.02], yaw: -0.55 },
};

function _frameCamera(framing) {
  const f = FRAMING[framing] || FRAMING.body;
  camera.position.set(f.pos[0], f.pos[1], f.pos[2]);
  camera.lookAt(f.look[0], f.look[1], f.look[2]);
  // Yaw the worm rather than orbit the camera: the face reads best turned a
  // little towards the lens, and turning the worm keeps the shallow elevation
  // that stops a hat brim from cutting across the eyes.
  if (rig) rig.group.rotation.y = f.yaw;
}

function _initScene() {
  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
  _frameCamera('body');

  // Warm key + cool fill, enough to show the clearcoat highlight rolling over
  // the beads without an environment map.
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const key = new THREE.DirectionalLight(0xfff6e2, 2.6);
  key.position.set(0.6, 1.1, 0.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd8ff, 1.1);
  fill.position.set(-0.8, 0.3, -0.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4);
  rim.position.set(-0.2, 0.6, -1);
  scene.add(rim);

  rig = _buildRig();
  scene.add(rig.group);
}

/** Called by TilePreviewHost (inside the R3F Canvas) to inject the main renderer. */
export function setWormSharedRenderer(gl) {
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
      samples: 4,          // MSAA — the beads are round, jaggies read as cheap
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

// ─── Worm pose ────────────────────────────────────────────────────────────────

// Where segment `i` sits, in the worm's local space. Each character moves
// differently in game, so each one stands differently here: the inch worm
// arches, the wiggle worm snakes, everything else trails in a lazy S.
function _segmentOffset(i, character, time, out) {
  const inch = character === 'inch';
  const wiggle = character === 'wiggle';
  const spacing = inch ? INCH_SPACING : SPACING;
  const d = i * spacing;

  let y = 0;
  let z = 0;
  if (inch) {
    // Accordion hump, peaking mid-body and breathing in and out.
    const arch = SEGMENTS > 1 ? Math.sin(Math.PI * (i / (SEGMENTS - 1))) : 0;
    y = arch * 0.085 * (0.72 + 0.28 * Math.sin(time * 1.6));
    z = Math.sin(d * 4 + time) * 0.008;
  } else if (wiggle) {
    z = Math.sin(d * 13 - time * 2.2) * 0.055 * Math.min(1, i / 1.5);
    y = Math.sin(d * 9 - time * 2.2) * 0.006;
  } else {
    z = Math.sin(d * 5.2 - time * 1.1) * 0.022 * Math.min(1, i / 1.2);
    y = Math.sin(time * 1.4 + d * 3) * 0.004;
  }
  out.set(-d, y, z);
  return out;
}

const _off = new THREE.Vector3();
const _anchor = new THREE.Vector3();

function _poseWorm(opts, time) {
  const { characterId, skinId, hatId } = opts;
  const headOnly = opts.framing === 'head';
  const skin = getSkin(skinId);
  const isInch = characterId === 'inch';
  const isGlow = characterId === 'glow';
  const isBook = characterId === 'book';
  const isPrism = characterId === 'prism';

  for (let i = 0; i < SEGMENTS; i++) {
    _segmentOffset(i, characterId, time, _off);
    const bead = rig.beads[i];
    const box = rig.boxes[i];
    const glow = rig.glows[i];
    const body = isBook ? box : bead;

    const shown = !headOnly || i <= 2;
    bead.visible = shown && !isBook;
    box.visible = shown && isBook;
    glow.visible = shown && isGlow && i % 2 === 0;

    body.position.copy(_off);
    if (i === 0) {
      body.scale.setScalar(HEAD_SCALE);
      if (isBook) body.scale.set(BOOK_BODY_SCALE[0], BOOK_BODY_SCALE[1], BOOK_BODY_SCALE[2]);
    } else if (isBook) {
      body.scale.set(BOOK_BODY_SCALE[0], BOOK_BODY_SCALE[1], BOOK_BODY_SCALE[2]);
    } else if (isInch) {
      body.scale.setScalar(INCH_BODY_SCALE);
    } else if (isGlow) {
      body.scale.setScalar(0.088 + Math.sin(time * 3.5 + i * 1.6) * 0.01);
    } else {
      body.scale.setScalar(BODY_SCALE);
    }

    // Segment colour, following WormBody: prism cycles the spectrum, the inch
    // worm bands body/belly, everything else is the skin's body colour.
    if (isPrism) {
      // In game the rainbow spans a long tail; over nine preview beads the same
      // per-segment step would read as a single gradient, so the spectrum is
      // spread across the beads that are actually on screen.
      _color.setHSL(((i / SEGMENTS) * 0.85 + time * 0.12) % 1, 0.85, 0.6);
    } else if (isInch) {
      _color.set(i % 2 === 0 ? skin.body : skin.belly);
    } else {
      _color.set(skin.body);
    }
    body.material.color.copy(_color);

    if (glow.visible) {
      glow.position.copy(_off);
      glow.scale.setScalar(body.scale.x * 1.4);
      glow.material.color.set(skin.glow);
    }
  }

  rig.glowLight.visible = isGlow;
  rig.glowLight.intensity = isGlow ? 0.5 + Math.sin(time * 2.4) * 0.15 : 0;
  if (isGlow) {
    rig.glowLight.color.set(skin.glow);
    rig.glowLight.position.set(0, 0.14, 0);
  }

  // Face anchor sits on top of the head, as on the cube surface.
  _segmentOffset(0, characterId, time, _off);
  _anchor.copy(_off).addScaledVector(UP, FACE_LIFT);

  const blink = Math.sin(time * 0.9) > 0.985 ? 0.18 : 1;   // occasional blink
  rig.eyes.forEach((eye, i) => {
    const side = i === 0 ? EYE_SIDE : -EYE_SIDE;
    eye.position.copy(_anchor).addScaledVector(RIGHT, side).addScaledVector(FWD, EYE_FWD);
    eye.scale.set(EYE_SCALE, EYE_SCALE * blink, EYE_SCALE);
  });

  const smileOffsets = [-0.022, 0, 0.022];
  rig.smile.forEach((bead, i) => {
    const yo = i === 1 ? -0.028 : -0.022;
    bead.position.copy(_anchor)
      .addScaledVector(RIGHT, smileOffsets[i])
      .addScaledVector(UP, yo * 0.3)
      .addScaledVector(FWD, EYE_FWD);
    bead.scale.setScalar(EYE_SCALE * 0.55);
  });

  rig.glasses.forEach((glass, i) => {
    glass.visible = isBook;
    if (!isBook) return;
    const side = i === 0 ? EYE_SIDE : -EYE_SIDE;
    glass.position.copy(_anchor).addScaledVector(RIGHT, side).addScaledVector(FWD, 0.029);
    glass.quaternion.setFromUnitVectors(UP, FWD);
    glass.scale.setScalar(GLASS_SCALE);
  });

  // Hat — rebuilt only when the hat changes, then parked above the head.
  if (rig.hatKey !== hatId) {
    rig.hatGroup.clear();
    for (const part of getHatParts(hatId, HAT_SCALE)) {
      const [geoName, args] = part.geo;
      const geo = _geometry(geoName, args);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: part.mat.color,
        emissive: part.mat.emissive ?? 0x000000,
        emissiveIntensity: part.mat.emissiveIntensity ?? 1,
        roughness: part.mat.roughness ?? 1,
        metalness: part.mat.metalness ?? 0,
      }));
      mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
      if (part.rot) mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
      if (part.scale) mesh.scale.set(part.scale[0], part.scale[1], part.scale[2]);
      rig.hatGroup.add(mesh);
    }
    rig.hatKey = hatId;
  }
  rig.hatGroup.position.copy(_anchor).addScaledVector(UP, HAT_LIFT);
}

function _geometry(name, args) {
  switch (name) {
    case 'cylinder': return new THREE.CylinderGeometry(...args);
    case 'cone': return new THREE.ConeGeometry(...args);
    case 'sphere': return new THREE.SphereGeometry(...args);
    case 'torus': return new THREE.TorusGeometry(...args);
    case 'box': return new THREE.BoxGeometry(...args);
    case 'octahedron': return new THREE.OctahedronGeometry(...args);
    default: return new THREE.SphereGeometry(...args);
  }
}

// ─── Core render ──────────────────────────────────────────────────────────────

function renderToCanvas(opts, time, targetCanvas) {
  if (_usingShared) {
    if (!renderer) return;
    const glCtx = renderer.getContext?.();
    if (!glCtx || glCtx.isContextLost?.()) return;
  } else {
    ensureOwnRenderer();
    if (!renderer) return;
  }

  const size = targetCanvas.width;
  if (!size) return;
  _frameCamera(opts.framing);
  _poseWorm(opts, time);

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
}

// ─── Registry ─────────────────────────────────────────────────────────────────

let idCounter = 0;
let simTime = 0;

let animFrameId = null;
let lastTimestamp = null;
let fallbackTimer = null;

// Map<id, { canvas, opts, animated, dirty }>
const registry = new Map();

export function hasActiveWormPreviews() { return registry.size > 0; }

/** Driven by TilePreviewHost's useFrame when using the shared renderer. */
// Animated previews cost a full size² pixel readback per drawn frame, so they
// run at ANIMATED_FPS rather than the main loop's rate — idle worm motion is
// slow enough that nobody can tell, and the store's static cards cost nothing
// after their first render.
const ANIMATED_FPS = 20;
const ANIMATED_STEP = 1 / ANIMATED_FPS;

export function tickWormPreviews(delta) {
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
  tickWormPreviews(delta);
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
 * @param canvas   target 2D canvas (square; canvas.width sets the render size)
 * @param opts     { characterId, skinId, hatId, animated }
 */
export function registerWormPreview(canvas, opts) {
  const id = ++idCounter;
  registry.set(id, { canvas, opts: { ...opts }, animated: !!opts.animated, dirty: true });
  maybeStartLoop();
  return id;
}

export function updateWormPreview(id, opts) {
  const info = registry.get(id);
  if (!info) return;
  info.opts = { ...opts };
  info.animated = !!opts.animated;
  info.dirty = true;
}

export function unregisterWormPreview(id) {
  registry.delete(id);
  maybeStopLoop();
}
