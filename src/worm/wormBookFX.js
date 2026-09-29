// src/worm/wormBookFX.js
// The Book Worm's body: a run of hardback volumes, each lying open face-down
// with its boards pitched like a roof over the page block. The spine is the
// worm's back ridge, the boards are its flanks, and the cream fore-edges rest
// on the tile. Gameplay (WormBody's instanced meshes), the picker/store preview
// and the menu rig all build from the parts here, so they cannot drift apart.
//
// Book space: X across the spread (+X is the worm's right), Y up the surface
// normal, -Z along the spine in the direction of travel. The hinge line is the
// Z axis. A book of scale s stands in for a round bead of radius
// s / BOOK_SCALE_PER_RADIUS: its lowest point sits exactly where that bead's
// belly would, so surface clearance, tunnel fitting and accessories that were
// solved for beads still hold.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const BOOK_LENGTH = 0.95;           // head to tail of the boards
export const BOOK_COVER_WIDTH = 1.0;       // hinge to fore-edge
export const BOOK_COVER_THICKNESS = 0.075;
export const BOOK_BLOCK_THICKNESS = 0.24;  // each half of the text block
export const BOOK_SQUARE = 0.055;          // how far the boards overhang the pages
export const BOOK_SPINE_RADIUS = 0.14;
const BLOCK_X0 = 0.03;

// World scale of a book standing in for a bead of radius r is r * this.
export const BOOK_SCALE_PER_RADIUS = 1.4;
// Book-space distance from the segment centre down to the book's lowest point.
export const BOOK_BELLY = 1 / BOOK_SCALE_PER_RADIUS;

// Boards pitched ~42° below level at rest. The body breathes the pitch in a
// wave running down its length, and a turn tips both boards the same way so
// the spread seesaws toward the side the worm turns into.
export const BOOK_REST_ANGLE = 0.74;
export const BOOK_BREATH = 0.06;
export const BOOK_BANK_GAIN = 0.10;
export const BOOK_BREATH_RATE = 3.2;
export const BOOK_BREATH_PHASE = 0.9;      // radians of wave per segment

// Alternate volumes are a size down, so overlapping books never share a board
// plane (no z-fighting) and the back reads as a segmented ridge.
export const BOOK_ODD_VOLUME = 0.88;
export const bookVolumeScale = index => (index % 2 === 1 ? BOOK_ODD_VOLUME : 1);
export const bookScaleForRadius = radius => radius * BOOK_SCALE_PER_RADIUS;

/** How far below the hinge a half reaches at `angle` from level, in book units. */
export function bookCoverDrop(angle) {
  const s = Math.sin(angle), c = Math.cos(angle);
  const board = BOOK_COVER_WIDTH * s + BOOK_COVER_THICKNESS * c;
  const block = (BOOK_COVER_WIDTH - BOOK_SQUARE) * s + (BOOK_COVER_THICKNESS + BOOK_BLOCK_THICKNESS) * c;
  return Math.max(board, block);
}

// The hinge rides high enough that the most drooped board (full breath plus
// full bank) just reaches the bead's belly; at rest the pages hover a hair
// above the tile instead of dipping into it.
export const BOOK_MAX_ANGLE = BOOK_REST_ANGLE + BOOK_BREATH + BOOK_BANK_GAIN;
export const BOOK_HINGE_Y = bookCoverDrop(BOOK_MAX_ANGLE) - BOOK_BELLY;

/** Raise a segment centre by this so a book of `scale` rests `clearance` below it. */
export const bookGroundLift = (scale, clearance) => BOOK_BELLY * scale - clearance;

// Material parts, carried per vertex as `bookPart`.
export const BOOK_PART = { cover: 0, board: 1, paper: 2, gilt: 3, spine: 4 };

function part(geometry, id) {
  const count = geometry.attributes.position.count;
  geometry.setAttribute('bookPart', new THREE.Float32BufferAttribute(new Float32Array(count).fill(id), 1));
  return geometry;
}

// A box between two corners. BoxGeometry lays its faces out +X, -X, +Y, -Y,
// +Z, -Z with four vertices each, so faces can take different parts.
function slab(min, max, parts) {
  const geometry = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  geometry.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  const ids = new Float32Array(geometry.attributes.position.count);
  for (let i = 0; i < ids.length; i++) ids[i] = parts[Math.floor(i / 4)];
  geometry.setAttribute('bookPart', new THREE.Float32BufferAttribute(ids, 1));
  return geometry;
}

/**
 * One half of the open book, hinged on the Z axis: a board on top (tooled
 * leather outside, plain board edges) over its half of the text block.
 * side = 1 builds the right half (+X), -1 the left.
 */
