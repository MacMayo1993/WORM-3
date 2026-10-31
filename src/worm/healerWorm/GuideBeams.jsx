// The guide's beams (which items, in guideTargets.js, published to wormBuffs.guide
// by useWormCrawler): a beam of light stands straight out of each lit item's tile
// along that face's outward direction (up from the face above, out to the left from
// the face on the left), in the item's colour, long enough to stand past the cube's
// edge from a tile round the side (`guideBeamTipInto`).
//
// Beams are depth-tested like anything else on the cube: the part the cube hides
// stays hidden, never drawn through it.
//
// The nearest item burns brightest; an item already in view, or close to the head,
// dims so the beams never wall off the way ahead. Each beam is a camera-facing strip
// turned about its own axis: one instanced strip geometry, one additive draw.
// Mounted for the mode's life (hidden) so the run's warm-up links its program, never
// the first frame it shows. Light climbs the beams on
// the sim's clock, so pause holds it, and reduced motion keeps them still. Beams fade
// in and out per item rather than popping when the lit set changes.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWormStickerWorldPos } from '../wormExpansion.js';
import { liveRotation } from '../liveRotation.js';
import { wormBuffs } from '../wormBuffs.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { uploadInstancePrefix } from '../../3d/instanceUploads.js';
import { FACE_NORMALS } from './constants.js';
import { GUIDE, guideBeamTipInto, guideTargetInView, tileKeyOf } from './guideTargets.js';

const CAPACITY = GUIDE.beams * 2;   // room for the old set to fade out under the new
const SEGMENTS = 8;                 // along each beam, so the widening strip keeps its shading even
const BEAM_WIDTH = 0.8;             // world units across at the foot, on a 1-unit tile
const BEAM_SPREAD = 3;              // ... and this many times that at the tip
const BEAM_LIFT = 0.02;             // the foot sits just over the sticker
const NEAR_FROM = 2, NEAR_TO = 4.5; // world distance from the head over which a beam fades in
const IN_VIEW = 0.5;                // an item on screen already: half as bright
const SECOND = 0.6;                 // every beam after the nearest
const FADE_IN = 5, FADE_OUT = 9;    // per second

const vertexShader = /* glsl */ `
  attribute vec3 aFoot;            // on the tile
  attribute vec3 aTip;             // out along the face's normal
  attribute vec3 aColor;
  attribute vec2 aBeam;            // intensity, phase seed
  uniform float uWidth;
  uniform float uSpread;
  varying vec2 vUv;
  varying vec2 vBeam;
  varying vec3 vColor;
  void main() {
    // uv.y runs from the foot to the tip; the strip turns about the beam to face the camera.
    float t = uv.y;
    vec3 point = mix(aFoot, aTip, t);
    vec3 along = normalize(aTip - aFoot);
    vec3 side = cross(along, cameraPosition - point);
    float sideLength = length(side);
    side = sideLength > 1e-5 ? side / sideLength : normalize(cross(along, vec3(0.31, 0.95, 0.0)));
    vec3 world = point + side * (uv.x - 0.5) * uWidth * mix(1.0, uSpread, t);
    vUv = uv;
    vBeam = aBeam;
    vColor = aColor;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vUv;
  varying vec2 vBeam;
  varying vec3 vColor;
  void main() {
    float x = abs(vUv.x - 0.5) * 2.0;      // 0 on the axis, 1 at the edge
    float y = vUv.y;                        // 0 at the foot, 1 at the tip
    float core = exp(-x * x * 14.0);
    float glow = exp(-x * x * 2.4) * (1.0 - x);
    float foot = exp(-y * 40.0);
    // Even along most of its length, thinning out over the last stretch.
    float span = smoothstep(0.0, 0.005, y) * (1.0 - smoothstep(0.6, 1.0, y));
    // Light climbing the beam, away from the cube.
    float climb = 0.5 + 0.5 * sin(6.2832 * (y * 12.0 - uTime * 1.2 + vBeam.y));
    float pulse = mix(0.85, 0.65 + 0.55 * climb, uMotion);
    float a = (glow * 0.85 * pulse + core * 0.8 + foot * glow) * span * vBeam.x;
    vec3 color = mix(vColor, vec3(1.0), core * 0.6 + foot * 0.25);
    gl_FragColor = vec4(color, a);
    #include <colorspace_fragment>
  }
`;

