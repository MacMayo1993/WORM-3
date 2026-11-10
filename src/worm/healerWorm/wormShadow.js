import * as THREE from 'three';
import { uploadInstancePrefix } from '../../3d/instanceUploads.js';

// The played worm's contact shadow: one soft dark pool on the cube under every
// other bead, ONE instanced draw whatever the worm's length. Phones draw no
// shadow map, so without it the worm floated over its tiles and a jump had
// nothing to read its height against. Each pool lies where a ray down the
// bead's own normal meets the cube (`bodySurfaceDrop`), so it stays on the tile
// while the bead leaves it: under a jump it spreads and fades, and it is gone
// once the worm is a tile and a half up or off the cube altogether. Render-only.

export const WORM_SHADOW_MAX = 320;
// Every other bead: beads sit 0.09 apart and a pool is ~0.3 across, so the
// pools already overlap into one soft band.
export const WORM_SHADOW_STRIDE = 2;
// Above the sticker's face (0.01 off the cubie) and the decals it wears (to
// ~0.012 more): at 0.012 the pool sat under them and never showed. Still well
// under a resting bead's centre (0.10).
const SURFACE_LIFT = 0.03;
// Height (above a resting bead's) at which the pool has faded out.
export const WORM_SHADOW_REACH = 1.4;
const SPREAD = 3.9; // pool diameter in bead radii, at rest
// Straight under a bead the pool is hidden by the bead itself from the chase
// camera, which looks down on the worm. It is cast a little down the screen
// instead (the studio key is camera-relative too, so that is where it falls).
const CAST = 1.05; // in bead radii

const VERTEX = /* glsl */`
  attribute float aFade;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    vUv = uv;
    vFade = aFade;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    float d = length((vUv - 0.5) * 2.0);
    // A flat core with a soft rim: a pool that peaked only at its centre lay
    // wholly under the bead and showed as nothing.
    float a = (1.0 - smoothstep(0.5, 1.0, d)) * uOpacity * vFade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

const _z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
const _cast = new THREE.Vector3(), _slide = new THREE.Vector3();

/** How strongly a bead `gap` above its resting height still shades the tile (1 at rest, 0 from WORM_SHADOW_REACH). */
export function wormShadowFade(gap) {
  const t = Math.min(1, Math.max(0, gap / WORM_SHADOW_REACH));
  return (1 - t) * (1 - t);
}

export function createWormShadow(max = WORM_SHADOW_MAX) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  fade.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFade', fade);
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#07100b') }, uOpacity: { value: 0.4 } },
    vertexShader: VERTEX, fragmentShader: FRAGMENT,
    transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  const mesh = new THREE.InstancedMesh(geometry, material, max);
  mesh.name = 'worm-contact-shadow';
  mesh.frustumCulled = false;
  mesh.raycast = () => null;
  mesh.renderOrder = 1; // over the tiles' own transparent decals
  mesh.count = 0;
  mesh.visible = false;
  let count = 0;
  return {
    mesh,
    /** @param camera the lens this frame: the pools are cast down its screen. */
    begin(camera) {
      count = 0;
      if (camera?.quaternion) _cast.set(0, -1, 0).applyQuaternion(camera.quaternion);
      else _cast.set(0, 0, 0);
    },
    /**
     * @param position bead centre
     * @param normal the bead's surface normal (unit)
     * @param radius the bead's drawn radius
     * @param drop distance from the bead's centre down that normal to the cube (Infinity: nothing below)
     */
    add(position, normal, radius, drop) {
      if (count >= max || !(drop < Infinity) || radius <= 0.01) return;
      const gap = Math.max(0, drop - radius);
      const strength = wormShadowFade(gap);
      if (strength <= 0.01) return;
      _p.copy(position).addScaledVector(normal, SURFACE_LIFT - Math.max(0, drop));
      // Along the tile only: the part of the cast that lies in the surface.
      _slide.copy(_cast).addScaledVector(normal, -_cast.dot(normal));
      _p.addScaledVector(_slide, radius * CAST * (1 + gap * 2));
      const width = radius * SPREAD * (1 + gap * 0.9);
      _m.compose(_p, _q.setFromUnitVectors(_z, normal), _s.set(width, width, 1));
      mesh.setMatrixAt(count, _m);
      fade.array[count++] = strength;
    },
    end() {
      mesh.count = count;
      // A pool that draws nothing must cost no program selection (instanceUploads.js).
      mesh.visible = count > 0;
      if (!count) return;
      uploadInstancePrefix(mesh.instanceMatrix, count);
      uploadInstancePrefix(fade, count);
    },
    dispose() { geometry.dispose(); material.dispose(); }
  };
}
