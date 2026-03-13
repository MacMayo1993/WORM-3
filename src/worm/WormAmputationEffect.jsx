// src/worm/WormAmputationEffect.jsx
// Particle disintegration effect for cut worm tail segments
// Each position spawns a cluster of particles that scatter and fade over ~0.8s

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLES_PER_SEGMENT = 8;
const EFFECT_DURATION = 0.8;

// Shared geometry across all effect instances
const _particleSphere = new THREE.SphereGeometry(0.09, 6, 6);
const _effectDummy = new THREE.Object3D();

/**
 * Single amputation effect for one batch of cut segments
 * @param {Array} positions - Array of [x, y, z] world positions for each cut segment
 * @param {string} color - Worm body color for particles
 * @param {Function} onDone - Called when animation completes so parent can remove it
 */
function AmputationBurst({ positions, color = '#00ff88', onDone }) {
  const meshRef = useRef();
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const totalParticles = positions.length * PARTICLES_PER_SEGMENT;

  // Stable random velocities per particle — generated once at mount
  const velocities = useMemo(() => {
    const vels = [];
    for (let s = 0; s < positions.length; s++) {
      for (let p = 0; p < PARTICLES_PER_SEGMENT; p++) {
        // Random outward scatter + slight upward drift bias
        vels.push({
          x: (Math.random() - 0.5) * 3.5,
          y: Math.random() * 1.5 + 0.2,
          z: (Math.random() - 0.5) * 3.5,
        });
      }
    }
    return vels;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    if (t >= EFFECT_DURATION) {
      doneRef.current = true;
      onDone?.();
      return;
    }

    // progress 0→1, fade out in second half
    const progress = t / EFFECT_DURATION;
    const alpha = Math.max(0, 1 - progress * 2.2);
    const scale = Math.max(0, 1 - progress * 1.5);

    for (let s = 0; s < positions.length; s++) {
      const origin = positions[s];
      for (let p = 0; p < PARTICLES_PER_SEGMENT; p++) {
        const idx = s * PARTICLES_PER_SEGMENT + p;
        const v = velocities[idx];

        _effectDummy.position.set(
          origin[0] + v.x * t,
          origin[1] + v.y * t,
          origin[2] + v.z * t
        );
        _effectDummy.scale.setScalar(scale * (0.6 + Math.random() * 0.4));
        _effectDummy.updateMatrix();
        mesh.setMatrixAt(idx, _effectDummy.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.material.opacity = alpha;
  });

  if (totalParticles === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[_particleSphere, null, totalParticles]}
      frustumCulled={false}
    >
      <meshBasicMaterial color={color} transparent opacity={1} />
    </instancedMesh>
  );
}

/**
 * Container that manages multiple concurrent amputation effects
 * @param {Array} effects - Array of {id, positions, color} objects
 * @param {Function} onEffectDone - Called with id when an effect finishes
 */
export default function WormAmputationEffects({ effects, onEffectDone }) {
  if (!effects || effects.length === 0) return null;

  return (
    <>
      {effects.map(effect => (
        <AmputationBurst
          key={effect.id}
          positions={effect.positions}
          color={effect.color || '#00ff88'}
          onDone={() => onEffectDone(effect.id)}
        />
      ))}
    </>
  );
}
