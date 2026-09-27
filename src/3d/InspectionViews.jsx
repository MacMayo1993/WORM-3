import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, selectEffectiveFlipCap } from '../hooks/useGameStore.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { isMobile } from '../utils/device.js';
import { inspectionBudget, inspectionSurfaces, inspectionSuspended, lensRect } from './inspectionBridge.js';
import { PORTAL_OFFSET, PORTAL_RADIUS, framePortalCamera, livePortalPairs } from './portalViewMath.js';
import { createInspectionTarget, renderInspectionPass } from './inspectionPass.js';

const portalVertex = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const portalFragment = `uniform sampler2D tView; uniform vec3 rim; varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  if (r > 1.0) discard;
  vec3 image = texture2D(tView, vUv).rgb;
  float lip = smoothstep(0.90, 0.95, r);
  vec3 edge = mix(rim * 0.25, rim, smoothstep(0.96, 0.975, r));
  gl_FragColor = vec4(mix(image, edge, lip), 1.0 - smoothstep(0.988, 1.0, r));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const lensFragment = `uniform sampler2D tView; uniform vec4 lens; varying vec2 vUv;
void main() {
  vec2 p = (vUv - lens.xy) / lens.zw;
  float r = length(p);
  if (r > 1.0) discard;
  vec3 color = texture2D(tView, p * 0.5 + 0.5).rgb;
  // A machined ivory lip and dark inner edge separate the cutaway from the
  // intact surface. Nothing outside this circle is touched.
  color *= mix(1.0, 0.55, smoothstep(0.84, 0.95, r));
  vec3 bevel = mix(vec3(0.045, 0.12, 0.10), vec3(0.88, 0.82, 0.62), smoothstep(0.954, 0.974, r));
  color = mix(color, bevel, smoothstep(0.93, 0.95, r));
  gl_FragColor = vec4(color, 1.0 - smoothstep(0.988, 1.0, r));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function belongsTo(object, root) {
  for (let parent = object; parent; parent = parent.parent) if (parent === root) return true;
  return false;
}

/** Auxiliary captures only: R3F, AO and PiP retain ownership of the main frame. */
export default function InspectionViews({ cubeRef, exteriorRef, manifoldMap }) {
  const { gl, scene, camera, size: viewport } = useThree();
  const frame = useRef(0), context = useRef();
  context.current = { viewport, manifoldMap };
  useFrame(() => { frame.current++; });

  useLayoutEffect(() => {
    const root = new THREE.Group();
    root.name = 'LivePortalViews';
    const quad = new THREE.PlaneGeometry(PORTAL_RADIUS * 2, PORTAL_RADIUS * 2);
    const slots = Array.from({ length: 2 }, () => {
      const target = createInspectionTarget(256);
      const material = new THREE.ShaderMaterial({
        uniforms: { tView: { value: target.texture }, rim: { value: new THREE.Color('#f5df96') } },
        vertexShader: portalVertex, fragmentShader: portalFragment,
        transparent: true, depthWrite: true,
      });
      const mesh = new THREE.Mesh(quad, material);
      mesh.matrixAutoUpdate = false; mesh.visible = false; mesh.renderOrder = 6;
      mesh.raycast = () => {};
      root.add(mesh);
      return { target, material, mesh, camera: new THREE.PerspectiveCamera(), id: null };
    });
    const lensTarget = createInspectionTarget(512);
    const lensMaterial = new THREE.ShaderMaterial({
      uniforms: { tView: { value: lensTarget.texture }, lens: { value: new THREE.Vector4() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: lensFragment, transparent: true, depthTest: false, depthWrite: false,
    });
    const lensGeometry = new THREE.PlaneGeometry(2, 2);
    const lensMesh = new THREE.Mesh(lensGeometry, lensMaterial);
    lensMesh.frustumCulled = false; lensMesh.renderOrder = 10000; lensMesh.visible = false;
    lensMesh.raycast = () => {};
    root.add(lensMesh);
    const lensCamera = new THREE.PerspectiveCamera();

    // A faint shell outline preserves spatial context inside the cutaway.
    const box = new THREE.BoxGeometry(1, 1, 1), edges = new THREE.EdgesGeometry(box);
    box.dispose();
    const guideMaterial = new THREE.LineBasicMaterial({ color: '#86b9ac', transparent: true, opacity: 0.3 });
    const guide = new THREE.LineSegments(edges, guideMaterial);
    guide.matrixAutoUpdate = false; guide.visible = false; guide.raycast = () => {};
    scene.add(root, guide);

    const position = new THREE.Vector3(), normal = new THREE.Vector3(), toEye = new THREE.Vector3(), projected = new THREE.Vector3();
    const offset = new THREE.Matrix4().makeTranslation(0, 0, PORTAL_OFFSET), scale = new THREE.Matrix4();
    let lastFrame = -1, lastCapture = -Infinity, busy = false, failed = false, previousMode = '';
    let cachedCubies, cachedMap, cachedCap, pairs = [];
    const original = scene.onBeforeRender;
    const onBeforeRender = function(renderer, renderedScene, renderCamera, target) {
      original.call(this, renderer, renderedScene, renderCamera, target);
      if (busy || renderCamera !== camera || scene.overrideMaterial || lastFrame === frame.current) return;
      lastFrame = frame.current;
      const state = useGameStore.getState();
      root.visible = !failed && !inspectionSuspended(state);
      if (!root.visible) return;
      const lensOn = state.showCutawayLens;
      const portalsOn = state.settings?.livePortalViews !== false && !lensOn;
      const mode = lensOn ? 'lens' : portalsOn ? 'portals' : 'off';
      if (mode !== previousMode) { lastCapture = -Infinity; previousMode = mode; }
      lensMesh.visible = false;
      if (!portalsOn) slots.forEach(slot => { slot.mesh.visible = false; });
      if (!portalsOn && !lensOn) return;
      if (!cubeRef.current || !exteriorRef.current || gl.getContext().isContextLost()) return;
      const budget = inspectionBudget({ mobile: isMobile, reduced: state.perfReducedFX, size: state.size });
      const now = performance.now() / 1000;
      const due = now - lastCapture >= 1 / budget.fps;
      busy = true;
      try {
        if (lensOn) {
          const { width, height } = context.current.viewport;
          const rect = lensRect(width, height);
          lensMaterial.uniforms.lens.value.set(rect.x / width, 1 - rect.y / height, rect.radius / width, rect.radius / height);
          if (due) {
            lensTarget.setSize(budget.lensSize, budget.lensSize);
            lensCamera.copy(camera);
            camera.matrixWorld.decompose(lensCamera.position, lensCamera.quaternion, lensCamera.scale);
            lensCamera.setViewOffset(width, height, rect.x - rect.radius, rect.y - rect.radius, rect.radius * 2, rect.radius * 2);
            lensCamera.updateMatrixWorld(true);
            guide.matrix.copy(cubeRef.current.matrixWorld).multiply(scale.makeScale(state.size, state.size, state.size));
            guide.matrixWorldNeedsUpdate = true;
            const stickers = scene.getObjectByName('StickerInstanceMesh');
            renderInspectionPass(gl, scene, lensCamera, lensTarget, [root, exteriorRef.current, stickers], [guide]);
            lastCapture = now;
          }
          lensMesh.visible = true;
          return;
        }

        const cap = selectEffectiveFlipCap(state), map = context.current.manifoldMap;
        if (cachedCubies !== state.cubies || cachedMap !== map || cachedCap !== cap) {
          pairs = livePortalPairs(state.cubies, state.size, map, cap);
          cachedCubies = state.cubies; cachedMap = map; cachedCap = cap;
        }
        const surfaces = new Map();
        for (const [object, id] of inspectionSurfaces) if (belongsTo(object, cubeRef.current)) surfaces.set(id, object);
        const candidates = [];
        for (const pair of pairs) {
          for (const [id, other, color] of [[pair.a, pair.b, pair.colorB], [pair.b, pair.a, pair.colorA]]) {
            const source = surfaces.get(id), destination = surfaces.get(other);
            if (!source || !destination) continue;
            position.setFromMatrixPosition(source.matrixWorld);
            normal.setFromMatrixColumn(source.matrixWorld, 2).normalize();
            toEye.setFromMatrixPosition(camera.matrixWorld).sub(position);
            const facing = normal.dot(toEye);
            projected.copy(position).project(camera);
            if (facing <= 0.06 || projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1.15 || Math.abs(projected.y) > 1.15) continue;
            candidates.push({ id, source, destination, color, score: facing / Math.max(0.01, toEye.lengthSq() ** 1.5) });
          }
        }
        candidates.sort((a, b) => b.score - a.score);
        const colors = resolveColors(state.settings, state.settings?.biomeMode?.faceAssignment);
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i], candidate = i < budget.portals ? candidates[i] : null;
          slot.mesh.visible = false;
          if (!candidate) { slot.id = null; continue; }
          slot.mesh.matrix.copy(candidate.source.matrixWorld).multiply(offset);
          slot.mesh.matrixWorldNeedsUpdate = true;
          if (due || slot.id !== candidate.id) {
            if (!framePortalCamera(slot.camera, camera, candidate.source.matrixWorld, candidate.destination.matrixWorld)) continue;
            slot.target.setSize(budget.portalSize, budget.portalSize);
            renderInspectionPass(gl, scene, slot.camera, slot.target, [root]);
            slot.id = candidate.id;
            slot.material.uniforms.rim.value.set(colors[candidate.color] ?? '#f5df96');
          }
          slot.mesh.visible = true;
        }
        if (due) lastCapture = now;
      } catch (error) {
        // A driver failure must leave the ordinary portal treatment and the
        // main renderer usable. Each capture restores borrowed state in finally.
        failed = true; root.visible = false;
        console.warn('Portal inspection unavailable', error);
      } finally {
        busy = false;
      }
    };
    scene.onBeforeRender = onBeforeRender;
    const restored = () => { failed = false; lastCapture = -Infinity; slots.forEach(slot => { slot.id = null; }); };
    gl.domElement.addEventListener('webglcontextrestored', restored);
    return () => {
      if (scene.onBeforeRender === onBeforeRender) scene.onBeforeRender = original;
      gl.domElement.removeEventListener('webglcontextrestored', restored);
      scene.remove(root, guide);
      for (const slot of slots) { slot.target.dispose(); slot.material.dispose(); }
      quad.dispose(); lensTarget.dispose(); lensMaterial.dispose(); lensGeometry.dispose(); edges.dispose(); guideMaterial.dispose();
    };
  }, [gl, scene, camera, cubeRef, exteriorRef]);
  return null;
}
