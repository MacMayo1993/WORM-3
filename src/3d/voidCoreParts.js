// The parts of the cube's heart (VoidCore): the one point every wormhole passes
// through. The cube's surface is a sphere and the game glues each point to its
// antipode, so every tunnel is a diameter and the centre is the only point the
// antipodal map x → −x leaves where it is. The core is built to say that:
//
//   • a black-plastic piece in the menu cube's own finish (rubiksPiece.js), so
//     it reads as a piece of the same puzzle rather than a ghost box: rounded
//     edge beams and six face plates, each pierced by a porthole;
//   • six glossy portal rings, one per face colour, round the portholes, which
//     are the docks the tunnels plug into (centred exactly on TUNNEL_MINI_FACE_R);
//   • a mouth in each porthole that swirls with the ANTIPODE's colour: look into
//     the red port and you see orange, the colour at the tunnel's other end. In
//     WORM the mouths are opaque, so the piece is solid and hides the worm's
//     turn; elsewhere they are a see-through glow onto the chamber inside;
//   • a heart at the origin whose colour field is the cube's faces seen from the
//     far side (colour at direction n is the face colour at −n);
//   • three gimbal rings, one per antipodal axis, each carrying a pair of beads
//     that are always diametrically opposite — a point and its antipode.
//
// Pure geometry, shaders and small helpers; the React side lives in VoidCore.jsx.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TUNNEL_MINI_FACE_R } from '../utils/tunnelPath.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

// ── Dimensions ───────────────────────────────────────────────────────────────
// Everything stays inside the old 0.48 mini-cube's footprint, so the pieces
// around a 3×3's centre (their bodies start 0.52 out) never clip it.

/** Where each portal ring's front face sits; tunnels dock at its centre. */
export const CORE_DOCK = TUNNEL_MINI_FACE_R;
/** Half the piece's outer width. */
export const CORE_HALF = 0.24;
/** Width of an edge beam. */
export const CORE_BEAM = 0.06;
/** Half-width of the square window the beams leave on each face. */
export const CORE_WINDOW = CORE_HALF - CORE_BEAM;
/** The portal ring: its rim bites into the beams at the four edge midpoints. */
export const PORT_OUTER = 0.184;
export const PORT_INNER = 0.112;
export const PORT_DEPTH = 0.014;
/** The heart, and how far a flip may swell it. */
export const HEART_R = 0.092;
export const HEART_MAX_SWELL = 1.15;
/** Gimbal rings, innermost first, one per antipodal axis (X, Y, Z). */
export const GYRO_RADII = [0.122, 0.147, 0.172];
export const GYRO_TUBE = 0.0065;
export const GYRO_BEAD_R = 0.014;
/** The face plates fill each window (tucking into the beams) behind the ring. */
export const PLATE_DEPTH = 0.01;
export const PLATE_HALF = CORE_WINDOW + 0.01;

// ── Faces ────────────────────────────────────────────────────────────────────
// Face ids match FACE_COLORS: 1=PZ Red, 2=NX Green, 3=PY White, 4=NZ Orange,
// 5=PX Blue, 6=NY Yellow. Shader arrays are indexed by id − 1.
export const CORE_FACES = [
  { id: 1, dir: [0, 0, 1] },
  { id: 2, dir: [-1, 0, 0] },
  { id: 3, dir: [0, 1, 0] },
  { id: 4, dir: [0, 0, -1] },
  { id: 5, dir: [1, 0, 0] },
  { id: 6, dir: [0, -1, 0] }
];

const DIR_KEY_FACE = { PZ: 1, NX: 2, PY: 3, NZ: 4, PX: 5, NY: 6 };

/** The core face a sticker's tunnel docks on (tunnels dock by local dirKey). */
export const faceForDirKey = (dirKey) => DIR_KEY_FACE[dirKey] ?? null;

/** The gimbal rings' axes and the face pair each one carries (positive face first). */
export const GYRO_AXES = [
  { axis: 'x', faces: [5, 2] },
  { axis: 'y', faces: [3, 6] },
  { axis: 'z', faces: [1, 4] }
];

/**
 * How lit-up the heart is from how much of the network is alive: 0 on a fresh
 * cube, rising quickly with the first few flipped stickers, never quite 1.
 */
export const networkCharge = (flippedStickers) => 1 - Math.exp(-Math.max(0, flippedStickers) / 10);