function createBeams() {
  const strip = new THREE.PlaneGeometry(1, 1, 1, SEGMENTS);
  const geometry = new THREE.InstancedBufferGeometry().copy(strip);
  strip.dispose();
  const attribute = size => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    return a;
  };
  const attributes = { aFoot: attribute(3), aTip: attribute(3), aColor: attribute(3), aBeam: attribute(2) };
  for (const [name, a] of Object.entries(attributes)) geometry.setAttribute(name, a);
  geometry.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: { uTime: { value: 0 }, uMotion: { value: 1 }, uWidth: { value: BEAM_WIDTH }, uSpread: { value: BEAM_SPREAD } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    toneMapped: false, forceSinglePass: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'GuideBeams';
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.renderOrder = 1;
  mesh.visible = false;
  return { mesh, geometry, material, attributes };
}

const seedOf = key => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
};
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const _foot = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _tip = new THREE.Vector3();
const _color = new THREE.Color();

export function GuideBeams({ worm, size }) {
  const beams = useMemo(() => createBeams(), []);
  useEffect(() => () => {
    beams.geometry.dispose();
    beams.material.dispose();
  }, [beams]);
  // Every beam on show, by its tile's key, with its brightness easing toward `want`.
  const lit = useRef(new Map());

  useFrame(({ camera }, delta) => {
    const { mesh, geometry, material, attributes } = beams;
    const shown = lit.current;
    if (worm.phase.current !== 'crawling') {
      // A ride: the camera is inside the cube. Drop them at once.
      shown.clear();
      mesh.visible = false;
      return;
    }
    const goal = !liveRotation.active && !worm.restRead.current ? wormBuffs.guide : null;
    for (const item of shown.values()) item.want = 0;
    goal?.beams.forEach((b, i) => {
      const key = tileKeyOf(b);
      let item = shown.get(key);
      if (!item) shown.set(key, item = { tile: b, color: b.color, alpha: 0, want: 0, seed: seedOf(key) });
      item.tile = b; item.color = b.color;
      item.want = i === 0 ? 1 : SECOND;
    });

    const head = worm.headInterpPos.current;
    let count = 0;
    for (const [key, item] of shown) {
      const { tile } = item;
      _normal.copy(FACE_NORMALS[tile.dirKey]);
      _foot.fromArray(getWormStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size)).addScaledVector(_normal, BEAM_LIFT);
      let want = item.want;
      if (want > 0) {
        want *= smooth(NEAR_FROM, NEAR_TO, _foot.distanceTo(head));
        if (guideTargetInView(camera, _foot, _normal)) want *= IN_VIEW;
      }
      const rate = want > item.alpha ? FADE_IN : FADE_OUT;
      item.alpha += (want - item.alpha) * Math.min(1, delta * rate);
      if (item.want === 0 && item.alpha < 0.01) { shown.delete(key); continue; }
      if (item.alpha < 0.01 || count >= CAPACITY) continue;
      _foot.toArray(attributes.aFoot.array, count * 3);
      guideBeamTipInto(_tip, _foot, _normal, size).toArray(attributes.aTip.array, count * 3);
      _color.set(item.color).toArray(attributes.aColor.array, count * 3);
      attributes.aBeam.array[count * 2] = item.alpha;
      attributes.aBeam.array[count * 2 + 1] = item.seed;
      count++;
    }
    geometry.instanceCount = count;
    mesh.visible = count > 0;
    if (!count) return;
    const moving = !prefersReducedMotion();
    material.uniforms.uMotion.value = moving ? 1 : 0;
    material.uniforms.uTime.value = moving ? worm.timeAliveRef.current : 0;
    for (const a of Object.values(attributes)) uploadInstancePrefix(a, count);
  });

  return <primitive object={beams.mesh} />;
}
