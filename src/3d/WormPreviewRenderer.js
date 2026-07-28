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
import { layoutWormFace, FACE_LAYOUT, MOUTH_ARC } from '../worm/wormFaceLayout.js';
import { getSkinFX } from '../worm/wormSkinFX.js';
import { createWormSkinMaterial, applySkinMaterialProfile, updateWormSkinMaterialTime } from '../worm/wormSkinMaterial.js';
import { WormParticleSystem } from '../worm/wormSkinParticles.js';
import {
  PAGE_GEO_ARGS, PAGE_HINGE_X, PAGE_HINGE_Y, PAGE_LAYER_COUNT, PAGE_LAYER_GAP, PAGE_COLORS,
  FRONT_COVER_GEO_ARGS, SPINE_X_SCALE, pageHingeAngles,
} from '../worm/wormBookFX.js';

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
// Face features and the hat seat come from the shared layout (wormFaceLayout),
// which is also what the played worm uses.
const HAT_SCALE = HEAD_SCALE * FACE_LAYOUT.hatScale;

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
  // Thin spine/binding — the pages (below) are the visible body now, not a
  // flat square slab the pages ride on top of.
  const boxGeo = new THREE.BoxGeometry(SPINE_X_SCALE, 0.68, 1.12);
  const glowGeo = new THREE.SphereGeometry(1, 10, 10);

  // Book Worm's page flaps — same geometry/hinge recipe as WormBody.jsx /
  // CrawlerCharacter.jsx, posed manually per-frame in _poseWorm() (an idle
  // sway stands in for the turn-force signal, since the preview never turns).
  // PAGE_LAYER_COUNT thin layers per side per segment, so the stack reads as
  // multiple pages instead of one flat slab.
  const pageGeo = new THREE.BoxGeometry(...PAGE_GEO_ARGS);
  const frontCoverGeo = new THREE.BoxGeometry(...FRONT_COVER_GEO_ARGS);

  const beads = [];
  const boxes = [];
  const glows = [];
  const leftPages = [];  // leftPages[i] = [layer0Mesh, layer1Mesh, ...]
  const rightPages = [];
  for (let i = 0; i < SEGMENTS; i++) {
    // Same skin-themed material factory as gameplay (WormBody.jsx /
    // CrawlerCharacter.jsx) — metalness/roughness/clearcoat/transmission/
    // iridescence/flatShading + surface displacement all driven by the
    // equipped skin's FX profile, applied per-bead in _poseWorm().
    const bead = new THREE.Mesh(sphereGeo, createWormSkinMaterial());
    const box = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
      emissive: 0xffffff, emissiveIntensity: 0.18, roughness: 0.58, metalness: 0.2,
    }));
    const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    }));
    group.add(bead, box, glow);
    beads.push(bead); boxes.push(box); glows.push(glow);

    const leftLayers = [];
    const rightLayers = [];
    for (let layer = 0; layer < PAGE_LAYER_COUNT; layer++) {
      const paperColor = PAGE_COLORS[layer % PAGE_COLORS.length];
      const leftPage = new THREE.Mesh(pageGeo, new THREE.MeshStandardMaterial({ color: paperColor, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }));
      const rightPage = new THREE.Mesh(pageGeo, new THREE.MeshStandardMaterial({ color: paperColor, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }));
      group.add(leftPage, rightPage);
      leftLayers.push(leftPage); rightLayers.push(rightPage);
    }
    leftPages.push(leftLayers); rightPages.push(rightLayers);
  }

  // Head's standing front-cover panel (book worm only) — a single upright
  // panel instead of a flat page stack, distinct from the pages behind it.
  const frontCover = new THREE.Mesh(frontCoverGeo, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 }));
  group.add(frontCover);

  // Ambient skin FX (embers/bubbles/sparkle/...). Parented to an unscaled
  // anchor (not the head bead itself, whose own scale would otherwise shrink
  // every particle down with it) and repositioned to the head each frame in
  // _poseWorm().
  const particles = new WormParticleSystem();
  const particlesAnchor = new THREE.Object3D();
  particlesAnchor.add(particles.mesh);
  group.add(particlesAnchor);

  // Face — eyes with pupils and a curved smile, as in WormFace.
  const eyeGeo = new THREE.SphereGeometry(1, 14, 14);
  const pupilGeo = new THREE.SphereGeometry(1, 10, 10);
  const mouthGeo = new THREE.TorusGeometry(1, FACE_LAYOUT.mouthTube / FACE_LAYOUT.mouthRadius, 8, 22, MOUTH_ARC);
  const eyes = [0, 1].map(() => new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })));
  const pupils = [0, 1].map(() => new THREE.Mesh(pupilGeo, new THREE.MeshBasicMaterial({ color: 0x12131a })));
  const mouth = new THREE.Mesh(mouthGeo, new THREE.MeshBasicMaterial({ color: 0x12131a }));
  eyes.forEach(m => group.add(m));
  pupils.forEach(m => group.add(m));
  group.add(mouth);

  // Book worm glasses.
  const glassGeo = new THREE.TorusGeometry(1, FACE_LAYOUT.glassTube / FACE_LAYOUT.glassRadius, 8, 18);
  const glasses = [0, 1].map(() => new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.9, roughness: 0.1,
  })));
  glasses.forEach(m => group.add(m));

  const hatGroup = new THREE.Group();
  group.add(hatGroup);

  const glowLight = new THREE.PointLight(0xffffff, 0, 1.2);
  group.add(glowLight);

  return { group, beads, boxes, glows, leftPages, rightPages, frontCover, eyes, pupils, mouth, glasses, hatGroup, hatKey: null, glowLight, particles, particlesAnchor, skinKey: null };
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
// 'portrait' is 'head' pulled back far enough to hold the hat. The tight crop is
// right on a 34px chip, where the hat has to fill the tile to be identifiable at
// all, and wrong at hero size — a halo or a wizard's point sits well above the
// crown and was being cut off by the top of the frame.
const FRAMING = {
  body: { pos: [0.34, 0.66, 0.97], look: [-0.30, 0.05, -0.12], yaw: -0.38 },
  head: { pos: [0.20, 0.30, 0.40], look: [0.0, 0.05, -0.02], yaw: -0.55 },
  portrait: { pos: [0.34, 0.52, 0.68], look: [0.0, 0.10, -0.02], yaw: -0.55 },
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
  const book = character === 'book';
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
  } else if (book) {
    // Straight spine, no wiggle: the per-segment orientation for the open-book
    // body is derived from consecutive offsets (see _poseWorm's isBook block),
    // and the general idle sine wiggle below reads as a rippled/jagged spine
    // once amplified into a flat page's full 3D orientation — a stiff book
    // doesn't undulate like a soft-bodied worm.
  } else {
    z = Math.sin(d * 5.2 - time * 1.1) * 0.022 * Math.min(1, i / 1.2);
    y = Math.sin(time * 1.4 + d * 3) * 0.004;
  }
  out.set(-d, y, z);
  return out;
}