/** Stickers that have been flipped at least once. */
export function countFlippedStickers(cubies) {
  let count = 0;
  for (const layer of cubies || [])
    for (const row of layer)
      for (const cubie of row)
        for (const key in cubie.stickers) if ((cubie.stickers[key].flips || 0) > 0) count++;
  return count;
}

/**
 * How much of the cube's inside a viewer can see, 0–1. Only then does the heart
 * light its surroundings: with the cube closed, a light at the centre would leak
 * onto the groove walls between pieces and tint the classic look.
 */
export function interiorExposure({ explosionT = 0, visualMode = 'classic', hollowMode = false } = {}) {
  const view = hollowMode || visualMode === 'glass' ? 1 : visualMode === 'gap' ? 0.6 : 0;
  return Math.min(1, Math.max(explosionT, view));
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);

// Orient a +Z-facing piece onto a face and push it out to `distance`.
function placeOnFace(geometry, dir, distance) {
  _q.setFromUnitVectors(_z, _v.set(dir[0], dir[1], dir[2]));
  _m.makeRotationFromQuaternion(_q).setPosition(dir[0] * distance, dir[1] * distance, dir[2] * distance);
  return geometry.applyMatrix4(_m);
}

// `aFace` names the face each vertex belongs to; `aBack` marks the vertices on
// a ring's back, which paintCoreColors leaves as black plastic.
function tagFace(geometry, faceIndex, isBack = () => false) {
  const pos = geometry.attributes.position;
  const back = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) back[i] = isBack(pos.getZ(i)) ? 1 : 0;
  geometry.setAttribute('aFace', new THREE.BufferAttribute(new Float32Array(pos.count).fill(faceIndex), 1));
  geometry.setAttribute('aBack', new THREE.BufferAttribute(back, 1));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  return geometry;
}

/** The edges: twelve softly rounded beams, one draw. */
export function createCoreCageGeometry() {
  const h = CORE_HALF - CORE_BEAM / 2;
  const beams = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const a of [-h, h]) {
      for (const b of [-h, h]) {
        const dims = [CORE_BEAM, CORE_BEAM, CORE_BEAM];
        dims[axis] = CORE_HALF * 2;
        const beam = new RoundedBoxGeometry(dims[0], dims[1], dims[2], 2, 0.022);
        const pos = [a, b];
        pos.splice(axis, 0, 0);
        beams.push(beam.translate(pos[0], pos[1], pos[2]));
      }
    }
  }
  const geometry = mergeGeometries(beams, false);
  beams.forEach(b => b.dispose());
  return geometry;
}

/**
 * The six face plates: each fills its window behind the portal ring and is
 * pierced by the porthole, so the piece is closed everywhere but its ports.
 */
export function createCorePlateGeometry() {
  const h = PLATE_HALF;
  const shape = new THREE.Shape();
  shape.moveTo(-h, -h); shape.lineTo(h, -h); shape.lineTo(h, h); shape.lineTo(-h, h); shape.lineTo(-h, -h);
  shape.holes.push(new THREE.Path().absarc(0, 0, PORT_INNER, 0, Math.PI * 2, true));
  const plates = CORE_FACES.map(({ dir }) => {
    const plate = new THREE.ExtrudeGeometry(shape, { depth: PLATE_DEPTH, bevelEnabled: false, curveSegments: 40 });
    plate.translate(0, 0, -PLATE_DEPTH); // front face at z = 0
    return placeOnFace(plate, dir, CORE_DOCK - PORT_DEPTH);
  });
  const geometry = mergeGeometries(plates, false);
  plates.forEach(p => p.dispose());
  return geometry;
}

/**
 * The six portal rings: a glossy bevelled annulus per face, front face exactly
 * on the dock plane. Per-vertex `color` is painted by paintCoreColors.
 */
export function createPortGeometry() {
  const bevel = 0.004;
  const shape = new THREE.Shape().absarc(0, 0, PORT_OUTER - bevel, 0, Math.PI * 2, false);
  shape.holes.push(new THREE.Path().absarc(0, 0, PORT_INNER + bevel, 0, Math.PI * 2, true));
  const rings = CORE_FACES.map(({ dir }, i) => {
    const ring = new THREE.ExtrudeGeometry(shape, {
      depth: PORT_DEPTH - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 40
    });
    ring.translate(0, 0, -(PORT_DEPTH - bevel)); // front face at z = 0
    // Only the front is a sticker: from inside the cage a ring's back is the
    // cage's own black plastic, so the heart is what glows in there.
    tagFace(ring, i, (z) => z < -PORT_DEPTH / 2);
    return placeOnFace(ring, dir, CORE_DOCK);
  });
  const geometry = mergeGeometries(rings, false);
  rings.forEach(r => r.dispose());
  return geometry;
}

