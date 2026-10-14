import * as THREE from 'three';
import { CORE_MIRROR_HALF, corePassageGLSL } from './corePassage.js';
import { withPortalCutout } from './portalCutout.js';
import { createPlayStickerGeometry } from './rubiksPiece.js';

// The hollow inside the antipodal core that a WORM ride passes through is a room
// of real mirrors. Each wall is the core face's own grid, size × size, and each
// mirror is stained with the colour of the core sticker it sits behind (the
// cube's live state, as the core shows it). What they reflect is captured live:
// a cube camera at the room's centre renders the room (worm, bands, lightning
// and the other walls) every frame the room is open, and every mirror samples it
// box-projected onto the room's own walls, so a reflection sits where a flat
// mirror would put it rather than floating at infinity. The capture alternates
// between two targets, so the walls reflect each other's last frame without a
// feedback loop: an infinity mirror that deepens over a few frames.

const FACES = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const vertexShader = `
varying vec3 vMirrorWorld;
varying vec3 vMirrorNormal;
varying vec3 vMirrorTint;
varying vec2 vMirrorUv;
void main() {
  vec4 local = vec4(position, 1.0);
  mat3 toWorld = mat3(modelMatrix);
#ifdef USE_INSTANCING
  local = instanceMatrix * local;
  toWorld = toWorld * mat3(instanceMatrix);
#endif
  vec4 world = modelMatrix * local;
  vMirrorWorld = world.xyz;
  vMirrorNormal = normalize(toWorld * normal);
#ifdef USE_INSTANCING_COLOR
  vMirrorTint = instanceColor;
#else
  vMirrorTint = vec3(1.0);
#endif
  vMirrorUv = uv;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const fragmentShader = `
uniform samplerCube uMirrorEnv;
uniform float uMirrorLive;
uniform vec3 uMirrorBoxMin, uMirrorBoxMax, uMirrorProbe;
varying vec3 vMirrorWorld;
varying vec3 vMirrorNormal;
varying vec3 vMirrorTint;
varying vec2 vMirrorUv;

// Where the reflected ray leaves the room, seen from the capture point.
vec3 mirrorBoxProject(vec3 p, vec3 r) {
  vec3 safe = mix(vec3(1e-5), r, step(1e-5, abs(r)));
  vec3 tMax = (uMirrorBoxMax - p) / safe;
  vec3 tMin = (uMirrorBoxMin - p) / safe;
  vec3 t = max(tMax, tMin);
  return p + r * min(min(t.x, t.y), t.z) - uMirrorProbe;
}

void main() {
  vec3 n = normalize(vMirrorNormal);
  vec3 v = normalize(vMirrorWorld - cameraPosition);
  if (dot(n, v) > 0.0) n = -n;
  vec3 r = reflect(v, n);
  vec3 reflection = uMirrorLive > 0.5 ? textureCube(uMirrorEnv, mirrorBoxProject(vMirrorWorld, r)).rgb : vec3(0.0);
  float facing = max(0.0, dot(-v, n));
  float fresnel = pow(1.0 - facing, 4.0);
  // Silvered glass stained by the tile's colour: the reflection is filtered
  // through it, and the tint itself shows a little where the room is dark.
  vec3 stain = mix(vec3(0.86), vMirrorTint, 0.42);
  vec3 color = reflection * stain * 0.9 + vMirrorTint * (uMirrorLive > 0.5 ? 0.07 : 0.3) + fresnel * 0.16;
  // A polished bevel round each mirror catches the light.
  float edge = min(min(vMirrorUv.x, 1.0 - vMirrorUv.x), min(vMirrorUv.y, 1.0 - vMirrorUv.y));
  color += (1.0 - smoothstep(0.0, 0.07, edge)) * 0.14;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

/** Which core sticker each mirror sits behind, as `x,y,z,dirKey`, in instance order. */
export function coreMirrorTileKeys(size) {
  const edge = size - 1, keys = [];
  NORMALS.forEach((normal, face) => {
    const axis = normal.findIndex(value => value !== 0);
    const others = [0, 1, 2].filter(i => i !== axis);
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const grid = [0, 0, 0];
      grid[axis] = normal[axis] > 0 ? edge : 0;
      grid[others[0]] = col; grid[others[1]] = row;
      keys.push(`${grid[0]},${grid[1]},${grid[2]},${FACES[face]}`);
    }
  });
  return keys;
}

