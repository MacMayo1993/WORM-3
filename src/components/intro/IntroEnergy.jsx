import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { introEnergy, introMote } from './introEnergy.js';

// A bounded atmosphere: one point cloud and one instanced ring draw. No downloaded
// assets, physics, lights per particle, or per-frame geometry allocation.
export default function IntroEnergy({ time, reducedMotion, performanceMode }) {
  const motes = useRef();
  const rings = useRef();
  const light = useRef();
  const count = performanceMode ? 48 : 96;
  const data = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const pixels = new Uint8Array(16 * 16 * 4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = Math.hypot((x - 7.5) / 7.5, (y - 7.5) / 7.5);
      const i = (y * 16 + x) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
      pixels[i + 3] = Math.round(Math.max(0, 1 - r) ** 2 * 255);
    }
    const sprite = new THREE.DataTexture(pixels, 16, 16);
    sprite.magFilter = THREE.LinearFilter;
    sprite.needsUpdate = true;
    return { geometry, sprite, seeds: Array.from({ length: count }, (_, i) => introMote(i)), dummy: new THREE.Object3D() };
  }, [count]);
  useEffect(() => () => { data.geometry.dispose(); data.sprite.dispose(); }, [data]);
  useFrame(() => {
    const energy = introEnergy(time, reducedMotion);
    motes.current.visible = energy.dust > 0.001;
    rings.current.visible = energy.burst > 0.001;
    light.current.intensity = energy.charge * 1.8 + energy.burst * 2.4;
    motes.current.material.opacity = energy.dust * 0.62;
    const positions = data.geometry.attributes.position;
    data.seeds.forEach((seed, i) => {
      // Charge gathers near the cube; release throws motes into the surrounding
      // space, leaving a quiet depth field during the worms' traversal.
      const radius = 3.5 + (i % 7) * 0.35 + energy.release * 1.6 - energy.charge * 0.6;
      const angle = time * 0.08 + i * 0.1;
      const x = seed[0] * Math.cos(angle) - seed[2] * Math.sin(angle);
      const z = seed[0] * Math.sin(angle) + seed[2] * Math.cos(angle);
      positions.setXYZ(i, x * radius, seed[1] * radius, z * radius);
    });
    positions.needsUpdate = true;
    rings.current.material.opacity = energy.burst * 0.18;
    for (let i = 0; i < 3; i++) {
      const radius = 2.0 + energy.release * (3.2 + i * 0.5);
      data.dummy.position.set(0, 0, 0);
      data.dummy.rotation.set(i === 0 ? Math.PI / 2 : 0, i === 1 ? Math.PI / 2 : 0, 0);
      data.dummy.scale.setScalar(radius);
      data.dummy.updateMatrix();
      rings.current.setMatrixAt(i, data.dummy.matrix);
    }
    rings.current.instanceMatrix.needsUpdate = true;
  });
  return <group>
    <points ref={motes} geometry={data.geometry} frustumCulled={false}>
      <pointsMaterial map={data.sprite} alphaTest={0.01} color="#d5f4bd" size={performanceMode ? 0.07 : 0.055} transparent depthWrite={false} sizeAttenuation />
    </points>
    <instancedMesh ref={rings} args={[null, null, 3]} frustumCulled={false}>
      <torusGeometry args={[1, 0.006, 4, 64]} />
      <meshBasicMaterial color="#b7eecb" transparent depthWrite={false} toneMapped={false} />
    </instancedMesh>
    <pointLight ref={light} position={[0, 3, 4]} color="#b9e9da" distance={18} decay={2} />
  </group>;
}
