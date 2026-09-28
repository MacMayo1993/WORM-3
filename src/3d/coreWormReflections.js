import * as THREE from 'three';
import { CORE_MIRROR_HALF, corePassageGLSL } from './corePassage.js';

const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const MAIN = /void\s+main\s*\(\s*(?:void)?\s*\)/;

function reflectionMaterial(source, uniforms) {
  const material = source.clone();
  if (material.isShaderMaterial) material.uniforms = { ...source.uniforms };
  // Reflected glass uses its shell/skin without recursively capturing the room.
  if ('transmission' in material) material.transmission = 0;
  const patch = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 vReflectionPoint;
${shader.vertexShader.replace(MAIN, 'void reflectedVertexMain()')}
void main() {
  reflectedVertexMain();
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  vReflectionPoint = (modelMatrix * p).xyz;
}`;
    shader.fragmentShader = `uniform vec4 uMirrorPlane;
uniform vec3 uMirrorCenter;
uniform float uMirrorHalf;
varying vec3 vReflectionPoint;
${shader.fragmentShader.replace(MAIN, 'void reflectedSurfaceMain()')}
void main() {
  vec3 n = uMirrorPlane.xyz;
  vec3 original = vReflectionPoint - 2.0 * n * (dot(n, vReflectionPoint) - uMirrorPlane.w);
  vec3 p = abs(original - uMirrorCenter);
  if (max(p.x, max(p.y, p.z)) > uMirrorHalf) discard;
  reflectedSurfaceMain();
}`;
  };
  if (material.isShaderMaterial) patch(material);
  else {
    const original = source.onBeforeCompile, key = source.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      const before = new Set(Object.keys(shader.uniforms)), originalShader = source.userData.shader;
      // Skin factories retain their compiled shader for animation. A mirror
      // must never replace the live body's handle with a reflection shader.
      try { original.call(source, shader, renderer); }
      finally { if (originalShader) source.userData.shader = originalShader; else delete source.userData.shader; }
      material.userData.reflectionUniformKeys = Object.keys(shader.uniforms).filter(key => !before.has(key));
      material.userData.reflectionShader = shader;
      for (const key of material.userData.reflectionUniformKeys) if (originalShader?.uniforms[key]) shader.uniforms[key] = originalShader.uniforms[key];
      patch(shader);
    };
    material.customProgramCacheKey = () => `${key}-core-worm-reflection`;
  }
  return material;
}

// Only the current worm is captured, with shared geometry/instance/color
// buffers. The room, cube, effects and other mirrors never enter these passes.
// Their own depth buffers keep eyes, overlapping beads and glass shells crisp.
export function createCoreWormReflections() {
  const group = new THREE.Group();
  group.name = 'anticube-worm-reflections'; group.visible = false;
  const center = new THREE.Vector3(), scale = new THREE.Vector3(), cameraPosition = new THREE.Vector3();
  const vp = new THREE.Matrix4(), frustum = new THREE.Frustum(), clearColor = new THREE.Color();
  const halfUniform = { value: 0 }, pitchUniform = { value: 0 };
  const z = new THREE.Vector3(0, 0, 1), viewport = new THREE.Vector4(), scissor = new THREE.Vector4();
  const geometry = new THREE.PlaneGeometry(1, 1);
  const faces = NORMALS.map(values => {
    const normal = new THREE.Vector3(...values), scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight('#ffffff', 2); sun.position.set(2, 3, 4);
    scene.add(new THREE.AmbientLight('#dce9ff', 1.5), sun);
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    target.texture.generateMipmaps = false;
    const uniforms = { uMirrorPlane: { value: new THREE.Vector4(...values, 0) },
      uMirrorCenter: { value: center }, uMirrorHalf: halfUniform, uMirrorPitch: pitchUniform,
      uReflection: { value: target.texture } };
    const material = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false,
      premultipliedAlpha: true, toneMapped: false,
      vertexShader: `varying vec4 vScreen; varying vec3 vWall;
void main() { vWall = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWall, 1.0); vScreen = gl_Position; }`,
      fragmentShader: `uniform sampler2D uReflection;