/**
 * The six mouths filling the rings' holes, set just behind the ring face.
 * `color` holds the antipode's colour; uv spans the disc (centre at 0.5, 0.5).
 */
export function createMouthGeometry() {
  const discs = CORE_FACES.map(({ dir }, i) =>
    tagFace(placeOnFace(new THREE.CircleGeometry(PORT_INNER + 0.003, 40), dir, CORE_DOCK - PORT_DEPTH * 0.5), i));
  const geometry = mergeGeometries(discs, false);
  discs.forEach(d => d.dispose());
  return geometry;
}

/**
 * One gimbal ring in its local XY plane with its two beads at local ±X. The
 * `side` table (+1 → −1 around the ring, ±2 on the beads) is what
 * paintGyroRing blends the pair's two colours by.
 */
export function createGyroRingGeometry(radius) {
  const torus = new THREE.TorusGeometry(radius, GYRO_TUBE, 8, 96);
  const beadA = new THREE.SphereGeometry(GYRO_BEAD_R, 12, 8).translate(radius, 0, 0);
  const beadB = new THREE.SphereGeometry(GYRO_BEAD_R, 12, 8).translate(-radius, 0, 0);
  const geometry = mergeGeometries([torus, beadA, beadB], false);
  const pos = geometry.attributes.position;
  const side = new Float32Array(pos.count);
  const torusCount = torus.attributes.position.count;
  const beadCount = beadA.attributes.position.count;
  for (let i = 0; i < pos.count; i++) {
    if (i < torusCount) side[i] = Math.cos(Math.atan2(pos.getY(i), pos.getX(i)));
    else side[i] = i < torusCount + beadCount ? 2 : -2;
  }
  geometry.userData.side = side;
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  [torus, beadA, beadB].forEach(g => g.dispose());
  return geometry;
}

// ── Colour ───────────────────────────────────────────────────────────────────

const _a = new THREE.Color();
const _b = new THREE.Color();
const _c = new THREE.Color();
const _white = new THREE.Color(1, 1, 1);

const PLASTIC_BACK = new THREE.Color('#141416');

function fillFaceColors(geometry, colorOfFace) {
  const face = geometry.attributes.aFace.array;
  const back = geometry.attributes.aBack.array;
  const color = geometry.attributes.color;
  for (let i = 0; i < face.length; i++) {
    const c = back[i] ? PLASTIC_BACK : colorOfFace(face[i]);
    color.setXYZ(i, c.r, c.g, c.b);
  }
  color.needsUpdate = true;
}

/** Face id → hex, falling back to grey for anything the scheme leaves out. */
export const faceHex = (faceColors, id) => faceColors?.[id] || '#888888';

/** The gimbals' own metal: a pale brass that stays out of the colours' way. */
export const GYRO_METAL = new THREE.Color('#d9c89c');

/**
 * Ring colour at `side` (+1 at bead A, −1 at bead B; ±2 are the beads). The
 * ring is plain metal that only warms toward each bead's colour close to it, so
 * the six beads — three antipodal pairs — are what the eye picks out.
 */
export function gyroColorAt(side, colorA, colorB, out = new THREE.Color()) {
  if (side > 1.5) return out.copy(colorA).lerp(_white, 0.2);
  if (side < -1.5) return out.copy(colorB).lerp(_white, 0.2);
  out.copy(GYRO_METAL).multiplyScalar(0.55);
  return out.lerp(side > 0 ? colorA : colorB, 0.7 * Math.pow(Math.abs(side), 12));
}

function paintGyroRing(geometry, colorA, colorB) {
  const side = geometry.userData.side;
  const color = geometry.attributes.color;
  for (let i = 0; i < side.length; i++) {
    gyroColorAt(side[i], colorA, colorB, _c);
    color.setXYZ(i, _c.r, _c.g, _c.b);
  }
  color.needsUpdate = true;
}

/**
 * Write a colour scheme into every coloured part: the rings in their own face
 * colours, the mouths in their antipodes', the gimbals in their axis pairs and
 * the heart's six-colour field.
 */
