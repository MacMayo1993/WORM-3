import * as THREE from 'three';
import { CORE_MIRROR_HALF, corePassageGLSL } from './corePassage.js';
import { withPortalCutout } from './portalCutout.js';
import { createPlayStickerGeometry } from './rubiksPiece.js';
import { makeCoreChamberLight, coreChamberLightGLSL } from './coreChamberLight.js';
import { MIRROR_LAYER, createMirrorCaptureScene } from './mirrorSubjects.js';
import { coreWallCrossingsInto } from './corePortalRims.js';
import { mirrorPanelIntervals } from './coreMirrorPanels.js';

// The hollow inside the antipodal core that a WORM ride passes through is a room
// of real mirrors. Each wall starts as the core face's own size × size grid.
// During a ride its panels fit around the actual openings; each panel takes
// the nearest core sticker's live colour. What they reflect is captured live:
// a cube camera at the room's centre renders the room (worm, pearl rims, light ribbons
// and the other walls) on a bounded capture clock, and every mirror samples it
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
varying vec3 vMirrorLocal;
void main() {
  vec4 local = vec4(position, 1.0);
  mat3 toWorld = mat3(modelMatrix);
#ifdef USE_INSTANCING
  local = instanceMatrix * local;
  toWorld = toWorld * mat3(instanceMatrix);
#endif
  vMirrorLocal = local.xyz;
  vec4 world = modelMatrix * local;
  vMirrorWorld = world.xyz;
  // Adaptive panels stretch each tile nonuniformly. Correct each orthogonal
  // TRS column before transforming bevel normals (the core has uniform scale).
  // This is the instancing normal correction used by Three, without inverse()
  // so it also works in WebGL1.
  vec3 normalScale = vec3(dot(toWorld[0], toWorld[0]), dot(toWorld[1], toWorld[1]), dot(toWorld[2], toWorld[2]));
  vMirrorNormal = normalize(toWorld * (normal / normalScale));
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

${coreChamberLightGLSL}

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
  vec3 stain = mix(vec3(0.86), vMirrorTint, 0.22);
  vec3 color = reflection * stain * 0.88;
  vec3 light = vMirrorTint * (uMirrorLive > 0.5 ? 0.045 : 0.18) + fresnel * 0.10;
  // A polished bevel round each mirror catches the light.
  float edge = min(min(vMirrorUv.x, 1.0 - vMirrorUv.x), min(vMirrorUv.y, 1.0 - vMirrorUv.y));
  light += (1.0 - smoothstep(0.0, 0.07, edge)) * 0.065;
  light += chamberLight(vMirrorLocal / ${CORE_MIRROR_HALF.toFixed(8)});
  // The LDR capture is fed back into the other mirrors. Unbounded addition
  // clips the bevel and ribbons to white before the next reflection can tint
  // them. Roll local light into the remaining channel range in BOTH passes:
  // weak light stays near-linear, while bright ribbons retain their colour.
  color += (vec3(1.0) - color) * (vec3(1.0) - exp(-light));
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
  const lighting = makeCoreChamberLight();
  const mirrorUniforms = {
    ...lighting.uniforms,
    uMirrorEnv: { value: null },
    uMirrorLive: { value: 0 },
    uMirrorBoxMin: { value: new THREE.Vector3(-1, -1, -1) },
    uMirrorBoxMax: { value: new THREE.Vector3(1, 1, 1) },
    uMirrorProbe: { value: new THREE.Vector3() },
  };
  const material = withPortalCutout(new THREE.ShaderMaterial({
    name: 'anticube-mirror', uniforms: mirrorUniforms, vertexShader, fragmentShader, toneMapped: false,
    extensions: { derivatives: true },
  }), uniforms, corePassageGLSL, 'core-mirror');
  const tiles = new THREE.InstancedMesh(geometry, material, 6 * (size + 6) * (size + 6));
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
  tiles.count = index;
  tiles.instanceMatrix.needsUpdate = true;
  // The mirrors reflect each other; the backing behind them never shows.
  tiles.layers.enable(MIRROR_LAYER);
  tiles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(tiles.instanceMatrix.count * 3).fill(0.7), 3);
  const backingGeometry = new THREE.BoxGeometry(CORE_MIRROR_HALF * 2 + .001, CORE_MIRROR_HALF * 2 + .001, CORE_MIRROR_HALF * 2 + .001);
  const backingMaterial = withPortalCutout(new THREE.MeshBasicMaterial({ color: '#10161f', side: THREE.BackSide }),
    uniforms, corePassageGLSL, 'core-mirror-backing');
  const backing = new THREE.Mesh(backingGeometry, backingMaterial);
  group.add(backing, tiles);
  let keys = coreMirrorTileKeys(size), layoutSignature = '', tintIndex = null, tintRgb = null;
  const crossings = [], localCenter = new THREE.Vector3();
  const passageEnds = { entry: new THREE.Vector3(), exit: new THREE.Vector3(), active: false };
  const applyTints = () => {
    if (!tintIndex || !tintRgb) return;
    const out = tiles.instanceColor.array;
    keys.forEach((key, i) => {
      const at = tintIndex.get(key);
      if (at === undefined) return;
      out[i * 3] = tintRgb[at * 3]; out[i * 3 + 1] = tintRgb[at * 3 + 1]; out[i * 3 + 2] = tintRgb[at * 3 + 2];
    });
    tiles.instanceColor.clearUpdateRanges(); tiles.instanceColor.addUpdateRange(0, tiles.count * 3);
    tiles.instanceColor.needsUpdate = true;
  };
  return {
    group, tiles, backing, material, lighting, uniforms: mirrorUniforms, passageEnds,
    updateLayout(passage, zoom) {
      const active = uniforms.uPassageOpen.value > .5;
      const signature = active ? `${passage.signature}:${zoom}` : 'closed';
      if (signature === layoutSignature) return;
      layoutSignature = signature;
      const center = uniforms.uCoreRoomCenter.value;
      const count = active ? coreWallCrossingsInto(crossings, uniforms.uPassagePoints.value, center, CORE_MIRROR_HALF * zoom) : 0;
      passageEnds.active = count >= 2;
      if (count) {
        let first = crossings[0], last = crossings[0];
        for (let i = 1; i < count; i++) {
          if (crossings[i].routeOrder < first.routeOrder) first = crossings[i];
          if (crossings[i].routeOrder > last.routeOrder) last = crossings[i];
        }
        passageEnds.entry.copy(first.center).sub(center).divideScalar(zoom);
        passageEnds.exit.copy(last.center).sub(center).divideScalar(zoom);
      }
      keys = []; let index = 0;
      for (let face = 0; face < NORMALS.length; face++) {
        const faceNormal = NORMALS[face];
        const axis = faceNormal.findIndex(value => value !== 0), sign = faceNormal[axis];
        const others = [0, 1, 2].filter(i => i !== axis);
        const centers = [[], []];
        for (let i = 0; i < count; i++) {
          const crossing = crossings[i];
          if (crossing.axis !== axis || crossing.sign !== sign) continue;
          localCenter.copy(crossing.center).sub(center).divideScalar(zoom);
          centers[0].push(localCenter.getComponent(others[0])); centers[1].push(localCenter.getComponent(others[1]));
        }
        const radius = uniforms.uPassageRadius.value / zoom;
        const columns = mirrorPanelIntervals(CORE_MIRROR_HALF, size, centers[0], radius);
        const rows = mirrorPanelIntervals(CORE_MIRROR_HALF, size, centers[1], radius);
        normal.fromArray(faceNormal).negate();
        pose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        // A face's local geometry axes may be swapped by its orientation.
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(pose.quaternion);
        const rightAxis = Math.abs(right.getComponent(others[0])) > .5 ? 0 : 1;
        for (const row of rows) for (const column of columns) {
          point.set(0, 0, 0).setComponent(axis, sign * CORE_MIRROR_HALF)
            .setComponent(others[0], column.center).setComponent(others[1], row.center);
          pose.position.copy(point);
          pose.scale.set(rightAxis === 0 ? column.width : row.width, rightAxis === 0 ? row.width : column.width, pitch);
          pose.updateMatrix(); tiles.setMatrixAt(index++, pose.matrix);
          const grid = [0, 0, 0]; grid[axis] = sign > 0 ? size - 1 : 0;
          grid[others[0]] = column.index; grid[others[1]] = row.index;
          keys.push(`${grid[0]},${grid[1]},${grid[2]},${FACES[face]}`);
        }
      }
      if (index > tiles.instanceMatrix.count) throw new RangeError('Mirror panel layout exceeds pooled capacity');
      tiles.count = index;
      tiles.instanceMatrix.clearUpdateRanges(); tiles.instanceMatrix.addUpdateRange(0, index * 16);
      tiles.instanceMatrix.needsUpdate = true;
      applyTints();
    },
    /** Stain each panel with its nearest core sticker's colour (linear rgb). */
    setTints(stickerIndex, rgb) { tintIndex = stickerIndex; tintRgb = rgb; applyTints(); },
    dispose() {
      tiles.dispose(); geometry.dispose(); material.dispose(); backingGeometry.dispose(); backingMaterial.dispose();
    }
  };
}