export function createBookCoverGeometry(side = 1) {
  const x = v => side * v;
  const lo = (a, b) => Math.min(x(a), x(b)), hi = (a, b) => Math.max(x(a), x(b));
  const { cover, board, paper } = BOOK_PART;
  const W = BOOK_COVER_WIDTH, L = BOOK_LENGTH / 2, T = BOOK_COVER_THICKNESS, P = BOOK_BLOCK_THICKNESS, Q = BOOK_SQUARE;
  const boardGeo = slab([lo(0, W), -T, -L], [hi(0, W), 0, L], [board, board, cover, board, board, board]);
  const blockGeo = slab([lo(BLOCK_X0, W - Q), -T - P, -L + Q], [hi(BLOCK_X0, W - Q), -T, L - Q], [paper, paper, paper, paper, paper, paper]);
  const geometry = mergeGeometries([boardGeo, blockGeo]);
  boardGeo.dispose(); blockGeo.dispose();
  return geometry;
}

/**
 * The rounded spine over the hinge, with two raised gilt bands, already lifted
 * to BOOK_HINGE_Y so it takes the segment's own transform.
 */
export function createBookSpineGeometry() {
  const R = BOOK_SPINE_RADIUS, L = BOOK_LENGTH;
  // Half a cylinder, arched over +Y, lying along Z.
  const spine = new THREE.CylinderGeometry(R, R, L, 14, 1, false, -Math.PI / 2, Math.PI);
  spine.rotateX(-Math.PI / 2);
  part(spine, BOOK_PART.spine);
  const bands = [-0.27, 0.27].map(z => {
    const band = new THREE.TorusGeometry(R, 0.03, 6, 14, Math.PI);
    band.translate(0, 0, z);
    return part(band, BOOK_PART.gilt);
  });
  const geometry = mergeGeometries([spine, ...bands]);
  [spine, ...bands].forEach(g => g.dispose());
  geometry.translate(0, BOOK_HINGE_Y, 0);
  return geometry;
}

/**
 * Leather, paper and gold from one material. The cover colour comes from the
 * material colour (previews) or the instance colour (gameplay), so orb bands
 * and pickup flashes still colour each volume; paper and gilt keep their own.
 * Tooling (gilt frame, corners, a diamond boss, the hinge groove), page lines
 * and the spine label are drawn from book-space position, not textures.
 */
export function createBookBindingMaterial() {
  const material = new THREE.MeshStandardMaterial({ color: 'white', roughness: 0.5, metalness: 0 });
  const uniforms = {
    uBookPaper: { value: new THREE.Color('#f4ead0') },
    uBookPageLine: { value: new THREE.Color('#c9b88e') },
    uBookGilt: { value: new THREE.Color('#b9821f') },
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float bookPart;\nvarying vec3 vBookLocal;\nvarying float vBookPart;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBookLocal = position;\nvBookPart = bookPart;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBookLocal;
        varying float vBookPart;
        uniform vec3 uBookPaper;
        uniform vec3 uBookPageLine;
        uniform vec3 uBookGilt;
        float bookBand(float d, float halfWidth) {
          float w = max(fwidth(d), 1e-4);
          return 1.0 - smoothstep(halfWidth - w, halfWidth + w, abs(d));
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 bookTint = diffuseColor.rgb;
        float bookGold = step(2.5, vBookPart) * (1.0 - step(3.5, vBookPart));
        float bookPaper = step(1.5, vBookPart) * (1.0 - step(2.5, vBookPart));
        vec3 bookColor = bookTint * 0.72;
        if (vBookPart < 0.5) {
          // Tooled board: a gilt frame round a diamond boss, brass corners on
          // the fore-edge, and the hinge groove beside the spine.
          float a = abs(vBookLocal.x) / ${BOOK_COVER_WIDTH.toFixed(3)};
          float b = vBookLocal.z / ${BOOK_LENGTH.toFixed(3)} + 0.5;
          vec2 q = vec2(a - 0.58, b - 0.5);
          vec2 d = abs(q) - vec2(0.3, 0.36);
          float frame = bookBand(max(d.x, d.y), 0.022);
          float diamond = abs(q.x) / 0.13 + abs(q.y) / 0.17;
          float boss = bookBand(diamond - 0.72, 0.28);
          float corner = 1.0 - smoothstep(0.17, 0.19, (1.0 - a) + min(b, 1.0 - b));
          float groove = bookBand(a - 0.1, 0.018);
          bookGold = max(max(frame, boss), corner);
          bookColor = bookTint * (1.0 - 0.45 * groove) * (0.6 + 0.1 * a);
        } else if (bookPaper > 0.5) {
          // Page edges: fine leaves across the block's thickness, warming to
          // gilt toward the fore-edge.
          float t = (-vBookLocal.y - ${BOOK_COVER_THICKNESS.toFixed(3)}) / ${BOOK_BLOCK_THICKNESS.toFixed(3)};
          float leaf = bookBand(fract(t * 9.0) - 0.5, 0.16);
          bookColor = mix(uBookPaper, uBookPageLine, leaf * 0.55);
          float fore = smoothstep(0.75, 0.97, abs(vBookLocal.x) / ${BOOK_COVER_WIDTH.toFixed(3)});
          bookColor = mix(bookColor, uBookGilt * 0.85, fore * 0.35);
        } else if (vBookPart > 3.5) {
          // Spine: the volume's title label, a darker panel between the bands.
          float z = vBookLocal.z / ${BOOK_LENGTH.toFixed(3)};
          float label = 1.0 - smoothstep(0.17, 0.18, abs(z));
          float rule = bookBand(abs(z) - 0.14, 0.012) * step(${(BOOK_HINGE_Y + BOOK_SPINE_RADIUS * 0.55).toFixed(3)}, vBookLocal.y);
          bookColor = mix(bookTint * 0.82, bookTint * 0.4, label);
          bookGold = max(bookGold, rule);
        }
        diffuseColor.rgb = mix(bookColor, uBookGilt, bookGold);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(0.62, 0.86, bookPaper), 0.3, bookGold);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = 0.75 * bookGold;`)
      // Metal gilt goes bronze-dark in the space scenes' thin reflections; a
      // little of its own glow keeps the tooling reading as gold.
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uBookGilt * bookGold * 0.35;`);
  };
  material.customProgramCacheKey = () => 'book-binding-2';
  return material;
}

