// The guide's beams (which items, in guideTargets.js, published to wormBuffs.guide
// by useWormCrawler): a ribbon of light leaves each lit item's tile straight out of
// the cube, in the item's colour, then bends and rises up the screen beside the
// cube into the sky, so an item round the side or underneath still shows as a
// column of light standing off the cube in its direction.
//
// Why it bends (`guideBeamCurveInto`, walked as `guideBeamAt`): the chase camera
// hugs the face the head is on, so the cube hides everything round the side, and a
// beam straight along a far face's normal stays behind the cube or shrinks into the
// horizon. Rising along the camera's own up, beside the cube, it clears the edge
// and never points into the lens. The stretch the cube still hides is drawn again,
// faintly, through it (a second pass that only draws where the cube is in front,
// GreaterDepth), so a column still leads back to its item.
//
// The nearest item burns brightest; an item already in view, or close to the head,
// dims so the beams never wall off the way ahead. Each beam is a bend and a rise the
// vertex shader walks: one instanced strip geometry, two additive draws sharing
// every buffer. Mounted for the mode's life (hidden) so the run's warm-up links
// both programs, never the first frame they show. Light climbs the beams on the
// sim's clock, so pause holds it, and reduced motion keeps them still. Beams fade in
// and out per item rather than popping when the lit set changes.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWormStickerWorldPos } from '../wormExpansion.js';
import { liveRotation } from '../liveRotation.js';
import { wormBuffs } from '../wormBuffs.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { uploadInstancePrefix } from '../../3d/instanceUploads.js';
import { FACE_NORMALS } from './constants.js';
import { GUIDE, guideBeamCurveInto, guideTargetInView, tileKeyOf } from './guideTargets.js';

const CAPACITY = GUIDE.beams * 2;   // room for the old set to fade out under the new
const SEGMENTS = 40;                // along each beam
const BEAM_WIDTH = 0.8;             // world units across at the foot, on a 1-unit tile
const BEAM_SPREAD = 3;              // ... and this many times that at the tip
const BEAM_LIFT = 0.02;             // the foot sits just over the sticker
const NEAR_FROM = 2, NEAR_TO = 4.5; // world distance from the head over which a beam fades in
const IN_VIEW = 0.5;                // an item on screen already: half as bright
const SECOND = 0.6;                 // every beam after the nearest
const THROUGH = 0.25;               // the stretch the cube hides, seen through it
const FADE_IN = 5, FADE_OUT = 9;    // per second

const vertexShader = /* glsl */ `
  attribute vec3 aP0;              // the foot, on the tile
  attribute vec3 aP1;              // straight out of the tile
  attribute vec3 aP2;              // clear of the cube
  attribute vec3 aP3;              // the bend ends, heading up
  attribute vec3 aP4;              // the tip, in the sky
  attribute vec3 aColor;
  attribute vec2 aBeam;            // intensity, phase seed
  uniform float uWidth;
  uniform float uSpread;
  varying vec2 vUv;
  varying vec2 vBeam;
  varying vec3 vColor;
  void main() {
    // uv.y walks the path (guideBeamAt): the bend's cubic over its share of the
    // length, then the straight rise. The strip turns about it to face the camera.
    float t = uv.y;
    float bend = distance(aP0, aP3) + distance(aP1, aP2) * 0.5 + 1e-3;
    float k = bend / (bend + distance(aP3, aP4));
    vec3 point, along;
    if (t < k) {
      float u = t / k, s = 1.0 - u;
      point = s * s * s * aP0 + 3.0 * s * s * u * aP1 + 3.0 * s * u * u * aP2 + u * u * u * aP3;
      along = 3.0 * s * s * (aP1 - aP0) + 6.0 * s * u * (aP2 - aP1) + 3.0 * u * u * (aP3 - aP2);
    } else {
      point = mix(aP3, aP4, (t - k) / (1.0 - k));
      along = aP4 - aP3;
    }
    float alongLength = length(along);
    along = alongLength > 1e-5 ? along / alongLength : normalize(aP4 - aP0);
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
  uniform float uGain;
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
    float a = (glow * 0.85 * pulse + core * 0.8 + foot * glow) * span * vBeam.x * uGain;
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
  const attributes = { aP0: attribute(3), aP1: attribute(3), aP2: attribute(3), aP3: attribute(3), aP4: attribute(3),
    aColor: attribute(3), aBeam: attribute(2) };
  for (const [name, a] of Object.entries(attributes)) geometry.setAttribute(name, a);
  geometry.instanceCount = 0;
  // Both passes read the same clock and shape.
  const shared = { uTime: { value: 0 }, uMotion: { value: 1 }, uWidth: { value: BEAM_WIDTH }, uSpread: { value: BEAM_SPREAD } };
  const pass = (gain, depthFunc) => new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: { ...shared, uGain: { value: gain } },
    transparent: true, depthWrite: false, depthFunc, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    toneMapped: false, forceSinglePass: true,
  });
  const materials = [pass(1, THREE.LessEqualDepth), pass(THROUGH, THREE.GreaterDepth)];
  const meshes = materials.map((material, i) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = i === 0 ? 'GuideBeams' : 'GuideBeamsThrough';
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    mesh.renderOrder = 1;
    mesh.visible = false;
    return mesh;
  });
  const group = new THREE.Group();
  group.add(...meshes);
  return { group, meshes, geometry, materials, attributes, shared };
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
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _color = new THREE.Color();
const _points = [0, 1, 2, 3, 4].map(() => new THREE.Vector3());

export function GuideBeams({ worm, size }) {
  const beams = useMemo(() => createBeams(), []);
  useEffect(() => () => {
    beams.geometry.dispose();
    beams.materials.forEach(material => material.dispose());
  }, [beams]);
  // Every beam on show, by its tile's key, with its brightness easing toward `want`.
  const lit = useRef(new Map());

  useFrame(({ camera }, delta) => {
    const { meshes, geometry, attributes, shared } = beams;
    const shown = lit.current;
    if (worm.phase.current !== 'crawling') {
      // A ride: the camera is inside the cube. Drop them at once.
      shown.clear();
      for (const mesh of meshes) mesh.visible = false;
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
    _up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
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
      guideBeamCurveInto(_points, _foot, _normal, _up, _right, size);
      for (let k = 0; k < 5; k++) _points[k].toArray(attributes[`aP${k}`].array, count * 3);
      _color.set(item.color).toArray(attributes.aColor.array, count * 3);
      attributes.aBeam.array[count * 2] = item.alpha;
      attributes.aBeam.array[count * 2 + 1] = item.seed;
      count++;
    }
    geometry.instanceCount = count;
    for (const mesh of meshes) mesh.visible = count > 0;
    if (!count) return;
    const moving = !prefersReducedMotion();
    shared.uMotion.value = moving ? 1 : 0;
    shared.uTime.value = moving ? worm.timeAliveRef.current : 0;
    for (const a of Object.values(attributes)) uploadInstancePrefix(a, count);
  });

  return <primitive object={beams.group} />;
}