const _center = new THREE.Vector3();
const _scale = new THREE.Vector3();

/**
 * The room's live reflection: a cube camera at its centre, ping-ponging between
 * two targets so a mirror never samples the target being drawn into. It sees
 * only MIRROR_LAYER (mirrorSubjects.js): the mirrors, the worm and the band
 * being ridden.
 */
export function createCoreMirrorProbe(resolution, type = THREE.UnsignedByteType) {
  const targets = [0, 1].map(() => new THREE.WebGLCubeRenderTarget(resolution, { type, generateMipmaps: false }));
  const camera = new THREE.CubeCamera(0.01, 60, targets[0]);
  const captureScene = createMirrorCaptureScene();
  for (const face of camera.children) face.layers.set(MIRROR_LAYER);
  let next = 0, elapsed = 0, face = 6;
  return {
    camera,
    /**
     * Capture the room around `room` (its group) and point the mirrors at the
     * result. A capture starts at most once per `interval` seconds, and draws at
     * most `faces` of its six views per call, so its cost is spread over frames
     * instead of landing on one; the mirrors switch to it once all six are drawn.
     */
    capture(renderer, scene, room, { delta = Infinity, interval = 0, faces = 6 } = {}) {
      room.group.getWorldPosition(_center);
      room.group.getWorldScale(_scale);
      const half = CORE_MIRROR_HALF * _scale.x;
      room.uniforms.uMirrorProbe.value.copy(_center);
      room.uniforms.uMirrorBoxMin.value.copy(_center).subScalar(half);
      room.uniforms.uMirrorBoxMax.value.copy(_center).addScalar(half);
      // Only a real renderer can capture (it names its coordinate system).
      if (renderer?.coordinateSystem === undefined) return;
      elapsed += Math.max(0, delta);
      if (face >= 6) {
        if (elapsed + 1e-6 < interval && room.uniforms.uMirrorEnv.value) return;
        elapsed = Number.isFinite(elapsed) && interval > 0 ? elapsed % interval : 0;
        face = 0;
      }
      if (camera.coordinateSystem !== renderer.coordinateSystem) {
        camera.coordinateSystem = renderer.coordinateSystem;
        camera.updateCoordinateSystem();
      }
      // The walls are opaque: nothing past the room's far corner can show in a
      // reflection, so the capture culls the rest of the cube and the sky.
      const far = half * 1.8;
      for (const view of camera.children) {
        if (view.far !== far) { view.far = far; view.updateProjectionMatrix(); }
      }
      camera.position.copy(_center);
      camera.updateMatrixWorld();
      // Only reflected subtrees need fresh transforms or per-face projection.
      // The exterior cube never enters this render list, even on large boards.
      const reflected = captureScene.sync(scene, room.group);
      // Keep the main view's shadow maps and render state, even on failure.
      const shadows = renderer.shadowMap;
      const autoShadow = shadows?.autoUpdate, shadowDirty = shadows?.needsUpdate;
      const target = renderer.getRenderTarget();
      const activeFace = renderer.getActiveCubeFace?.() ?? 0;
      const mip = renderer.getActiveMipmapLevel?.() ?? 0;
      const xr = renderer.xr.enabled;
      const chamberCapture = room.uniforms.uChamberCapture.value;
      const end = Math.min(6, face + Math.max(1, faces));
      try {
        if (shadows) { shadows.autoUpdate = false; shadows.needsUpdate = false; }
        renderer.xr.enabled = false;
        room.uniforms.uChamberCapture.value = 1;
        for (; face < end; face++) {
          renderer.setRenderTarget(targets[next], face, 0);
          renderer.render(reflected, camera.children[face]);
        }
      } finally {
        if (shadows) { shadows.autoUpdate = autoShadow; shadows.needsUpdate = shadowDirty; }
        renderer.setRenderTarget(target, activeFace, mip);
        renderer.xr.enabled = xr;
        room.uniforms.uChamberCapture.value = chamberCapture;
      }
      if (face < 6) return;
      room.uniforms.uMirrorEnv.value = targets[next].texture;
      room.uniforms.uMirrorLive.value = 1;
      next = 1 - next;
    },
    dispose() { captureScene.dispose(); targets.forEach(target => target.dispose()); }
  };
}
