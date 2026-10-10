import { Line2, LineSegments2, LineGeometry, LineSegmentsGeometry, LineMaterial } from 'three-stdlib';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createFlipBurstWarmupMeshes } from '../../3d/flipBurstShaders.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { createStickerPortalWarmupMaterials } from '../../3d/stickerPortalShaders.js';
import { createMobiusWarmupMaterials } from '../../manifold/mobiusTunnelShaders.js';
import { pickupWarmupMeshes } from './pickupMaterials.js';
import { usePickupPool } from './usePickupMaterials.js';
import { exteriorPortalWarmupMaterial } from '../../3d/exteriorPortals.js';
import { createTileBoundaryWarmupMeshes } from '../../3d/tileBoundaryMaterials.js';
import { stickerWormBodyMaterial, stickerWormGlowMaterial } from '../../3d/stickerWormMaterials.js';
import { healthBarMaterial } from '../../3d/disparityHealthBarMaterial.js';
import { rubiksFinish } from '../../3d/rubiksPiece.js';
import { bodyMaterialProps } from '../../3d/cubeViewStyles.js';
import { rimFragmentShader, rimVertexShader } from '../../teach/LayerHighlight.jsx';
import { elementalWarmupObjects } from './elementalWarmup.js';
import { ELEMENTAL_TYPES } from './elementalDefs.js';
import { elementalOrbMaterials } from './elementalOrbMaterials.js';
import { warmOrbReveal } from '../orbReveal.js';
import { warmCautionDissolve } from './cautionDissolve.js';
import { isMobile, prefersReducedMotion } from '../../utils/device.js';

