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

// Keep one owner of each transient program for this WORM session. Real portal
// materials still have private uniforms and their normal disposal; only the
// compiled programs are shared, so one tunnel cannot recolour another.
export default function WormEffectWarmup({ body }) {
  const { gl, camera, scene } = useThree();
  const pool = usePickupPool(), resources = useRef(null), warmed = useRef(null);
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
    const meshes = [...pickupWarmupMeshes(pool.warm, geometry), ...flips];
    warm.add(...shaderMeshes, ...meshes);
    resources.current = warm; warmed.current = null;
    return () => {
      resources.current = null; warm.clear(); geometry.dispose();
      lines.forEach(line => line.geometry.dispose());
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
    warmed.current = key;
  });
  return null;
}