export function createCoreMirrorRoom(size, uniforms) {
  const group = new THREE.Group();
  group.name = 'anticube-mirror-room';
  const pitch = CORE_MIRROR_HALF * 2 / size;
  const geometry = createPlayStickerGeometry(.95);
  const mirrorUniforms = {
    uMirrorEnv: { value: null },
    uMirrorLive: { value: 0 },
    uMirrorBoxMin: { value: new THREE.Vector3(-1, -1, -1) },
    uMirrorBoxMax: { value: new THREE.Vector3(1, 1, 1) },
    uMirrorProbe: { value: new THREE.Vector3() },
  };
  const material = withPortalCutout(new THREE.ShaderMaterial({
    name: 'anticube-mirror', uniforms: mirrorUniforms, vertexShader, fragmentShader, toneMapped: false,
  }), uniforms, corePassageGLSL, 'core-mirror', true);
  const tiles = new THREE.InstancedMesh(geometry, material, 6 * size * size);
  tiles.name = 'anticube-mirror-tiles';
  tiles.frustumCulled = false;
  // Lay each wall out in the same (col, row) order coreMirrorTileKeys names them.
  const pose = new THREE.Object3D(), normal = new THREE.Vector3(), point = new THREE.Vector3();
  let index = 0;
  for (const face of NORMALS) {
    normal.fromArray(face);
    const axis = face.findIndex(value => value !== 0);
    const others = [0, 1, 2].filter(i => i !== axis);
    pose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().negate());
    pose.scale.setScalar(pitch);
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      point.set(0, 0, 0);
      point.setComponent(axis, face[axis] * CORE_MIRROR_HALF);
      point.setComponent(others[0], (col + .5) * pitch - CORE_MIRROR_HALF);
      point.setComponent(others[1], (row + .5) * pitch - CORE_MIRROR_HALF);
      pose.position.copy(point);
      pose.updateMatrix(); tiles.setMatrixAt(index++, pose.matrix);
    }
  }
  tiles.instanceMatrix.needsUpdate = true;
  tiles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(tiles.count * 3).fill(0.7), 3);
  const backingGeometry = new THREE.BoxGeometry(CORE_MIRROR_HALF * 2 + .001, CORE_MIRROR_HALF * 2 + .001, CORE_MIRROR_HALF * 2 + .001);
  const backingMaterial = withPortalCutout(new THREE.MeshBasicMaterial({ color: '#10161f', side: THREE.BackSide }),
    uniforms, corePassageGLSL, 'core-mirror-backing');
  const backing = new THREE.Mesh(backingGeometry, backingMaterial);
  group.add(backing, tiles);
  const keys = coreMirrorTileKeys(size);
  return {
    group, tiles, backing, material, uniforms: mirrorUniforms,
    /** Stain each mirror with its core sticker's colour (rgb: linear, 3 per sticker). */
    setTints(stickerIndex, rgb) {
      const out = tiles.instanceColor.array;
      keys.forEach((key, i) => {
        const at = stickerIndex.get(key);
        if (at === undefined) return;
        out[i * 3] = rgb[at * 3]; out[i * 3 + 1] = rgb[at * 3 + 1]; out[i * 3 + 2] = rgb[at * 3 + 2];
      });
      tiles.instanceColor.needsUpdate = true;
    },
    dispose() {
      geometry.dispose(); material.dispose(); backingGeometry.dispose(); backingMaterial.dispose();
    }
  };
}

const _center = new THREE.Vector3();
const _scale = new THREE.Vector3();

/**
 * The room's live reflection: a cube camera at its centre, ping-ponging between
 * two targets so a mirror never samples the target being drawn into.
 */
export function createCoreMirrorProbe(resolution, type = THREE.UnsignedByteType) {
  const targets = [0, 1].map(() => new THREE.WebGLCubeRenderTarget(resolution, { type, generateMipmaps: false }));
  const camera = new THREE.CubeCamera(0.01, 60, targets[0]);
  let next = 0, frame = 0;
  return {
    camera,
    /**
     * Capture the room around `room` (its group) and point the mirrors at the
     * result. `every` > 1 captures on that fraction of frames only.
     */
    capture(renderer, scene, room, every = 1) {
      room.group.getWorldPosition(_center);
      room.group.getWorldScale(_scale);
      const half = CORE_MIRROR_HALF * _scale.x;
      room.uniforms.uMirrorProbe.value.copy(_center);
      room.uniforms.uMirrorBoxMin.value.copy(_center).subScalar(half);
      room.uniforms.uMirrorBoxMax.value.copy(_center).addScalar(half);
      // Only a real renderer can capture (it names its coordinate system).
      if (renderer?.coordinateSystem === undefined) return;
      if (frame++ % every !== 0 && room.uniforms.uMirrorEnv.value) return;
      camera.renderTarget = targets[next];
      // The walls are opaque: nothing past the room's far corner can show in a
      // reflection, so the capture culls the rest of the cube and the sky.
      const far = half * 1.8;
      for (const face of camera.children) {
        if (face.far !== far) { face.far = far; face.updateProjectionMatrix(); }
      }
      camera.position.copy(_center);
      camera.updateMatrixWorld();
      camera.update(renderer, scene);
      room.uniforms.uMirrorEnv.value = targets[next].texture;
      room.uniforms.uMirrorLive.value = 1;
      next = 1 - next;
    },
    dispose() { targets.forEach(target => target.dispose()); }
  };
}