// Keep one owner of each transient program for this WORM session. Real portal
// materials still have private uniforms and their normal disposal; only the
// compiled programs are shared, so one tunnel cannot recolour another.
export default function WormEffectWarmup({ body }) {
  const { gl, camera, scene } = useThree();
  const pool = usePickupPool(), resources = useRef(null), warmed = useRef(null), sceneWarmed = useRef(null);
  const fall = useRef({ key: null, dispose: null });
  useEffect(() => () => fall.current.dispose?.(), []);
  useEffect(() => {
    const materials = [...createStickerPortalWarmupMaterials(), ...createMobiusWarmupMaterials()];
    const geometry = new THREE.PlaneGeometry(.1, .1), warm = new THREE.Scene();
    // Tally strokes and the raised cubie's coloured edge outline use drei Line.
    const lines = [false, true].map(vertexColors => {
      const lineGeometry = vertexColors ? new LineSegmentsGeometry() : new LineGeometry();
      lineGeometry.setPositions([0, 0, 0, .1, 0, 0]);
      if (vertexColors) lineGeometry.setColors([1, 1, 1, 1, 1, 1]);
      const material = new LineMaterial({ transparent: true, vertexColors });
      return vertexColors ? new LineSegments2(lineGeometry, material) : new Line2(lineGeometry, material);
    });
    const flips = [...createFlipBurstWarmupMeshes(geometry), ...lines];
    const shaderMeshes = materials.map(material => new THREE.Mesh(geometry, material));
    materials.push(...flips.map(mesh => mesh.material));
    // Everything under the cube's exterior is drawn with the portal bore patched in
    // (exteriorPortals.js), which is a different program. The tile effects, flip
    // bursts and edge lines mount there on the first flip, together with the raised
    // tile's border, sticker and see-through body; warm those variants too, or the
    // first tunnel of every run links them all in one frame.
    const rgba = geometry.clone().setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(16).fill(1), 4));
    const ownedRaised = [
      new THREE.Mesh(geometry, isMobile ? new THREE.MeshStandardMaterial({ ...rubiksFinish(true).sticker, envMapIntensity: 0.3 })
        : new THREE.MeshPhysicalMaterial({ ...rubiksFinish(false).sticker, envMapIntensity: 0.3 })),
      new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ ...bodyMaterialProps('neon'), transparent: true, opacity: 0.16,
        depthWrite: false, side: THREE.DoubleSide })),
    ];
    // Module-level materials, never disposed here: borders, a flipped tile's ghost
    // worms and its flip-life bar.
    const sharedRaised = [...createTileBoundaryWarmupMeshes(), new THREE.Mesh(geometry, stickerWormBodyMaterial),
      new THREE.Mesh(rgba, stickerWormGlowMaterial), new THREE.Mesh(geometry, healthBarMaterial)];
    const raised = [...ownedRaised, ...sharedRaised];
    const bored = [...shaderMeshes, ...flips, ...raised].map(source => {
      const mesh = source.clone();
      mesh.material = exteriorPortalWarmupMaterial(source.material);
      return mesh;
    });
    materials.push(...ownedRaised.map(mesh => mesh.material), ...bored.map(mesh => mesh.material));
    // The slice-warning rim mounts with each warning and unmounts after the turn;
    // holding its programs here keeps every warning after the first from relinking.
    const rims = [false, true].map(lite => new THREE.ShaderMaterial({ vertexShader: rimVertexShader, fragmentShader: rimFragmentShader(lite),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    materials.push(...rims);
    const meshes = [...pickupWarmupMeshes(pool.warm, geometry), ...flips, ...raised, ...bored,
      ...rims.map(material => new THREE.Mesh(geometry, material)), ...elementalWarmupObjects(geometry)];
    warm.add(...shaderMeshes, ...meshes);
    resources.current = warm; warmed.current = null;
    return () => {
      resources.current = null; warm.clear(); geometry.dispose(); rgba.dispose();
      lines.forEach(line => line.geometry.dispose());
      // Elemental and tile-border materials are module-owned; only their carriers go.
      meshes.forEach(mesh => { if (mesh.isInstancedMesh) mesh.dispose(); });
      materials.forEach(material => material.dispose());
    };
  }, [pool]);

  // Runs after the body's frame, when instance colours/skin defines exist.
  // Loading the environment or changing the quality tier changes program keys;
  // warm that variant too and retain earlier variants for a return to the tier.
  useFrame(() => {
    if (!resources.current || !body.current) return;
    const s = useGameStore.getState();
    const key = [scene.environment?.uuid, scene.environment?.version, scene.fog ? (scene.fog.isFogExp2 ? 'exp2' : 'linear') : 'none',
      gl.shadowMap.enabled, gl.shadowMap.type, s.perfReducedFX, s.wormCharacter, s.wormSkin,
      gl.toneMapping, gl.outputColorSpace].join('|');
    if (warmed.current === key) return;
    // A fresh live Line starts without this define, including after a quality
    // change. Reset before each warm-up so that variant retains its first key.
    resources.current.traverse(object => {
      if (object.material?.isLineMaterial) delete object.material.defines.USE_LINE_COLOR_ALPHA;
    });
    gl.compile(resources.current, camera, scene);
    // three-stdlib LineMaterial adds USE_LINE_COLOR_ALPHA in onBeforeCompile,
    // after r159 computes its first cache key. Retain both the initial and
    // settled key so subsequent live Line mounts can reuse either program.
    gl.compile(resources.current, camera, scene);
    gl.compile(body.current, camera, scene);
    // An offering's first arrival used to link its whole dissolve set in one frame.
    // Best effort: the orb's sprites are canvas textures, and without a 2D canvas
    // the first spawn simply compiles them as it always did.
    try { warmOrbReveal(gl, camera, scene, ELEMENTAL_TYPES.flatMap(elementalOrbMaterials), prefersReducedMotion()); }
    catch { /* no 2D canvas */ }
    warmed.current = key;
    sceneWarmed.current = null;
  });

  // Pooled effects that already sit hidden in the scene (pad energy, burrows,
  // wormhole rings, combat rigs) compile on their first appearance otherwise.
  // Compile the live scene once per run and look, while the board is still
  // scrambling and a long frame cannot be felt; never in the middle of play.
  useFrame(() => {
    if (warmed.current === null) return;
    const s = useGameStore.getState();
    if (s.wormGamePhase !== 'scrambling') return;
    const key = `${warmed.current}|${s.wormRunId}|${s.size}`;
    if (sceneWarmed.current === key) return;
    sceneWarmed.current = key;
    gl.compile(scene, camera, scene);
  });

  // The caution fall dissolves every worm material (cautionDissolve.js); its
  // programs used to link in the frame the worm went over the edge. Warm them per
  // look before play starts (a look that changes mid-run waits for the next run),
  // only from a live crawling worm so a fall in progress is never patched.
  useFrame(() => {
    if (warmed.current === null || !body.current) return;
    const s = useGameStore.getState();
    if (fall.current.key === warmed.current || s.wormGamePhase === 'active' || !s.wormAlive || s.wormPhase !== 'crawling') return;
    fall.current.dispose?.();
    fall.current.dispose = warmCautionDissolve(gl, camera, scene, body.current);
    fall.current.key = warmed.current;
  });
  return null;
}