export function paintCoreColors(parts, faceColors) {
  const byIndex = CORE_FACES.map(({ id }) => new THREE.Color(faceHex(faceColors, id)));
  const antipodeOf = (i) => byIndex[ANTIPODAL_COLOR[CORE_FACES[i].id] - 1];
  fillFaceColors(parts.ports, (i) => byIndex[i]);
  fillFaceColors(parts.mouths, (i) => antipodeOf(i));
  GYRO_AXES.forEach(({ faces }, i) => {
    _a.copy(byIndex[faces[0] - 1]);
    _b.copy(byIndex[faces[1] - 1]);
    paintGyroRing(parts.gyro[i], _a, _b);
  });
  byIndex.forEach((c, i) => parts.heartUniforms.uFace.value[i].copy(c));
}

// ── Shaders ──────────────────────────────────────────────────────────────────

const FACE_FIELD_GLSL = /* glsl */ `
  uniform vec3 uFace[6]; // by face id - 1: PZ, NX, PY, NZ, PX, NY
  // The cube's six face colours spread over the sphere of directions, sharpened
  // so each face keeps its own hue with only a short blend at the edges.
  vec3 faceField(vec3 n) {
    vec3 p = pow(max(n, 0.0), vec3(6.0));
    vec3 q = pow(max(-n, 0.0), vec3(6.0));
    vec3 c = uFace[4] * p.x + uFace[1] * q.x + uFace[2] * p.y + uFace[5] * q.y + uFace[0] * p.z + uFace[3] * q.z;
    return c / max(p.x + q.x + p.y + q.y + p.z + q.z, 1e-4);
  }
`;