uniform vec4 uMirrorPlane; uniform vec3 uMirrorCenter; uniform float uMirrorHalf, uMirrorPitch;
varying vec4 vScreen; varying vec3 vWall;
${corePassageGLSL}
void main() {
  vec4 reflection = texture2D(uReflection, vScreen.xy / vScreen.w * 0.5 + 0.5);
  if (reflection.a < 0.005) discard;
  vec3 wall = vWall - uMirrorCenter;
  vec2 face = abs(uMirrorPlane.x) > 0.5 ? wall.yz : abs(uMirrorPlane.y) > 0.5 ? wall.xz : wall.xy;
  vec2 tile = abs(fract((face + uMirrorHalf) / uMirrorPitch) - 0.5);
  if (length(max(tile - vec2(0.345), 0.0)) > 0.13) discard;
  if (portalDistance(vWall) < 0.0) discard;
  gl_FragColor = vec4(reflection.rgb / max(reflection.a, 0.001), reflection.a * 0.94);
  #include <colorspace_fragment>
  gl_FragColor.rgb *= gl_FragColor.a;
}` });
    const surface = new THREE.Mesh(geometry, material);
    surface.quaternion.setFromUnitVectors(z, normal.clone().negate());
    surface.renderOrder = -1; group.add(surface);
    return { normal, surface, scene, target, uniforms, matrix: new THREE.Matrix4(), bounds: new THREE.Box3(), meshes: new Map() };
  });
  function disposeMesh(entry) { entry.materials.forEach(material => material.dispose()); }
  return {
    group, faces,
    sync(source, room, camera, gl) {
      group.visible = false;
      if (!source || !room?.visible) return;
      room.updateWorldMatrix(true, false);
      room.getWorldPosition(center); room.getWorldScale(scale);
      const half = CORE_MIRROR_HALF * scale.x;
      camera.getWorldPosition(cameraPosition);
      if (Math.max(Math.abs(cameraPosition.x - center.x), Math.abs(cameraPosition.y - center.y), Math.abs(cameraPosition.z - center.z)) >= half) return;
      const tiles = room.getObjectByName('anticube-mirror-tiles');
      halfUniform.value = half; pitchUniform.value = 2 * half / Math.sqrt(tiles.count / 6);
      camera.updateMatrixWorld(); vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(vp);
      source.updateWorldMatrix(true, true); group.visible = true;
      const height = 512, width = Math.max(128, Math.round(height * Math.min(1, camera.aspect)));
      for (const face of faces) {
        const n = face.normal, d = n.dot(center) + half;
        face.uniforms.uMirrorPlane.value.w = d;
        Object.assign(face.uniforms, tiles.material.userData.portalCutout);
        face.surface.position.copy(center).addScaledVector(n, half - half * .0002);
        face.surface.scale.setScalar(half * 2);
        face.bounds.min.copy(center).addScalar(-half); face.bounds.max.copy(center).addScalar(half);
        const axis = n.x ? 'x' : n.y ? 'y' : 'z';
        face.bounds.min[axis] = center[axis] + n[axis] * half - .001; face.bounds.max[axis] = face.bounds.min[axis] + .002;
        face.surface.visible = frustum.intersectsBox(face.bounds);
        if (!face.surface.visible) continue;
        face.target.setSize(width, height);
        face.matrix.set(
          1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.z, 2 * d * n.x,
          -2 * n.y * n.x, 1 - 2 * n.y * n.y, -2 * n.y * n.z, 2 * d * n.y,
          -2 * n.z * n.x, -2 * n.z * n.y, 1 - 2 * n.z * n.z, 2 * d * n.z,
          0, 0, 0, 1
        );
        for (const entry of face.meshes.values()) entry.seen = false;
        source.traverseVisible(mesh => {
          if (!mesh.isMesh || !mesh.material || mesh.isSkinnedMesh || (mesh.isInstancedMesh && mesh.count === 0)) return;
          let entry = face.meshes.get(mesh);
          if (entry && entry.sourceMaterial !== mesh.material) {
            face.scene.remove(entry.mesh); disposeMesh(entry); face.meshes.delete(mesh); entry = null;
          }
          if (!entry) {
            const reflected = mesh.isInstancedMesh ? new THREE.InstancedMesh(mesh.geometry, null, 0) : new THREE.Mesh(mesh.geometry, null);
            reflected.renderOrder = mesh.renderOrder;
            const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const materials = originals.map(material => reflectionMaterial(material, face.uniforms));
            reflected.material = Array.isArray(mesh.material) ? materials : materials[0];
            reflected.matrixAutoUpdate = false; reflected.frustumCulled = !mesh.isInstancedMesh;
            reflected.castShadow = false; reflected.receiveShadow = false;
            entry = { mesh: reflected, sourceMaterial: mesh.material, materials, originals, seen: true };
            face.meshes.set(mesh, entry); face.scene.add(reflected);
          }
          entry.seen = true; entry.mesh.geometry = mesh.geometry;
          entry.mesh.matrix.multiplyMatrices(face.matrix, mesh.matrixWorld); entry.mesh.matrixWorldNeedsUpdate = true;
          if (mesh.isInstancedMesh) { entry.mesh.instanceMatrix = mesh.instanceMatrix; entry.mesh.instanceColor = mesh.instanceColor; entry.mesh.count = Math.min(mesh.count, 192); }
          entry.materials.forEach((material, i) => {
            const original = entry.originals[i];
            if (material.color) material.color.copy(original.color);
            if (material.emissive) material.emissive.copy(original.emissive);
            material.opacity = original.opacity; material.emissiveIntensity = original.emissiveIntensity;
            for (const key of material.userData.reflectionUniformKeys ?? []) {
              if (original.userData.shader?.uniforms[key]) material.userData.reflectionShader.uniforms[key] = original.userData.shader.uniforms[key];
            }
          });
        });
        for (const [mesh, entry] of face.meshes) if (!entry.seen) { face.scene.remove(entry.mesh); disposeMesh(entry); face.meshes.delete(mesh); }
      }
      if (!gl) return;
      const previousTarget = gl.getRenderTarget(), previousAlpha = gl.getClearAlpha(), autoClear = gl.autoClear;
      const xr = gl.xr.enabled, shadows = gl.shadowMap.autoUpdate, scissorTest = gl.getScissorTest();
      gl.getClearColor(clearColor); gl.getViewport(viewport); gl.getScissor(scissor);
      try {
        gl.xr.enabled = false; gl.shadowMap.autoUpdate = false; gl.autoClear = true; gl.setScissorTest(false); gl.setClearColor(0, 0);
        for (const face of faces) if (face.surface.visible) { gl.setRenderTarget(face.target); gl.render(face.scene, camera); }
      } finally {
        gl.setRenderTarget(previousTarget); gl.setViewport(viewport); gl.setScissor(scissor); gl.setScissorTest(scissorTest);
        gl.setClearColor(clearColor, previousAlpha); gl.autoClear = autoClear; gl.xr.enabled = xr; gl.shadowMap.autoUpdate = shadows;
      }
    },
    dispose() {
      for (const face of faces) { face.meshes.forEach(disposeMesh); face.meshes.clear(); face.target.dispose(); face.surface.material.dispose(); face.scene.clear(); }
      geometry.dispose(); group.clear();
    }
  };
}