/**
 * Hinge angles for the left and right boards of segment `index`. `turn` is
 * the smoothed turn force (clamped to -1..1 so a hard turn cannot fold a board
 * through the tile); `time` drives the breathing wave, frozen at 0 for reduced
 * motion. Writes into and returns `out`.
 */
export function bookCoverAngles(turn, time = 0, index = 0, out = { left: 0, right: 0 }) {
  const bank = Math.max(-1, Math.min(1, turn || 0)) * BOOK_BANK_GAIN;
  const pitch = BOOK_REST_ANGLE + BOOK_BREATH * Math.sin(time * BOOK_BREATH_RATE - index * BOOK_BREATH_PHASE);
  out.left = pitch + bank;
  out.right = -pitch + bank;
  return out;
}

const _hinge = new THREE.Matrix4();
/** A board's instance matrix: the segment's matrix, then up to the hinge and about it. */
export function bookCoverMatrixInto(out, segmentMatrix, angle) {
  _hinge.makeRotationZ(angle).setPosition(0, BOOK_HINGE_Y, 0);
  return out.multiplyMatrices(segmentMatrix, _hinge);
}

/**
 * A posable book for previews and menus: spine and both boards sharing
 * `material`, in book units (scale the group by the book scale).
 */
export function createBookSegment(parts, material) {
  const group = new THREE.Group();
  const spine = new THREE.Mesh(parts.spine, material);
  const hinges = [parts.left, parts.right].map(geometry => {
    const hinge = new THREE.Group();
    hinge.position.y = BOOK_HINGE_Y;
    hinge.add(new THREE.Mesh(geometry, material));
    group.add(hinge);
    return hinge;
  });
  group.add(spine);
  return { group, hinges, material };
}

/** Shared geometry for createBookSegment. Dispose with disposeBookParts. */
export const createBookParts = () => ({ spine: createBookSpineGeometry(), left: createBookCoverGeometry(-1), right: createBookCoverGeometry(1) });
export const disposeBookParts = parts => Object.values(parts).forEach(g => g.dispose());

const _angles = { left: 0, right: 0 };
export function poseBookSegment(book, turn, time, index) {
  bookCoverAngles(turn, time, index, _angles);
  book.hinges[0].rotation.z = _angles.left;
  book.hinges[1].rotation.z = _angles.right;
}

// The head is a round orb, like every other worm's; only the body is books.
// Kept here because gameplay and the picker previews both build it, and they
// must agree or the preview stops matching the worm you get.
export const BOOK_HEAD_RADIUS = 0.092; // matches HEAD_RADIUS / the sphere worms' head

// A hair of lift so the head sits on the body's line; WormFace applies the
// same lift, so the eyes stay on the orb.
export const BOOK_HEAD_LIFT = BOOK_HEAD_RADIUS * 0.06;

export const TURN_SMOOTH_RATE = 7;     // per-second exponential-follow rate
export const TURN_SIGNAL_GAIN = 14;    // scales the raw per-frame direction-delta into a -1..1-ish force

/**
 * Signed "how hard is it turning, and which way" scalar from two consecutive
 * (unit) forward directions and the up/normal axis they're both tangent to.
 * Positive/negative sign is arbitrary but consistent frame-to-frame — only
 * the sign flip on reversal and the magnitude scaling with turn rate matter.
 */
const _turnCross = new THREE.Vector3();
export function turnSignalFromDirections(prevDir, newDir, upAxis, delta = 1 / 60) {
  _turnCross.crossVectors(prevDir, newDir);
  if (!(delta > 0)) return 0;
  return Math.atan2(_turnCross.dot(upAxis), prevDir.dot(newDir)) / (delta * 60);
}

/**
 * Exponential-follow smoothing toward a target value (frame-rate independent).
 */
export function smoothTurn(current, target, delta, rate = TURN_SMOOTH_RATE) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) * rate));
}
