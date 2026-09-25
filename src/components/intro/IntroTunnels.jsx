import React, { useMemo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { tubeVertexShader, tubeFragmentShader } from '../../manifold/tunnelSurface.js';
import { PAIRS, FACES, pairPoint, flippedColor } from './introTopology.js';
import { sampleIntro } from './introChoreography.js';
import { introColor, tunnelGrowth } from './introMotion.js';

const RADIUS = 0.066;
const TUBULAR = 24, RADIAL = 6;
const INDICES_PER_SEGMENT = RADIAL * 6;

// Same centerline and energy shader as WormholeTunnel. Reuse fixed buffers for
// the 27-pair shot rather than rebuilding TubeGeometry every frame. Each tunnel
// shoots across from its portal in turn (a growing draw range, see tunnelGrowth)
// instead of all 27 appearing at once.
export default function IntroTunnels({ time, reducedMotion }) {
  const root = useRef();
  const assets = useMemo(() => {
    const materials = [0, 2, 4].map(() => new THREE.ShaderMaterial({
      vertexShader: tubeVertexShader, fragmentShader: tubeFragmentShader,
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uColor1: { value: new THREE.Color() }, uColor2: { value: new THREE.Color() },
        uTime: { value: 0 }, uPulse: { value: 1 }, uBurst: { value: 0 }, uDanger: { value: 0 }, uDead: { value: 0 } }
    }));
    const geometries = PAIRS.map(() => new THREE.TubeGeometry(
      new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 1)), TUBULAR, RADIUS, RADIAL, false));
    return { materials, geometries, a: new THREE.Vector3(), b: new THREE.Vector3(), tangent: new THREE.Vector3(),
      right: new THREE.Vector3(), up: new THREE.Vector3(), point: new THREE.Vector3() };
  }, []);
  useEffect(() => () => { assets.materials.forEach(m => m.dispose()); assets.geometries.forEach(g => g.dispose()); }, [assets]);
  useFrame(() => {
    const pose = sampleIntro(time, reducedMotion);
    root.current.visible = pose.passage > 0.001;
    if (!root.current.visible) return;
    assets.materials.forEach((m, i) => {
      m.uniforms.uColor1.value.set(introColor(flippedColor(i * 2, pose.flip)));
      m.uniforms.uColor2.value.set(introColor(flippedColor(i * 2 + 1, pose.flip)));
      m.uniforms.uTime.value = time;
      // Denser than in play: these tubes cross cream paper, not a dark sky.
      m.uniforms.uPulse.value = pose.passage * 1.5;
    });
    const { a, b, tangent, right, up, point } = assets;
    PAIRS.forEach((pair, index) => {
      const geometry = assets.geometries[index];
      const grown = Math.round(tunnelGrowth(index, time, reducedMotion) * TUBULAR);
      geometry.setDrawRange(0, grown * INDICES_PER_SEGMENT);
      if (grown === 0) return;
      const positions = geometry.attributes.position;
      for (let j = 0; j <= TUBULAR; j++) {
        const u = j / TUBULAR;
        pairPoint(pair, u, 1 + 1.5 * pose.open, a, 0.51, time);
        pairPoint(pair, u === 1 ? u - 0.001 : u + 0.001, 1 + 1.5 * pose.open, b, 0.51, time);
        tangent.subVectors(b, a).normalize().multiplyScalar(u === 1 ? -1 : 1);
        up.set(0, 1, 0); right.crossVectors(tangent, up);
        if (right.lengthSq() < 0.001) right.crossVectors(tangent, up.set(0, 0, 1));
        right.normalize(); up.crossVectors(right, tangent).normalize();
        for (let k = 0; k <= RADIAL; k++) {
          const angle = k / RADIAL * Math.PI * 2;
          point.copy(a).addScaledVector(right, Math.cos(angle) * RADIUS).addScaledVector(up, Math.sin(angle) * RADIUS);
          positions.setXYZ(j * (RADIAL + 1) + k, point.x, point.y, point.z);
        }
      }
      positions.needsUpdate = true;
    });
  });
  return <group ref={root}>{PAIRS.map((pair, i) => <mesh key={i} geometry={assets.geometries[i]}
    material={assets.materials[Math.floor(FACES.indexOf(pair.face) / 2)]} dispose={null} frustumCulled={false} renderOrder={2} />)}</group>;
}