const _off = new THREE.Vector3();
const _anchor = new THREE.Vector3();
const _faceParts = { eyes: [null, null], pupils: [null, null], glasses: [null, null], mouth: null, hat: null };

// Book Worm page-flip scratch (preview only — see the isBook block in _poseWorm).
const _pbPrevOff = new THREE.Vector3();
const _pbZ = new THREE.Vector3();
const _pbX = new THREE.Vector3();
const _pbY = new THREE.Vector3();
const _pbBasisMat = new THREE.Matrix4();
const _pbQuat = new THREE.Quaternion();
const _pbHingeQuat = new THREE.Quaternion();
const _pbPageQuat = new THREE.Quaternion();
const _pbPageOffset = new THREE.Vector3();
const _pbZAxisUnit = new THREE.Vector3(0, 0, 1);

function _poseWorm(opts, time) {
  const { characterId, skinId, hatId } = opts;
  const headOnly = opts.framing === 'head';
  const skin = getSkin(skinId);
  const isInch = characterId === 'inch';
  const isGlow = characterId === 'glow';
  const isBook = characterId === 'book';
  const isPrism = characterId === 'prism';

  // Skin FX (material personality + surface displacement + ambient particles)
  // only need reapplying when the equipped/browsed skin actually changes —
  // not every frame, so browsing the store doesn't force a shader-uniform
  // rewrite on every render.
  const skinChanged = rig.skinKey !== skinId;
  if (skinChanged) {
    const fx = getSkinFX(skinId);
    for (let i = 0; i < SEGMENTS; i++) applySkinMaterialProfile(rig.beads[i].material, fx, i);
    rig.particles.configure(fx.particle, skin.glow);
    rig.skinKey = skinId;
  }
  for (let i = 0; i < SEGMENTS; i++) updateWormSkinMaterialTime(rig.beads[i].material, time);

  for (let i = 0; i < SEGMENTS; i++) {
    _segmentOffset(i, characterId, time, _off);
    const bead = rig.beads[i];
    const box = rig.boxes[i];
    const glow = rig.glows[i];
    const leftLayers = rig.leftPages[i];
    const rightLayers = rig.rightPages[i];
    const body = isBook ? box : bead;

    const shown = !headOnly || i <= 2;
    bead.visible = shown && !isBook;
    box.visible = shown && isBook;
    glow.visible = shown && isGlow && i % 2 === 0;
    const pagesShown = shown && isBook && i !== 0;
    const coverShown = shown && isBook && i === 0;
    for (const l of leftLayers) l.visible = pagesShown;
    for (const l of rightLayers) l.visible = pagesShown;
    // frontCover is a single shared mesh, not one per segment — only the i===0
    // iteration is ever allowed to touch its visibility, or every later i>0
    // iteration (where coverShown is always false) would immediately hide it
    // again right after the head iteration showed it.
    if (i === 0) rig.frontCover.visible = coverShown;

    // Book worm rides on top of the ground, lifted by its own height, instead
    // of centered/embedded at it — mutates _off itself so the pages (which
    // read _off below) inherit the same lift as the cover.
    if (isBook) _off.y += BOOK_BODY_SCALE[0] * PAGE_HINGE_Y;

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

    // Book Worm: orient the cover to face the direction of travel (derived
    // from consecutive segment offsets, since the preview has no real turn
    // signal to read). Pages stay at their flat rest pose here — no idle
    // sway — so the preview shows the actual resting shape instead of a
    // moment frozen mid-turn.
    if (pagesShown) {
      _segmentOffset(i - 1, characterId, time, _pbPrevOff);
      _pbPrevOff.y += BOOK_BODY_SCALE[0] * PAGE_HINGE_Y; // same constant raise _off already has — a uniform lift shouldn't skew the segment-to-segment direction
      _pbZ.subVectors(_off, _pbPrevOff).normalize(); // backward = away from the segment ahead
      if (_pbZ.lengthSq() < 1e-8) _pbZ.set(0, 0, 1);
      _pbX.crossVectors(UP, _pbZ).normalize();
      _pbY.crossVectors(_pbZ, _pbX);
      _pbBasisMat.makeBasis(_pbX, _pbY, _pbZ);
      _pbQuat.setFromRotationMatrix(_pbBasisMat);
      body.quaternion.copy(_pbQuat);

      const { left, right } = pageHingeAngles(0);
      const pageScale = body.scale.x;

      _pbHingeQuat.setFromAxisAngle(_pbZAxisUnit, left);
      _pbPageQuat.copy(_pbQuat).multiply(_pbHingeQuat);
      _pbPageOffset.set(PAGE_GEO_ARGS[0] * 0.5, 0, 0).applyQuaternion(_pbPageQuat);
      for (let layer = 0; layer < leftLayers.length; layer++) {
        const l = leftLayers[layer];
        l.position.copy(_off)
          .addScaledVector(_pbX, PAGE_HINGE_X * pageScale)
          .addScaledVector(_pbY, pageScale * (PAGE_HINGE_Y + layer * PAGE_LAYER_GAP))
          .addScaledVector(_pbPageOffset, pageScale);
        l.quaternion.copy(_pbPageQuat);
        l.scale.setScalar(pageScale);
      }

      _pbHingeQuat.setFromAxisAngle(_pbZAxisUnit, right);
      _pbPageQuat.copy(_pbQuat).multiply(_pbHingeQuat);
      _pbPageOffset.set(-PAGE_GEO_ARGS[0] * 0.5, 0, 0).applyQuaternion(_pbPageQuat);
      for (let layer = 0; layer < rightLayers.length; layer++) {
        const r = rightLayers[layer];
        r.position.copy(_off)
          .addScaledVector(_pbX, -PAGE_HINGE_X * pageScale)
          .addScaledVector(_pbY, pageScale * (PAGE_HINGE_Y + layer * PAGE_LAYER_GAP))
          .addScaledVector(_pbPageOffset, pageScale);
        r.quaternion.copy(_pbPageQuat);
        r.scale.setScalar(pageScale);
      }
    } else if (isBook) {
      body.quaternion.identity();
    }

    // Book Worm head: a single upright front-cover panel, standing vertical
    // instead of lying flat like the page stack — same orientation basis as
    // the body pages (computed against segment 1, since there's no "segment
    // -1" to diff against), a box whose Y is its largest dimension.
    if (coverShown) {
      _segmentOffset(1, characterId, time, _pbPrevOff);
      _pbPrevOff.y += BOOK_BODY_SCALE[0] * PAGE_HINGE_Y;
      _pbZ.subVectors(_pbPrevOff, _off).normalize(); // toward segment 1 = backward, from the head's point of view
      if (_pbZ.lengthSq() < 1e-8) _pbZ.set(0, 0, 1);
      _pbX.crossVectors(UP, _pbZ).normalize();
      _pbY.crossVectors(_pbZ, _pbX);
      _pbBasisMat.makeBasis(_pbX, _pbY, _pbZ);
      _pbQuat.setFromRotationMatrix(_pbBasisMat);
      const coverScale = body.scale.x;
      rig.frontCover.position.copy(_off).addScaledVector(_pbZ, -0.05 * coverScale);
      rig.frontCover.quaternion.copy(_pbQuat);
      rig.frontCover.scale.setScalar(coverScale);
      rig.frontCover.material.color.set(skin.body);
    }

    if (glow.visible) {
      glow.position.copy(_off);
      glow.scale.setScalar(body.scale.x * 1.4);
      glow.material.color.set(skin.glow);
    }

    if (i === 0) rig.particlesAnchor.position.copy(_off);
  }
  rig.particles.update(time);

  rig.glowLight.visible = isGlow;
  rig.glowLight.intensity = isGlow ? 0.5 + Math.sin(time * 2.4) * 0.15 : 0;
  if (isGlow) {
    rig.glowLight.color.set(skin.glow);
    rig.glowLight.position.set(0, 0.14, 0);
  }

  // Face — same layout the played worm uses.
  _segmentOffset(0, characterId, time, _anchor);
  rig.glasses.forEach(g => { g.visible = isBook; });
  _faceParts.eyes[0] = rig.eyes[0];
  _faceParts.eyes[1] = rig.eyes[1];
  _faceParts.pupils[0] = rig.pupils[0];
  _faceParts.pupils[1] = rig.pupils[1];
  _faceParts.mouth = rig.mouth;
  _faceParts.glasses[0] = isBook ? rig.glasses[0] : null;
  _faceParts.glasses[1] = isBook ? rig.glasses[1] : null;
  _faceParts.hat = rig.hatGroup;
  layoutWormFace(_anchor, FWD, UP, HEAD_SCALE, _faceParts);

  // An occasional blink, squashing the eye and its pupil together.
  const blink = Math.sin(time * 0.9) > 0.985 ? 0.2 : 1;
  if (blink !== 1) {
    rig.eyes.forEach(eye => { eye.scale.y *= blink; });
    rig.pupils.forEach(pupil => { pupil.scale.y *= blink; });
  }

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
