import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { wormBuffs } from '../wormBuffs.js';
import { wormSegments } from '../wormSegments.js';
import { elementalEnvelope } from './elementalLifecycle.js';
import { fusionLookOf, REACTION_PARTICLES } from './fusionLooks.js';
import { makeReactionField, stepReactionField } from './fusionParticles.js';
import { getFusionParticleMaterial } from './fusionParticleMaterial.js';

// A fused pair's reaction boiling off the cube: steam clouds for Steam, smoke from
// quenched obsidian, petals for Bloom, a blizzard for Cryostorm. Motion lives in
// fusionParticles.js; this uploads it and runs the shared envelope. One draw call,
// sized by the device's particle budget; reduced motion (a zero budget) mounts nothing.
export default function FusionParticles({ recipe, size, count }) {
  const look = fusionLookOf(recipe);
  const cfg = REACTION_PARTICLES[look?.particle] ?? REACTION_PARTICLES.steam;
  const pointsRef = useRef();
  const elapsed = useRef(0);
  const material = useMemo(() => (look ? getFusionParticleMaterial(recipe, look, cfg) : null), [recipe, look, cfg]);
  const { field, geometry } = useMemo(() => {
    const f = makeReactionField(count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(f.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(f.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(f.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aK', new THREE.BufferAttribute(f.k, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(f.seed, 1));
    return { field: f, geometry: geo };
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => { if (material) material.uniforms.uOpacity.value = 0; }, [material]);

  useFrame((state, delta) => {
    if (!material || !pointsRef.current) return;
    if (useGameStore.getState().wormPaused) return;
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;
    const env = elementalEnvelope({ elapsed: elapsed.current, remaining: wormBuffs.elementalT });
    stepReactionField(field, dt, { cfg, size, worm: wormSegments, emitting: env.accents || env.phase === 'claim', rand: Math.random });
    const attrs = geometry.attributes;
    attrs.position.needsUpdate = true;
    attrs.aAlpha.needsUpdate = true;
    attrs.aSize.needsUpdate = true;
    attrs.aK.needsUpdate = true;
    material.uniforms.uOpacity.value = cfg.opacity * env.intensity;
    material.uniforms.uTime.value = elapsed.current;
    material.uniforms.uScale.value = state.size.height * state.gl.getPixelRatio() / (2 * Math.tan(state.camera.fov * Math.PI / 360));
  });

  if (!material || count <= 0) return null;
  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false} raycast={() => null}>
      <primitive object={material} attach="material" />
    </points>
  );
}