const HEART_VERTEX = /* glsl */ `
  varying vec3 vObjN;
  varying vec3 vViewN;
  varying vec3 vViewPos;
  void main() {
    vObjN = normal;
    vViewN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const HEART_FRAGMENT = /* glsl */ `
  ${FACE_FIELD_GLSL}
  uniform float uTime;
  uniform float uEnergy;
  uniform float uFlash;
  uniform float uFlipT;
  uniform vec3 uFlipDir;
  uniform vec3 uFlipColor;
  varying vec3 vObjN;
  varying vec3 vViewN;
  varying vec3 vViewPos;

  void main() {
    vec3 n = normalize(vObjN);
    // A slow churn so the colour field never sits still.
    float s = uTime * 0.6;
    vec3 w = normalize(n + 0.22 * vec3(sin(n.y * 5.0 + s), sin(n.z * 5.0 - s * 1.3), sin(n.x * 5.0 + s * 0.7)));
    // Antipodal: each side of the heart shows the colour of the opposite face.
    vec3 field = faceField(-w);

    float facing = clamp(dot(normalize(vViewN), normalize(-vViewPos)), 0.0, 1.0);
    float rim = pow(1.0 - facing, 2.0);
    vec3 hot = mix(field * 1.15, vec3(1.0, 0.96, 0.88), pow(facing, 2.0) * (0.5 + 0.4 * uEnergy));
    vec3 col = hot * (0.55 + 0.6 * uEnergy) + field * rim * 1.3;

    // A flip crosses the heart as a bright front, from the flipped face to its antipode.
    float front = 1.0 - 2.0 * uFlipT;
    float band = exp(-pow((dot(n, uFlipDir) - front) * 6.0, 2.0)) * step(0.001, uFlipT) * (1.0 - uFlipT);
    col += (uFlipColor * 0.9 + 0.5) * band * 1.4;
    col *= 1.0 + uFlash * 0.7;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const MOUTH_VERTEX = /* glsl */ `
  attribute float aFace;
  attribute vec3 color;
  uniform float uFlare[6];
  varying vec2 vLocal;
  varying vec3 vColor;
  varying float vFlare;
  void main() {
    vLocal = uv * 2.0 - 1.0;
    vColor = color;
    vFlare = uFlare[int(aFace + 0.5)];
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MOUTH_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  varying vec2 vLocal;
  varying vec3 vColor;
  varying float vFlare;

  void main() {
    float r = length(vLocal);
    float a = atan(vLocal.y, vLocal.x);
    // Three arms winding in toward the dock, turning like water down a drain.
    float swirl = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uTime * 2.4);
    float rim = smoothstep(0.5, 0.97, r);
  #ifdef SOLID
    // WORM: an opaque, dark throat the worm dives into.
    vec3 col = mix(vec3(0.012, 0.018, 0.028), vColor, (0.2 + swirl * 0.55) * smoothstep(0.08, 1.0, r));
    col += vColor * (rim * 0.45 + vFlare * 0.8 * (1.0 - r));
    gl_FragColor = vec4(col, 1.0);
  #else
    // Elsewhere: see-through, so the heart shows through a glowing iris.
    float glow = rim * 0.85 + swirl * smoothstep(0.15, 1.0, r) * 0.3;
    vec3 col = vColor * glow * (0.35 + 0.35 * uEnergy + 1.2 * vFlare);
    gl_FragColor = vec4(col, 1.0);
  #endif
    #include <colorspace_fragment>
  }
`;

const HALO_VERTEX = /* glsl */ `
  uniform float uSize;
  varying vec2 vLocal;
  void main() {
    vLocal = uv * 2.0 - 1.0;
    // Billboard: always faces the camera, centred on the heart.
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vLocal;
  void main() {
    float r2 = dot(vLocal, vLocal);
    float g = (exp(-r2 * 7.0) * 0.8 + exp(-r2 * 28.0) * 0.6) * (1.0 - smoothstep(0.6, 1.0, r2));
    gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
    #include <colorspace_fragment>
  }
`;

// ── Parts ────────────────────────────────────────────────────────────────────

/**
 * Build every geometry and material the core needs. `performanceMode` drops
 * the clearcoat finishes, as rubiksFinish does for the menu cube.
 */
export function createVoidCoreParts({ performanceMode = false } = {}) {
  const Lit = performanceMode ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const coat = (p) => (performanceMode ? {} : p);

  const heartUniforms = {
    uFace: { value: CORE_FACES.map(() => new THREE.Color()) },
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uFlash: { value: 0 },
    uFlipT: { value: 0 },
    uFlipDir: { value: new THREE.Vector3(0, 0, 1) },
    uFlipColor: { value: new THREE.Color(1, 1, 1) }
  };
  const mouthUniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uFlare: { value: new Array(6).fill(0) }
  };
  const haloUniforms = {
    uSize: { value: 0.75 },
    uColor: { value: new THREE.Color('#ffe7c2') },
    uIntensity: { value: 0 }
  };
  // Shared by the ring material's patched shader: how much the rings glow.
  const portGlow = { value: 0.2 };

  const portMaterial = new Lit({
    vertexColors: true, roughness: 0.24, metalness: 0, ...coat({ clearcoat: 1, clearcoatRoughness: 0.12 })
  });
  // Let the rings glow in their own colours so they stay readable deep inside
  // the cube, where the studio rig reaches them only at a glance.
  portMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uPortGlow = portGlow;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uPortGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * uPortGlow;');
  };
  portMaterial.customProgramCacheKey = () => 'void-core-port';

  const gyroMaterials = GYRO_RADII.map(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));

  return {
    cage: createCoreCageGeometry(),
    plates: createCorePlateGeometry(),
    ports: createPortGeometry(),
    mouths: createMouthGeometry(),
    heart: new THREE.SphereGeometry(HEART_R, 40, 28),
    halo: new THREE.PlaneGeometry(1, 1),
    gyro: GYRO_RADII.map(createGyroRingGeometry),
    heartUniforms,
    mouthUniforms,
    haloUniforms,
    portGlow,
    materials: {
      plastic: new Lit({ color: '#141416', roughness: 0.34, metalness: 0, ...coat({ clearcoat: 0.4, clearcoatRoughness: 0.35 }) }),
      port: portMaterial,
      heart: new THREE.ShaderMaterial({ uniforms: heartUniforms, vertexShader: HEART_VERTEX, fragmentShader: HEART_FRAGMENT }),
      mouthGlow: new THREE.ShaderMaterial({
        uniforms: mouthUniforms, vertexShader: MOUTH_VERTEX, fragmentShader: MOUTH_FRAGMENT,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      }),
      mouthSolid: new THREE.ShaderMaterial({
        uniforms: mouthUniforms, vertexShader: MOUTH_VERTEX, fragmentShader: MOUTH_FRAGMENT, defines: { SOLID: '' }
      }),
      halo: new THREE.ShaderMaterial({
        uniforms: haloUniforms, vertexShader: HALO_VERTEX, fragmentShader: HALO_FRAGMENT,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      }),
      gyro: gyroMaterials
    }
  };
}

export function disposeVoidCoreParts(parts) {
  for (const key of ['cage', 'plates', 'ports', 'mouths', 'heart', 'halo']) parts[key].dispose();
  parts.gyro.forEach(g => g.dispose());
  const { gyro, ...single } = parts.materials;
  Object.values(single).forEach(m => m.dispose());
  gyro.forEach(m => m.dispose());
}
